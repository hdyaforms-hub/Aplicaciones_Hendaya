'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function getConsumoGas(filters?: { query?: string }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        return { error: 'No tienes permisos para ver esta información' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []
        const isAdmin = session?.user?.role?.name === 'Administrador'

        let whereClauseColegio: any = {}
        if (!isAdmin) {
            const uts = await prisma.uT.findMany({
                where: { sucursal: { nombre: { in: userSucursales } } },
                select: { codUT: true }
            })
            const allowedUTs = uts.map(ut => ut.codUT)
            whereClauseColegio.colut = { in: allowedUTs }
        }

        const query = filters?.query?.trim()
        const isNumeric = query && !isNaN(Number(query))

        const consumos = await (prisma as any).mat_ConsumoGas.findMany({
            where: {
                ...(query ? {
                    OR: [
                        ...(isNumeric ? [{ rbd: Number(query) }] : []),
                    ]
                } : {})
            },
            orderBy: { rbd: 'asc' }
        })

        // Fetch school names for these RBDs and filter by sucursal
        const rbdsInConsumo = consumos.map((c: any) => c.rbd)
        const colegios = await prisma.colegios.findMany({
            where: {
                ...whereClauseColegio,
                colRBD: { in: rbdsInConsumo },
                ...(query && !isNumeric ? { nombreEstablecimiento: { contains: query } } : {})
            },
            select: { colRBD: true, nombreEstablecimiento: true }
        })

        const colegiosMap = new Map(colegios.map((col: any) => [col.colRBD, col.nombreEstablecimiento]))

        // Final result: only those that match the colegio filter (if non-admin) OR all if admin
        const result = consumos
            .filter((c: any) => isAdmin || colegiosMap.has(c.rbd))
            .map((c: any) => ({
                ...c,
                nombreEstablecimiento: colegiosMap.get(c.rbd) || 'No asignado o sin acceso'
            }))
            .filter((c: any) => !query || isNumeric || (c.nombreEstablecimiento !== 'No asignado o sin acceso' && c.nombreEstablecimiento.toLowerCase().includes(query.toLowerCase())))

        return { data: result }
    } catch (e) {
        console.error("Error fetching consumo gas:", e)
        return { error: 'Error al obtener los datos de consumo' }
    }
}

export async function saveConsumoGas(data: {
    rbd: number
    litros: number
    cantidad: number
    meses: string
    observacion: string
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data.observacion || data.observacion.trim().length === 0) {
        return { error: 'La observación es obligatoria para registrar el cambio' }
    }

    try {
        // Obtener valores actuales antes de actualizar para el historial
        const currentConfig = await (prisma as any).mat_ConsumoGas.findUnique({
            where: { rbd: data.rbd }
        })

        await (prisma as any).mat_ConsumoGas.upsert({
            where: { rbd: data.rbd },
            update: {
                litros: data.litros,
                cantidad: data.cantidad,
                meses: data.meses,
            },
            create: {
                rbd: data.rbd,
                litros: data.litros,
                cantidad: data.cantidad,
                meses: data.meses,
            }
        })

        // Guardar en el HISTORIAL con valores anteriores
        await (prisma as any).mat_ConsumoGasHistory.create({
            data: {
                rbd: data.rbd,
                litros: data.litros,
                cantidad: data.cantidad,
                meses: data.meses,
                old_litros: currentConfig?.litros,
                old_cantidad: currentConfig?.cantidad,
                old_meses: currentConfig?.meses,
                observacion: data.observacion,
                user: session?.user?.username || 'Sistema',
            }
        })

        revalidatePath('/dashboard/consumo-gas')
        return { success: true }
    } catch (e) {
        console.error("Error saving consumo gas:", e)
        return { error: 'Error al guardar el consumo y registrar en el historial' }
    }
}

