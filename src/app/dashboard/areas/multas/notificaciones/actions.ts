'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureNotificacionesJunaebTables } from '@/lib/multas/notificaciones-db-init'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import * as xlsx from 'xlsx'

export interface NotificacionRexItemDTO {
    id: string
    notificacionId: string
    folio: string
    rbd: number | null
    establecimiento: string | null
    sucursal: string | null
    fechaSupervision: string | null
    aspecto: string
    infraccionDetalle: string | null
    montoNotificado: number
    montoCalculado: number
    diferenciaMonto: number
    estadoConciliacion: 'COINCIDE' | 'DIFERENCIA_MONTO' | 'SOLO_JUNAEB' | 'NO_INCLUIDO' | 'FOLIO_REPETIDO' | 'PENDIENTE'
    clasificacionError: 'ERROR_JUNAEB' | 'ERROR_INTERNO' | 'EN_REVISION' | 'ACEPTADO' | null
    motivoClasificacion: string | null
    resolucionAnterior: string | null
    clasificadoPor: string | null
    clasificadoEn: string | null
}

export interface NotificacionRexCabDTO {
    id: string
    numeroResolucion: string
    fechaResolucion: string | null
    periodoMes: number
    periodoAnio: number
    licitacionId: number | null
    licitacionNombre: string | null
    nombreArchivo: string
    totalFilasNotif: number
    totalFoliosNotif: number
    montoTotalNotificado: number
    montoTotalCalculado: number
    montoTotalDiferencia: number
    estado: 'BORRADOR' | 'CONCILIADO' | 'EN_DESCARGO' | 'CERRADO'
    cargadoPor: string
    observaciones: string | null
    createdAt: string
    updatedAt: string
}

export interface ResumenEstadisticoConciliacion {
    totalItems: number
    coinciden: number
    diferenciasMonto: number
    soloJunaeb: number
    noIncluidos: number
    foliosRepetidos: number
    clasificados: number
    pendientesClasificar: number
    montoTotalNotificado: number
    montoTotalCalculado: number
    montoTotalDiferencia: number
}

// Utility para verificar permisos con lectura fresca de base de datos
async function checkNotificacionesPermission(perm: string | string[]): Promise<{ authorized: boolean; user: any }> {
    const session = await getSession()
    if (!session?.user?.id) return { authorized: false, user: null }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })
    if (!user || !user.role) return { authorized: false, user: null }

    const roleName = user.role.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    if (isAdmin) return { authorized: true, user }

    const permissions: string[] = Array.isArray(user.role.permissions)
        ? (user.role.permissions as string[])
        : typeof user.role.permissions === 'string'
            ? (() => { try { return JSON.parse(user.role.permissions) } catch { return [] } })()
            : []

    const targets = Array.isArray(perm) ? perm : [perm]
    const authorized = permissions.includes('*') || targets.some(p => permissions.includes(p))
    return { authorized, user }
}

/**
 * Obtiene el listado de resoluciones exentas (REX) registradas
 */
export async function getNotificacionesListAction(): Promise<{ success: boolean; data?: NotificacionRexCabDTO[]; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized } = await checkNotificacionesPermission(['view_notificaciones_junaeb', 'manage_notificaciones_junaeb'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar las notificaciones de JUNAEB.' }
        }

        const list = await prisma.multas_Notificacion_REX.findMany({
            orderBy: [
                { periodoAnio: 'desc' },
                { periodoMes: 'desc' },
                { createdAt: 'desc' }
            ]
        })

        return {
            success: true,
            data: list.map(r => ({
                id: r.id,
                numeroResolucion: r.numeroResolucion,
                fechaResolucion: r.fechaResolucion ? r.fechaResolucion.toISOString().split('T')[0] : null,
                periodoMes: r.periodoMes,
                periodoAnio: r.periodoAnio,
                licitacionId: r.licitacionId,
                licitacionNombre: r.licitacionNombre,
                nombreArchivo: r.nombreArchivo,
                totalFilasNotif: r.totalFilasNotif,
                totalFoliosNotif: r.totalFoliosNotif,
                montoTotalNotificado: r.montoTotalNotificado,
                montoTotalCalculado: r.montoTotalCalculado,
                montoTotalDiferencia: r.montoTotalDiferencia,
                estado: r.estado as any,
                cargadoPor: r.cargadoPor,
                observaciones: r.observaciones,
                createdAt: r.createdAt.toISOString(),
                updatedAt: r.updatedAt.toISOString()
            }))
        }
    } catch (e: any) {
        console.error('Error al obtener lista de notificaciones:', e)
        return { success: false, error: e.message || 'Error al obtener notificaciones.' }
    }
}

