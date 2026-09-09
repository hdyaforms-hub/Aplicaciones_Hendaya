import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit'
import { dispararEventoN8N } from '@/lib/logistica/n8n-dispatcher'

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await context.params

        // 1. Validar token contra log_integracion_configs
        const config = await rawPrisma.logIntegracionConfig.findFirst({
            where: { activo: true }
        })

        if (!config || (config.secretToken && config.secretToken !== token)) {
            return NextResponse.json(
                { error: 'No autorizado: Token de webhook inválido o inactivo' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { tokenRuta, rutaId, accion, choferTelegramId, notas, metadata } = body

        if (!tokenRuta && !rutaId) {
            return NextResponse.json(
                { error: 'Se requiere tokenRuta o rutaId para procesar la acción' },
                { status: 400 }
            )
        }

        // 2. Buscar la ruta
        const ruta = await rawPrisma.logRuta.findFirst({
            where: {
                OR: [
                    tokenRuta ? { tokenRuta } : {},
                    rutaId ? { id: rutaId } : {}
                ]
            },
            include: { chofer: true, camion: true, anden: true }
        })

        if (!ruta) {
            return NextResponse.json(
                { error: 'Ruta no encontrada para el token especificado' },
                { status: 404 }
            )
        }

        // Si viene choferTelegramId y el chofer no lo tenía, vincularlo automáticamente
        if (choferTelegramId && ruta.choferId) {
            await rawPrisma.logChofer.update({
                where: { id: ruta.choferId },
                data: { telegramChatId: String(choferTelegramId) }
            })
        }

        let nuevoEstado = ruta.estado
        let descripcionEvento = notas || 'Acción recibida desde Telegram / n8n'

        // 3. Procesar acción
        if (accion === 'LLEGADA_PORTON' || accion === 'PORTON') {
            if (ruta.estado === 'PROGRAMADA' || ruta.estado === 'NOTIFICADA') {
                nuevoEstado = 'EN_PORTON'
                await rawPrisma.logRuta.update({
                    where: { id: ruta.id },
                    data: {
                        estado: 'EN_PORTON',
                        horaLlegadaPorton: ruta.horaLlegadaPorton || new Date()
                    }
                })
                descripcionEvento = 'Chofer reportó llegada al portón vía Telegram bot.'
            }
        } else if (accion === 'CONFIRMAR_RECEPCION' || accion === 'CONFIRMADA') {
            if (ruta.estado === 'PROGRAMADA') {
                nuevoEstado = 'NOTIFICADA'
                await rawPrisma.logRuta.update({
                    where: { id: ruta.id },
                    data: { estado: 'NOTIFICADA' }
                })
                descripcionEvento = 'Chofer confirmó recepción de orden de despacho.'
            }
        }

        // 4. Registrar evento en bitácora de la ruta
        await rawPrisma.logEventoRuta.create({
            data: {
                rutaId: ruta.id,
                estadoAnterior: ruta.estado,
                estadoNuevo: nuevoEstado,
                origenCambio: 'TELEGRAM_CHOFER',
                notas: descripcionEvento,
                metadataJson: metadata ? JSON.stringify(metadata) : null
            }
        })

        // 5. Auditoría del sistema
        await logAuditAction({
            username: `telegram:${choferTelegramId || ruta.chofer?.nombre || 'chofer'}`,
            action: `CALLBACK_TELEGRAM_${accion || 'INFO'}`,
            modulo: 'Logística -> Webhooks',
            detalle: `Ruta ${ruta.numeroRuta}: ${descripcionEvento}`
        })

        return NextResponse.json({
            success: true,
            numeroRuta: ruta.numeroRuta,
            estadoAnterior: ruta.estado,
            estadoActual: nuevoEstado,
            mensaje: 'Evento procesado correctamente'
        })
    } catch (error: any) {
        console.error('Error procesando webhook entrante:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor procesando callback', detalle: error?.message },
            { status: 500 }
        )
    }
}
