'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { dispararEventoN8N } from '@/lib/logistica/n8n-dispatcher'
import crypto from 'crypto'

export interface NuevaRutaInput {
    bodegaId: string
    choferId: string
    camionId: string
    transportistaId?: string
    clienteId?: string
    fechaRuta: string // YYYY-MM-DD
    horaProgramada: string // HH:MM
    totalBultos?: number
    totalKilos?: number
    observaciones?: string
    andenId?: string
}

/**
 * Genera el correlativo diario de ruta con formato RUT-YYYYMMDD-0001
 */
async function generarCorrelativoRuta(fechaRuta: string): Promise<string> {
    const cleanFecha = fechaRuta.replace(/-/g, '')
    const prefix = `RUT-${cleanFecha}-`

    const ultimas = await rawPrisma.logRuta.findMany({
        where: {
            numeroRuta: { startsWith: prefix }
        },
        select: { numeroRuta: true },
        orderBy: { numeroRuta: 'desc' },
        take: 1
    })

    if (ultimas.length === 0) {
        return `${prefix}0001`
    }

    const ultimoNumero = ultimas[0].numeroRuta
    const correlativo = parseInt(ultimoNumero.replace(prefix, ''), 10) || 0
    const siguiente = (correlativo + 1).toString().padStart(4, '0')
    return `${prefix}${siguiente}`
}

/**
 * Obtiene el listado de rutas con filtros
 */
export async function getRutas(filtros: {
    bodegaId?: string
    fechaRuta?: string
    fechaDesde?: string
    fechaHasta?: string
    estado?: string
    search?: string
    take?: number
}) {
    try {
        const where: any = {}

        if (filtros.bodegaId && filtros.bodegaId !== 'ALL') {
            where.bodegaId = filtros.bodegaId
        }

        if (filtros.fechaRuta) {
            where.fechaRuta = filtros.fechaRuta
        } else if (filtros.fechaDesde || filtros.fechaHasta) {
            where.fechaRuta = {}
            if (filtros.fechaDesde) where.fechaRuta.gte = filtros.fechaDesde
            if (filtros.fechaHasta) where.fechaRuta.lte = filtros.fechaHasta
        }

        if (filtros.estado && filtros.estado !== 'ALL') {
            where.estado = filtros.estado
        }

        if (filtros.search && filtros.search.trim()) {
            const s = filtros.search.trim()
            where.OR = [
                { numeroRuta: { contains: s, mode: 'insensitive' } },
                { chofer: { nombre: { contains: s, mode: 'insensitive' } } },
                { camion: { patente: { contains: s, mode: 'insensitive' } } },
                { cliente: { razonSocial: { contains: s, mode: 'insensitive' } } },
                { transportista: { razonSocial: { contains: s, mode: 'insensitive' } } }
            ]
        }

        const rutas = await rawPrisma.logRuta.findMany({
            where,
            include: {
                bodega: true,
                chofer: true,
                camion: true,
                transportista: true,
                cliente: true,
                anden: true,
                _count: { select: { eventos: true } }
            },
            orderBy: [{ fechaRuta: 'desc' }, { horaProgramada: 'asc' }, { createdAt: 'desc' }],
            take: filtros.take || 200
        })

        return { success: true, rutas }
    } catch (error: any) {
        console.error('Error al obtener rutas:', error)
        return { success: false, error: error?.message, rutas: [] }
    }
}

/**
 * Obtiene una ruta por ID junto a toda su línea de tiempo
 */
