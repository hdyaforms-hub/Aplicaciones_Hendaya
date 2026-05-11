'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type MinutaData = {
    numeroMinuta: string
    licitacion: string
    numeroPrograma: string
    programa: string
    numeroCocina: number
    cocina: string
    dia: number
    mes: number
    anio: number
    numeroPreparacion: number | string | bigint
    sucid: string
    codigoServicio: string
    nombreServicio: string
    codigoEnlace: number
    nombreEnlace: string
}

export async function checkMinutasExists(data: MinutaData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    const firstRow: any = data[0]
 
    const existing = await prisma.minutas.findFirst({
        where: {
            numeroMinuta: String(firstRow.NumeroMinuta || ''),
            licitacion: String(firstRow.Licitacion || '')
        }
    })

    if (existing) {
        return { exists: true }
    }

    return { exists: false }
}

export async function uploadMinutasData(data: MinutaData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        if (overwrite) {
            // Obtener combinaciones únicas de licitacion y numeroMinuta para borrar
            const uniqueKeys = data.reduce((acc, curr: any) => {
                const key = `${curr.Licitacion}-${curr.NumeroMinuta}`
                if (!acc.find(k => k.key === key)) {
                    acc.push({ key, licitacion: curr.Licitacion, numeroMinuta: curr.NumeroMinuta })
                }
                return acc
            }, [] as { key: string, licitacion: string, numeroMinuta: string }[])

            // Borrar en lotes si hay muchos
            for (const item of uniqueKeys) {
                await prisma.minutas.deleteMany({
                    where: { 
                        licitacion: item.licitacion,
                        numeroMinuta: item.numeroMinuta
                    }
                })
            }
        }

        const dataToInsert = data.map((d: any) => ({
            numeroMinuta: String(d.NumeroMinuta || ''),
            licitacion: String(d.Licitacion || ''),
            numeroPrograma: String(d.NumeroPrograma || ''),
            programa: String(d.Programa || ''),
            numeroCocina: Number(d.NumeroCocina) || 0,
            cocina: String(d.Cocina || ''),
            dia: Number(d.Dia) || 0,
            mes: Number(d.Mes) || 0,
            anio: Number(d.Año) || 0,
            numeroPreparacion: d.NumeroPreparacion ? BigInt(d.NumeroPreparacion) : BigInt(0),
            sucid: String(d.sucid || ''),
            codigoServicio: String(d.CodigoServicio || ''),
            nombreServicio: String(d.NombreServicio || ''),
            codigoEnlace: Number(d.CodigoEnlace) || 0,
            nombreEnlace: String(d.NombreEnlace || ''),
        }))

        // Insertar en trozos de 1000 para no saturar la conexión
        const chunkSize = 1000
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
            const chunk = dataToInsert.slice(i, i + chunkSize)
            await prisma.minutas.createMany({
                data: chunk
            })
        }

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error detallado insertando datos Minutas:', error)
        // Intentar devolver un mensaje más específico si es posible
        if (error.code === 'P2002') return { error: 'Error de duplicidad en los datos.' }
        if (error.message?.includes('BigInt')) return { error: 'Error en el formato de NumeroPreparacion (debe ser numérico).' }
        return { error: `Error DB: ${error.message || 'Ocurrió un error al guardar los registros.'}` }
    }
}

export async function updateMinutaEntries(entries: { id: string, numeroPreparacion: number | string | bigint, codigoEnlace: number, nombreEnlace: string }[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        for (const e of entries) {
            await prisma.minutas.update({
                where: { id: e.id },
                data: {
                    numeroPreparacion: BigInt(e.numeroPreparacion),
                    codigoEnlace: Number(e.codigoEnlace),
                    nombreEnlace: e.nombreEnlace
                }
            })
        }

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error actualizando entradas de minuta:', error)
        return { error: 'Error al actualizar los registros.' }
    }
}

export async function createMinutaEntry(data: any) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.minutas.create({
            data: {
                ...data,
                numeroPreparacion: BigInt(data.numeroPreparacion),
                numeroCocina: Number(data.numeroCocina),
                dia: Number(data.dia),
                mes: Number(data.mes),
                anio: Number(data.anio),
                codigoEnlace: Number(data.codigoEnlace)
            }
        })

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error creando entrada de minuta:', error)
        return { error: 'Error al crear el registro.' }
    }
}

export async function deleteMinutaEntry(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.minutas.delete({
            where: { id }
        })

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error eliminando entrada de minuta:', error)
        return { error: 'Error al eliminar el registro.' }
    }
}
export async function deleteMassiveMinutas(mes: number, anio: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const deleted = await prisma.minutas.deleteMany({
            where: {
                mes: mes,
                anio: anio
            }
        })

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true, count: deleted.count }
    } catch (error: any) {
        console.error('Error en eliminación masiva de minutas:', error)
        return { error: 'Error al realizar la eliminación masiva.' }
    }
}
