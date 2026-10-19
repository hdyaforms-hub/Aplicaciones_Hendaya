'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureMonitoreoTables } from '@/lib/monitoreo-db-init'
import { revalidatePath } from 'next/cache'

export interface ItemConfigState {
    id?: string
    tipo: 'MATRIZ' | 'ACTA'
    plantillaId: string
    nombre: string
    subtitulo?: string
    anio?: number
    periodicidad: '1_DIA' | '15_DIAS' | '1_MES' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | '1_ANIO'
    activo: boolean
}

export interface MonitoreoDataResponse {
    success: boolean
    error?: string
    matrices: Array<{
        id: string
        titulo: string
        anio: number
        licitacionNombre?: string
        estado: boolean
    }>
    actas: Array<{
        id: string
        nombre: string
        anio: number
        codigo?: string | null
        version?: string | null
        licitacionNombre?: string
        rolesPerfiles?: string[]
        estado: boolean
    }>
    roles: Array<{
        id: string
        name: string
        description?: string | null
        activeUsersCount: number
    }>
    configuredRoles: string[] // IDs de roles seleccionados
    itemsConfig: Record<string, { periodicidad: string; activo: boolean }>
}

const PERIODICIDAD_DIAS: Record<string, number> = {
    '1_DIA': 1,
    '15_DIAS': 15,
    '1_MES': 30,
    'BIMESTRAL': 60,
    'TRIMESTRAL': 90,
    'SEMESTRAL': 180,
    '1_ANIO': 365
}

export async function getMonitoreoConfigData(): Promise<MonitoreoDataResponse> {
    try {
        await ensureMonitoreoTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_mantenedor_monitoreo')) {
            return {
                success: false,
                error: 'No tienes permisos para acceder a la configuración de monitoreo.',
                matrices: [],
                actas: [],
                roles: [],
                configuredRoles: [],
                itemsConfig: {}
            }
        }

        // 1. Obtener Matrices de Riesgo vigentes
        const matricesDb = await rawPrisma.matrizT_Cabecera.findMany({
            where: { estado: true },
            include: { licitacion: true },
            orderBy: [{ anio: 'desc' }, { titulo: 'asc' }]
        })

        const matrices = matricesDb.map(m => ({
            id: m.id,
            titulo: m.titulo,
            anio: m.anio,
            licitacionNombre: m.licitacion?.licitacionHomologada || `Lic. #${m.licId}`,
            estado: m.estado
        }))

        // 2. Obtener Actas de Supervisión vigentes
        const actasDb = await rawPrisma.actaSupervisionPlantilla.findMany({
            where: { estado: true },
            include: { licitacion: true },
            orderBy: [{ anio: 'desc' }, { nombre: 'asc' }]
        })

        const actas = actasDb.map(a => {
            let rolesAsignados: string[] = []
            try {
                const parsed = JSON.parse(a.rolesPerfiles || '[]')
                rolesAsignados = Array.isArray(parsed) ? parsed : [a.rolesPerfiles]
            } catch {
                rolesAsignados = (a.rolesPerfiles || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            }

            return {
                id: a.id,
                nombre: a.nombre,
                anio: a.anio,
                codigo: a.codigo,
                version: a.version,
                licitacionNombre: a.licitacion?.licitacionHomologada || (a.licitacionId ? `Lic. #${a.licitacionId}` : 'General'),
                rolesPerfiles: rolesAsignados,
                estado: a.estado
            }
        })

        // 3. Obtener Roles creados y conteo de usuarios activos
        const rolesDb = await rawPrisma.role.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        users: {
                            where: { isDeleted: false, isActive: true }
                        }
                    }
                }
            }
        })

        const roles = rolesDb.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            activeUsersCount: r._count.users
        }))

        // 4. Leer configuración guardada
        const configGlobal: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "rolesAsignados" FROM "monitoreo_configuracion" WHERE "id" = 'global' LIMIT 1;
        `)

        let configuredRoles: string[] = []
        if (configGlobal && configGlobal.length > 0 && configGlobal[0].rolesAsignados) {
            try {
                configuredRoles = JSON.parse(configGlobal[0].rolesAsignados)
            } catch {
                configuredRoles = []
            }
        }

        const itemsSaved: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "tipo", "plantillaId", "periodicidad", "activo" FROM "monitoreo_item_config";
        `)

        const itemsConfig: Record<string, { periodicidad: string; activo: boolean }> = {}
        for (const item of itemsSaved) {
            const key = `${item.tipo}_${item.plantillaId}`
            itemsConfig[key] = {
                periodicidad: item.periodicidad || '1_MES',
                activo: item.activo === true || item.activo === 'true' || item.activo === 1
            }
        }

        return {
            success: true,
            matrices,
            actas,
            roles,
            configuredRoles,
            itemsConfig
        }
    } catch (error: any) {
        console.error('Error al obtener datos de configuración de monitoreo:', error)
        return {
            success: false,
            error: error?.message || 'Error al cargar la configuración.',
            matrices: [],
            actas: [],
            roles: [],
            configuredRoles: [],
            itemsConfig: {}
        }
    }
}