export async function getRutaDetalle(id: string) {
    try {
        const ruta = await rawPrisma.logRuta.findUnique({
            where: { id },
            include: {
                bodega: true,
                chofer: true,
                camion: true,
                transportista: true,
                cliente: true,
                anden: true,
                eventos: {
                    include: { anden: true },
                    orderBy: { createdAt: 'asc' }
                },
                integracionLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        })

        if (!ruta) return { success: false, error: 'Ruta no encontrada' }
        return { success: true, ruta }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

/**
 * Crea una nueva ruta de despacho
 */
export async function crearRuta(input: NuevaRutaInput) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        if (!input.bodegaId || !input.choferId || !input.camionId || !input.fechaRuta || !input.horaProgramada) {
            return { success: false, error: 'Faltan campos obligatorios para registrar la ruta.' }
        }

        // Obtener transportista si el camión o chofer lo tienen y no se especificó
        let transportistaId = input.transportistaId
        if (!transportistaId) {
            const chofer = await rawPrisma.logChofer.findUnique({
                where: { id: input.choferId },
                select: { transportistaId: true }
            })
            transportistaId = chofer?.transportistaId || undefined
        }

        const numeroRuta = await generarCorrelativoRuta(input.fechaRuta)
        const tokenRuta = crypto.randomUUID()

        // Si se seleccionó andén de inmediato, verificar disponibilidad
        let estadoInicial = 'PROGRAMADA'
        if (input.andenId) {
            const anden = await rawPrisma.logAnden.findUnique({
                where: { id: input.andenId }
            })
            if (!anden || anden.estadoOperativo !== 'DISPONIBLE') {
                return { success: false, error: `El andén ${anden?.nombre || ''} no está disponible.` }
            }
        }

        // Crear la ruta en la base de datos
        const ruta = await rawPrisma.logRuta.create({
            data: {
                numeroRuta,
                bodegaId: input.bodegaId,
                choferId: input.choferId,
                camionId: input.camionId,
                transportistaId: transportistaId || null,
                clienteId: input.clienteId || null,
                andenId: input.andenId || null,
                fechaRuta: input.fechaRuta,
                horaProgramada: input.horaProgramada,
                totalBultos: Number(input.totalBultos || 0),
                totalKilos: input.totalKilos ? Number(input.totalKilos) : null,
                observaciones: input.observaciones || null,
                tokenRuta,
                estado: estadoInicial,
                creadaPorId: userId || null
            },
            include: {
                chofer: true,
                camion: true,
                bodega: true,
                anden: true
            }
        })

        // Si se asignó andén de inicio, marcarlo ocupado
        if (input.andenId) {
            await rawPrisma.logAnden.update({
                where: { id: input.andenId },
                data: { estadoOperativo: 'OCUPADO' }
            })
        }

        // Registrar evento inicial en la bitácora
        await rawPrisma.logEventoRuta.create({
            data: {
                rutaId: ruta.id,
                estadoAnterior: null,
                estadoNuevo: estadoInicial,
                andenId: input.andenId || null,
                origenCambio: 'DESPACHADOR',
                notas: 'Ruta creada y programada en el sistema.',
                usuarioId: userId || null
            }
        })

        // Auditoría
        await logAuditAction({
            username,
            userId,
            action: 'CREAR_RUTA_DESPACHO',
            modulo: 'Logística -> Rutas',
            detalle: `Se creó la ruta ${numeroRuta} para chofer ${ruta.chofer?.nombre} y patente ${ruta.camion?.patente}`
        })

        // Disparar integración n8n en segundo plano
        dispararEventoN8N('RUTA_CREADA', {
            rutaId: ruta.id,
            origen: 'DESPACHADOR_WEB',
            notas: 'Nueva ruta programada'
        }).catch(err => console.error('[N8N Event Error]', err))

        return { success: true, ruta }
    } catch (error: any) {
        console.error('Error al crear ruta:', error)
        return { success: false, error: error?.message || 'Error al crear la ruta.' }
    }
}

/**
 * Asigna un andén disponible a una ruta
 */
export async function asignarAnden(rutaId: string, andenId: string, notas?: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        // Transacción para garantizar concurrencia atómica
        const result = await rawPrisma.$transaction(async (tx) => {
            const anden = await tx.logAnden.findUnique({
                where: { id: andenId }
            })

            if (!anden) {
                throw new Error('El andén seleccionado no existe.')
            }

            if (anden.estadoOperativo !== 'DISPONIBLE') {
                throw new Error(`El andén ${anden.nombre} no se encuentra disponible (Estado: ${anden.estadoOperativo}).`)
            }

            const rutaActual = await tx.logRuta.findUnique({
                where: { id: rutaId },
                include: { anden: true }
            })

            if (!rutaActual) {
                throw new Error('La ruta especificada no existe.')
            }

            // Si la ruta ya tenía otro andén anterior, liberarlo
            if (rutaActual.andenId && rutaActual.andenId !== andenId) {
                await tx.logAnden.update({
                    where: { id: rutaActual.andenId },
                    data: { estadoOperativo: 'DISPONIBLE' }
                })
            }

            // Marcar nuevo andén como OCUPADO
            await tx.logAnden.update({
                where: { id: andenId },
                data: { estadoOperativo: 'OCUPADO' }
            })

            // Actualizar ruta a EN_ANDEN
            const rutaActualizada = await tx.logRuta.update({
                where: { id: rutaId },
                data: {
                    andenId,
                    estado: 'EN_ANDEN',
                    horaEntradaAnden: rutaActual.horaEntradaAnden || new Date()
                },
                include: {
                    anden: true,
                    chofer: true,
                    camion: true
                }
            })

            // Registrar evento en bitácora
            await tx.logEventoRuta.create({
                data: {
                    rutaId,
                    estadoAnterior: rutaActual.estado,
                    estadoNuevo: 'EN_ANDEN',
                    andenId,
                    origenCambio: 'DESPACHADOR',
                    notas: notas || `Asignado a ${anden.nombre}`,
                    usuarioId: userId || null
                }
            })

            return { ruta: rutaActualizada, andenNombre: anden.nombre }
        })

        // Auditoría
        await logAuditAction({
            username,
            userId,
            action: 'ASIGNAR_ANDEN',
            modulo: 'Logística -> Tablero',
            detalle: `Ruta ${result.ruta.numeroRuta} asignada al andén ${result.andenNombre}`
        })

        // Disparar webhook n8n (notifica a chofer por Telegram)
        dispararEventoN8N('ANDEN_ASIGNADO', {
            rutaId,
            notas: `Camión asignado a ${result.andenNombre}`
        }).catch(err => console.error('[N8N Event Error]', err))

        return { success: true, ruta: result.ruta }
    } catch (error: any) {
        console.error('Error al asignar andén:', error)
        return { success: false, error: error?.message || 'Error al asignar andén.' }
    }
}