/**
 * Obtiene el detalle de una resolución REX, sus items y resumen de conciliación
 */
export async function getNotificacionDetalleAction(id: string): Promise<{
    success: boolean
    cabecera?: NotificacionRexCabDTO
    items?: NotificacionRexItemDTO[]
    resumen?: ResumenEstadisticoConciliacion
    error?: string
}> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized } = await checkNotificacionesPermission(['view_notificaciones_junaeb', 'manage_notificaciones_junaeb'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ver el detalle de la resolución.' }
        }

        const rex = await prisma.multas_Notificacion_REX.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: [
                        { folio: 'asc' },
                        { aspecto: 'asc' }
                    ]
                }
            }
        })

        if (!rex) {
            return { success: false, error: 'Resolución no encontrada.' }
        }

        const itemsDto: NotificacionRexItemDTO[] = rex.items.map(i => ({
            id: i.id,
            notificacionId: i.notificacionId,
            folio: i.folio,
            rbd: i.rbd,
            establecimiento: i.establecimiento,
            sucursal: i.sucursal,
            fechaSupervision: i.fechaSupervision ? i.fechaSupervision.toISOString().split('T')[0] : null,
            aspecto: i.aspecto,
            infraccionDetalle: i.infraccionDetalle,
            montoNotificado: i.montoNotificado,
            montoCalculado: i.montoCalculado,
            diferenciaMonto: i.diferenciaMonto,
            estadoConciliacion: i.estadoConciliacion as any,
            clasificacionError: i.clasificacionError as any,
            motivoClasificacion: i.motivoClasificacion,
            resolucionAnterior: i.resolucionAnterior,
            clasificadoPor: i.clasificadoPor,
            clasificadoEn: i.clasificadoEn ? i.clasificadoEn.toISOString() : null
        }))

        // Calcular resumen estadístico
        let coinciden = 0
        let diferenciasMonto = 0
        let soloJunaeb = 0
        let noIncluidos = 0
        let foliosRepetidos = 0
        let clasificados = 0

        for (const item of itemsDto) {
            if (item.estadoConciliacion === 'COINCIDE') coinciden++
            else if (item.estadoConciliacion === 'DIFERENCIA_MONTO') diferenciasMonto++
            else if (item.estadoConciliacion === 'SOLO_JUNAEB') soloJunaeb++
            else if (item.estadoConciliacion === 'NO_INCLUIDO') noIncluidos++
            else if (item.estadoConciliacion === 'FOLIO_REPETIDO') foliosRepetidos++

            if (item.clasificacionError) clasificados++
        }

        const resumen: ResumenEstadisticoConciliacion = {
            totalItems: itemsDto.length,
            coinciden,
            diferenciasMonto,
            soloJunaeb,
            noIncluidos,
            foliosRepetidos,
            clasificados,
            pendientesClasificar: itemsDto.length - coinciden - clasificados,
            montoTotalNotificado: rex.montoTotalNotificado,
            montoTotalCalculado: rex.montoTotalCalculado,
            montoTotalDiferencia: rex.montoTotalDiferencia
        }

        const cabeceraDto: NotificacionRexCabDTO = {
            id: rex.id,
            numeroResolucion: rex.numeroResolucion,
            fechaResolucion: rex.fechaResolucion ? rex.fechaResolucion.toISOString().split('T')[0] : null,
            periodoMes: rex.periodoMes,
            periodoAnio: rex.periodoAnio,
            licitacionId: rex.licitacionId,
            licitacionNombre: rex.licitacionNombre,
            nombreArchivo: rex.nombreArchivo,
            totalFilasNotif: rex.totalFilasNotif,
            totalFoliosNotif: rex.totalFoliosNotif,
            montoTotalNotificado: rex.montoTotalNotificado,
            montoTotalCalculado: rex.montoTotalCalculado,
            montoTotalDiferencia: rex.montoTotalDiferencia,
            estado: rex.estado as any,
            cargadoPor: rex.cargadoPor,
            observaciones: rex.observaciones,
            createdAt: rex.createdAt.toISOString(),
            updatedAt: rex.updatedAt.toISOString()
        }

        return {
            success: true,
            cabecera: cabeceraDto,
            items: itemsDto,
            resumen
        }
    } catch (e: any) {
        console.error('Error al obtener detalle de resolución:', e)
        return { success: false, error: e.message || 'Error al obtener detalle.' }
    }
}

