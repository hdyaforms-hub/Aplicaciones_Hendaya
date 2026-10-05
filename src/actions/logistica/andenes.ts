'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureLogisticaTables } from '@/lib/logistica/selfHealing'

export async function getBodegas() {
    try {
        // 0. Auto-recuperación de tablas en producción
        await ensureLogisticaTables()

        // 1. Obtener todas las sucursales del sistema
        const sucursales = await rawPrisma.sucursal.findMany({
            orderBy: { nombre: 'asc' }
        }).catch(() => [])

        // Fallback garantizado basado en sucursales
        const fallbackBodegas = sucursales.map((s, idx) => ({
            id: s.id,
            codigo: s.nombre.trim().toUpperCase().replace(/\s+/g, '-'),
            nombre: s.nombre,
            sucursalId: s.id,
            direccion: s.direccion || null,
            activa: true,
            orden: idx + 1,
            _count: { andenes: 0, rutas: 0 }
        }))

        // 2. Intentar obtener y sincronizar bodegas de logística
        try {
            const sucursalIds = sucursales.map(s => s.id)

            // Sincronizar sucursales con log_bodegas
            for (let i = 0; i < sucursales.length; i++) {
                const suc = sucursales[i]
                const cleanCode = suc.nombre
                    .trim()
                    .toUpperCase()
                    .replace(/\s+/g, '-')

                const existing = await rawPrisma.logBodega.findFirst({
                    where: {
                        OR: [
                            { sucursalId: suc.id },
                            { codigo: cleanCode },
                            { nombre: suc.nombre }
                        ]
                    }
                })

                if (!existing) {
                    await rawPrisma.logBodega.create({
                        data: {
                            codigo: cleanCode,
                            nombre: suc.nombre,
                            sucursalId: suc.id,
                            direccion: suc.direccion || null,
                            activa: true,
                            orden: i + 1
                        }
                    })
                } else {
                    await rawPrisma.logBodega.update({
                        where: { id: existing.id },
                        data: {
                            sucursalId: suc.id,
                            nombre: suc.nombre,
                            direccion: suc.direccion || existing.direccion,
                            activa: true,
                            orden: i + 1
                        }
                    })
                }
            }

            // Desactivar bodegas huérfanas que no pertenezcan a ninguna sucursal
            if (sucursalIds.length > 0) {
                await rawPrisma.logBodega.updateMany({
                    where: {
                        sucursalId: { notIn: sucursalIds }
                    },
                    data: { activa: false }
                })
            }

            const bodegas = await rawPrisma.logBodega.findMany({
                where: {
                    activa: true,
                    ...(sucursalIds.length > 0 ? { sucursalId: { in: sucursalIds } } : {})
                },
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

            if (bodegas.length > 0) {
                return { success: true, bodegas }
            }
        } catch (syncErr) {
            console.warn('[getBodegas] Advertencia durante sincronización de LogBodega:', syncErr)
        }

        // Si la tabla log_bodegas no devolvió registros pero hay sucursales, retornar fallback de sucursales
        if (fallbackBodegas.length > 0) {
            return { success: true, bodegas: fallbackBodegas }
        }

        // Si no hubiera sucursales registradas, intentar leer directamente logBodega
        const directBodegas = await rawPrisma.logBodega.findMany({
            where: { activa: true },
            include: { _count: { select: { andenes: true, rutas: true } } },
            orderBy: { orden: 'asc' }
        }).catch(() => [])

        return { success: true, bodegas: directBodegas }
    } catch (error: any) {
        console.error('Error al obtener bodegas:', error)
        // Intentar último rescate directo de sucursales
        try {
            const emergencySucursales = await rawPrisma.sucursal.findMany({
                orderBy: { nombre: 'asc' }
            })
            if (emergencySucursales.length > 0) {
                return {
                    success: true,
                    bodegas: emergencySucursales.map((s, idx) => ({
                        id: s.id,
                        codigo: s.nombre.trim().toUpperCase().replace(/\s+/g, '-'),
                        nombre: s.nombre,
                        sucursalId: s.id,
                        direccion: s.direccion || null,
                        activa: true,
                        orden: idx + 1,
                        _count: { andenes: 0, rutas: 0 }
                    }))
                }
            }
        } catch {}
        return { success: false, error: error?.message, bodegas: [] }
    }
}

export async function getAndenes(bodegaId: string) {
    try {
        if (!bodegaId) return { success: true, andenes: [] }
        await ensureLogisticaTables()

        // Resolver si bodegaId corresponde a un sucursalId o a un logBodega.id
        let resolvedBodegaId = bodegaId
        const bodegaMatch = await rawPrisma.logBodega.findFirst({
            where: {
                OR: [
                    { id: bodegaId },
                    { sucursalId: bodegaId }
                ]
            }
        }).catch(() => null)

        if (bodegaMatch) {
            resolvedBodegaId = bodegaMatch.id
        }

        let andenes = await rawPrisma.logAnden.findMany({
            where: { bodegaId: resolvedBodegaId, activo: true },
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
        }).catch(() => [])

        // Si no existen andenes para esta bodega, crear automáticamente 2 andenes iniciales
        if (andenes.length === 0 && bodegaMatch) {
            try {
                await rawPrisma.logAnden.createMany({
                    data: [
                        {
                            bodegaId: resolvedBodegaId,
                            codigo: 'AND-01',
                            nombre: 'Andén 01 - Carga General',
                            tipoCarga: 'GENERAL',
                            estadoOperativo: 'DISPONIBLE',
                            orden: 1,
                            activo: true
                        },
                        {
                            bodegaId: resolvedBodegaId,
                            codigo: 'AND-02',
                            nombre: 'Andén 02 - Carga General',
                            tipoCarga: 'GENERAL',
                            estadoOperativo: 'DISPONIBLE',
                            orden: 2,
                            activo: true
                        }
                    ]
                })

                andenes = await rawPrisma.logAnden.findMany({
                    where: { bodegaId: resolvedBodegaId, activo: true },
                    include: {
                        rutas: {
                            where: { estado: { in: ['EN_ANDEN', 'EN_PROCESO'] } },
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
                }).catch(() => [])
            } catch {}
        }

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
        await ensureLogisticaTables()
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        // Resolver si data.bodegaId es id de sucursal o id de logBodega
        let targetBodegaId = data.bodegaId
        const b = await rawPrisma.logBodega.findFirst({
            where: { OR: [{ id: data.bodegaId }, { sucursalId: data.bodegaId }] }
        }).catch(() => null)
        if (b) {
            targetBodegaId = b.id
        }

        const nuevo = await rawPrisma.logAnden.create({
            data: {
                bodegaId: targetBodegaId,
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