/**
 * Reasigna un andén (cambio forzado de muelle)
 */
export async function reasignarAnden(rutaId: string, nuevoAndenId: string, motivo: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        if (!motivo || !motivo.trim()) {
            return { success: false, error: 'Debe ingresar un motivo para la reasignación de andén.' }
        }

        const result = await rawPrisma.$transaction(async (tx) => {
            const nuevoAnden = await tx.logAnden.findUnique({
                where: { id: nuevoAndenId }
            })

            if (!nuevoAnden || nuevoAnden.estadoOperativo !== 'DISPONIBLE') {
                throw new Error(`El nuevo andén no está disponible.`)
            }

            const ruta = await tx.logRuta.findUnique({
                where: { id: rutaId },
                include: { anden: true }
            })

            if (!ruta) throw new Error('Ruta no encontrada.')

            // Liberar andén anterior
            if (ruta.andenId) {
                await tx.logAnden.update({
                    where: { id: ruta.andenId },
                    data: { estadoOperativo: 'DISPONIBLE' }
                })
            }

            // Ocupar nuevo andén
            await tx.logAnden.update({
                where: { id: nuevoAndenId },
                data: { estadoOperativo: 'OCUPADO' }
            })

            // Actualizar ruta
            const rutaActualizada = await tx.logRuta.update({
                where: { id: rutaId },
                data: {
                    andenId: nuevoAndenId,
                    estado: 'EN_ANDEN'
                },
                include: { anden: true, chofer: true }
            })

            // Registrar evento
            await tx.logEventoRuta.create({
                data: {
                    rutaId,
                    estadoAnterior: 'EN_ANDEN',
                    estadoNuevo: 'EN_ANDEN',
                    andenId: nuevoAndenId,
                    origenCambio: 'DESPACHADOR',
                    notas: `Reasignado desde ${ruta.anden?.nombre || 'anterior'} a ${nuevoAnden.nombre}. Motivo: ${motivo}`,
                    usuarioId: userId || null
                }
            })

            return { ruta: rutaActualizada, nombreNuevo: nuevoAnden.nombre }
        })

        await logAuditAction({
            username,
            userId,
            action: 'REASIGNAR_ANDEN',
            modulo: 'Logística -> Tablero',
            detalle: `Ruta ${result.ruta.numeroRuta} reasignada a ${result.nombreNuevo}. Motivo: ${motivo}`
        })

        dispararEventoN8N('ANDEN_ASIGNADO', {
            rutaId,
            notas: `Reasignación de andén: ${result.nombreNuevo}`
        }).catch(err => console.error('[N8N Event Error]', err))

        return { success: true, ruta: result.ruta }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Error al reasignar andén.' }
    }
}

