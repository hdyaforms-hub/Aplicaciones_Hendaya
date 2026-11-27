'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureCalidadC8Tables } from '@/lib/calidad/calidad-c8-db-init'
import { ensureReclamosProveedoresTables } from '@/lib/calidad/reclamos-proveedores-db-init'

export interface MotivoC8 {
    id: string
    codigo: string
    nombre: string
    descripcion: string | null
    licitacion: string
    activo: boolean
    creadoPor: string
    actualizadoPor: string | null
    createdAt: string
    updatedAt: string
}

async function verifyManagePermission(): Promise<{ usuario: string; isAdmin: boolean }> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado: Sesión expirada')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canManage = isAdmin || perms.includes('manage_calidad_registros_globales')

    if (!canManage) {
        throw new Error('No tiene permisos para modificar Registros Globales de Calidad')
    }

    const usuario = session.user.name || session.user.username || session.user.email || 'Usuario'
    return { usuario, isAdmin }
}

export async function obtenerMotivosC8Action(licitacion?: string): Promise<{ success: boolean; data?: MotivoC8[]; error?: string }> {
    try {
        await ensureCalidadC8Tables()
        let query = `
            SELECT 
                "id", "codigo", "nombre", "descripcion", COALESCE("licitacion", 'TODAS') as "licitacion", "activo", 
                "creadoPor", "actualizadoPor",
                "createdAt"::text as "createdAt",
                "updatedAt"::text as "updatedAt"
            FROM "Calidad_Motivo_C8"
        `
        const params: any[] = []
        if (licitacion && licitacion !== 'TODAS') {
            query += ` WHERE ("licitacion" = $1 OR "licitacion" = 'TODAS') `
            params.push(licitacion)
        }
        query += ` ORDER BY "codigo" ASC;`
        const rows = await rawPrisma.$queryRawUnsafe<any[]>(query, ...params)

        const data: MotivoC8[] = rows.map(r => ({
            id: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
            descripcion: r.descripcion,
            licitacion: r.licitacion || 'TODAS',
            activo: Boolean(r.activo),
            creadoPor: r.creadoPor,
            actualizadoPor: r.actualizadoPor,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al obtener Motivos C8:', error)
        return { success: false, error: error.message || 'Error al obtener registros' }
    }
}

export async function guardarMotivoC8Action(data: {
    id?: string
    codigo: string
    nombre: string
    descripcion?: string
    licitacion?: string
    activo?: boolean
}): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureCalidadC8Tables()

        const codigo = data.codigo.trim().toUpperCase()
        const nombre = data.nombre.trim()
        const descripcion = data.descripcion?.trim() || null
        const licitacion = (data.licitacion || 'TODAS').trim()
        const activo = data.activo ?? true

        if (!codigo) throw new Error('El código del motivo es obligatorio')
        if (!nombre) throw new Error('El nombre del motivo es obligatorio')
        if (!licitacion) throw new Error('La licitación asociada es obligatoria')

        if (data.id) {
            // Edición
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Calidad_Motivo_C8"
                SET 
                    "codigo" = $1,
                    "nombre" = $2,
                    "descripcion" = $3,
                    "licitacion" = $4,
                    "activo" = $5,
                    "actualizadoPor" = $6,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $7;
            `, codigo, nombre, descripcion, licitacion, activo, usuario, data.id)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Calidad',
                action: 'EDICION',
                detalle: `Editó Motivo C8: ${codigo} - ${nombre} (Licitación: ${licitacion})`
            })

            return { success: true, id: data.id }
        } else {
            // Creación
            const id = crypto.randomUUID()
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Calidad_Motivo_C8" (
                    "id", "codigo", "nombre", "descripcion", "licitacion", "activo", "creadoPor"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7);
            `, id, codigo, nombre, descripcion, licitacion, activo, usuario)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Calidad',
                action: 'CREACION',
                detalle: `Creó Motivo C8: ${codigo} - ${nombre} (Licitación: ${licitacion})`
            })

            return { success: true, id }
        }
    } catch (error: any) {
        console.error('Error al guardar Motivo C8:', error)
        if (error.message?.includes('unique') || error.message?.includes('duplicate key')) {
            return { success: false, error: 'Ya existe un motivo con ese código para la licitación seleccionada' }
        }
        return { success: false, error: error.message || 'Error al guardar el motivo' }
    }
}

