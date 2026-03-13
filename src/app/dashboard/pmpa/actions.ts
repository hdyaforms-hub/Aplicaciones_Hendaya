'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

// Interfaz que coincide con las columnas del Excel y BD
export type PMPAData = {
    sucursal: string
    ano: number
    mes: number
    rbd: number
    programa: string
    estrato: string
    raceq: number
    servicio: string
}

export async function checkPMPAExists(data: PMPAData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_pmpa')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Buscamos si existe al menos un registro en la BD que coincida con el primer mes/año/sucursal
    // (Asumiendo que los archivos vienen agrupados por esos criterios, o verificamos el primer row)
    const firstRow = data[0]

    // Simplificación de verificación: si existe algún registro del mismo año y mes que el primero del excel
    const existing = await prisma.pMPA.findFirst({
        where: {
            ano: firstRow.ano,
            mes: firstRow.mes,
            sucursal: firstRow.sucursal
        }
    })

    if (existing) {
        return { exists: true } // Confirmar con el usuario
    }

    return { exists: false }
}

export async function uploadPMPAData(data: PMPAData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_pmpa')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    const username = session.user.username as string

    try {
        if (overwrite) {
            // Eliminar registros previos con los mismos criterios (distintos años/meses presentes en el excel)
            // Agrupamos los criterios únicos para borrar exactamente lo que vamos a sobrescribir
            const periodos = [...new Set(data.map(d => `${d.ano}-${d.mes}-${d.sucursal}`))]

            for (const p of periodos) {
                const [ano, mes, sucursal] = p.split('-')
                await prisma.pMPA.deleteMany({
                    where: {
                        ano: parseInt(ano),
                        mes: parseInt(mes),
                        sucursal: sucursal
                    }
                })
            }
        }

        // Mapear agregando el usuario que subió el registro
        const dataToInsert = data.map(d => ({
            sucursal: String(d.sucursal).trim(),
            ano: Number(d.ano),
            mes: Number(d.mes),
            rbd: Number(d.rbd),
            programa: String(d.programa).trim(),
            estrato: String(d.estrato).trim(),
            raceq: Number(d.raceq),
            servicio: String(d.servicio).trim(),
            uploadedBy: username
        }))

        // Insertar por lotes
        await prisma.pMPA.createMany({
            data: dataToInsert
        })

        revalidatePath('/dashboard/pmpa')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos PMPA:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}
