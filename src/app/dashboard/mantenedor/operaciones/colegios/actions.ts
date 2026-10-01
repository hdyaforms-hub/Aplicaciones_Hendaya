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
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    if (!isAdmin && !session?.user?.role?.permissions?.includes('view_colegios')) {
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
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    if (!isAdmin && !session?.user?.role?.permissions?.includes('view_colegios')) {
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

        revalidatePath('/dashboard/mantenedor/operaciones/colegios')
        revalidatePath('/dashboard/mantenedor/operaciones/personal')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos Colegios:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}

export async function updateColegio(id: string, data: Partial<ColegioData>) {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    if (!isAdmin && !session?.user?.role?.permissions?.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const current = await prisma.colegios.findUnique({ where: { id } })
        if (!current) {
            return { error: 'Colegio no encontrado.' }
        }

        const newInstitucion = data.institucion !== undefined 
            ? data.institucion.trim().toUpperCase() 
            : current.institucion?.trim().toUpperCase()

        await prisma.colegios.update({
            where: { id },
            data: {
                institucion: data.institucion !== undefined ? data.institucion.trim() : current.institucion,
                sucursal: data.sucursal !== undefined ? data.sucursal.trim() : current.sucursal,
                nombreEstablecimiento: data.nombreEstablecimiento !== undefined ? data.nombreEstablecimiento.trim() : current.nombreEstablecimiento,
                direccionEstablecimiento: data.direccionEstablecimiento !== undefined ? data.direccionEstablecimiento.trim() : current.direccionEstablecimiento,
                comuna: data.comuna !== undefined ? data.comuna.trim() : current.comuna,
            }
        })

        // Sincronizar inmediatamente con ColegiosMatriz (Módulo Matriz de Riesgo / Colegios Activos)
        if (newInstitucion !== 'JUNAEB') {
            // Si la institución ya no es JUNAEB (ej. JUNJI o INTEGRA), debe desaparecer de la matriz de riesgo
            await prisma.colegiosMatriz.deleteMany({
                where: { colRBD: current.colRBD }
            })
        } else {
            // Si es JUNAEB, asegurar que exista y esté actualizado en ColegiosMatriz
            const existingMatriz = await prisma.colegiosMatriz.findUnique({
                where: { colRBD: current.colRBD }
            })

            const nombreFinal = (data.nombreEstablecimiento || current.nombreEstablecimiento).trim()
            const sucursalFinal = (data.sucursal || current.sucursal).trim()

            if (!existingMatriz) {
                await prisma.colegiosMatriz.create({
                    data: {
                        colRBD: current.colRBD,
                        nombreEstablecimiento: nombreFinal,
                        institucion: 'JUNAEB',
                        sucursal: sucursalFinal,
                        colut: current.colut,
                        isActive: true
                    }
                })
            } else {
                await prisma.colegiosMatriz.update({
                    where: { colRBD: current.colRBD },
                    data: {
                        nombreEstablecimiento: nombreFinal,
                        institucion: 'JUNAEB',
                        sucursal: sucursalFinal,
                        colut: current.colut
                    }
                })
            }
        }

        revalidatePath('/dashboard/mantenedor/operaciones/colegios')
        revalidatePath('/dashboard/mantenedor/matriz-riesgo/colegios-activos')
        revalidatePath('/dashboard/matriz-riesgo')
        return { success: true }
    } catch (e) {
        console.error("Error updating colegio:", e)
        return { error: 'No se pudo actualizar el colegio.' }
    }
}

export async function deleteColegioByRBD(rbd: number) {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    if (!isAdmin && !session?.user?.role?.permissions?.includes('view_colegios')) {
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

        revalidatePath('/dashboard/mantenedor/operaciones/colegios')
        revalidatePath('/dashboard/mantenedor/matriz-riesgo/colegios-activos')
        revalidatePath('/dashboard/matriz-riesgo')
        return { success: true }
    } catch (error) {
        console.error('Error eliminando colegio por RBD:', error)
        return { error: 'No se pudo eliminar el colegio.' }
    }
}

export async function syncJUNAEBToMatriz() {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    if (!isAdmin && !session?.user?.role?.permissions?.includes('view_colegios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const allColegios = await prisma.colegios.findMany()

        const junaebColegios = allColegios.filter(c => c.institucion?.trim().toUpperCase() === 'JUNAEB')
        const nonJunaebColegios = allColegios.filter(c => c.institucion?.trim().toUpperCase() !== 'JUNAEB')
        const nonJunaebRbds = nonJunaebColegios.map(c => c.colRBD)

        // 1. Eliminar de ColegiosMatriz cualquier colegio que ahora sea JUNJI, INTEGRA u otra institución distinta a JUNAEB
        let removedCount = 0
        if (nonJunaebRbds.length > 0) {
            const deleteResult = await prisma.colegiosMatriz.deleteMany({
                where: { colRBD: { in: nonJunaebRbds } }
            })
            removedCount = deleteResult.count
        }

        // 2. Insertar o actualizar colegios JUNAEB en ColegiosMatriz
        let addedCount = 0
        let updatedCount = 0
        for (const col of junaebColegios) {
            const existing = await prisma.colegiosMatriz.findUnique({
                where: { colRBD: col.colRBD }
            })

            const nombreTrim = col.nombreEstablecimiento?.trim() || ''
            const sucursalTrim = col.sucursal?.trim() || ''

            if (!existing) {
                await prisma.colegiosMatriz.create({
                    data: {
                        colRBD: col.colRBD,
                        nombreEstablecimiento: nombreTrim,
                        institucion: 'JUNAEB',
                        sucursal: sucursalTrim,
                        colut: col.colut,
                        isActive: true
                    }
                })
                addedCount++
            } else {
                if (
                    existing.institucion !== 'JUNAEB' ||
                    existing.nombreEstablecimiento !== nombreTrim ||
                    existing.sucursal !== sucursalTrim ||
                    existing.colut !== col.colut
                ) {
                    await prisma.colegiosMatriz.update({
                        where: { colRBD: col.colRBD },
                        data: {
                            nombreEstablecimiento: nombreTrim,
                            institucion: 'JUNAEB',
                            sucursal: sucursalTrim,
                            colut: col.colut
                        }
                    })
                    updatedCount++
                }
            }
        }

        revalidatePath('/dashboard/mantenedor/operaciones/colegios')
        revalidatePath('/dashboard/mantenedor/matriz-riesgo/colegios-activos')
        revalidatePath('/dashboard/matriz-riesgo')

        return { 
            success: true, 
            count: addedCount, 
            addedCount, 
            updatedCount, 
            removedCount 
        }
    } catch (error) {
        console.error('Error sincronizando colegios JUNAEB:', error)
        return { error: 'Error al sincronizar con Matriz.' }
    }
}

  
export async function crearColegioManual(data: ColegioData) {  
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    if (!isAdmin && !session?.user?.role?.permissions?.includes('view_colegios')) return { error: 'Sin permisos' }  
    try {  
        const existing = await prisma.colegios.findFirst({ where: { colRBD: Number(data.colRBD) } })  
        if (existing) return { error: 'El RBD ya existe' }  
        await prisma.colegios.create({ data: { ...data, colRBD: Number(data.colRBD), colut: Number(data.colut), sucursal: data.sucursal.trim(), nombreEstablecimiento: data.nombreEstablecimiento.trim(), uploadedBy: session.user.username as string } })  
        if (data.institucion === 'JUNAEB') { await prisma.colegiosMatriz.create({ data: { colRBD: Number(data.colRBD), nombreEstablecimiento: data.nombreEstablecimiento.trim(), institucion: data.institucion, sucursal: data.sucursal.trim(), colut: Number(data.colut), isActive: true } }) }  
        revalidatePath('/dashboard/mantenedor/operaciones/colegios')  
        revalidatePath('/dashboard/mantenedor/operaciones/personal')  
        return { success: true }  
    } catch (e) { return { error: 'Error al crear' } }  
} 
