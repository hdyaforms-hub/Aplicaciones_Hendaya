'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { TABLA_AQL_PAE_DEFAULT } from '@/lib/multas/it/alertas'

const PATH = '/dashboard/mantenedor/multas/configuracion'

export interface ModuloSistemaConfig {
    codigo: string
    nombre: string
    descripcion: string
    activo: boolean
    fase: 'Operativo' | 'En Desarrollo' | 'Planificado'
}

export const MODULOS_C_DEFAULT: ModuloSistemaConfig[] = [
    { codigo: 'C1', nombre: 'Hub Configuración de Multas y Parámetros', descripcion: 'Parametrización dinámica y centralizada de umbrales por licitación.', activo: true, fase: 'Operativo' },
    { codigo: 'C2', nombre: 'Restricciones y Reglas por Aspecto', descripcion: 'Reglas de excepción por año calendario y rangos de fechas (ej: M 2024/2025 = $0).', activo: true, fase: 'Operativo' },
    { codigo: 'C3', nombre: 'Cálculo Dinámico y Alertas Técnicas IT', descripcion: 'Motor de cálculo de multas sincronizado con UTM, servicios y fórmulas oficiales.', activo: true, fase: 'Operativo' },
    { codigo: 'C4', nombre: 'Gestión de Descargos y Resoluciones', descripcion: 'Control de descargos de actas, resoluciones de multas y plazos de apelación.', activo: true, fase: 'Operativo' },
    { codigo: 'C5', nombre: 'Detección de Causales No Imputables', descripcion: 'Análisis textual inteligente de cortes de suministro, paros gremiales y fuerza mayor.', activo: true, fase: 'Operativo' },
    { codigo: 'C6', nombre: 'Auditoría de Pesaje y Control AQL 6,5', descripcion: 'Verificación de tamaño de muestra de bandejas pesadas según tabla Militar Estándar.', activo: true, fase: 'Operativo' },
    { codigo: 'C7', nombre: 'Control de Ratio Manipuladoras (Aspecto H)', descripcion: 'Cálculo de dotación mínima (1 manipuladora cada 70 raciones de establecimiento).', activo: true, fase: 'Operativo' },
    { codigo: 'C8', nombre: 'Rangos Térmicos y Calidad (Aspecto K)', descripcion: 'Monitoreo de umbrales térmicos en equipos de frío y congelación.', activo: true, fase: 'Operativo' },
    { codigo: 'C9', nombre: 'Tolerancias Frutas y Hortalizas (Aspecto F)', descripcion: 'Límites de defectos leves (10%), moderados (5%) y graves (0%) según Anexo 2.', activo: true, fase: 'Operativo' },
    { codigo: 'C10', nombre: 'Subsanabilidad y Pautas de Solución', descripcion: 'Detección de aspectos subsanables (B, E, J, L) y pautas de solución en 5 días.', activo: true, fase: 'Operativo' },
    { codigo: 'C11', nombre: 'Tablero Ejecutivo y Reportes EE', descripcion: 'Métricas gerenciales de multas, distribución por aspecto y montos en UTM.', activo: false, fase: 'Planificado' }
]

export const CAUSAS_NO_IMPUTABLES_DEFAULT = [
    { terminoClave: 'corte de agua', descripcion: 'Corte o suspensión del suministro de agua potable no atribuible al prestador.', imputable: false },
    { terminoClave: 'corte de luz', descripcion: 'Corte o falla en el suministro de energía eléctrica acreditada por compañía.', imputable: false },
    { terminoClave: 'toma del establecimiento', descripcion: 'Toma del establecimiento educacional declarada formalmente por dirección.', imputable: false },
    { terminoClave: 'paro', descripcion: 'Paralización de actividades o paro docente/estudiantil/gremial.', imputable: false },
    { terminoClave: 'fuerza mayor', descripcion: 'Evento imprevisto de fuerza mayor, catástrofe natural o emergencia comunal.', imputable: false },
    { terminoClave: 'temporal', descripcion: 'Temporal climático severo, lluvias torrenciales o anegamiento de accesos.', imputable: false }
]

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
