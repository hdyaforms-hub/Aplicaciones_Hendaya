'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export interface ActaField {
    id: string
    label: string
    type: 
        | 'text' 
        | 'textarea' 
        | 'date' 
        | 'time' 
        | 'select' 
        | 'multiselect' 
        | 'radio' 
        | 'checkbox' 
        | 'section' 
        | 'separator'
        | 'group'
        | 'audit_item'
        | 'linear_scale' 
        | 'rating' 
        | 'evaluation' 
        | 'observation' 
        | 'grid_options' 
        | 'grid_checkbox' 
        | 'table' 
        | 'dynamic_table' 
        | 'signature' 
        | 'signature_with_data'
        | 'file'
        | 'numeric_special'
        | 'totalizer'
    required: boolean
    validation?: string
    options?: string[]
    numericOptions?: { label: string; value: string }[]
    targetFields?: string[]
    operation?: 'sum' | 'subtract' | 'multiply' | 'divide' | 'average' | 'percentage'
    minScale?: number
    maxScale?: number
    maxScore?: number
    weight?: number
    gridRows?: string[]
    gridCols?: string[]
    tableColumns?: {
        key: string
        label: string
        type: 'text_short' | 'text' | 'number' | 'number_special' | 'rut' | 'signature' | 'file' | 'select' | 'radio' | 'checkbox' | 'rating' | 'totalizer'
        options?: string[]
    }[]
    auditColumns?: {
        key: string
        label: string
        type: 'text' | 'select' | 'number' | 'number_special' | 'totalizer'
        options?: string[]
        includeInTotalizer?: boolean
        operation?: 'sum' | 'average' | 'percentage' | 'subtract' | 'multiply' | 'divide'
        numeratorColKey?: string
        denominatorColKey?: string
        capAt100?: boolean
    }[]
    placeholder?: string
    helpText?: string
    dato1Label?: string
    dato2Label?: string
    layoutWidth?: '100%' | '50%' | '33%' | '25%'
    hideNumber?: boolean
}

export async function getLicitacionesList() {
    try {
        const lics = await prisma.licitacion.findMany({
            orderBy: { licId: 'asc' },
            select: {
                licId: true,
                licitacionHomologada: true
            }
        })
        return lics
    } catch (error) {
        console.error('Error al obtener licitaciones:', error)
        return []
    }
}

export async function getRolesList() {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                description: true
            }
        })
        return roles
    } catch (error) {
        console.error('Error al obtener lista de roles:', error)
        return []
    }
}

