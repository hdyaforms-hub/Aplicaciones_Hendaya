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

    // Obtener todas las combinaciones únicas de licitación y numeroMinuta del archivo
    const uniqueKeys = Array.from(new Set(data.map(d => `${d.licitacion || (d as any).Licitacion}-${d.numeroMinuta || (d as any).NumeroMinuta}`)))
    
    for (const key of uniqueKeys) {
        const [licitacion, numeroMinuta] = key.split('-')
        const existing = await prisma.minutas.findFirst({
            where: {
                numeroMinuta: String(numeroMinuta || ''),
                licitacion: String(licitacion || '')
            }
        })
        if (existing) {
            return { exists: true, message: `Ya existen registros para la minuta ${numeroMinuta} en la licitación ${licitacion}.` }
        }
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
                const lic = curr.Licitacion || curr.licitacion
                const num = curr.NumeroMinuta || curr.numeroMinuta
                const key = `${lic}-${num}`
                if (!acc.find(k => k.key === key)) {
                    acc.push({ key, licitacion: String(lic), numeroMinuta: String(num) })
                }
                return acc
            }, [] as { key: string, licitacion: string, numeroMinuta: string }[])

            // Borrar en lotes
            for (const item of uniqueKeys) {
                await prisma.minutas.deleteMany({
                    where: { 
                        licitacion: item.licitacion,
                        numeroMinuta: item.numeroMinuta
                    }
                })
            }
        } else {
            // Si no se permite sobrescribir, validamos que NINGUNO exista
            const check = await checkMinutasExists(data)
            if (check.exists) {
                return { error: check.message || 'Algunos registros ya existen en la base de datos.' }
            }
        }

        const dataToInsert = data.map((d: any) => ({
            numeroMinuta: String(d.NumeroMinuta || d.numeroMinuta || ''),
            licitacion: String(d.Licitacion || d.licitacion || ''),
            numeroPrograma: String(d.NumeroPrograma || d.numeroPrograma || ''),
            programa: String(d.Programa || d.programa || ''),
            numeroCocina: Number(d.NumeroCocina || d.numeroCocina) || 0,
            cocina: String(d.Cocina || d.cocina || ''),
            dia: Number(d.Dia || d.dia) || 0,
            mes: Number(d.Mes || d.mes) || 0,
            anio: Number(d.Año || d.anio) || 0,
            numeroPreparacion: (d.NumeroPreparacion || d.numeroPreparacion) ? BigInt(d.NumeroPreparacion || d.numeroPreparacion) : BigInt(0),
            sucid: String(d.sucid || d.sucid || ''),
            codigoServicio: String(d.CodigoServicio || d.codigoServicio || ''),
            nombreServicio: String(d.NombreServicio || d.nombreServicio || ''),
            codigoEnlace: Number(d.CodigoEnlace || d.codigoEnlace) || 0,
            nombreEnlace: String(d.NombreEnlace || d.nombreEnlace || ''),
        }))

        // Insertar en trozos de 1000
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
        if (error.code === 'P2002') return { error: 'Error de duplicidad en los datos (Restricción de BD).' }
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
        // Validar si ya existe el registro exacto
        const existing = await prisma.minutas.findFirst({
            where: {
                licitacion: data.licitacion,
                numeroMinuta: data.numeroMinuta,
                dia: Number(data.dia),
                mes: Number(data.mes),
                anio: Number(data.anio),
                numeroPreparacion: BigInt(data.numeroPreparacion),
                sucid: data.sucid,
                codigoServicio: data.codigoServicio
            }
        })

        if (existing) {
            return { error: 'Esta combinación de minuta, día, preparación y servicio ya existe para este establecimiento.' }
        }

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