export async function toggleActivoMotivoC8Action(id: string, activo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureCalidadC8Tables()

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "Calidad_Motivo_C8"
            SET "activo" = $1, "actualizadoPor" = $2, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $3;
        `, activo, usuario, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Calidad',
            action: 'ACTUALIZACION',
            detalle: `${activo ? 'Activó' : 'Desactivó'} Motivo C8 (ID: ${id})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al cambiar estado de Motivo C8:', error)
        return { success: false, error: error.message || 'Error al actualizar estado' }
    }
}

export async function eliminarMotivoC8Action(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureCalidadC8Tables()

        // Verificar si está en uso en Actas C8
        const enUso = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::text as count FROM "Calidad_Acta_C8" WHERE "motivoGenericoId" = $1;
        `, id)
        const totalEnUso = Number(enUso[0]?.count || 0)

        if (totalEnUso > 0) {
            return { 
                success: false, 
                error: `No se puede eliminar el motivo porque está asignado en ${totalEnUso} acta(s) C8. Puede desactivarlo en su lugar.` 
            }
        }

        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "Calidad_Motivo_C8" WHERE "id" = $1;
        `, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Calidad',
            action: 'ELIMINACION',
            detalle: `Eliminó Motivo C8 (ID: ${id})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar Motivo C8:', error)
        return { success: false, error: error.message || 'Error al eliminar motivo' }
    }
}

export interface ValorContratoItem {
    id: string
    licitacion: string
    anio: number
    montoAnualPesos: number
    descripcion: string | null
    activo: boolean
    creadoPor: string
    actualizadoPor: string | null
    createdAt: string
    updatedAt: string
}

export async function obtenerValoresContratoAction(licitacion?: string): Promise<{ success: boolean; data?: ValorContratoItem[]; error?: string }> {
    try {
        await ensureCalidadC8Tables()
        let query = `
            SELECT 
                "id", "licitacion", "anio", "montoAnualPesos", "descripcion", "activo",
                "creadoPor", "actualizadoPor",
                "createdAt"::text as "createdAt",
                "updatedAt"::text as "updatedAt"
            FROM "Calidad_Valor_Contrato"
        `
        const params: any[] = []
        if (licitacion && licitacion !== 'TODAS') {
            query += ` WHERE "licitacion" = $1 `
            params.push(licitacion)
        }
        query += ` ORDER BY "anio" DESC, "licitacion" ASC;`
        const rows = await rawPrisma.$queryRawUnsafe<any[]>(query, ...params)

        const data: ValorContratoItem[] = rows.map(r => ({
            id: r.id,
            licitacion: r.licitacion,
            anio: Number(r.anio),
            montoAnualPesos: Number(r.montoAnualPesos || 0),
            descripcion: r.descripcion,
            activo: Boolean(r.activo),
            creadoPor: r.creadoPor,
            actualizadoPor: r.actualizadoPor,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al obtener valores de contrato:', error)
        return { success: false, error: error.message || 'Error al obtener registros' }
    }
}

export async function guardarValorContratoAction(data: {
    id?: string
    licitacion: string
    anio: number
    montoAnualPesos: number
    descripcion?: string
    activo?: boolean
}): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureCalidadC8Tables()

        const licitacion = data.licitacion.trim()
        const anio = Number(data.anio)
        const montoAnualPesos = Number(data.montoAnualPesos) || 0
        const descripcion = data.descripcion?.trim() || null
        const activo = data.activo ?? true

        if (!licitacion) throw new Error('La licitación es obligatoria')
        if (isNaN(anio) || anio < 2000) throw new Error('El año es inválido')
        if (montoAnualPesos < 0) throw new Error('El monto no puede ser negativo')

        if (data.id) {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Calidad_Valor_Contrato"
                SET 
                    "licitacion" = $1,
                    "anio" = $2,
                    "montoAnualPesos" = $3,
                    "descripcion" = $4,
                    "activo" = $5,
                    "actualizadoPor" = $6,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $7;
            `, licitacion, anio, montoAnualPesos, descripcion, activo, usuario, data.id)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Calidad',
                action: 'EDICION',
                detalle: `Editó Valor Contrato Anual Licitación ${licitacion} Año ${anio}: $${montoAnualPesos.toLocaleString('es-CL')}`
            })

            return { success: true, id: data.id }
        } else {
            const id = crypto.randomUUID()
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Calidad_Valor_Contrato" (
                    "id", "licitacion", "anio", "montoAnualPesos", "descripcion", "activo", "creadoPor"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7);
            `, id, licitacion, anio, montoAnualPesos, descripcion, activo, usuario)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Calidad',
                action: 'CREACION',
                detalle: `Creó Valor Contrato Anual Licitación ${licitacion} Año ${anio}: $${montoAnualPesos.toLocaleString('es-CL')}`
            })

            return { success: true, id }
        }
    } catch (error: any) {
        console.error('Error al guardar valor de contrato:', error)
        if (error.message?.includes('unique') || error.message?.includes('duplicate key')) {
            return { success: false, error: 'Ya existe un registro para esta Licitación y Año' }
        }
        return { success: false, error: error.message || 'Error al guardar registro' }
    }
}

export async function toggleActivoValorContratoAction(id: string, activo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureCalidadC8Tables()

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "Calidad_Valor_Contrato"
            SET "activo" = $1, "actualizadoPor" = $2, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $3;
        `, activo, usuario, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Calidad',
            action: 'ACTUALIZACION',
            detalle: `${activo ? 'Activó' : 'Desactivó'} Valor Contrato (ID: ${id})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al cambiar estado de Valor Contrato:', error)
        return { success: false, error: error.message || 'Error al actualizar estado' }
    }
}

export async function eliminarValorContratoAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureCalidadC8Tables()

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Calidad_Valor_Contrato" WHERE "id" = $1;`, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Calidad',
            action: 'ELIMINACION',
            detalle: `Eliminó Valor Contrato (ID: ${id})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar Valor Contrato:', error)
        return { success: false, error: error.message || 'Error al eliminar registro' }
    }
}

export async function obtenerValorContratoPorLicitacionAction(licitacion: string, anio: number): Promise<number> {
    try {
        await ensureCalidadC8Tables()
        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "montoAnualPesos" 
            FROM "Calidad_Valor_Contrato" 
            WHERE "licitacion" = $1 AND "anio" = $2 AND "activo" = TRUE
            LIMIT 1;
        `, licitacion, anio)

        if (rows.length > 0) {
            return Number(rows[0].montoAnualPesos || 0)
        }
        return 0
    } catch (e) {
        console.error('Error al consultar valor contrato por licitacion:', e)
        return 0
    }
}