/**
 * Marca la llegada física del camión a portón
 */
export async function marcarLlegadaPorton(rutaId: string, notas?: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const ruta = await rawPrisma.logRuta.findUnique({ where: { id: rutaId } })
        if (!ruta) return { success: false, error: 'Ruta no encontrada' }

        const rutaActualizada = await rawPrisma.logRuta.update({
            where: { id: rutaId },
            data: {
                estado: 'EN_PORTON',
                horaLlegadaPorton: ruta.horaLlegadaPorton || new Date()
            }
        })

        await rawPrisma.logEventoRuta.create({
            data: {
                rutaId,
                estadoAnterior: ruta.estado,
                estadoNuevo: 'EN_PORTON',
                origenCambio: 'PORTON',
                notas: notas || 'Llegada a portón confirmada físicamente por guardia/despachador.',
                usuarioId: userId || null
            }
        })

        await logAuditAction({
            username,
            userId,
            action: 'LLEGADA_PORTON',
            modulo: 'Logística -> Portón',
            detalle: `Ruta ${ruta.numeroRuta} marcada en portón.`
        })

        dispararEventoN8N('CHOFER_EN_PORTON', { rutaId, origen: 'PORTON_MANUAL' })
            .catch(err => console.error('[N8N Event Error]', err))

        return { success: true, ruta: rutaActualizada }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

/**
 * Completa el despacho y libera el andén
 */
export async function completarDespacho(
    rutaId: string,
    data: { selloSalida?: string; observaciones?: string }
) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const result = await rawPrisma.$transaction(async (tx) => {
            const ruta = await tx.logRuta.findUnique({
                where: { id: rutaId },
                include: { anden: true }
            })

            if (!ruta) throw new Error('Ruta no encontrada.')

            // Liberar andén si estaba asignado
            if (ruta.andenId) {
                await tx.logAnden.update({
                    where: { id: ruta.andenId },
                    data: { estadoOperativo: 'DISPONIBLE' }
                })
            }

            // Marcar ruta como DESPACHADA
            const rutaFinal = await tx.logRuta.update({
                where: { id: rutaId },
                data: {
                    estado: 'DESPACHADA',
                    horaSalidaAnden: new Date(),
                    selloSalida: data.selloSalida || ruta.selloSalida,
                    observaciones: data.observaciones
                        ? `${ruta.observaciones || ''} | ${data.observaciones}`.trim()
                        : ruta.observaciones
                },
                include: { chofer: true, camion: true, anden: true }
            })

            // Registrar evento
            await tx.logEventoRuta.create({
                data: {
                    rutaId,
                    estadoAnterior: ruta.estado,
                    estadoNuevo: 'DESPACHADA',
                    andenId: ruta.andenId,
                    origenCambio: 'DESPACHADOR',
                    notas: `Despacho completado. Sello: ${data.selloSalida || 'N/A'}`,
                    usuarioId: userId || null
                }
            })

            return rutaFinal
        })

        await logAuditAction({
            username,
            userId,
            action: 'COMPLETAR_DESPACHO',
            modulo: 'Logística -> Despacho',
            detalle: `Ruta ${result.numeroRuta} despachada exitosamente. Andén liberado.`
        })

        dispararEventoN8N('DESPACHO_COMPLETO', {
            rutaId,
            notas: `Despacho finalizado con sello: ${data.selloSalida || 'N/A'}`
        }).catch(err => console.error('[N8N Event Error]', err))

        return { success: true, ruta: result }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Error al completar despacho.' }
    }
}

/**
 * Cancela una ruta y libera su andén si lo tenía
 */
