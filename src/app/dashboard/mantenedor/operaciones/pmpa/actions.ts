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

    // Buscamos si existe al menos un registro en la BD que coincida con el primer mes/año/ute y ALGÚN RBD del archivo
    const firstRow = data[0]
    const rbds = data.map(d => d.rbd)

    const existing = await prisma.pMPA.findFirst({
        where: {
            ano: firstRow.ano,
            mes: firstRow.mes,
            ute: firstRow.ute,
            rbd: { in: rbds }
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
                const rbdsInPeriod = data
                    .filter(d => d.ano === parseInt(ano) && d.mes === parseInt(mes) && d.ute === parseInt(ute))
                    .map(d => d.rbd)

                await prisma.pMPA.deleteMany({
                    where: {
                        ano: parseInt(ano),
                        mes: parseInt(mes),
                        ute: parseInt(ute),
                        rbd: { in: rbdsInPeriod }
                    }
                })
            }
        }

        // Obtener instituciones de Colegios
        const allRbds = [...new Set(data.map(d => d.rbd))]
        const colegios = await prisma.colegios.findMany({
            where: { colRBD: { in: allRbds } },
            select: { colRBD: true, institucion: true }
        })
        const mapInstitucion = new Map(colegios.map(c => [c.colRBD, c.institucion]))

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
            institucion: mapInstitucion.get(d.rbd) || "S/D",
            uploadedBy: username
        }))

        // Insertar por lotes
        await prisma.pMPA.createMany({
            data: dataToInsert
        })
        revalidatePath('/dashboard/mantenedor/operaciones/pmpa')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos PMPA:', error)
        return { error: 'Ocurrió un error al guardar los registros en la base de datos.' }
    }
}

export async function deletePMPAPeriod(ano: number, mes: number, sucursalName?: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_pmpa')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const where: any = { ano, mes }
        if (sucursalName) {
            where.ut = { sucursal: { nombre: sucursalName } }
        }

        const deleted = await prisma.pMPA.deleteMany({ where })
        
        revalidatePath('/dashboard/mantenedor/operaciones/pmpa')
        return { success: true, count: deleted.count }
    } catch (error: any) {
        console.error('Error eliminando periodo PMPA:', error)
        return { error: 'Ocurrió un error al eliminar los registros.' }
    }
}