/**
 * Carga una nueva resolución REX a partir del archivo Excel del Anexo 1
 */
export async function cargarNotificacionRexAction(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para cargar resoluciones REX de JUNAEB.' }
        }

        const file = formData.get('file') as File | null
        const numeroResolucion = (formData.get('numeroResolucion') as string || '').trim()
        const fechaResolucionStr = (formData.get('fechaResolucion') as string || '').trim()
        const periodoMes = parseInt(formData.get('periodoMes') as string || '0', 10)
        const periodoAnio = parseInt(formData.get('periodoAnio') as string || '0', 10)
        const licitacionIdStr = formData.get('licitacionId') as string || ''
        const licitacionId = licitacionIdStr ? parseInt(licitacionIdStr, 10) : null
        const licitacionNombre = (formData.get('licitacionNombre') as string || '').trim() || null
        const observaciones = (formData.get('observaciones') as string || '').trim() || null

        if (!file || file.size === 0) {
            return { success: false, error: 'Debes seleccionar un archivo Excel válido.' }
        }
        if (!numeroResolucion) {
            return { success: false, error: 'El número de resolución es obligatorio.' }
        }
        if (periodoMes < 1 || periodoMes > 12 || periodoAnio < 2020 || periodoAnio > 2035) {
            return { success: false, error: 'El período (mes y año) ingresado no es válido.' }
        }

        // Leer archivo Excel
        const arrayBuffer = await file.arrayBuffer()
        const workbook = xlsx.read(Buffer.from(arrayBuffer), { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
            return { success: false, error: 'El archivo Excel no contiene ninguna hoja.' }
        }

        const sheet = workbook.Sheets[sheetName]
        const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' })
        if (rows.length === 0) {
            return { success: false, error: 'La hoja seleccionada está vacía.' }
        }

        // Mapeo flexible de columnas
        const itemsToInsert: Array<{
            folio: string
            rbd: number | null
            establecimiento: string | null
            sucursal: string | null
            fechaSupervision: Date | null
            aspecto: string
            infraccionDetalle: string | null
            montoNotificado: number
        }> = []

        const foliosSet = new Set<string>()
        let totalMontoNotificado = 0

        for (const row of rows) {
            // Buscar columna de folio
            const folioVal = findRowValue(row, ['folio', 'n° acta', 'acta', 'nro acta', 'nro_acta', 'folio_acta', 'folio acta', 'n° de acta'])
            if (!folioVal) continue

            const folio = String(folioVal).trim().replace(/^['"\s]+|['"\s]+$/g, '')
            if (!folio) continue

            // Aspecto / Letra
            const aspectoVal = findRowValue(row, ['aspecto', 'letra', 'item', 'código aspecto', 'codigo_aspecto', 'letra aspecto', 'aspecto ee', 'aspecto_ee']) || 'GENERAL'
            const aspecto = String(aspectoVal).trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'A'

            // Monto Notificado (UTM)
            const montoVal = findRowValue(row, ['monto', 'utm', 'monto utm', 'monto_utm', 'multa utm', 'total utm', 'monto notificado', 'monto sancion', 'sancion utm'])
            let montoNotificado = 0
            if (montoVal !== undefined && montoVal !== null && montoVal !== '') {
                const parsedMonto = typeof montoVal === 'number' ? montoVal : parseFloat(String(montoVal).replace(/\./g, '').replace(',', '.'))
                if (!isNaN(parsedMonto)) {
                    montoNotificado = Math.round(parsedMonto * 1000) / 1000
                }
            }

            // RBD
            const rbdVal = findRowValue(row, ['rbd', 'cod rbd', 'colegio rbd', 'rbd colegio', 'codigo rbd'])
            const rbdNum = rbdVal ? parseInt(String(rbdVal).replace(/\D/g, ''), 10) : null
            const rbd = rbdNum && !isNaN(rbdNum) ? rbdNum : null

            // Establecimiento
            const estabVal = findRowValue(row, ['establecimiento', 'nombre establecimiento', 'colegio', 'escuela', 'nombre colegio'])
            const establecimiento = estabVal ? String(estabVal).trim() : null

            // Sucursal
            const sucursalVal = findRowValue(row, ['sucursal', 'sede', 'cd', 'zona'])
            const sucursal = sucursalVal ? String(sucursalVal).trim() : null

            // Fecha Supervisión
            const fechaVal = findRowValue(row, ['fecha', 'fecha supervisión', 'fecha_supervision', 'fecha visita', 'fecha acta'])
            let fechaSupervision: Date | null = null
            if (fechaVal) {
                const parsedDate = parseExcelDate(fechaVal)
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    fechaSupervision = parsedDate
                }
            }

            // Infracción / Detalle
            const infraccionVal = findRowValue(row, ['infraccion', 'descripcion', 'detalle', 'observacion', 'motivo', 'hecho imputado'])
            const infraccionDetalle = infraccionVal ? String(infraccionVal).trim() : null

            itemsToInsert.push({
                folio,
                rbd,
                establecimiento,
                sucursal,
                fechaSupervision,
                aspecto,
                infraccionDetalle,
                montoNotificado
            })

            foliosSet.add(folio)
            totalMontoNotificado += montoNotificado
        }

        if (itemsToInsert.length === 0) {
            return { success: false, error: 'No se encontraron filas con número de folio válido en el archivo Excel.' }
        }

        // Crear registro en base de datos
        const fechaResolucion = fechaResolucionStr ? new Date(fechaResolucionStr) : null
        const userName = user.name || user.username || 'Usuario'

        const createdRex = await prisma.multas_Notificacion_REX.create({
            data: {
                numeroResolucion,
                fechaResolucion,
                periodoMes,
                periodoAnio,
                licitacionId,
                licitacionNombre,
                nombreArchivo: file.name,
                totalFilasNotif: itemsToInsert.length,
                totalFoliosNotif: foliosSet.size,
                montoTotalNotificado: Math.round(totalMontoNotificado * 1000) / 1000,
                estado: 'BORRADOR',
                cargadoPor: userName,
                observaciones,
                items: {
                    create: itemsToInsert.map(i => ({
                        folio: i.folio,
                        rbd: i.rbd,
                        establecimiento: i.establecimiento,
                        sucursal: i.sucursal,
                        fechaSupervision: i.fechaSupervision,
                        aspecto: i.aspecto,
                        infraccionDetalle: i.infraccionDetalle,
                        montoNotificado: i.montoNotificado,
                        montoCalculado: 0.0,
                        diferenciaMonto: i.montoNotificado,
                        estadoConciliacion: 'PENDIENTE'
                    }))
                }
            }
        })

        // Registrar auditoría
        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CARGA_NOTIFICACION_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Carga de REX N° ${numeroResolucion}: ${itemsToInsert.length} filas, ${foliosSet.size} folios, total ${totalMontoNotificado.toFixed(2)} UTM.`
        })

        revalidatePath('/dashboard/areas/multas/notificaciones')
        return { success: true, id: createdRex.id }
    } catch (e: any) {
        console.error('Error al cargar REX:', e)
        if (e.code === 'P2002') {
            return { success: false, error: 'Ya existe una resolución registrada con ese mismo número y licitación.' }
        }
        return { success: false, error: e.message || 'Error al procesar el archivo Excel.' }
    }
}

/**
 * Ejecuta la conciliación automática entre la REX cargada y los cálculos internos
 */
export async function conciliarNotificacionRexAction(notificacionId: string): Promise<{ success: boolean; resumen?: ResumenEstadisticoConciliacion; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ejecutar la conciliación de la resolución.' }
        }

        const rex = await prisma.multas_Notificacion_REX.findUnique({
            where: { id: notificacionId },
            include: { items: true }
        })
        if (!rex) {
            return { success: false, error: 'Resolución no encontrada.' }
        }

        const items = rex.items
        const foliosNotif = Array.from(new Set(items.map(i => i.folio)))

        // 1. Consultar cálculos internos en Multas_Elementos_Esenciales
        const cabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where: { folioOriginal: { in: foliosNotif } },
            include: { detalles: true }
        })

        // Mapa de cálculo interno: folio -> aspecto -> montoMulta
        const calcMap = new Map<string, Map<string, number>>()
        for (const cab of cabs) {
            const aspMap = new Map<string, number>()
            for (const det of cab.detalles) {
                const letra = (det.letraAspecto || '').toUpperCase().trim()
                aspMap.set(letra, det.montoMulta || 0)
            }
            calcMap.set(cab.folioOriginal, aspMap)
        }

        // 2. Buscar si los folios/aspectos ya fueron imputados en resoluciones anteriores
        const prevItems = await prisma.multas_Notificacion_Item.findMany({
            where: {
                folio: { in: foliosNotif },
                notificacionId: { not: notificacionId }
            },
            include: {
                notificacion: {
                    select: { numeroResolucion: true }
                }
            }
        })

        const prevMap = new Map<string, string>() // key: `${folio}_${aspecto}` -> numeroResolucion
        for (const pi of prevItems) {
            const key = `${pi.folio}_${pi.aspecto.toUpperCase()}`
            if (!prevMap.has(key)) {
                prevMap.set(key, pi.notificacion.numeroResolucion)
            }
        }

        // 3. Procesar y actualizar cada item de la notificación
        let montoTotalCalculado = 0
        const notifiedKeys = new Set<string>()

        for (const item of items) {
            const aspUpper = item.aspecto.toUpperCase()
            const key = `${item.folio}_${aspUpper}`
            notifiedKeys.add(key)

            const aspMap = calcMap.get(item.folio)
            const montoCalculado = aspMap && aspMap.has(aspUpper) ? aspMap.get(aspUpper)! : 0
            const diff = Math.round((item.montoNotificado - montoCalculado) * 1000) / 1000

            let estadoConciliacion: 'COINCIDE' | 'DIFERENCIA_MONTO' | 'SOLO_JUNAEB' | 'FOLIO_REPETIDO' = 'COINCIDE'
            let resolucionAnterior: string | null = null

            if (prevMap.has(key)) {
                estadoConciliacion = 'FOLIO_REPETIDO'
                resolucionAnterior = prevMap.get(key)!
            } else if (!aspMap || !aspMap.has(aspUpper) || (montoCalculado === 0 && item.montoNotificado > 0)) {
                estadoConciliacion = 'SOLO_JUNAEB'
            } else if (Math.abs(diff) < 0.005) {
                estadoConciliacion = 'COINCIDE'
            } else {
                estadoConciliacion = 'DIFERENCIA_MONTO'
            }

            montoTotalCalculado += montoCalculado

            await prisma.multas_Notificacion_Item.update({
                where: { id: item.id },
                data: {
                    montoCalculado,
                    diferenciaMonto: diff,
                    estadoConciliacion,
                    resolucionAnterior
                }
            })
        }

        // 4. Identificar actas del mismo período calculadas en Hendaya pero OMITIDAS por JUNAEB ('NO_INCLUIDO')
        // Buscar actas del mes/año especificado
        const startOfMonth = new Date(rex.periodoAnio, rex.periodoMes - 1, 1)
        const endOfMonth = new Date(rex.periodoAnio, rex.periodoMes, 0, 23, 59, 59)

        const omittedCabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where: {
                fechaSupervision: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                ...(rex.licitacionNombre ? { licitacion: { contains: rex.licitacionNombre, mode: 'insensitive' } } : {})
            },
            include: { detalles: true }
        })

        // Eliminar antiguos 'NO_INCLUIDO' de esta conciliación previa si existían
        await prisma.multas_Notificacion_Item.deleteMany({
            where: {
                notificacionId,
                estadoConciliacion: 'NO_INCLUIDO'
            }
        })

        const omittedItemsToCreate = []
        for (const oc of omittedCabs) {
            for (const od of oc.detalles) {
                const letra = (od.letraAspecto || '').toUpperCase().trim()
                const key = `${oc.folioOriginal}_${letra}`
                if (od.montoMulta > 0 && !notifiedKeys.has(key)) {
                    omittedItemsToCreate.push({
                        notificacionId,
                        folio: oc.folioOriginal,
                        rbd: oc.rbd,
                        fechaSupervision: oc.fechaSupervision,
                        aspecto: letra,
                        infraccionDetalle: od.descripcion || `Infracción aspecto ${letra} calculada internamente no notificada por JUNAEB`,
                        montoNotificado: 0.0,
                        montoCalculado: od.montoMulta,
                        diferenciaMonto: -od.montoMulta,
                        estadoConciliacion: 'NO_INCLUIDO',
                        clasificacionError: 'ERROR_JUNAEB',
                        motivoClasificacion: 'Infracción no consignada en Anexo 1 por JUNAEB'
                    })
                    montoTotalCalculado += od.montoMulta
                }
            }
        }

        if (omittedItemsToCreate.length > 0) {
            await prisma.multas_Notificacion_Item.createMany({
                data: omittedItemsToCreate
            })
        }

        // 5. Actualizar totales y estado de la resolución
        const totalItemsCount = items.length + omittedItemsToCreate.length
        const totalDiff = Math.round((rex.montoTotalNotificado - montoTotalCalculado) * 1000) / 1000

        await prisma.multas_Notificacion_REX.update({
            where: { id: notificacionId },
            data: {
                montoTotalCalculado: Math.round(montoTotalCalculado * 1000) / 1000,
                montoTotalDiferencia: totalDiff,
                totalFilasNotif: totalItemsCount,
                estado: 'CONCILIADO'
            }
        })

        const userName = user.name || user.username || 'Usuario'
        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CONCILIACION_NOTIFICACION_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Conciliación ejecutada para REX N° ${rex.numeroResolucion}: ${totalItemsCount} items evaluados. Total Notificado: ${rex.montoTotalNotificado} UTM vs Calculado: ${montoTotalCalculado.toFixed(2)} UTM.`
        })

        revalidatePath(`/dashboard/areas/multas/notificaciones/${notificacionId}`)
        revalidatePath('/dashboard/areas/multas/notificaciones')

        const freshDetalle = await getNotificacionDetalleAction(notificacionId)
        return { success: true, resumen: freshDetalle.resumen }
    } catch (e: any) {
        console.error('Error al conciliar REX:', e)
        return { success: false, error: e.message || 'Error al ejecutar conciliación.' }
    }
}