export async function cancelarRuta(rutaId: string, motivo: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        if (!motivo || !motivo.trim()) {
            return { success: false, error: 'Debe ingresar un motivo para cancelar la ruta.' }
        }

        const result = await rawPrisma.$transaction(async (tx) => {
            const ruta = await tx.logRuta.findUnique({ where: { id: rutaId } })
            if (!ruta) throw new Error('Ruta no encontrada')

            if (ruta.andenId) {
                await tx.logAnden.update({
                    where: { id: ruta.andenId },
                    data: { estadoOperativo: 'DISPONIBLE' }
                })
            }

            const rutaCancelada = await tx.logRuta.update({
                where: { id: rutaId },
                data: {
                    estado: 'CANCELADA',
                    observaciones: `${ruta.observaciones || ''} | CANCELADA: ${motivo}`.trim()
                }
            })

            await tx.logEventoRuta.create({
                data: {
                    rutaId,
                    estadoAnterior: ruta.estado,
                    estadoNuevo: 'CANCELADA',
                    origenCambio: 'DESPACHADOR',
                    notas: `Ruta cancelada por ${username}. Motivo: ${motivo}`,
                    usuarioId: userId || null
                }
            })

            return rutaCancelada
        })

        await logAuditAction({
            username,
            userId,
            action: 'CANCELAR_RUTA',
            modulo: 'Logística -> Rutas',
            detalle: `Ruta ${result.numeroRuta} cancelada. Motivo: ${motivo}`
        })

        dispararEventoN8N('RUTA_CANCELADA', { rutaId, notas: motivo })
            .catch(err => console.error('[N8N Event Error]', err))

        return { success: true, ruta: result }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Error al cancelar la ruta.' }
    }
}

/**
 * Fuerza el estado de una ruta (excepcional con justificación y permiso)
 */
