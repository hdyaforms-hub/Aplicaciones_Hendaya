'use server'

import { prisma } from '@/lib/prisma'
import { getMultasDelegate } from '@/lib/multas/db'
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
    SUBMODULOS_C5_DEFAULT,
    SUBMODULOS_C2_DEFAULT,
    SUBMODULOS_C3_DEFAULT,
    SUBMODULOS_C4_DEFAULT,
    HorarioServicioItem,
    ManipuladoraMesItem,
    MinutaMesItem
} from './types'

const dbParametros = () => getMultasDelegate('multas_Parametros_Licitacion')
const dbHorarios = () => getMultasDelegate('multas_Horario_Servicio')
const dbEstratos = () => getMultasDelegate('multas_Estrato_Excluido')
const dbManipuladoras = () => getMultasDelegate('multas_Manipuladora_Mes')
const dbMinutas = () => getMultasDelegate('multas_Minuta_Mes')

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

        const paramRecord = await dbParametros().findUnique({
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
                        let submodulos = undefined
                        if (def.codigo === 'C5') {
                            submodulos = { ...SUBMODULOS_C5_DEFAULT, ...(found.submodulos || {}) }
                        } else if (def.codigo === 'C2') {
                            submodulos = { ...SUBMODULOS_C2_DEFAULT, ...(found.submodulos || {}) }
                        } else if (def.codigo === 'C3') {
                            submodulos = { ...SUBMODULOS_C3_DEFAULT, ...(found.submodulos || {}) }
                        } else if (def.codigo === 'C4') {
                            submodulos = { ...SUBMODULOS_C4_DEFAULT, ...(found.submodulos || {}) }
                        }
                        return {
                            ...def,
                            activo: found.activo,
                            submodulos,
                            parametros: found.parametros || undefined
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
            submodulos: m.submodulos || undefined,
            parametros: (m as any).parametros || undefined
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

        const saved = await dbParametros().upsert({
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

        await dbParametros().deleteMany({
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

/**
 * =======================================================================
 * C2.1 HORARIOS POR SERVICIO (CATÁLOGO DE VALIDACIÓN)
 * =======================================================================
 */


const HORARIOS_SUGERIDOS_OFICIALES: Record<string, { horaInicio: string; horaFin: string; toleranciaMinutos: number }> = {
    'D': { horaInicio: '06:30', horaFin: '10:30', toleranciaMinutos: 15 },
    'A': { horaInicio: '11:30', horaFin: '15:30', toleranciaMinutos: 15 },
    'O': { horaInicio: '15:00', horaFin: '18:00', toleranciaMinutos: 15 },
    'C': { horaInicio: '18:30', horaFin: '21:30', toleranciaMinutos: 15 },
    'T': { horaInicio: '15:00', horaFin: '18:00', toleranciaMinutos: 15 }
}

export async function getHorariosServicio(licId: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para consultar horarios por servicio.' }
    }

    try {
        await ensureMultasEETables()
        const servicios = await prisma.multaServicio.findMany({
            orderBy: { nombre: 'asc' }
        })

        const horarios = await dbHorarios().findMany({
            where: { licId }
        })

        const items: HorarioServicioItem[] = servicios.map(s => {
            const h = (horarios as any[]).find((x: any) => x.servicioCodigo === s.codigo)
            const sug = HORARIOS_SUGERIDOS_OFICIALES[s.codigo] || { horaInicio: '08:00', horaFin: '12:00', toleranciaMinutos: 0 }
            return {
                id: h?.id,
                servicioCodigo: s.codigo,
                servicioNombre: s.nombre,
                horaInicio: h?.horaInicio || sug.horaInicio,
                horaFin: h?.horaFin || sug.horaFin,
                toleranciaMinutos: h?.toleranciaMinutos ?? sug.toleranciaMinutos,
                activo: h?.activo ?? false
            }
        })

        return { horarios: items }
    } catch (error: any) {
        console.error('Error al obtener horarios de servicio:', error)
        return { error: error.message || 'Error al obtener horarios de servicio.' }
    }
}

export async function guardarHorariosServicio(
    licId: number,
    horarios: Array<{ servicioCodigo: string; horaInicio: string; horaFin: string; toleranciaMinutos: number; activo: boolean }>
) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para guardar horarios.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

        for (const h of horarios) {
            if (!timeRegex.test(h.horaInicio) || !timeRegex.test(h.horaFin)) {
                return { error: `Formato de hora inválido para el servicio ${h.servicioCodigo} (debe ser HH:MM).` }
            }
            if (h.horaInicio >= h.horaFin) {
                return { error: `La hora de inicio (${h.horaInicio}) debe ser menor a la hora de fin (${h.horaFin}) para ${h.servicioCodigo}.` }
            }
        }

        for (const h of horarios) {
            await dbHorarios().upsert({
                where: {
                    licId_servicioCodigo: {
                        licId,
                        servicioCodigo: h.servicioCodigo
                    }
                },
                create: {
                    licId,
                    servicioCodigo: h.servicioCodigo,
                    horaInicio: h.horaInicio,
                    horaFin: h.horaFin,
                    toleranciaMinutos: Number(h.toleranciaMinutos) || 0,
                    activo: h.activo,
                    usuarioModif: username
                },
                update: {
                    horaInicio: h.horaInicio,
                    horaFin: h.horaFin,
                    toleranciaMinutos: Number(h.toleranciaMinutos) || 0,
                    activo: h.activo,
                    usuarioModif: username
                }
            })
        }

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'EDIT_MULTAS_HORARIOS',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Guardados horarios de servicio para Licitación ID: ${licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar horarios de servicio:', error)
        return { error: error.message || 'Error al guardar horarios.' }
    }
}

export async function cargarHorariosSugeridos(licId: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para cargar horarios sugeridos.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const servicios = await prisma.multaServicio.findMany()

        for (const s of servicios) {
            const sug = HORARIOS_SUGERIDOS_OFICIALES[s.codigo] || { horaInicio: '08:00', horaFin: '12:00', toleranciaMinutos: 15 }
            await dbHorarios().upsert({
                where: {
                    licId_servicioCodigo: {
                        licId,
                        servicioCodigo: s.codigo
                    }
                },
                create: {
                    licId,
                    servicioCodigo: s.codigo,
                    horaInicio: sug.horaInicio,
                    horaFin: sug.horaFin,
                    toleranciaMinutos: sug.toleranciaMinutos,
                    activo: true,
                    usuarioModif: username
                },
                update: {
                    horaInicio: sug.horaInicio,
                    horaFin: sug.horaFin,
                    toleranciaMinutos: sug.toleranciaMinutos,
                    activo: true,
                    usuarioModif: username
                }
            })
        }

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'SUGGEST_MULTAS_HORARIOS',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Cargados horarios sugeridos oficiales para Licitación ID: ${licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al cargar horarios sugeridos:', error)
        return { error: error.message || 'Error al cargar horarios sugeridos.' }
    }
}

/**
 * =======================================================================
 * C2.2 ESTRATOS EXCLUIDOS (CATÁLOGO DE VALIDACIÓN)
 * =======================================================================
 */

export async function getEstratosExcluidos(licId: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para consultar estratos excluidos.' }
    }

    try {
        await ensureMultasEETables()
        const estratos = await dbEstratos().findMany({
            where: { licId },
            orderBy: { estrato: 'asc' }
        })

        return { estratos }
    } catch (error: any) {
        console.error('Error al consultar estratos excluidos:', error)
        return { error: error.message || 'Error al consultar estratos excluidos.' }
    }
}

export async function guardarEstratoExcluido(licId: number, estrato: string, descripcion?: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para agregar estratos.' }
    }

    const cleanEstrato = estrato.trim()
    if (!cleanEstrato) {
        return { error: 'El código de estrato no puede estar vacío.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const record = await dbEstratos().upsert({
            where: {
                licId_estrato: {
                    licId,
                    estrato: cleanEstrato
                }
            },
            create: {
                licId,
                estrato: cleanEstrato,
                descripcion: descripcion?.trim() || null,
                activo: true,
                usuarioModif: username
            },
            update: {
                descripcion: descripcion?.trim() || null,
                activo: true,
                usuarioModif: username
            }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'ADD_MULTAS_ESTRATO',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Agregado estrato excluido ${cleanEstrato} para Licitación ID: ${licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true, record }
    } catch (error: any) {
        console.error('Error al guardar estrato excluido:', error)
        return { error: error.message || 'Error al guardar estrato.' }
    }
}

export async function toggleEstratoExcluido(id: string, activo: boolean) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para modificar estratos.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const updated = await dbEstratos().update({
            where: { id },
            data: {
                activo,
                usuarioModif: username
            }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'TOGGLE_MULTAS_ESTRATO',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Estado de estrato ${updated.estrato} cambiado a ${activo ? 'ACTIVO' : 'INACTIVO'}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true, updated }
    } catch (error: any) {
        console.error('Error al modificar estrato:', error)
        return { error: error.message || 'Error al modificar estrato.' }
    }
}

export async function eliminarEstratoExcluido(id: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para eliminar estratos.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const deleted = await dbEstratos().delete({
            where: { id }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'DELETE_MULTAS_ESTRATO',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Eliminado estrato excluido ${deleted.estrato} de Licitación ID: ${deleted.licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar estrato:', error)
        return { error: error.message || 'Error al eliminar estrato.' }
    }
}

export async function cargarEstratosSugeridos(licId: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para cargar estratos sugeridos.' }
    }

    const SUGERIDOS = [
        { estrato: '206', descripcion: 'Estrato especial JUNAEB excluido de raciones base' },
        { estrato: '208', descripcion: 'Estrato complementario JUNAEB excluido de raciones base' },
        { estrato: '209', descripcion: 'Estrato no regular JUNAEB excluido de raciones base' }
    ]

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        for (const s of SUGERIDOS) {
            await dbEstratos().upsert({
                where: {
                    licId_estrato: {
                        licId,
                        estrato: s.estrato
                    }
                },
                create: {
                    licId,
                    estrato: s.estrato,
                    descripcion: s.descripcion,
                    activo: true,
                    usuarioModif: username
                },
                update: {
                    descripcion: s.descripcion,
                    activo: true,
                    usuarioModif: username
                }
            })
        }

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'SUGGEST_MULTAS_ESTRATOS',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Cargados estratos sugeridos oficiales (206, 208, 209) para Licitación ID: ${licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al cargar estratos sugeridos:', error)
        return { error: error.message || 'Error al cargar estratos sugeridos.' }
    }
}

/**
 * =======================================================================
 * C2.3 DOTACIÓN OFICIAL DE MANIPULADORAS POR MES
 * =======================================================================
 */

export async function getDotacionManipuladoras(licId: number, anio: number, mes: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para consultar la dotación oficial.' }
    }

    try {
        await ensureMultasEETables()
        const dotaciones = await dbManipuladoras().findMany({
            where: { licId, anio, mes },
            orderBy: { rbd: 'asc' }
        })
        return { dotaciones }
    } catch (error: any) {
        console.error('Error al obtener dotación de manipuladoras:', error)
        return { error: error.message || 'Error al obtener dotación.' }
    }
}

export async function guardarDotacionManipuladora(data: {
    licId: number
    anio: number
    mes: number
    rbd: number
    total: number
    establecimiento?: string
}) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para guardar la dotación oficial.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const record = await dbManipuladoras().upsert({
            where: {
                licId_anio_mes_rbd: {
                    licId: data.licId,
                    anio: data.anio,
                    mes: data.mes,
                    rbd: data.rbd
                }
            },
            create: {
                licId: data.licId,
                anio: data.anio,
                mes: data.mes,
                rbd: data.rbd,
                establecimiento: data.establecimiento || null,
                total: Number(data.total) || 0,
                usuarioModif: username
            },
            update: {
                establecimiento: data.establecimiento || undefined,
                total: Number(data.total) || 0,
                usuarioModif: username
            }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'SAVE_DOTACION_MANIPULADORA',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Guardada dotación oficial para RBD ${data.rbd} (${data.total} manipuladoras) periodo ${data.mes}/${data.anio} licitación ${data.licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true, record }
    } catch (error: any) {
        console.error('Error al guardar dotación de manipuladora:', error)
        return { error: error.message || 'Error al guardar dotación.' }
    }
}

export async function importarDotacionMasiva(
    licId: number,
    anio: number,
    mes: number,
    filas: Array<{ rbd: number; total: number; establecimiento?: string }>,
    filename?: string
) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para importar dotación de manipuladoras.' }
    }

    if (!Array.isArray(filas) || filas.length === 0) {
        return { error: 'No se encontraron filas válidas para importar.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        let guardadas = 0
        for (const fila of filas) {
            const rbd = Number(fila.rbd)
            const total = Number(fila.total)
            if (!rbd || isNaN(rbd) || isNaN(total)) continue

            await dbManipuladoras().upsert({
                where: {
                    licId_anio_mes_rbd: {
                        licId,
                        anio,
                        mes,
                        rbd
                    }
                },
                create: {
                    licId,
                    anio,
                    mes,
                    rbd,
                    establecimiento: fila.establecimiento || null,
                    total,
                    filename: filename || null,
                    usuarioModif: username
                },
                update: {
                    establecimiento: fila.establecimiento || undefined,
                    total,
                    filename: filename || undefined,
                    usuarioModif: username
                }
            })
            guardadas++
        }

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'IMPORT_DOTACION_MASIVA',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Importadas ${guardadas} dotaciones oficiales para periodo ${mes}/${anio} licitación ${licId} desde ${filename || 'Excel'}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true, count: guardadas }
    } catch (error: any) {
        console.error('Error al importar dotación masiva:', error)
        return { error: error.message || 'Error al importar dotación masiva.' }
    }
}

export async function eliminarDotacionManipuladora(id: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para eliminar la dotación.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        await dbManipuladoras().delete({
            where: { id }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'DELETE_DOTACION_MANIPULADORA',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Eliminada dotación oficial ID: ${id}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar dotación:', error)
        return { error: error.message || 'Error al eliminar dotación.' }
    }
}

/**
 * =======================================================================
 * C2.4 MINUTAS PLANIFICADAS POR MES
 * =======================================================================
 */

export async function getMinutaMes(licId: number, anio: number, mes: number, nivel: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para consultar minutas planificadas.' }
    }

    try {
        await ensureMultasEETables()
        const minuta = await dbMinutas().findUnique({
            where: {
                licId_anio_mes_nivel: {
                    licId,
                    anio,
                    mes,
                    nivel
                }
            }
        })
        return { minuta }
    } catch (error: any) {
        console.error('Error al obtener minuta del mes:', error)
        return { error: error.message || 'Error al obtener minuta.' }
    }
}

export async function guardarMinutaMes(
    licId: number,
    anio: number,
    mes: number,
    nivel: string,
    datosJson: string,
    filename?: string
) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para guardar minutas planificadas.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        const record = await dbMinutas().upsert({
            where: {
                licId_anio_mes_nivel: {
                    licId,
                    anio,
                    mes,
                    nivel
                }
            },
            create: {
                licId,
                anio,
                mes,
                nivel,
                datosJson,
                filename: filename || null,
                usuarioModif: username
            },
            update: {
                datosJson,
                filename: filename || undefined,
                usuarioModif: username
            }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'SAVE_MINUTA_MES',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Guardada minuta planificada para nivel ${nivel} periodo ${mes}/${anio} licitación ${licId}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true, record }
    } catch (error: any) {
        console.error('Error al guardar minuta del mes:', error)
        return { error: error.message || 'Error al guardar minuta.' }
    }
}

