'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

// Interfaz que coincide con las columnas del Excel y BD
export type PMPAData = {
    ano: number
    mes: number
    licitacion: number
    ute: number
    rbd: number
    programa: string
    estrato: string
    nivel: string
    servicioLic: string
    raceqJunaeb: number
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

    // Buscamos si existe al menos un registro en la BD que coincida con el primer mes/año/ute
    // (Asumiendo que los archivos vienen agrupados por esos criterios, o verificamos el primer row)
    const firstRow = data[0]

    // Simplificación de verificación: si existe algún registro del mismo año y mes que el primero del excel
    const existing = await prisma.pMPA.findFirst({
        where: {
            ano: firstRow.ano,
            mes: firstRow.mes,
            ute: firstRow.ute
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
            const periodos = [...new Set(data.map(d => `${d.ano}-${d.mes}-${d.ute}`))]

            for (const p of periodos) {
                const [ano, mes, ute] = p.split('-')
                await prisma.pMPA.deleteMany({
                    where: {
                        ano: parseInt(ano),
                        mes: parseInt(mes),
                        ute: parseInt(ute)
                    }
                })
            }
        }

        // Mapear agregando el usuario que subió el registro
        const dataToInsert = data.map(d => ({
            ano: Number(d.ano),
            mes: Number(d.mes),
            licitacion: Number(d.licitacion),
            ute: Number(d.ute),
            rbd: Number(d.rbd),
            programa: String(d.programa).trim(),
            estrato: String(d.estrato).trim(),
            nivel: String(d.nivel).trim(),
            servicioLic: String(d.servicioLic).trim(),
            raceqJunaeb: Number(d.raceqJunaeb),
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

export async function deletePMPAPeriod(ano: number, mes: number, ute?: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_pmpa')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const where: any = { ano, mes }
        if (ute) where.ute = ute

        const deleted = await prisma.pMPA.deleteMany({ where })
        
        revalidatePath('/dashboard/pmpa')
        return { success: true, count: deleted.count }
    } catch (error: any) {
        console.error('Error eliminando periodo PMPA:', error)
        return { error: 'Ocurrió un error al eliminar los registros.' }
    }
}
