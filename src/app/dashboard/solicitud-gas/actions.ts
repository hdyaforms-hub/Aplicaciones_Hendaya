
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function searchColegiosGas(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_gas')) {
        return { error: 'No tienes permisos para buscar' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))

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
            where: {
                ...whereClause,
                OR: [
                    ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                    { nombreEstablecimiento: { contains: query } }
                ]
            },
            take: 10
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios gas:", e)
        return { error: 'Error en la búsqueda' }
    }
}

export async function saveSolicitudGas(data: {
    ut: number
    rbd: number
    distribuidor: string
    distribuidorOtro?: string
    tipoGas: 'Bombona' | 'Cilindro'
    litrosBombona?: number
    pesoCilindro?: string // "5 Kilos", "11 Kilos", etc.
    cantidadCilindros?: number
    observacion?: string
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_gas') && session?.user?.role?.name !== 'Administrador') {
        return { error: 'No tienes permisos para guardar solicitudes de gas' }
    }

    if (!data.ut || !data.rbd) return { error: 'UT y RBD son obligatorios' }

    try {
        const finalDistribuidor = data.distribuidor === 'Otro' ? data.distribuidorOtro : data.distribuidor
        if (!finalDistribuidor) return { error: 'Debe especificar un distribuidor' }

        let calculoLitros = 0
        if (data.tipoGas === 'Bombona') {
            calculoLitros = data.litrosBombona || 0
        } else {
            // Cilindro logic
            const pesoStr = data.pesoCilindro || ''
            const pesoMatch = pesoStr.match(/\d+/)
            const pesoNum = pesoMatch ? parseInt(pesoMatch[0]) : 0
            const cantidad = data.cantidadCilindros || 0
            
            // Formula: (Kilos * 0.54) * Cantidad
            calculoLitros = (pesoNum * 0.54) * cantidad
        }

        if (data.observacion && data.observacion.length > 500) {
            return { error: 'La observación no puede superar los 500 caracteres' }
        }

        await prisma.solicitudGas.create({
            data: {
                ut: data.ut,
                rbd: data.rbd,
                nombreSolicitante: session?.user?.name || session?.user?.username || 'Desconocido',
                distribuidor: finalDistribuidor.substring(0, 20),
                tipoGas: data.tipoGas,
                cantidadLitro: parseFloat(calculoLitros.toFixed(2)),
                cilindro: data.tipoGas === 'Cilindro' ? data.pesoCilindro : null,
                cantidad: data.tipoGas === 'Cilindro' ? data.cantidadCilindros : null,
                observacion: data.observacion?.substring(0, 500)
            }
        })

        revalidatePath('/dashboard/solicitud-gas')
        revalidatePath('/dashboard/reports/solicitud-gas')
        return { success: true }
    } catch (e) {
        console.error("Error saving gas request:", e)
        return { error: 'Ocurrió un error al guardar la solicitud' }
    }
}
