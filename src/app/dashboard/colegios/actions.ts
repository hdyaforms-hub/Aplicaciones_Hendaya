'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type ColegioData = {
    colut: number
    colRBD: number
    colRBDDV: string
    insid: string
    institucion: string
    sucursal: string
    nombreEstablecimiento: string
    direccionEstablecimiento: string
    comuna: string
}

export async function checkColegiosExists(data: ColegioData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Buscamos si existe al menos un registro en la BD que coincida con colRBD (que asumo es ID principal)
    // Para simplificar, revisamos si el colegio de la primera fila ya existe
    const firstRow = data[0]

    const existing = await prisma.colegios.findFirst({
        where: {
            colRBD: firstRow.colRBD,
        }
    })

    if (existing) {
        return { exists: true } // Confirmar con el usuario
    }

    return { exists: false }
}

export async function uploadColegiosData(data: ColegioData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    const username = session.user.username as string

    try {
        if (overwrite) {
            // Eliminar registros previos con los mismos colRBD presentes en el excel
            const colesIds = [...new Set(data.map(d => d.colRBD))]

            for (const colRBD of colesIds) {
                await prisma.colegios.deleteMany({
                    where: { colRBD }
                })
            }
        }

        const dataToInsert = data.map(d => ({
            colut: Number(d.colut),
            colRBD: Number(d.colRBD),
            colRBDDV: String(d.colRBDDV),
            insid: String(d.insid),
            institucion: String(d.institucion),
            sucursal: String(d.sucursal),
            nombreEstablecimiento: String(d.nombreEstablecimiento),
            direccionEstablecimiento: String(d.direccionEstablecimiento),
            comuna: String(d.comuna),
            uploadedBy: username
        }))

        // Insertar por lotes
        await prisma.colegios.createMany({
            data: dataToInsert
        })

        revalidatePath('/dashboard/colegios')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos Colegios:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}

export async function updateColegio(id: string, data: Partial<ColegioData>) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.colegios.update({
            where: { id },
            data: {
                institucion: data.institucion,
                sucursal: data.sucursal,
                nombreEstablecimiento: data.nombreEstablecimiento,
                direccionEstablecimiento: data.direccionEstablecimiento,
                comuna: data.comuna,
            }
        })
        revalidatePath('/dashboard/colegios')
        return { success: true }
    } catch (e) {
        console.error("Error updating colegio:", e)
        return { error: 'No se pudo actualizar el colegio.' }
    }
}

