'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { TABLA_AQL_PAE_DEFAULT } from '@/lib/multas/it/alertas'
import {
    ModuloSistemaConfig,
    MODULOS_C_DEFAULT,
    CAUSAS_NO_IMPUTABLES_DEFAULT,
    SUBMODULOS_C5_DEFAULT
} from './types'

const PATH = '/dashboard/mantenedor/multas/configuracion'

async function checkPermission() {
    const session = await getSession()
    if (!session?.user) return false

    const sessionRole = session.user.role?.name?.toUpperCase() || ''
    if (sessionRole.includes('ADMIN') || sessionRole.includes('SUPER')) return true

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })

    if (!user) return false

    const userRole = user.role?.name?.toUpperCase() || ''
    if (userRole.includes('ADMIN') || userRole.includes('SUPER')) return true

    try {
        let permissions: string[] = []
        if (typeof user.role?.permissions === 'string') {
            permissions = JSON.parse(user.role.permissions)
        } else if (Array.isArray(user.role?.permissions)) {
            permissions = user.role.permissions as any
        }
        return permissions.includes('manage_multa_configuracion') || permissions.includes('*')
    } catch {
        return false
    }
}

/**
 * Obtiene las licitaciones autorizadas según el perfil y los RBDs asignados al usuario.
 */
export async function getLicitacionesConfiguracion() {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para acceder a la configuración de multas.' }
    }

    try {
        await ensureMultasEETables()
        const userEffectiveRbds = await getUserEffectiveRbds()

        let whereClause: any = {}
        if (userEffectiveRbds !== null) {
            if (userEffectiveRbds.length === 0) {
                return { licitaciones: [] }
            }
            whereClause = {
                uts: {
                    some: {
                        colegios: {
                            some: {
                                colRBD: { in: userEffectiveRbds }
                            }
                        }
                    }
                }
            }
        }

        const licitaciones = await prisma.licitacion.findMany({
            where: whereClause,
            select: {
                licId: true,
                licitacionHomologada: true,
                estado: true
            },
            orderBy: { licId: 'asc' }
        })

        return { licitaciones }
    } catch (error: any) {
        console.error('Error al obtener licitaciones:', error)
        return { error: error.message || 'Error al obtener licitaciones.' }
    }
}

/**
 * Obtiene los parámetros de configuración para una licitación. Si no existen, retorna los valores por defecto.
 */
export async function getParametrosLicitacion(licId: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para consultar la configuración.' }
    }

    try {
        await ensureMultasEETables()

        const lic = await prisma.licitacion.findUnique({
            where: { licId },
            select: { licId: true, licitacionHomologada: true }
        })

        if (!lic) {
            return { error: `Licitación ${licId} no encontrada.` }
        }

        const paramRecord = await prisma.multas_Parametros_Licitacion.findUnique({
            where: { licId }
        })

        // Parsear módulos C1 - C11 y sus sub-reglas C5
        let modulos: ModuloSistemaConfig[] = MODULOS_C_DEFAULT
        if (paramRecord?.modulosActivosJson) {
            try {
                const parsedModulos = JSON.parse(paramRecord.modulosActivosJson)
                if (Array.isArray(parsedModulos)) {
                    modulos = MODULOS_C_DEFAULT.map(def => {
                        const found = parsedModulos.find((m: any) => m.codigo === def.codigo)
                        if (!found) return def
                        return {
                            ...def,
                            activo: found.activo,
                            submodulos: def.codigo === 'C5'
                                ? { ...SUBMODULOS_C5_DEFAULT, ...(found.submodulos || {}) }
                                : undefined
                        }
                    })
                }
            } catch {
                modulos = MODULOS_C_DEFAULT
            }
        }

        // Parsear tabla AQL: mapear null o undefined en max hacia Infinity para cálculo en cliente
        let tablaAql = TABLA_AQL_PAE_DEFAULT
        if (paramRecord?.tablaAqlJson) {
            try {
                const parsed = JSON.parse(paramRecord.tablaAqlJson)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    tablaAql = parsed.map((row: any) => ({
                        ...row,
                        max: (row.max === null || row.max === undefined) ? Infinity : row.max
                    }))
                }
            } catch {
                tablaAql = TABLA_AQL_PAE_DEFAULT
            }
        }

        // Parsear causas no imputables
        let causasNoImputables = CAUSAS_NO_IMPUTABLES_DEFAULT
        if (paramRecord?.causasNoImputablesJson) {
            try {
                const parsed = JSON.parse(paramRecord.causasNoImputablesJson)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    causasNoImputables = parsed
                }
            } catch {
                causasNoImputables = CAUSAS_NO_IMPUTABLES_DEFAULT
            }
        }

        return {
            licitacion: lic,
            parametros: {
                id: paramRecord?.id || null,
                licId,
                modulos,
                ratioManipuladorasH: paramRecord?.ratioManipuladorasH ?? 70,
                tempRefriMin: paramRecord?.tempRefriMin ?? 0.0,
                tempRefriMax: paramRecord?.tempRefriMax ?? 5.0,
                tempCongelacionMax: paramRecord?.tempCongelacionMax ?? -18.0,
                toleranciaFLeve: paramRecord?.toleranciaFLeve ?? 10.0,
                toleranciaFModerado: paramRecord?.toleranciaFModerado ?? 5.0,
                toleranciaFGrave: paramRecord?.toleranciaFGrave ?? 0.0,
                plazoCorreccionDias: paramRecord?.plazoCorreccionDias ?? 5,
                tablaAql,
                causasNoImputables,
                activo: paramRecord?.activo ?? true,
                updatedAt: paramRecord?.updatedAt || null,
                usuarioModif: paramRecord?.usuarioModif || null
            }
        }
    } catch (error: any) {
        console.error('Error al obtener parámetros de licitación:', error)
        return { error: error.message || 'Error al obtener parámetros de licitación.' }
    }
}

