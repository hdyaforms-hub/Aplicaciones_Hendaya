'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

/**
 * Verifica si la sesión actual tiene el permiso requerido.
 */
async function verificarPermiso(permiso: string) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    if (!permissions.includes(permiso)) {
        throw new Error('No tiene los permisos necesarios para realizar esta acción.')
    }
    return session
}

/**
 * Obtiene todos los códigos de causa ordenados por ID de manera ascendente.
 */
export async function obtenerCodigosCausa() {
    try {
        await verificarPermiso('view_codigo_causa')
        
        const codigos = await prisma.codigoCausa.findMany({
            orderBy: {
                id: 'asc'
            }
        })
        
        return { success: true, data: codigos }
    } catch (error: any) {
        console.error('Error en obtenerCodigosCausa:', error)
        return { success: false, error: error.message || 'Error al obtener los códigos de causa.' }
    }
}

/**
 * Guarda o edita un código de causa.
 */
export async function guardarCodigoCausa(id: number, descripcion: string, imputable: string, definicion: string, isEdit: boolean) {
    try {
        await verificarPermiso('view_codigo_causa')

        // Validaciones de negocio
        if (!id || id <= 0 || !Number.isInteger(id)) {
            return { success: false, error: 'El ID debe ser un número entero mayor a cero.' }
        }

        if (!descripcion || descripcion.trim() === '') {
            return { success: false, error: 'La descripción no puede estar vacía.' }
        }

        if (!imputable || (imputable !== 'Imputable' && imputable !== 'No Imputable')) {
            return { success: false, error: 'La imputabilidad debe ser "Imputable" o "No Imputable".' }
        }

        const descripcionLimpia = descripcion.trim()
        const definicionLimpia = (definicion || '').trim()

        if (isEdit) {
            // Actualizar registro existente
            await prisma.codigoCausa.update({
                where: { id },
                data: { 
                    descripcion: descripcionLimpia,
                    imputable: imputable,
                    definicion: definicionLimpia
                }
            })
        } else {
            // Crear registro nuevo, verificando unicidad previamente
            const existente = await prisma.codigoCausa.findUnique({
                where: { id }
            })

            if (existente) {
                return { success: false, error: `El ID ${id} ya está registrado en la base de datos.` }
            }

            await prisma.codigoCausa.create({
                data: {
                    id,
                    descripcion: descripcionLimpia,
                    imputable: imputable,
                    definicion: definicionLimpia
                }
            })
        }

        revalidatePath('/dashboard/mantenedor/pae-online/codigo-causa')
        return { success: true }
    } catch (error: any) {
        console.error('Error en guardarCodigoCausa:', error)
        return { success: false, error: error.message || 'Error al guardar el código de causa.' }
    }
}

/**
 * Elimina un código de causa por su ID.
 */
export async function eliminarCodigoCausa(id: number) {
    try {
        await verificarPermiso('view_codigo_causa')

        if (!id || id <= 0) {
            return { success: false, error: 'ID inválido para eliminar.' }
        }

        await prisma.codigoCausa.delete({
            where: { id }
        })

        revalidatePath('/dashboard/mantenedor/pae-online/codigo-causa')
        return { success: true }
    } catch (error: any) {
        console.error('Error en eliminarCodigoCausa:', error)
        return { success: false, error: error.message || 'Error al eliminar el código de causa.' }
    }
}