export async function bulkUploadConsumoGas(data: { rbd: number, litros: number, cantidad: number, meses: string }[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        // Simple sequential upsert for now, can be optimized with transactions if needed
        for (const item of data) {
            const current = await (prisma as any).mat_ConsumoGas.findUnique({
                where: { rbd: Number(item.rbd) }
            })

            await (prisma as any).mat_ConsumoGas.upsert({
                where: { rbd: Number(item.rbd) },
                update: {
                    litros: Number(item.litros),
                    cantidad: Number(item.cantidad),
                    meses: String(item.meses),
                },
                create: {
                    rbd: Number(item.rbd),
                    litros: Number(item.litros),
                    cantidad: Number(item.cantidad),
                    meses: String(item.meses),
                }
            })

            // Registro automático en historial por carga masiva con valores anteriores
            await (prisma as any).mat_ConsumoGasHistory.create({
                data: {
                    rbd: Number(item.rbd),
                    litros: Number(item.litros),
                    cantidad: Number(item.cantidad),
                    meses: String(item.meses),
                    old_litros: current?.litros,
                    old_cantidad: current?.cantidad,
                    old_meses: current?.meses,
                    observacion: 'Cambio realizado mediante Carga Masiva',
                    user: session?.user?.username || 'Sistema',
                }
            })
        }

        revalidatePath('/dashboard/consumo-gas')
        return { success: true, count: data.length }
    } catch (e) {
        console.error("Error bulk uploading consumo gas:", e)
        return { error: 'Error al realizar la carga masiva' }
    }
}

export async function getPendingConsumoRBDs() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        return { error: 'No tienes permisos' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []
        const isAdmin = session?.user?.role?.name === 'Administrador'

        // 1. Get all schools
        let whereClause: any = {}
        if (!isAdmin) {
            const uts = await prisma.uT.findMany({
                where: { sucursal: { nombre: { in: userSucursales } } },
                select: { codUT: true }
            })
            const allowedUTs = uts.map(ut => ut.codUT)
            whereClause.colut = { in: allowedUTs }
        }

        const allColegios = await prisma.colegios.findMany({
            where: whereClause,
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                colut: true
            }
        })

        // 2. Get all configured RBDs
        const configured = await (prisma as any).mat_ConsumoGas.findMany({
            where: {
                rbd: { in: allColegios.map(c => c.colRBD) }
            },
            select: { rbd: true }
        })

        const configuredSet = new Set(configured.map((c: any) => c.rbd))

        // 3. Filter pending
        const pending = allColegios.filter(c => !configuredSet.has(c.colRBD))

        return { data: pending }
    } catch (e: any) {
        console.error("Error fetching pending RBDs:", e)
        return { error: 'Error al obtener RBDs pendientes' }
    }
}

export async function getColegiosForAutocomplete() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        return { error: 'No tienes permisos' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []
        const isAdmin = session?.user?.role?.name === 'Administrador'

        let whereClause: any = {}
        if (!isAdmin) {
            const uts = await prisma.uT.findMany({
                where: { sucursal: { nombre: { in: userSucursales } } },
                select: { codUT: true }
            })
            const allowedUTs = uts.map(ut => ut.codUT)
            whereClause.colut = { in: allowedUTs }
        }

        const colegios = await prisma.colegios.findMany({
            where: whereClause,
            select: {
                colRBD: true,
                nombreEstablecimiento: true
            },
            orderBy: {
                nombreEstablecimiento: 'asc'
            }
        })

        return { data: colegios }
    } catch (e: any) {
        console.error("Error fetching colleges for autocomplete:", e)
        return { error: 'Error al obtener lista de colegios' }
    }
}

export async function getConsumoGasHistory(rbd: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_consumo_gas')) {
        return { error: 'No tienes permisos' }
    }

    try {
        const history = await (prisma as any).mat_ConsumoGasHistory.findMany({
            where: { rbd },
            orderBy: { createdAt: 'desc' }
        })
        return { data: history }
    } catch (e) {
        console.error("Error fetching gas history:", e)
        return { error: 'Error al obtener el historial' }
    }
}
