import { rawPrisma } from '@/lib/prisma'
import crypto from 'crypto'

export type LogisticaEventoTipo =
    | 'RUTA_CREADA'
    | 'CHOFER_NOTIFICADO'
    | 'CHOFER_EN_PORTON'
    | 'ANDEN_ASIGNADO'
    | 'CARGA_INICIADA'
    | 'DESPACHO_COMPLETO'
    | 'RUTA_CANCELADA'
    | 'PRUEBA_CONEXION'

export interface EventoPayloadOptions {
    rutaId?: string
    origen?: string
    notas?: string
    extra?: Record<string, any>
}

/**
 * Despacha un evento logístico hacia el webhook de n8n configurado.
 * Registra auditoría técnica en log_integracion_logs.
 */
export async function dispararEventoN8N(
    evento: LogisticaEventoTipo,
    options: EventoPayloadOptions = {}
) {
    try {
        // 1. Obtener la configuración activa de n8n
        const config = await rawPrisma.logIntegracionConfig.findFirst({
            where: { activo: true }
        })

        if (!config || !config.webhookUrl) {
            // Si no está activo o configurado, no hacer nada
            return { enviado: false, motivo: 'INTEGRACION_INACTIVA' }
        }

        // 2. Verificar si el evento está suscrito
        let suscritos: string[] = []
        try {
            suscritos = JSON.parse(config.eventosSuscritos || '[]')
        } catch {
            suscritos = ['RUTA_CREADA', 'CHOFER_NOTIFICADO', 'ANDEN_ASIGNADO', 'DESPACHO_COMPLETO', 'PRUEBA_CONEXION']
        }

        if (evento !== 'PRUEBA_CONEXION' && !suscritos.includes(evento)) {
            return { enviado: false, motivo: 'EVENTO_NO_SUSCRITO' }
        }

        // 3. Preparar los datos completos de la ruta si aplica
        let rutaData: any = null
        if (options.rutaId) {
            rutaData = await rawPrisma.logRuta.findUnique({
                where: { id: options.rutaId },
                include: {
                    chofer: true,
                    camion: true,
                    anden: true,
                    bodega: true,
                    cliente: true,
                    transportista: true
                }
            })
        }

        const timestamp = new Date().toISOString()
        const deliveryId = crypto.randomUUID()

        // 4. Construir payload estandarizado para n8n
        const payload = {
            id: deliveryId,
            event: evento,
            timestamp,
            origen: options.origen || 'SISTEMA_HENDAYA',
            notas: options.notas || null,
            ruta: rutaData
                ? {
                      id: rutaData.id,
                      numeroRuta: rutaData.numeroRuta,
                      tokenRuta: rutaData.tokenRuta,
                      fechaRuta: rutaData.fechaRuta,
                      horaProgramada: rutaData.horaProgramada,
                      estado: rutaData.estado,
                      totalBultos: rutaData.totalBultos,
                      totalKilos: rutaData.totalKilos,
                      selloSalida: rutaData.selloSalida,
                      observaciones: rutaData.observaciones
                  }
                : null,
            chofer: rutaData?.chofer
                ? {
                      id: rutaData.chofer.id,
                      nombre: rutaData.chofer.nombre,
                      rut: rutaData.chofer.rut,
                      telefono: rutaData.chofer.telefono,
                      telegramChatId: rutaData.chofer.telegramChatId
                  }
                : null,
            camion: rutaData?.camion
                ? {
                      id: rutaData.camion.id,
                      patente: rutaData.camion.patente,
                      tipoVehiculo: rutaData.camion.tipoVehiculo
                  }
                : null,
            anden: rutaData?.anden
                ? {
                      id: rutaData.anden.id,
                      codigo: rutaData.anden.codigo,
                      nombre: rutaData.anden.nombre,
                      tipoCarga: rutaData.anden.tipoCarga
                  }
                : null,
            bodega: rutaData?.bodega
                ? {
                      id: rutaData.bodega.id,
                      codigo: rutaData.bodega.codigo,
                      nombre: rutaData.bodega.nombre
                  }
                : null,
            cliente: rutaData?.cliente
                ? {
                      id: rutaData.cliente.id,
                      razonSocial: rutaData.cliente.razonSocial,
                      comuna: rutaData.cliente.comuna,
                      direccion: rutaData.cliente.direccion
                  }
                : null,
            transportista: rutaData?.transportista
                ? {
                      id: rutaData.transportista.id,
                      razonSocial: rutaData.transportista.razonSocial,
                      rut: rutaData.transportista.rut
                  }
                : null,
            extra: options.extra || {}
        }

        const payloadString = JSON.stringify(payload)

        // 5. Crear registro de log en estado PENDIENTE
        const logRecord = await rawPrisma.logIntegracionLog.create({
            data: {
                integracionConfigId: config.id,
                evento,
                rutaId: options.rutaId || null,
                payloadEnviado: payloadString,
                estado: 'PENDIENTE',
                intentos: 1
            }
        })

        // 6. Preparar headers y firma criptográfica
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Hendaya-Event': evento,
            'X-Hendaya-Delivery': deliveryId,
            'X-Hendaya-Timestamp': timestamp
        }

        if (config.secretToken) {
            const hmac = crypto.createHmac('sha256', config.secretToken).update(payloadString).digest('hex')
            headers['X-Hendaya-Signature'] = `sha256=${hmac}`
            headers['Authorization'] = `Bearer ${config.secretToken}`
        }

        // Agregar headers personalizados si existen
        if (config.headersJson) {
            try {
                const customHeaders = JSON.parse(config.headersJson)
                Object.assign(headers, customHeaders)
            } catch (e) {
                console.warn('Headers JSON inválido en configuración de integración n8n')
            }
        }

        // 7. Enviar petición HTTP POST a n8n (con timeout de 10s)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        try {
            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers,
                body: payloadString,
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            const responseText = await response.text()
            const isOk = response.status >= 200 && response.status < 300

            await rawPrisma.logIntegracionLog.update({
                where: { id: logRecord.id },
                data: {
                    respuestaCodigo: response.status,
                    respuestaCuerpo: responseText.slice(0, 4000),
                    estado: isOk ? 'EXITO' : 'ERROR',
                    errorDetalle: isOk ? null : `HTTP ${response.status}: ${responseText.slice(0, 500)}`
                }
            })

            return { enviado: true, status: response.status, logId: logRecord.id, ok: isOk }
        } catch (fetchError: any) {
            clearTimeout(timeoutId)

            await rawPrisma.logIntegracionLog.update({
                where: { id: logRecord.id },
                data: {
                    estado: 'ERROR',
                    errorDetalle: `Fallo de conexión webhook: ${fetchError?.message || String(fetchError)}`
                }
            })

            return { enviado: false, error: fetchError?.message, logId: logRecord.id }
        }
    } catch (globalError: any) {
        console.error('[N8N Dispatcher Error]', globalError)
        return { enviado: false, error: globalError?.message }
    }
}