/**
 * Guarda o actualiza los parámetros de configuración de una licitación.
 */
export async function guardarParametrosLicitacion(data: {
    licId: number
    modulos: ModuloSistemaConfig[]
    ratioManipuladorasH: number
    tempRefriMin: number
    tempRefriMax: number
    tempCongelacionMax: number
    toleranciaFLeve: number
    toleranciaFModerado: number
    toleranciaFGrave: number
    plazoCorreccionDias: number
    tablaAql: any[]
    causasNoImputables: any[]
}) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para guardar la configuración.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const modulosActivosJson = JSON.stringify(data.modulos.map(m => ({
            codigo: m.codigo,
            activo: m.activo,
            submodulos: m.submodulos || undefined
        })))

        // Sanitizar tabla AQL: max: Infinity o null se guarda como null ("sin tope")
        const tablaAqlSanitizada = (data.tablaAql || []).map(row => ({
            min: Number(row.min) || 0,
            max: (row.max === Infinity || row.max === null || row.max === undefined || row.max === '' || Number(row.max) >= 999999) ? null : Number(row.max),
            muestra: Number(row.muestra) || 0,
            ac: Number(row.ac) || 0,
            re: Number(row.re) || 0,
            rangoTexto: row.rangoTexto || undefined
        }))
        const tablaAqlJson = JSON.stringify(tablaAqlSanitizada)
        const causasNoImputablesJson = JSON.stringify(data.causasNoImputables)

        const saved = await prisma.multas_Parametros_Licitacion.upsert({
            where: { licId: data.licId },
            create: {
                licId: data.licId,
                modulosActivosJson,
                ratioManipuladorasH: Number(data.ratioManipuladorasH) || 70,
                tempRefriMin: Number(data.tempRefriMin) || 0.0,
                tempRefriMax: Number(data.tempRefriMax) || 5.0,
                tempCongelacionMax: Number(data.tempCongelacionMax) || -18.0,
                toleranciaFLeve: Number(data.toleranciaFLeve) || 10.0,
                toleranciaFModerado: Number(data.toleranciaFModerado) || 5.0,
                toleranciaFGrave: Number(data.toleranciaFGrave) || 0.0,
                plazoCorreccionDias: Number(data.plazoCorreccionDias) || 5,
                tablaAqlJson,
                causasNoImputablesJson,
                activo: true,
                usuarioModif: username
            },
            update: {
                modulosActivosJson,
                ratioManipuladorasH: Number(data.ratioManipuladorasH) || 70,
                tempRefriMin: Number(data.tempRefriMin) || 0.0,
                tempRefriMax: Number(data.tempRefriMax) || 5.0,
                tempCongelacionMax: Number(data.tempCongelacionMax) || -18.0,
                toleranciaFLeve: Number(data.toleranciaFLeve) || 10.0,
                toleranciaFModerado: Number(data.toleranciaFModerado) || 5.0,
                toleranciaFGrave: Number(data.toleranciaFGrave) || 0.0,
                plazoCorreccionDias: Number(data.plazoCorreccionDias) || 5,
                tablaAqlJson,
                causasNoImputablesJson,
                activo: true,
                usuarioModif: username
            }
        })

        // Auditoría
        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'EDIT_MULTAS_PARAMETROS',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Actualizados parámetros de multas para Licitación ID: ${data.licId}. Ratio H: ${data.ratioManipuladorasH}, Plazo: ${data.plazoCorreccionDias} días, Temp Refri: [${data.tempRefriMin}, ${data.tempRefriMax}]°C.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true, saved }
    } catch (error: any) {
        console.error('Error al guardar parámetros de licitación:', error)
        return { error: error.message || 'Error al guardar parámetros de licitación.' }
    }
}

/**
 * Restablece los parámetros a los valores por defecto oficiales JUNAEB para la licitación.
 */
export async function restablecerParametrosDefecto(licId: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para restablecer la configuración.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        await prisma.multas_Parametros_Licitacion.deleteMany({
            where: { licId }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'RESET_MULTAS_PARAMETROS',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Restablecidos a valores por defecto los parámetros de multas para Licitación ID: ${licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al restablecer parámetros:', error)
        return { error: error.message || 'Error al restablecer parámetros.' }
    }
}