export interface UsuarioPrivilegioReclamo {
    userId: string
    username: string
    nombre: string
    email: string | null
    rolId: string | null
    rolNombre: string
    puedeEditar: boolean
    puedeFechasSeguimiento: boolean
    puedeAdjuntarRespuesta: boolean
    actualizadoPor: string | null
    updatedAt: string | null
}

export async function obtenerPrivilegiosUsuariosReclamosAction(): Promise<{
    success: boolean
    data?: UsuarioPrivilegioReclamo[]
    roles?: { id: string; nombre: string }[]
    error?: string
}> {
    try {
        await ensureReclamosProveedoresTables()

        // 1. Obtener todos los usuarios del sistema junto con sus roles
        const users = await rawPrisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                roleId: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        // 2. Obtener los privilegios registrados en la tabla calidad_reclamos_privilegios_usuarios
        const privRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "userId", "puedeEditar", "puedeFechasSeguimiento", "puedeAdjuntarRespuesta", "actualizadoPor", "updatedAt"::text
            FROM "calidad_reclamos_privilegios_usuarios";
        `)
        const privMap = new Map<string, any>()
        privRows.forEach(p => privMap.set(p.userId, p))

        // 3. Mapear roles únicos
        const rolesMap = new Map<string, string>()
        users.forEach(u => {
            if (u.role?.id && u.role?.name) {
                rolesMap.set(u.role.id, u.role.name)
            }
        })
        const roles = Array.from(rolesMap.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))

        // 4. Armar el dataset
        const data: UsuarioPrivilegioReclamo[] = users.map(u => {
            const p = privMap.get(u.id)
            return {
                userId: u.id,
                username: u.username || '',
                nombre: u.name || u.username || 'Sin Nombre',
                email: u.email || null,
                rolId: u.role?.id || null,
                rolNombre: u.role?.name || 'Sin Rol',
                puedeEditar: Boolean(p?.puedeEditar),
                puedeFechasSeguimiento: Boolean(p?.puedeFechasSeguimiento),
                puedeAdjuntarRespuesta: Boolean(p?.puedeAdjuntarRespuesta),
                actualizadoPor: p?.actualizadoPor || null,
                updatedAt: p?.updatedAt || null
            }
        })

        return { success: true, data, roles }
    } catch (error: any) {
        console.error('[obtenerPrivilegiosUsuariosReclamosAction] Error:', error)
        return { success: false, error: error.message || 'Error al obtener usuarios y privilegios' }
    }
}

export async function guardarPrivilegioUsuarioReclamoAction(data: {
    userId: string
    puedeEditar: boolean
    puedeFechasSeguimiento: boolean
    puedeAdjuntarRespuesta: boolean
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureReclamosProveedoresTables()

        const user = await rawPrisma.user.findUnique({
            where: { id: data.userId },
            select: { id: true, username: true, name: true }
        })

        if (!user) {
            return { success: false, error: 'Usuario no encontrado' }
        }

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "calidad_reclamos_privilegios_usuarios" (
                "id", "userId", "username", "nombreCompleto",
                "puedeEditar", "puedeFechasSeguimiento", "puedeAdjuntarRespuesta",
                "actualizadoPor", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, $1, $2, $3,
                $4, $5, $6,
                $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("userId")
            DO UPDATE SET
                "puedeEditar" = EXCLUDED."puedeEditar",
                "puedeFechasSeguimiento" = EXCLUDED."puedeFechasSeguimiento",
                "puedeAdjuntarRespuesta" = EXCLUDED."puedeAdjuntarRespuesta",
                "actualizadoPor" = EXCLUDED."actualizadoPor",
                "updatedAt" = CURRENT_TIMESTAMP;
        `,
            user.id,
            user.username || '',
            user.name || user.username || '',
            data.puedeEditar,
            data.puedeFechasSeguimiento,
            data.puedeAdjuntarRespuesta,
            usuario
        )

        await logAuditAction({
            username: usuario,
            modulo: 'Calidad -> Registros Globales',
            action: 'MODIFICACION',
            detalle: `Actualizó privilegios Reclamos a Proveedores para usuario: ${user.name || user.username} (Editar: ${data.puedeEditar}, Fechas: ${data.puedeFechasSeguimiento}, Adjunto: ${data.puedeAdjuntarRespuesta})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('[guardarPrivilegioUsuarioReclamoAction] Error:', error)
        return { success: false, error: error.message || 'Error al guardar privilegios' }
    }
}