export async function getActasPlantillas() {
    try {
        const plantillas = await rawPrisma.actaSupervisionPlantilla.findMany({
            include: {
                licitacion: true,
                _count: {
                    select: { respuestas: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return plantillas.map((p: any) => ({
            ...p,
            campos: JSON.parse(p.campos || '[]')
        }))
    } catch (error) {
        console.error('Error al obtener plantillas de actas:', error)
        return []
    }
}

export async function getActaPlantillaById(id: string) {
    try {
        const plantilla = await rawPrisma.actaSupervisionPlantilla.findUnique({
            where: { id },
            include: {
                licitacion: true,
                _count: {
                    select: { respuestas: true }
                }
            }
        })

        if (!plantilla) return null

        return {
            ...plantilla,
            campos: JSON.parse(plantilla.campos || '[]')
        }
    } catch (error) {
        console.error('Error al obtener plantilla de acta:', error)
        return null
    }
}

export async function saveActaPlantilla(data: {
    id?: string | null
    nombre: string
    licitacionId?: number | null
    anio: number
    instituciones?: string[] | string | null
    rolesPerfiles?: string[] | string | null
    estado: boolean
    logoUrl?: string | null
    instrucciones?: string | null
    codigo?: string | null
    version?: string | null
    fecha?: string | null
    codigoAdicional?: string | null
    mostrarCodigoAdicional?: boolean
    correlativoAutomatico?: boolean
    mostrarCodigoVersionFecha?: boolean
    campos: ActaField[]
}) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
            return { success: false, error: 'No tienes permisos para gestionar Actas de Supervisión' }
        }

        if (!data.nombre || !data.nombre.trim()) {
            return { success: false, error: 'El Nombre del Acta es obligatorio' }
        }

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null
        const camposJson = JSON.stringify(data.campos || [])
        const institucionesStr = Array.isArray(data.instituciones) 
            ? JSON.stringify(data.instituciones) 
            : (typeof data.instituciones === 'string' ? data.instituciones : '[]')
        const rolesPerfilesStr = Array.isArray(data.rolesPerfiles)
            ? JSON.stringify(data.rolesPerfiles)
            : (typeof data.rolesPerfiles === 'string' ? data.rolesPerfiles : '[]')

        let saved
        if (data.id) {
            // Actualizar existente
            saved = await rawPrisma.actaSupervisionPlantilla.update({
                where: { id: data.id },
                data: {
                    nombre: data.nombre.trim(),
                    licitacion: data.licitacionId ? { connect: { licId: Number(data.licitacionId) } } : { disconnect: true },
                    anio: Number(data.anio) || 2026,
                    instituciones: institucionesStr,
                    rolesPerfiles: rolesPerfilesStr,
                    estado: data.estado,
                    logoUrl: data.logoUrl || null,
                    instrucciones: data.instrucciones || null,
                    codigo: data.codigo || null,
                    version: data.version || null,
                    fecha: data.fecha || null,
                    codigoAdicional: data.codigoAdicional || null,
                    mostrarCodigoAdicional: data.mostrarCodigoAdicional ?? false,
                    correlativoAutomatico: data.correlativoAutomatico ?? false,
                    mostrarCodigoVersionFecha: data.mostrarCodigoVersionFecha ?? true,
                    campos: camposJson
                }
            })

            await logAuditAction({
                username,
                userId,
                action: 'EDITAR_PLANTILLA_ACTA',
                modulo: 'MANTENEDOR -> ACTAS DE SUPERVISIÓN',
                detalle: `Se actualizó la plantilla de acta "${saved.nombre}" (ID: ${saved.id})`
            })
        } else {
            // Crear nueva
            saved = await rawPrisma.actaSupervisionPlantilla.create({
                data: {
                    nombre: data.nombre.trim(),
                    licitacion: data.licitacionId ? { connect: { licId: Number(data.licitacionId) } } : undefined,
                    anio: Number(data.anio) || 2026,
                    instituciones: institucionesStr,
                    rolesPerfiles: rolesPerfilesStr,
                    estado: data.estado,
                    logoUrl: data.logoUrl || null,
                    instrucciones: data.instrucciones || null,
                    codigo: data.codigo || null,
                    version: data.version || null,
                    fecha: data.fecha || null,
                    codigoAdicional: data.codigoAdicional || null,
                    mostrarCodigoAdicional: data.mostrarCodigoAdicional ?? false,
                    correlativoAutomatico: data.correlativoAutomatico ?? false,
                    mostrarCodigoVersionFecha: data.mostrarCodigoVersionFecha ?? true,
                    campos: camposJson,
                    createdBy: username
                }
            })

            await logAuditAction({
                username,
                userId,
                action: 'CREAR_PLANTILLA_ACTA',
                modulo: 'MANTENEDOR -> ACTAS DE SUPERVISIÓN',
                detalle: `Se creó la plantilla de acta "${saved.nombre}" (ID: ${saved.id})`
            })
        }

        revalidatePath('/dashboard/mantenedor/actas-supervision/crear')
        return { success: true, id: saved.id }
    } catch (error: any) {
        console.error('Error al guardar plantilla de acta:', error)
        return { success: false, error: error.message || 'Error al guardar la plantilla' }
    }
}

export async function duplicateActaPlantilla(id: string, nuevoNombre?: string) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
            return { success: false, error: 'Sin permisos' }
        }

        const original = await rawPrisma.actaSupervisionPlantilla.findUnique({ where: { id } })
        if (!original) return { success: false, error: 'Plantilla no encontrada' }

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null

        const finalNombre = (nuevoNombre && nuevoNombre.trim()) 
            ? nuevoNombre.trim() 
            : `(Copia) ${original.nombre}`

        const copy = await rawPrisma.actaSupervisionPlantilla.create({
            data: {
                nombre: finalNombre,
                licitacion: original.licitacionId ? { connect: { licId: original.licitacionId } } : undefined,
                anio: original.anio,
                instituciones: original.instituciones,
                rolesPerfiles: original.rolesPerfiles,
                estado: original.estado,
                logoUrl: original.logoUrl,
                instrucciones: original.instrucciones,
                codigo: original.codigo,
                version: original.version,
                fecha: original.fecha,
                codigoAdicional: original.codigoAdicional,
                mostrarCodigoAdicional: original.mostrarCodigoAdicional,
                correlativoAutomatico: original.correlativoAutomatico,
                mostrarCodigoVersionFecha: original.mostrarCodigoVersionFecha,
                campos: original.campos,
                createdBy: username
            }
        })

        await logAuditAction({
            username,
            userId,
            action: 'DUPLICAR_PLANTILLA_ACTA',
            modulo: 'MANTENEDOR -> ACTAS DE SUPERVISIÓN',
            detalle: `Se duplicó la plantilla completa "${original.nombre}" -> "${copy.nombre}" con todos sus campos (ID: ${copy.id})`
        })

        revalidatePath('/dashboard/mantenedor/actas-supervision/crear')
        return { success: true, id: copy.id, copy }
    } catch (error: any) {
        console.error('Error al duplicar plantilla:', error)
        return { success: false, error: error.message || 'Error al duplicar' }
    }
}

