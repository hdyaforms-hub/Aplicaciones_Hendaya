'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type PreparacionData = {
    licitacion: string
    numeroPreparacion: number
    nombrePreparacion: string
    numeroPrograma: string
    programa: string
    numeroCocina: number
    cocina: string
    codigoProducto: string
    nombreProducto: string
    codigoSubServicio: string
    nombreSubServicio: string
    cantPreparacion: number
    porcentajePerdida: number
}

export async function checkPreparacionesExists(data: PreparacionData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_preparaciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Buscamos si existe al menos un registro en la BD que coincida con NumeroPreparacion y Licitacion
    const firstRow = data[0]

    const existing = await prisma.preparaciones.findFirst({
        where: {
            numeroPreparacion: firstRow.numeroPreparacion,
            licitacion: firstRow.licitacion
        }
    })

    if (existing) {
        return { exists: true }
    }

    return { exists: false }
}

export async function uploadPreparacionesData(data: PreparacionData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_preparaciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        if (overwrite) {
            // Eliminar registros previos con las mismas licitaciones y numeros de preparacion presentes en el excel
            // Para ser más seguros, eliminamos por combinación de licitacion y numeroPreparacion
            const uniqueKeys = data.reduce((acc, curr) => {
                const key = `${curr.licitacion}-${curr.numeroPreparacion}`
                if (!acc.find(k => k.key === key)) {
                    acc.push({ key, licitacion: curr.licitacion, numeroPreparacion: curr.numeroPreparacion })
                }
                return acc
            }, [] as { key: string, licitacion: string, numeroPreparacion: number }[])

            for (const item of uniqueKeys) {
                await prisma.preparaciones.deleteMany({
                    where: { 
                        licitacion: item.licitacion,
                        numeroPreparacion: item.numeroPreparacion
                    }
                })
            }
        }

        const dataToInsert = data.map(d => ({
            licitacion: String(d.licitacion),
            numeroPreparacion: Number(d.numeroPreparacion),
            nombrePreparacion: String(d.nombrePreparacion),
            numeroPrograma: String(d.numeroPrograma),
            programa: String(d.programa),
            numeroCocina: Number(d.numeroCocina),
            cocina: String(d.cocina),
            codigoProducto: String(d.codigoProducto),
            nombreProducto: String(d.nombreProducto),
            codigoSubServicio: String(d.codigoSubServicio),
            nombreSubServicio: String(d.nombreSubServicio),
            cantPreparacion: d.cantPreparacion,
            porcentajePerdida: Number(d.porcentajePerdida),
        }))

        // Insertar por lotes
        await prisma.preparaciones.createMany({
            data: dataToInsert
        })

        revalidatePath('/dashboard/calculadora/preparaciones')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos Preparaciones:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}

export async function updatePreparacionProducts(products: { id: string, codigoProducto?: string, nombreProducto?: string, cantPreparacion: number, porcentajePerdida: number }[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_preparaciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        for (const p of products) {
            await prisma.preparaciones.update({
                where: { id: p.id },
                data: {
                    codigoProducto: p.codigoProducto,
                    nombreProducto: p.nombreProducto,
                    cantPreparacion: p.cantPreparacion,
                    porcentajePerdida: p.porcentajePerdida
                }
            })
        }

        revalidatePath('/dashboard/calculadora/preparaciones')
        return { success: true }
    } catch (error: any) {
        console.error('Error actualizando productos de preparación:', error)
        return { error: 'Error al actualizar los productos en la base de datos.' }
    }
}


export async function createPreparacionProduct(data: any) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_preparaciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.preparaciones.create({
            data: {
                licitacion: data.licitacion,
                numeroPreparacion: data.numeroPreparacion,
                nombrePreparacion: data.nombrePreparacion,
                numeroPrograma: data.numeroPrograma,
                programa: data.programa,
                numeroCocina: data.numeroCocina,
                cocina: data.cocina,
                codigoProducto: data.codigoProducto,
                nombreProducto: data.nombreProducto,
                codigoSubServicio: data.codigoSubServicio,
                nombreSubServicio: data.nombreSubServicio,
                cantPreparacion: data.cantPreparacion,
                porcentajePerdida: data.porcentajePerdida
            }
        })

        revalidatePath('/dashboard/calculadora/preparaciones')
        return { success: true }
    } catch (error: any) {
        console.error('Error creando producto de preparación:', error)
        return { error: 'Error al crear el producto.' }
    }
}

export async function deletePreparacionProduct(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_preparaciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.preparaciones.delete({
            where: { id }
        })

        revalidatePath('/dashboard/calculadora/preparaciones')
        return { success: true }
    } catch (error: any) {
        console.error('Error eliminando producto de preparación:', error)
        return { error: 'Error al eliminar el producto.' }
    }
}


