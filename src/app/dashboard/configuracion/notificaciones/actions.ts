'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ensureNotificationConditionalColumns } from '@/lib/notifications-db-init'

export interface ListaAsignadaConfig {
    listaCorreoId: string
    condicionTag?: string | null
    condicionOperador?: string | null
    condicionValor?: string | null
}

export async function getPantallasConfig() {
    await ensureNotificationConditionalColumns()
    try {
        const results: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT np.id, np."codigoPantalla", np."listaCorreoId", np.activa,
                   np."condicionTag", np."condicionOperador", np."condicionValor",
                   lc.id as "lc_id", lc.nombre as "lc_nombre", lc.para as "lc_para", lc.cc as "lc_cc",
                   lc."porSucursal" as "lc_porSucursal"
            FROM "NotificacionPantalla" np
            JOIN "ListaCorreo" lc ON lc.id = np."listaCorreoId"
            ORDER BY np."createdAt" ASC;
        `)

        return results.map(r => ({
            id: r.id,
            codigoPantalla: r.codigoPantalla,
            listaCorreoId: r.listaCorreoId,
            activa: r.activa,
            condicionTag: r.condicionTag || null,
            condicionOperador: r.condicionOperador || 'ALWAYS',
            condicionValor: r.condicionValor || null,
            listaCorreo: {
                id: r.lc_id,
                nombre: r.lc_nombre,
                para: r.lc_para,
                cc: r.lc_cc,
                porSucursal: r.lc_porSucursal
            }
        }))
    } catch (error) {
        console.error('Error fetching pantallas config:', error)
        return []
    }
}

export async function getPlantillasConfig() {
    try {
        return await prisma.plantillaCorreo.findMany()
    } catch (error) {
        return []
    }
}

export async function getListasCorreo() {
    await ensureNotificationConditionalColumns()
    try {
        const results: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT lc.id, lc.nombre, lc.descripcion, lc.para, lc.cc, lc."porSucursal",
                   s.id as "suc_id", s.nombre as "suc_nombre"
            FROM "ListaCorreo" lc
            LEFT JOIN "Sucursal" s ON s.id = lc."sucursalId"
            ORDER BY lc.nombre ASC;
        `)
        return results.map(r => ({
            id: r.id,
            nombre: r.nombre,
            descripcion: r.descripcion,
            para: r.para,
            cc: r.cc,
            porSucursal: r.porSucursal,
            sucursal: r.suc_id ? { id: r.suc_id, nombre: r.suc_nombre } : null
        }))
    } catch (error) {
        console.error('Error fetching listas:', error)
        return []
    }
}