export async function deleteActaPlantilla(id: string) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
            return { success: false, error: 'Sin permisos' }
        }

        const target = await rawPrisma.actaSupervisionPlantilla.findUnique({
            where: { id },
            include: { _count: { select: { respuestas: true } } }
        })
        if (!target) return { success: false, error: 'Cabecera no encontrada' }

        if (target._count?.respuestas > 0) {
            return {
                success: false,
                error: `No se puede eliminar el acta "${target.nombre}" porque ya tiene ${target._count.respuestas} respuesta(s) asociada(s).`
            }
        }

        await rawPrisma.actaSupervisionPlantilla.delete({ where: { id } })

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null

        await logAuditAction({
            username,
            userId,
            action: 'ELIMINAR_PLANTILLA_ACTA',
            modulo: 'MANTENEDOR -> ACTAS DE SUPERVISIÓN',
            detalle: `Se eliminó la plantilla de acta "${target.nombre}" (ID: ${target.id})`
        })

        revalidatePath('/dashboard/mantenedor/actas-supervision/crear')
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar plantilla:', error)
        return { success: false, error: error.message || 'Error al eliminar' }
    }
}

export async function toggleActaState(id: string, estado: boolean) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
            return { success: false, error: 'Sin permisos' }
        }

        const updated = await rawPrisma.actaSupervisionPlantilla.update({
            where: { id },
            data: { estado }
        })

        const username = session?.user?.username || 'desconocido'
        const userId = session?.user?.id || null

        await logAuditAction({
            username,
            userId,
            action: 'CAMBIAR_ESTADO_PLANTILLA_ACTA',
            modulo: 'MANTENEDOR -> ACTAS DE SUPERVISIÓN',
            detalle: `Se cambió el estado de la plantilla "${updated.nombre}" a ${estado ? 'VIGENTE' : 'NO VIGENTE'}`
        })

        revalidatePath('/dashboard/mantenedor/actas-supervision/crear')
        return { success: true }
    } catch (error: any) {
        console.error('Error al cambiar estado:', error)
        return { success: false, error: error.message || 'Error al cambiar estado' }
    }
}
