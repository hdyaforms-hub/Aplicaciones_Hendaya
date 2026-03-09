'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type ProductoData = {
    nombre: string
    codigo: string
    unidad: string
    tipoProducto: number
}

export async function checkProductosExists(data: ProductoData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_productos')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Buscamos si existe al menos un registro en la BD que coincida con codigo (que asumo es ID principal)
    // Para simplificar, revisamos si el primer producto ya existe
    const firstRow = data[0]

    const existing = await prisma.productos.findFirst({
        where: {
            codigo: firstRow.codigo,
        }
    })

    if (existing) {
        return { exists: true } // Confirmar con el usuario
    }

    return { exists: false }
}

export async function uploadProductosData(data: ProductoData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_productos')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        if (overwrite) {
            // Eliminar registros previos con los mismos codigos presentes en el excel
            const codigos = [...new Set(data.map(d => d.codigo))]

            for (const codigo of codigos) {
                await prisma.productos.deleteMany({
                    where: { codigo }
                })
            }
        }

        const dataToInsert = data.map(d => ({
            nombre: String(d.nombre),
            codigo: String(d.codigo),
            unidad: String(d.unidad),
            tipoProducto: Number(d.tipoProducto),
        }))

        // Insertar por lotes
        await prisma.productos.createMany({
            data: dataToInsert
        })

        revalidatePath('/dashboard/productos')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos Productos:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}

export async function updateProducto(id: string, data: Partial<ProductoData>) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_productos')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.productos.update({
            where: { id },
            data: {
                nombre: data.nombre,
                unidad: data.unidad,
                tipoProducto: data.tipoProducto,
            }
        })
        revalidatePath('/dashboard/productos')
        return { success: true }
    } catch (e) {
        console.error("Error updating producto:", e)
        return { error: 'No se pudo actualizar el producto.' }
    }
}
