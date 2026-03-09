'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function searchColegios(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_pmpa') && !session?.user?.role?.permissions.includes('view_ingreso_raciones')) {
        return { error: 'No tienes permisos para buscar colegios' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))

    const isAdmin = session?.user?.role?.name === 'Administrador'
    const userSucursales = session?.user?.sucursales || []

    try {
        const baseWhere = {
            OR: [
                ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                { nombreEstablecimiento: { contains: query } }
            ]
        }

        const finalWhere = isAdmin ? baseWhere : {
            ...baseWhere,
            sucursal: { in: userSucursales }
        }

        const colegios = await prisma.colegios.findMany({
            where: finalWhere,
            take: 20, // Limitar resultados para rendimiento
            orderBy: { nombreEstablecimiento: 'asc' }
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios:", e)
        return { error: 'Ocurrió un error al buscar los colegios.' }
    }
}

export async function checkPmpaDisponibilidad(rbd: number, year: number, month: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_ingreso_raciones') && !session?.user?.role?.permissions.includes('view_pmpa')) {
        return { error: 'No tienes permisos para consultar esta información' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: rbd, colut: { in: allowedUTs } }
        })

        if (!colegio) {
            return { error: 'No tienes acceso a este establecimiento.' }
        }

        const pmpaRecords = await prisma.pMPA.findMany({
            where: { rbd, ano: year, mes: month }
        })

        if (pmpaRecords.length === 0) {
            return { error: 'Favor comunicarse con el administrador para que cargue el PMPA del mes en curso o mes que quiere trabajar.' }
        }

        // Obtener programas y estratos únicos
        const programas = Array.from(new Set(pmpaRecords.map((r: any) => r.programa as string)))
        const estratos = Array.from(new Set(pmpaRecords.map((r: any) => r.estrato as string)))

        return {
            programas,
            estratos
        }
    } catch (e) {
        console.error("Error checking PMPA:", e)
        return { error: 'Ocurrió un error al verificar los registros del PMPA.' }
    }
}

export type IngRacionFormData = {
    ubicacion: string
    fechaIngreso: string
    rbd: number
    nombreEstablecimiento: string
    ano: number
    mes: number
    programa: string
    estrato: string
    desayunoIng: number
    almuerzoIng: number
    onceIng: number
    colacionIng: number
    cenaIng: number
    totalIng: number
    desayunoAsig: number
    almuerzoAsig: number
    onceAsig: number
    colacionAsig: number
    cenaAsig: number
    totalAsig: number
    tasaPreparacion: number
    observacion: string
}

export async function getPmpaAssignmentsAndLastRecord(rbd: number, ano: number, mes: number, programa: string, estrato: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_ingreso_raciones')) {
        return { error: 'No tienes permisos para consultar esta información.' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: rbd, colut: { in: allowedUTs } }
        })

        if (!colegio) {
            return { error: 'No tienes acceso a las asignaciones de este establecimiento.' }
        }

        const pmpaRecords = await prisma.pMPA.findMany({
            where: { rbd, ano, mes, programa, estrato }
        })

        if (pmpaRecords.length === 0) {
            return { error: 'No se encontraron asignaciones para esta configuración en PMPA.' }
        }

        const asignados = {
            desayunoAsig: 0,
            almuerzoAsig: 0,
            onceAsig: 0,
            colacionAsig: 0,
            cenaAsig: 0
        }

        for (const record of pmpaRecords) {
            if (record.servicio === 'D') asignados.desayunoAsig += record.raceq
            if (record.servicio === 'A') asignados.almuerzoAsig += record.raceq
            if (record.servicio === 'O') asignados.onceAsig += record.raceq
            if (record.servicio === 'CO') asignados.colacionAsig += record.raceq
            if (record.servicio === 'C') asignados.cenaAsig += record.raceq
        }

        // Consultar el último registro en la tabla IngRacion
        const lastRecord = await prisma.ingRacion.findFirst({
            where: { rbd, ano, mes, programa, estrato },
            orderBy: { fechaIngreso: 'desc' }
        })

        return {
            asignados,
            ultimaFecha: lastRecord ? lastRecord.fechaIngreso.toISOString() : null
        }
    } catch (e) {
        console.error("Error obteniendo asignaciones PMPA:", e)
        return { error: 'Ocurrió un error al consultar las asignaciones del PMPA o la última fecha.' }
    }
}

export async function saveIngRacion(data: IngRacionFormData) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_ingreso_raciones')) {
        return { error: 'No tienes permisos para guardar esta información.' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: data.rbd, colut: { in: allowedUTs } }
        })

        if (!colegio) {
            return { error: 'No tienes permisos para guardar en este establecimiento.' }
        }

        const utcFechaIngreso = new Date(`${data.fechaIngreso}T12:00:00Z`)

        // Duplicate Check
        const existingRecord = await prisma.ingRacion.findFirst({
            where: {
                fechaIngreso: utcFechaIngreso,
                rbd: data.rbd,
                ano: data.ano,
                mes: data.mes,
                programa: data.programa,
                estrato: data.estrato
            }
        })

        if (existingRecord) {
            return { error: 'Ya existe un registro guardado para este colegio con esta fecha, programa y estrato.' }
        }

        await prisma.ingRacion.create({
            data: {
                usuario: session.user.username as string,
                ubicacion: data.ubicacion,
                fechaIngreso: utcFechaIngreso,
                rbd: data.rbd,
                nombreEstablecimiento: data.nombreEstablecimiento,
                ano: data.ano,
                mes: data.mes,
                programa: data.programa,
                estrato: data.estrato,
                desayunoIng: data.desayunoIng,
                almuerzoIng: data.almuerzoIng,
                onceIng: data.onceIng,
                colacionIng: data.colacionIng,
                cenaIng: data.cenaIng,
                totalIng: data.totalIng,
                desayunoAsig: data.desayunoAsig,
                almuerzoAsig: data.almuerzoAsig,
                onceAsig: data.onceAsig,
                colacionAsig: data.colacionAsig,
                cenaAsig: data.cenaAsig,
                totalAsig: data.totalAsig,
                tasaPreparacion: data.tasaPreparacion,
                observacion: data.observacion,
            }
        })

        return { success: true }
    } catch (error) {
        console.error("Error guardando IngRacion:", error)
        return { error: 'Ocurrió un error insesperado al intentar guardar el registro.' }
    }
}