/**
 * Clasifica una discrepancia asignando 'ERROR_JUNAEB' o 'ERROR_INTERNO' con motivo obligatorio
 */
export async function updateClasificacionItemAction(params: {
    itemId: string
    clasificacionError: 'ERROR_JUNAEB' | 'ERROR_INTERNO' | 'EN_REVISION' | 'ACEPTADO'
    motivoClasificacion: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para clasificar discrepancias.' }
        }

        const { itemId, clasificacionError, motivoClasificacion } = params
        if (!itemId) {
            return { success: false, error: 'ID de item no proporcionado.' }
        }
        if (!motivoClasificacion || motivoClasificacion.trim().length < 5) {
            return { success: false, error: 'Debes proporcionar un motivo detallado (mínimo 5 caracteres).' }
        }

        const userName = user.name || user.username || 'Usuario'

        const updated = await prisma.multas_Notificacion_Item.update({
            where: { id: itemId },
            data: {
                clasificacionError,
                motivoClasificacion: motivoClasificacion.trim(),
                clasificadoPor: userName,
                clasificadoEn: new Date()
            }
        })

        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CLASIFICAR_DIFERENCIA_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Item Folio ${updated.folio} Aspecto ${updated.aspecto} clasificado como '${clasificacionError}': ${motivoClasificacion.trim()}`
        })

        revalidatePath(`/dashboard/areas/multas/notificaciones/${updated.notificacionId}`)
        return { success: true }
    } catch (e: any) {
        console.error('Error al clasificar item:', e)
        return { success: false, error: e.message || 'Error al clasificar la discrepancia.' }
    }
}

/**
 * Elimina una resolución REX y todos sus items asociados
 */
export async function eliminarNotificacionRexAction(notificacionId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para eliminar resoluciones REX.' }
        }

        const rex = await prisma.multas_Notificacion_REX.findUnique({
            where: { id: notificacionId }
        })
        if (!rex) {
            return { success: false, error: 'Resolución no encontrada.' }
        }

        await prisma.multas_Notificacion_REX.delete({
            where: { id: notificacionId }
        })

        const userName = user.name || user.username || 'Usuario'
        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'ELIMINAR_NOTIFICACION_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Eliminación de REX N° ${rex.numeroResolucion} (${rex.nombreArchivo})`
        })

        revalidatePath('/dashboard/areas/multas/notificaciones')
        return { success: true }
    } catch (e: any) {
        console.error('Error al eliminar REX:', e)
        return { success: false, error: e.message || 'Error al eliminar la resolución.' }
    }
}

// Helper: búsqueda case-insensitive y flexible en filas de Excel
function findRowValue(row: any, possibleKeys: string[]): any {
    const keys = Object.keys(row)
    for (const target of possibleKeys) {
        const found = keys.find(k => {
            const cleanKey = k.toLowerCase().replace(/[\s_\-]/g, '')
            const cleanTarget = target.toLowerCase().replace(/[\s_\-]/g, '')
            return cleanKey === cleanTarget || cleanKey.includes(cleanTarget)
        })
        if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
            return row[found]
        }
    }
    return undefined
}

// Helper: parseo de fechas de Excel (número de serie o string)
function parseExcelDate(val: any): Date | null {
    if (val instanceof Date) return val
    if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000))
    }
    if (typeof val === 'string') {
        const parts = val.trim().split(/[-/]/)
        if (parts.length === 3) {
            // Caso DD/MM/YYYY o YYYY/MM/DD
            if (parts[0].length === 4) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
            } else {
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
            }
        }
        const d = new Date(val)
        return !isNaN(d.getTime()) ? d : null
    }
    return null
}