/**
 * Reintenta manualmente un envío fallido desde la UI de logs
 */
export async function reintentarEnvioLogN8N(logId: string) {
    const log = await rawPrisma.logIntegracionLog.findUnique({
        where: { id: logId },
        include: { integracionConfig: true }
    })

    if (!log || !log.integracionConfig || !log.integracionConfig.webhookUrl) {
        throw new Error('Registro o configuración de integración no encontrada')
    }

    const payloadString = log.payloadEnviado || '{}'
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Hendaya-Event': log.evento,
        'X-Hendaya-Delivery': crypto.randomUUID(),
        'X-Hendaya-Retry': String(log.intentos + 1)
    }

    if (log.integracionConfig.secretToken) {
        const hmac = crypto.createHmac('sha256', log.integracionConfig.secretToken).update(payloadString).digest('hex')
        headers['X-Hendaya-Signature'] = `sha256=${hmac}`
        headers['Authorization'] = `Bearer ${log.integracionConfig.secretToken}`
    }

    try {
        const response = await fetch(log.integracionConfig.webhookUrl, {
            method: 'POST',
            headers,
            body: payloadString
        })
        const text = await response.text()
        const isOk = response.status >= 200 && response.status < 300

        await rawPrisma.logIntegracionLog.update({
            where: { id: log.id },
            data: {
                intentos: log.intentos + 1,
                respuestaCodigo: response.status,
                respuestaCuerpo: text.slice(0, 4000),
                estado: isOk ? 'EXITO' : 'ERROR',
                errorDetalle: isOk ? null : `HTTP ${response.status}: ${text.slice(0, 500)}`
            }
        })

        return { success: isOk, status: response.status }
    } catch (err: any) {
        await rawPrisma.logIntegracionLog.update({
            where: { id: log.id },
            data: {
                intentos: log.intentos + 1,
                estado: 'ERROR',
                errorDetalle: `Reintento fallido: ${err?.message}`
            }
        })
        return { success: false, error: err?.message }
    }
}
