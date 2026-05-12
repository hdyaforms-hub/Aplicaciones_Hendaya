'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type RacionData = {
    licitacion: string
    numeroServicio: string
    servicio: string
    numeroCocina: number
    numeroArea: string
    numeroEnlace: number
    numeroLocacion: string
    locacion: string
    numeroPrograma: string
    programa: string
    mes: number
    anio: number
    fecha: string
    estadoRacion: number
    numeroBeneficiario: number
    beneficiario: string
    cantidad: number
    rbd: number
    ut: number
}

export async function checkRacionesExists(data: RacionData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Buscamos si existe al menos un registro en la BD que coincida con Licitacion y NumeroServicio
    // (Asumiendo que licitacion y servicio son combinaciones clave)
    const uniqueKeys = Array.from(new Set(data.map(d => `${d.licitacion}-${d.numeroServicio}`)))
    
    for (const key of uniqueKeys) {
        const [licitacion, numeroServicio] = key.split('-')
        const existing = await prisma.raciones.findFirst({
            where: {
                numeroServicio: String(numeroServicio),
                licitacion: String(licitacion)
            }
        })
        if (existing) {
            return { exists: true, message: `Ya existen registros para el servicio ${numeroServicio} en la licitación ${licitacion}.` }
        }
    }

    return { exists: false }
}

export async function uploadRacionesData(data: RacionData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        if (overwrite) {
            const uniqueKeys = data.reduce((acc, curr) => {
                const key = `${curr.licitacion}-${curr.numeroServicio}`
                if (!acc.find(k => k.key === key)) {
                    acc.push({ key, licitacion: curr.licitacion, numeroServicio: curr.numeroServicio })
                }
                return acc
            }, [] as { key: string, licitacion: string, numeroServicio: string }[])

            for (const item of uniqueKeys) {
                await prisma.raciones.deleteMany({
                    where: { 
                        licitacion: item.licitacion,
                        numeroServicio: item.numeroServicio
                    }
                })
            }
        } else {
            const check = await checkRacionesExists(data)
            if (check.exists) {
                return { error: check.message || 'Algunos registros ya existen en la base de datos.' }
            }
        }

        const dataToInsert = data.map(d => ({
            licitacion: String(d.licitacion),
            numeroServicio: String(d.numeroServicio),
            servicio: String(d.servicio),
            numeroCocina: Number(d.numeroCocina),
            numeroArea: String(d.numeroArea),
            numeroEnlace: Number(d.numeroEnlace),
            numeroLocacion: String(d.numeroLocacion),
            locacion: String(d.locacion),
            numeroPrograma: String(d.numeroPrograma),
            programa: String(d.programa),
            mes: Number(d.mes),
            anio: Number(d.anio),
            fecha: new Date(d.fecha),
            estadoRacion: Number(d.estadoRacion),
            numeroBeneficiario: Number(d.numeroBeneficiario),
            beneficiario: String(d.beneficiario),
            cantidad: Number(d.cantidad),
            rbd: Number(d.rbd),
            ut: Number(d.ut)
        }))

        // Insertar por lotes
        await prisma.raciones.createMany({
            data: dataToInsert
        })

        revalidatePath('/dashboard/calculadora/raciones')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos Raciones:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}

export async function updateRacion(id: string, cantidad: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.raciones.update({
            where: { id },
            data: { cantidad: Number(cantidad) }
        })
        revalidatePath('/dashboard/calculadora/raciones')
        return { success: true }
    } catch (error) {
        console.error('Error actualizando ración:', error)
        return { error: 'No se pudo actualizar la cantidad de la ración.' }
    }
}