export async function sincronizarMinutasDesdeSistema(licId: number, anio: number, mes: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para sincronizar minutas.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        // Obtener licitación para calzar con tabla Minutas
        const lic = await prisma.licitacion.findUnique({
            where: { licId },
            select: { licId: true, licitacionHomologada: true }
        })

        const licitacionCodes = [String(licId)]
        if (lic?.licitacionHomologada) {
            licitacionCodes.push(lic.licitacionHomologada.trim())
        }

        // Buscar minutas existentes en el sistema para ese periodo y licitación
        const minutasRaw = await prisma.minutas.findMany({
            where: {
                licitacion: { in: licitacionCodes },
                anio,
                mes
            },
            select: {
                dia: true,
                codigoServicio: true,
                nombreServicio: true,
                numeroPreparacion: true,
                programa: true
            }
        })

        if (!minutasRaw || minutasRaw.length === 0) {
            return {
                error: `No se encontraron minutas registradas en el sistema para la licitación ${lic?.licitacionHomologada || licId} en el periodo ${mes}/${anio}.`
            }
        }

        // Obtener nombres de preparaciones
        const numPreps = Array.from(new Set(minutasRaw.map(m => Number(m.numeroPreparacion)).filter(n => !isNaN(n))))
        const preps = await prisma.preparaciones.findMany({
            where: {
                numeroPreparacion: { in: numPreps }
            },
            select: {
                numeroPreparacion: true,
                nombrePreparacion: true,
                nombreProducto: true
            }
        })

        const prepMap = new Map<number, string>()
        for (const p of preps) {
            prepMap.set(p.numeroPreparacion, p.nombrePreparacion?.trim() || p.nombreProducto?.trim() || `Prep ${p.numeroPreparacion}`)
        }

        // Mapear por niveles comunes ('T' | 'B' | 'M' / GENERAL)
        const diasPorNivel: Record<string, Record<number, Array<{ servicio: string; preparacion: string }>>> = {
            'GENERAL': {},
            'T': {},
            'B': {},
            'M': {}
        }

        for (const m of minutasRaw) {
            const dia = m.dia
            const numP = Number(m.numeroPreparacion)
            const prepNombre = prepMap.get(numP) || `Prep ${numP}`
            const item = { servicio: m.nombreServicio || m.codigoServicio || 'Servicio', preparacion: prepNombre }

            // Guardar en GENERAL
            if (!diasPorNivel['GENERAL'][dia]) diasPorNivel['GENERAL'][dia] = []
            if (!diasPorNivel['GENERAL'][dia].some(x => x.preparacion === item.preparacion)) {
                diasPorNivel['GENERAL'][dia].push(item)
            }

            // Si el programa indica nivel
            const prog = (m.programa || '').toUpperCase()
            let nivelKey = 'GENERAL'
            if (prog.includes('PARV') || prog.includes('TRANS')) nivelKey = 'T'
            else if (prog.includes('BASIC') || prog.includes('MEDIA') || prog.includes('NMMN')) {
                nivelKey = prog.includes('MEDIA') ? 'M' : 'B'
            }

            if (nivelKey !== 'GENERAL') {
                if (!diasPorNivel[nivelKey][dia]) diasPorNivel[nivelKey][dia] = []
                if (!diasPorNivel[nivelKey][dia].some(x => x.preparacion === item.preparacion)) {
                    diasPorNivel[nivelKey][dia].push(item)
                }
            }
        }

        let sincronizados = 0
        for (const [nivel, diasObj] of Object.entries(diasPorNivel)) {
            if (Object.keys(diasObj).length === 0) continue

            await dbMinutas().upsert({
                where: {
                    licId_anio_mes_nivel: {
                        licId,
                        anio,
                        mes,
                        nivel
                    }
                },
                create: {
                    licId,
                    anio,
                    mes,
                    nivel,
                    datosJson: JSON.stringify(diasObj),
                    filename: 'Sincronizado desde Minutas del Sistema',
                    usuarioModif: username
                },
                update: {
                    datosJson: JSON.stringify(diasObj),
                    filename: 'Sincronizado desde Minutas del Sistema',
                    usuarioModif: username
                }
            })
            sincronizados++
        }

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'SYNC_MINUTAS_SISTEMA',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Sincronizadas ${sincronizados} minutas de niveles para periodo ${mes}/${anio} licitación ${licId} desde tabla Minutas.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return {
            success: true,
            count: sincronizados,
            message: `Sincronización completada exitosamente (${sincronizados} niveles procesados).`
        }
    } catch (error: any) {
        console.error('Error al sincronizar minutas:', error)
        return { error: error.message || 'Error al sincronizar minutas.' }
    }
}

export async function eliminarMinutaMes(id: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para eliminar la minuta.' }
    }

    try {
        await ensureMultasEETables()
        const session = await getSession()
        const username = session?.user?.name || session?.user?.username || 'Usuario'

        await dbMinutas().delete({
            where: { id }
        })

        try {
            await logAuditAction({
                username,
                userId: session?.user?.id || null,
                action: 'DELETE_MINUTA_MES',
                modulo: 'MULTAS_CONFIGURACION',
                detalle: `Eliminada minuta planificada ID: ${id}.`
            })
        } catch (auditErr) {
            console.warn('Error en logAuditAction:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar minuta:', error)
        return { error: error.message || 'Error al eliminar minuta.' }
    }
}

