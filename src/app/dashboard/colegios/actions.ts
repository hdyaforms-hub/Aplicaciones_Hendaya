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
            colRBDDV: String(d.colRBDDV).trim(),
            insid: String(d.insid).trim(),
            institucion: String(d.institucion).trim(),
            sucursal: String(d.sucursal).trim(),
            nombreEstablecimiento: String(d.nombreEstablecimiento).trim(),
            direccionEstablecimiento: String(d.direccionEstablecimiento).trim(),
            comuna: String(d.comuna).trim(),
            uploadedBy: username
        }))

        // Insertar por lotes
        await prisma.colegios.createMany({
            data: dataToInsert
        })

        // Sincronizar JUNAEB a ColegiosMatriz (solo los nuevos)
        const junaebs = dataToInsert.filter(d => d.institucion === 'JUNAEB')
        for (const j of junaebs) {
            const exists = await prisma.colegiosMatriz.findUnique({ where: { colRBD: j.colRBD } })
            if (!exists) {
                await prisma.colegiosMatriz.create({
                    data: {
                        colRBD: j.colRBD,
                        nombreEstablecimiento: j.nombreEstablecimiento,
                        institucion: j.institucion,
                        sucursal: j.sucursal,
                        colut: j.colut,
                        isActive: true
                    }
                })
            }
        }

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

        // Sincronizar cambios a ColegiosMatriz si existe
        const current = await prisma.colegios.findUnique({ where: { id } })
        if (current) {
            await prisma.colegiosMatriz.updateMany({
                where: { colRBD: current.colRBD },
                data: {
                    nombreEstablecimiento: data.nombreEstablecimiento || current.nombreEstablecimiento,
                    institucion: data.institucion || current.institucion,
                    sucursal: data.sucursal || current.sucursal,
                }
            })
        }

        revalidatePath('/dashboard/colegios')
        return { success: true }
    } catch (e) {
        console.error("Error updating colegio:", e)
        return { error: 'No se pudo actualizar el colegio.' }
    }
}

export async function deleteColegioByRBD(rbd: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        // 1. Eliminar de Colegios
        await prisma.colegios.deleteMany({
            where: { colRBD: rbd }
        })

        // 2. Marcar como inactivo en ColegiosMatriz si existe
        await prisma.colegiosMatriz.updateMany({
            where: { colRBD: rbd },
            data: { isActive: false }
        })

        revalidatePath('/dashboard/colegios')
        return { success: true }
    } catch (error) {
        console.error('Error eliminando colegio por RBD:', error)
        return { error: 'No se pudo eliminar el colegio.' }
    }
}

export async function syncJUNAEBToMatriz() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const junaebColegios = await prisma.colegios.findMany({
            where: { institucion: 'JUNAEB' }
        })

        let count = 0
        for (const col of junaebColegios) {
            const existing = await prisma.colegiosMatriz.findUnique({
                where: { colRBD: col.colRBD }
            })

            if (!existing) {
                await prisma.colegiosMatriz.create({
                    data: {
                        colRBD: col.colRBD,
                        nombreEstablecimiento: col.nombreEstablecimiento,
                        institucion: col.institucion,
                        sucursal: col.sucursal,
                        colut: col.colut,
                        isActive: true
                    }
                })
                count++
            }
        }

        return { success: true, count }
    } catch (error) {
        console.error('Error sincronizando colegios JUNAEB:', error)
        return { error: 'Error al sincronizar con Matriz.' }
    }
}