export async function forzarEstadoRuta(rutaId: string, nuevoEstado: string, justificacion: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        if (!justificacion || !justificacion.trim()) {
            return { success: false, error: 'Debe justificar el cambio forzado de estado.' }
        }

        const ruta = await rawPrisma.logRuta.findUnique({ where: { id: rutaId } })
        if (!ruta) return { success: false, error: 'Ruta no encontrada' }

        const rutaActualizada = await rawPrisma.logRuta.update({
            where: { id: rutaId },
            data: { estado: nuevoEstado }
        })

        await rawPrisma.logEventoRuta.create({
            data: {
                rutaId,
                estadoAnterior: ruta.estado,
                estadoNuevo: nuevoEstado,
                origenCambio: 'DESPACHADOR',
                notas: `[CAMBIO FORZADO] Por ${username}: ${justificacion}`,
                usuarioId: userId || null
            }
        })

        await logAuditAction({
            username,
            userId,
            action: 'FORZAR_ESTADO_RUTA',
            modulo: 'Logística -> Rutas',
            detalle: `Ruta ${ruta.numeroRuta} forzada de ${ruta.estado} a ${nuevoEstado}. Justificación: ${justificacion}`
        })

        return { success: true, ruta: rutaActualizada }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

/**
 * Notifica manualmente al chofer disparando el webhook de Telegram en n8n
 */
export async function notificarChoferManual(rutaId: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const ruta = await rawPrisma.logRuta.findUnique({
            where: { id: rutaId },
            include: { chofer: true }
        })

        if (!ruta) return { success: false, error: 'Ruta no encontrada' }

        // Actualizar estado a NOTIFICADA si estaba PROGRAMADA
        if (ruta.estado === 'PROGRAMADA') {
            await rawPrisma.logRuta.update({
                where: { id: rutaId },
                data: { estado: 'NOTIFICADA' }
            })

            await rawPrisma.logEventoRuta.create({
                data: {
                    rutaId,
                    estadoAnterior: 'PROGRAMADA',
                    estadoNuevo: 'NOTIFICADA',
                    origenCambio: 'DESPACHADOR',
                    notas: `Notificación enviada a Telegram de ${ruta.chofer?.nombre}`,
                    usuarioId: userId || null
                }
            })
        }

        const result = await dispararEventoN8N('CHOFER_NOTIFICADO', {
            rutaId,
            notas: `Notificación enviada manualmente por ${username}`
        })

        await logAuditAction({
            username,
            userId,
            action: 'NOTIFICAR_CHOFER_TELEGRAM',
            modulo: 'Logística -> Notificaciones',
            detalle: `Notificación disparada para chofer ${ruta.chofer?.nombre} en ruta ${ruta.numeroRuta}`
        })

        return { success: true, result }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

/**
 * Carga masiva de rutas desde datos procesados de Excel
 */
export async function importarRutasMasivas(
    bodegaId: string,
    filas: Array<{
        rutChofer: string
        nombreChofer?: string
        telefonoChofer?: string
        patenteCamion: string
        tipoVehiculo?: string
        fechaRuta: string
        horaProgramada: string
        clienteNombre?: string
        totalBultos?: number
        totalKilos?: number
        observaciones?: string
    }>
) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        if (!bodegaId || !filas || filas.length === 0) {
            return { success: false, error: 'No se suministraron filas válidas para importar.' }
        }

        let creadas = 0
        const errores: Array<{ fila: number; error: string }> = []

        for (let i = 0; i < filas.length; i++) {
            const f = filas[i]
            const indexFila = i + 1

            try {
                if (!f.rutChofer || !f.patenteCamion || !f.fechaRuta || !f.horaProgramada) {
                    errores.push({ fila: indexFila, error: 'Faltan campos obligatorios (RUT, Patente, Fecha, Hora).' })
                    continue
                }

                // 1. Buscar o crear Chofer
                let chofer = await rawPrisma.logChofer.findUnique({
                    where: { rut: f.rutChofer.trim() }
                })
                if (!chofer) {
                    chofer = await rawPrisma.logChofer.create({
                        data: {
                            rut: f.rutChofer.trim(),
                            nombre: f.nombreChofer?.trim() || `Chofer ${f.rutChofer}`,
                            telefono: f.telefonoChofer?.trim() || '+56900000000'
                        }
                    })
                }

                // 2. Buscar o crear Camión
                const cleanPatente = f.patenteCamion.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
                let camion = await rawPrisma.logCamion.findUnique({
                    where: { patente: cleanPatente }
                })
                if (!camion) {
                    camion = await rawPrisma.logCamion.create({
                        data: {
                            patente: cleanPatente,
                            tipoVehiculo: f.tipoVehiculo?.toUpperCase() || 'RAMPLA'
                        }
                    })
                }

                // 3. Buscar o crear Cliente opcional
                let clienteId: string | null = null
                if (f.clienteNombre && f.clienteNombre.trim()) {
                    const cNombre = f.clienteNombre.trim()
                    let cliente = await rawPrisma.logCliente.findFirst({
                        where: { razonSocial: { equals: cNombre, mode: 'insensitive' } }
                    })
                    if (!cliente) {
                        cliente = await rawPrisma.logCliente.create({
                            data: {
                                codigo: `CLI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
                                razonSocial: cNombre
                            }
                        })
                    }
                    clienteId = cliente.id
                }

                // 4. Crear Ruta
                const numeroRuta = await generarCorrelativoRuta(f.fechaRuta)
                const tokenRuta = crypto.randomUUID()

                const nuevaRuta = await rawPrisma.logRuta.create({
                    data: {
                        numeroRuta,
                        bodegaId,
                        choferId: chofer.id,
                        camionId: camion.id,
                        clienteId,
                        fechaRuta: f.fechaRuta,
                        horaProgramada: f.horaProgramada,
                        totalBultos: f.totalBultos ? Number(f.totalBultos) : 0,
                        totalKilos: f.totalKilos ? Number(f.totalKilos) : null,
                        observaciones: f.observaciones || 'Importación Masiva Excel',
                        estado: 'PROGRAMADA',
                        tokenRuta,
                        creadaPorId: userId || null
                    }
                })

                await rawPrisma.logEventoRuta.create({
                    data: {
                        rutaId: nuevaRuta.id,
                        estadoNuevo: 'PROGRAMADA',
                        origenCambio: 'DESPACHADOR',
                        notas: `Importada masivamente por ${username}`,
                        usuarioId: userId || null
                    }
                })

                creadas++
            } catch (errFila: any) {
                errores.push({ fila: indexFila, error: errFila?.message || 'Error inesperado en fila' })
            }
        }

        await logAuditAction({
            username,
            userId,
            action: 'IMPORTAR_RUTAS_EXCEL',
            modulo: 'Logística -> Rutas',
            detalle: `Importación masiva completada: ${creadas} rutas creadas, ${errores.length} fallidas.`
        })

        return {
            success: true,
            creadas,
            total: filas.length,
            errores
        }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Error en carga masiva.' }
    }
}
