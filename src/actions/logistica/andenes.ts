'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'

export async function getBodegas() {
    try {
        const bodegas = await rawPrisma.logBodega.findMany({
            where: { activa: true },
            include: {
                _count: {
                    select: {
                        andenes: true,
                        rutas: true
                    }
                }
            },
            orderBy: { orden: 'asc' }
        })
        return { success: true, bodegas }
    } catch (error: any) {
        console.error('Error al obtener bodegas:', error)
        return { success: false, error: error?.message, bodegas: [] }
    }
}

export async function getAndenes(bodegaId: string) {
    try {
        if (!bodegaId) return { success: true, andenes: [] }

        const andenes = await rawPrisma.logAnden.findMany({
            where: { bodegaId, activo: true },
            include: {
                rutas: {
                    where: {
                        estado: { in: ['EN_ANDEN', 'EN_PROCESO'] }
                    },
                    include: {
                        chofer: true,
                        camion: true,
                        cliente: true,
                        transportista: true
                    },
                    take: 1
                }
            },
            orderBy: { orden: 'asc' }
        })

        // Formatear información para el tablero en vivo
        const formatted = andenes.map((anden) => {
            const rutaActiva = anden.rutas[0] || null
            return {
                id: anden.id,
                codigo: anden.codigo,
                nombre: anden.nombre,
                tipoCarga: anden.tipoCarga,
                estadoOperativo: anden.estadoOperativo, // DISPONIBLE, OCUPADO, BLOQUEADO, MANTENCION
                orden: anden.orden,
                rutaActiva: rutaActiva
                    ? {
                          id: rutaActiva.id,
                          numeroRuta: rutaActiva.numeroRuta,
                          choferNombre: rutaActiva.chofer?.nombre,
                          choferTelefono: rutaActiva.chofer?.telefono,
                          camionPatente: rutaActiva.camion?.patente,
                          camionTipo: rutaActiva.camion?.tipoVehiculo,
                          clienteNombre: rutaActiva.cliente?.razonSocial,
                          horaEntradaAnden: rutaActiva.horaEntradaAnden,
                          totalBultos: rutaActiva.totalBultos,
                          totalKilos: rutaActiva.totalKilos
                      }
                    : null
            }
        })

        return { success: true, andenes: formatted }
    } catch (error: any) {
        console.error('Error al obtener andenes:', error)
        return { success: false, error: error?.message, andenes: [] }
    }
}

export async function cambiarEstadoAnden(
    andenId: string,
    nuevoEstado: 'DISPONIBLE' | 'OCUPADO' | 'BLOQUEADO' | 'MANTENCION',
    motivo?: string
) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const anden = await rawPrisma.logAnden.findUnique({
            where: { id: andenId },
            include: {
                rutas: {
                    where: { estado: { in: ['EN_ANDEN', 'EN_PROCESO'] } }
                }
            }
        })

        if (!anden) return { success: false, error: 'Andén no encontrado' }

        if (nuevoEstado !== 'DISPONIBLE' && anden.rutas.length > 0) {
            return {
                success: false,
                error: `El andén ${anden.nombre} tiene actualmente un camión en proceso (${anden.rutas[0].numeroRuta}). Debe completar o reasignar la ruta antes de bloquearlo.`
            }
        }

        const actualizado = await rawPrisma.logAnden.update({
            where: { id: andenId },
            data: { estadoOperativo: nuevoEstado }
        })

        await logAuditAction({
            username,
            userId,
            action: 'CAMBIAR_ESTADO_ANDEN',
            modulo: 'Logística -> Andenes',
            detalle: `Andén ${anden.nombre} cambió de ${anden.estadoOperativo} a ${nuevoEstado}. Motivo: ${motivo || 'N/A'}`
        })

        return { success: true, anden: actualizado }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

export async function crearAnden(data: {
    bodegaId: string
    codigo: string
    nombre: string
    tipoCarga?: string
    orden?: number
}) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const nuevo = await rawPrisma.logAnden.create({
            data: {
                bodegaId: data.bodegaId,
                codigo: data.codigo.trim().toUpperCase(),
                nombre: data.nombre.trim(),
                tipoCarga: data.tipoCarga || 'GENERAL',
                orden: data.orden || 1
            }
        })

        await logAuditAction({
            username,
            userId,
            action: 'CREAR_ANDEN',
            modulo: 'Logística -> Configuración',
            detalle: `Nuevo andén creado: ${nuevo.codigo} - ${nuevo.nombre}`
        })

        return { success: true, anden: nuevo }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

export async function actualizarAnden(
    id: string,
    data: {
        codigo?: string
        nombre?: string
        tipoCarga?: string
        orden?: number
        activo?: boolean
    }
) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const actualizado = await rawPrisma.logAnden.update({
            where: { id },
            data
        })

        await logAuditAction({
            username,
            userId,
            action: 'ACTUALIZAR_ANDEN',
            modulo: 'Logística -> Configuración',
            detalle: `Andén actualizado: ${actualizado.codigo}`
        })

        return { success: true, anden: actualizado }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

export async function eliminarAnden(id: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        // Comprobar si tiene rutas asociadas
        const rutasCount = await rawPrisma.logRuta.count({ where: { andenId: id } })
        if (rutasCount > 0) {
            // Desactivar en lugar de eliminar para no romper integridad histórica
            await rawPrisma.logAnden.update({
                where: { id },
                data: { activo: false, estadoOperativo: 'BLOQUEADO' }
            })
        } else {
            await rawPrisma.logAnden.delete({ where: { id } })
        }

        await logAuditAction({
            username,
            userId,
            action: 'ELIMINAR_ANDEN',
            modulo: 'Logística -> Configuración',
            detalle: `Andén eliminado o desactivado: ${id}`
        })

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}