export async function saveScreenNotification(
    codigoPantalla: string,
    listas: (string | ListaAsignadaConfig)[],
    activa: boolean
) {
    await ensureNotificationConditionalColumns()
    try {
        const assignments: ListaAsignadaConfig[] = listas.map(l => {
            if (typeof l === 'string') {
                return { listaCorreoId: l, condicionTag: null, condicionOperador: 'ALWAYS', condicionValor: null }
            }
            return l
        })

        const targetIds = assignments.map(a => a.listaCorreoId)

        if (targetIds.length > 0) {
            await rawPrisma.$executeRawUnsafe(`
                DELETE FROM "NotificacionPantalla"
                WHERE "codigoPantalla" = $1 AND "listaCorreoId" != ALL($2::text[]);
            `, codigoPantalla, targetIds)
        } else {
            await rawPrisma.$executeRawUnsafe(`
                DELETE FROM "NotificacionPantalla"
                WHERE "codigoPantalla" = $1;
            `, codigoPantalla)
        }

        for (const item of assignments) {
            const cleanTag = item.condicionTag ? item.condicionTag.replace(/[<>]/g, '').trim() : null
            const cleanOp = item.condicionOperador || 'ALWAYS'
            const cleanVal = item.condicionValor ? item.condicionValor.trim() : null

            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "NotificacionPantalla" (
                    id, "codigoPantalla", "listaCorreoId", activa,
                    "condicionTag", "condicionOperador", "condicionValor",
                    "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT ("codigoPantalla", "listaCorreoId")
                DO UPDATE SET
                    activa = EXCLUDED.activa,
                    "condicionTag" = EXCLUDED."condicionTag",
                    "condicionOperador" = EXCLUDED."condicionOperador",
                    "condicionValor" = EXCLUDED."condicionValor",
                    "updatedAt" = CURRENT_TIMESTAMP;
            `, codigoPantalla, item.listaCorreoId, activa, cleanTag, cleanOp, cleanVal)
        }

        revalidatePath('/dashboard/configuracion/notificaciones')
        return { success: true }
    } catch (error: any) {
        console.error('Error saving notification config:', error)
        return { success: false, error: error?.message || 'Hubo un error al guardar o verificar las listas.' }
    }
}

export async function savePlantillaCorreo(codigoPantalla: string, asunto: string, cuerpo: string) {
    try {
        await prisma.plantillaCorreo.upsert({
            where: { codigoPantalla },
            update: { asunto, cuerpo },
            create: { codigoPantalla, asunto, cuerpo }
        })
        revalidatePath('/dashboard/configuracion/notificaciones')
        return { success: true }
    } catch (error) {
        console.error('Error saving template:', error)
        return { success: false, error: 'Error al grabar plantilla de correo.' }
    }
}
export async function getMockDataForPreview(codigoPantalla: string) {
    const mockData: Record<string, any> = {
        'retiro-saldos': {
            Folio: '0000000088',
            Tipo: 'Retiro de saldo',
            RBD: '1234',
            Establecimiento: 'COLEGIO DE PRUEBA HENDAYA',
            UT: '5',
            Sucursal: 'SANTIAGO SUR',
            Supervisor: 'JUAN PÉREZ',
            NombreAutoriza: 'MARÍA GONZÁLEZ',
            RUTAutoriza: '12.345.678-9',
            Usuario: 'JUAN PÉREZ (ADMIN)',
            DetalleProductos: '- [001] PRODUCTO A: 10\n- [002] PRODUCTO B: 5'
        },
        'solicitud-pan': {
            Folio: 'PAN-2024-0015',
            RBD: '5678',
            Establecimiento: 'ESCUELA DE TALCA',
            Usuario: 'PEDRO RIVAS'
        },
        'ingreso-raciones': {
            RBD: '9012',
            Establecimiento: 'LICEO INDUSTRIAL',
            Usuario: 'ANA LÓPEZ'
        },
        'solicitud-gas': {
            RBD: '8532',
            Establecimiento: 'COLEGIO SAN JOSÉ',
            Usuario: 'CARLOS RIVERA',
            Sucursal: 'SANTIAGO NORTE',
            TipoGas: 'Bombona',
            CantidadLitros: '450.00',
            Distribuidor: 'ABASTIBLE',
            Observacion: 'Solicitud urgente para el casino.'
        },
        'solicitud-gas-exceso': {
            RBD: '7654',
            Establecimiento: 'ESCUELA RURAL EL SAUCE',
            Usuario: 'RODRIGO PAZ',
            Sucursal: 'SANTIAGO PONIENTE',
            TipoGas: 'Cilindro',
            CantidadLitros: '120.00',
            LimiteMensual: '500 Lts',
            AcumuladoActual: '420.00 Lts',
            IntentoActual: '120.00 Lts',
            MotivoBloqueo: 'El máximo de litros acumulados (500) sería superado con este pedido (540.00).'
        },
        'form-submission-pdf': {
            Formulario: 'CONTROL DE TEMPERATURA CASINO',
            Usuario: 'RICARDO LAGOS',
            FechaSometido: '2024-03-25 12:45',
            UT: '1303',
            RBD: '8532',
            Sucursal: 'METROPOLITANA'
        },
        'RETORNO_PRODUCTOS': {
            Titulo: 'BÚSQUEDA LOTE HARINA VENCIDA',
            Observacion: 'Se solicita retirar el lote #456 de harina marca X por posible contaminación.',
            Horas: '24',
            Usuario: 'ELISA CASTILLO',
            Sucursal: 'COPIAPÓ',
            Comentario: 'Se revisó la bodega y no se encontró el producto solicitado.'
        },
        'matriz-prestador': {
            RBD: '4567',
            Colegio: 'COLEGIO DE PRUEBA PRESTADOR',
            Usuario: 'JUAN PÉREZ (SUPERVISOR)',
            Sucursal: 'SANTIAGO CENTRO',
            DetalleDesviaciones: `1. Patio de servicio: ¿El basurero cuenta con tapa? -> Respuesta: No. Compromiso: Adquirir tapa o basurero nuevo.\n2. Bodega: ¿La bodega está libre de plagas? -> Respuesta: No. Compromiso: Coordinar desratización.`
        },
        'calidad-transporte-higiene': {
            Fecha: '15/09/2026',
            FechaInspeccion: '15/09/2026',
            Sucursal: 'SANTIAGO SUR',
            UsuarioCalidad: 'PAMELA FERNÁNDEZ',
            Usuario: 'PAMELA FERNÁNDEZ',
            TotalVehiculos: '5',
            TotalTransportes: '5',
            Desviaciones: 'FLSX83: Limpieza Exterior (No Cumple) - Lavado urgente solicitado',
            DiasAtraso: '0',
            ObservacionesGenerales: 'Sin novedades adicionales durante el turno.'
        },
        'calidad-higiene-personal': {
            Fecha: '15/09/2026',
            FechaInspeccion: '15/09/2026',
            Sucursal: 'SANTIAGO SUR',
            UsuarioCalidad: 'PAMELA FERNÁNDEZ',
            Usuario: 'PAMELA FERNÁNDEZ',
            TotalTrabajadores: '8',
            TotalPersonas: '8',
            TotalTransportistas: '8',
            Desviaciones: 'Juan Pérez: Uñas Cortas (No Cumple) - Se instruye corte inmediato',
            DiasAtraso: '0',
            ObservacionesGenerales: 'Todos los transportistas evaluados al inicio de la jornada.'
        },
        'cambio-rbd-personal': {
            Rut: '15.421.983-4',
            Nombre: 'MARÍA TERESA LÓPEZ CASTRO',
            RbdOrigen: '10253',
            ColegioOrigen: 'LICEO INDUSTRIAL DE SANTIAGO',
            SucursalOrigen: 'SANTIAGO SUR',
            RbdDestino: '10420',
            ColegioDestino: 'ESCUELA BÁSICA REPÚBLICA DE FRANCIA',
            TipoCambio: 'Comisión de servicio',
            FechaDesde: '20/10/2026',
            FechaHasta: '30/11/2026',
            Supervisor: 'CARLOS VALENZUELA',
            Usuario: 'ELISA CASTILLO'
        }
    }
    return mockData[codigoPantalla] || {}
}
