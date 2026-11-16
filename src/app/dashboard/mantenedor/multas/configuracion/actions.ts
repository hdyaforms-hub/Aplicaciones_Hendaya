'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { TABLA_AQL_PAE_DEFAULT } from '@/lib/multas/it/alertas'
import {
    ModuloSistemaConfig,
    MODULOS_C_DEFAULT,
    CAUSAS_NO_IMPUTABLES_DEFAULT
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

        let paramRecord: any = null
        try {
            if ((prisma as any).multas_Parametros_Licitacion) {
                paramRecord = await prisma.multas_Parametros_Licitacion.findUnique({
                    where: { licId }
                })
            } else if ((rawPrisma as any).multas_Parametros_Licitacion) {
                paramRecord = await (rawPrisma as any).multas_Parametros_Licitacion.findUnique({
                    where: { licId }
                })
            } else {
                const rows = await rawPrisma.$queryRawUnsafe<any[]>(
                    `SELECT * FROM "Multas_Parametros_Licitacion" WHERE "licId" = $1 LIMIT 1`,
                    licId
                )
                if (rows && rows.length > 0) paramRecord = rows[0]
            }
        } catch (dbErr) {
            console.warn('Advertencia al consultar Multas_Parametros_Licitacion:', dbErr)
        }

        // Parsear módulos
        let modulos: ModuloSistemaConfig[] = MODULOS_C_DEFAULT
        if (paramRecord?.modulosActivosJson) {
            try {
                const parsedModulos = JSON.parse(paramRecord.modulosActivosJson)
                if (Array.isArray(parsedModulos)) {
                    modulos = MODULOS_C_DEFAULT.map(def => {
                        const found = parsedModulos.find((m: any) => m.codigo === def.codigo)
                        return found ? { ...def, activo: found.activo } : def
                    })
                }
            } catch {
                modulos = MODULOS_C_DEFAULT
            }
        }

        // Parsear tabla AQL
        let tablaAql = TABLA_AQL_PAE_DEFAULT
        if (paramRecord?.tablaAqlJson) {
            try {
                const parsed = JSON.parse(paramRecord.tablaAqlJson)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    tablaAql = parsed
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

        const modulosActivosJson = JSON.stringify(data.modulos.map(m => ({ codigo: m.codigo, activo: m.activo })))
        const tablaAqlJson = JSON.stringify(data.tablaAql)
        const causasNoImputablesJson = JSON.stringify(data.causasNoImputables)

        let saved: any = null
        if ((prisma as any).multas_Parametros_Licitacion) {
            saved = await prisma.multas_Parametros_Licitacion.upsert({
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
        } else {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Parametros_Licitacion" (
                    "id", "licId", "modulosActivosJson", "ratioManipuladorasH",
                    "tempRefriMin", "tempRefriMax", "tempCongelacionMax",
                    "toleranciaFLeve", "toleranciaFModerado", "toleranciaFGrave",
                    "plazoCorreccionDias", "tablaAqlJson", "causasNoImputablesJson",
                    "activo", "usuarioModif", "updatedAt"
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, NOW()
                )
                ON CONFLICT ("licId") DO UPDATE SET
                    "modulosActivosJson" = EXCLUDED."modulosActivosJson",
                    "ratioManipuladorasH" = EXCLUDED."ratioManipuladorasH",
                    "tempRefriMin" = EXCLUDED."tempRefriMin",
                    "tempRefriMax" = EXCLUDED."tempRefriMax",
                    "tempCongelacionMax" = EXCLUDED."tempCongelacionMax",
                    "toleranciaFLeve" = EXCLUDED."toleranciaFLeve",
                    "toleranciaFModerado" = EXCLUDED."toleranciaFModerado",
                    "toleranciaFGrave" = EXCLUDED."toleranciaFGrave",
                    "plazoCorreccionDias" = EXCLUDED."plazoCorreccionDias",
                    "tablaAqlJson" = EXCLUDED."tablaAqlJson",
                    "causasNoImputablesJson" = EXCLUDED."causasNoImputablesJson",
                    "usuarioModif" = EXCLUDED."usuarioModif",
                    "updatedAt" = NOW()
            `,
                data.licId,
                modulosActivosJson,
                Number(data.ratioManipuladorasH) || 70,
                Number(data.tempRefriMin) || 0.0,
                Number(data.tempRefriMax) || 5.0,
                Number(data.tempCongelacionMax) || -18.0,
                Number(data.toleranciaFLeve) || 10.0,
                Number(data.toleranciaFModerado) || 5.0,
                Number(data.toleranciaFGrave) || 0.0,
                Number(data.plazoCorreccionDias) || 5,
                tablaAqlJson,
                causasNoImputablesJson,
                username
            )
            saved = { licId: data.licId }
        }

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

        if ((prisma as any).multas_Parametros_Licitacion) {
            await prisma.multas_Parametros_Licitacion.deleteMany({
                where: { licId }
            })
        } else {
            await rawPrisma.$executeRawUnsafe(
                `DELETE FROM "Multas_Parametros_Licitacion" WHERE "licId" = $1`,
                licId
            )
        }

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