export async function saveMonitoreoConfig(payload: {
    rolesAsignados: string[]
    items: Array<{
        tipo: 'MATRIZ' | 'ACTA'
        plantillaId: string
        nombre: string
        periodicidad: '1_DIA' | '15_DIAS' | '1_MES' | 'BIMESTRAL' | 'TRIMESTRAL' | '1_ANIO'
        activo: boolean
    }>
}) {
    try {
        await ensureMonitoreoTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_mantenedor_monitoreo')) {
            return { success: false, error: 'No tienes permisos para modificar la configuración de monitoreo.' }
        }

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null
        const rolesJson = JSON.stringify(payload.rolesAsignados || [])

        // 1. Guardar roles asignados en monitoreo_configuracion
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "monitoreo_configuracion" ("id", "rolesAsignados", "actualizadoPor", "updatedAt")
            VALUES ('global', $1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO UPDATE SET
                "rolesAsignados" = EXCLUDED."rolesAsignados",
                "actualizadoPor" = EXCLUDED."actualizadoPor",
                "updatedAt" = CURRENT_TIMESTAMP;
        `, rolesJson, username)

        // 2. Guardar o actualizar cada ítem de monitoreo
        for (const item of payload.items) {
            const diasCiclo = PERIODICIDAD_DIAS[item.periodicidad] || 30
            const id = `${item.tipo.toLowerCase()}_${item.plantillaId}`

            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "monitoreo_item_config" ("id", "tipo", "plantillaId", "nombre", "periodicidad", "diasCiclo", "activo", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT ("tipo", "plantillaId") DO UPDATE SET
                    "nombre" = EXCLUDED."nombre",
                    "periodicidad" = EXCLUDED."periodicidad",
                    "diasCiclo" = EXCLUDED."diasCiclo",
                    "activo" = EXCLUDED."activo",
                    "updatedAt" = CURRENT_TIMESTAMP;
            `, id, item.tipo, item.plantillaId, item.nombre, item.periodicidad, diasCiclo, item.activo)
        }

        // 3. Registrar en Auditoría
        await logAuditAction({
            action: 'CONFIGURAR_MONITOREO',
            modulo: 'MANTENEDOR_MONITOREO',
            detalle: `Usuario ${username} actualizó la configuración de Monitoreo: ${payload.items.length} pautas configuradas, ${payload.rolesAsignados.length} roles monitoreados.`,
            userId: userId || undefined,
            username: username
        })

        revalidatePath('/dashboard/mantenedor/monitoreo')
        revalidatePath('/dashboard/tablero/monitoreo-avances')

        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar configuración de monitoreo:', error)
        return { success: false, error: error?.message || 'Error al guardar la configuración.' }
    }
}
