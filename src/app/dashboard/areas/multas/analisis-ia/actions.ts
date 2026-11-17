'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureIaConfigTables } from '@/lib/multas/ia-config-db-init'
import { checkMultasPermission, getUserEffectiveRbds } from '@/lib/multas/permisos'
import {
    encryptApiKey,
    decryptApiKey,
    analizarFolioConIa,
    extraerPesajeConVision,
    AnalisisIaResultado,
    ExtraccionPesajeResultado
} from '@/lib/multas/ia-service'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export interface ConfigIaDTO {
    id: string
    proveedor: string
    modelo: string
    limiteGastoMensualUsd: number
    gastoAcumuladoMesUsd: number
    temperatura: number
    activo: boolean
    hasApiKey: boolean
    apiKeyMasked: string
    actualizadoPor: string | null
    updatedAt: string
}

export interface LogConsumoIaDTO {
    id: string
    folio: string | null
    usuario: string
    tipoOperacion: string
    modeloUsado: string
    tokensPrompt: number
    tokensRespuesta: number
    costoEstimadoUsd: number
    tiempoRespuestaMs: number
    exitoso: boolean
    createdAt: string
}

/**
 * Obtener la configuración actual de IA
 */
export async function getConfigIaAction(): Promise<{
    success: boolean
    data?: ConfigIaDTO
    error?: string
}> {
    try {
        await ensureIaConfigTables()
        const { authorized, user } = await checkMultasPermission('view_ia_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar la configuración de IA' }
        }

        const config = await prisma.multas_Config_IA.findFirst({
            where: { activo: true },
            orderBy: { updatedAt: 'desc' }
        })

        if (!config) {
            return { success: false, error: 'Configuración no encontrada' }
        }

        // Solo usuarios con manage_config_ia_multas pueden ver los últimos 4 dígitos
        const managePerm = await checkMultasPermission('manage_config_ia_multas')
        const rawKey = config.apiKeyEnc ? decryptApiKey(config.apiKeyEnc) : ''
        const hasKey = rawKey.length > 0

        let masked = 'No configurada (Modo Local Activo)'
        if (hasKey) {
            masked = managePerm.authorized
                ? `••••••••••••${rawKey.slice(-4)}`
                : '••••••••••••••••'
        }

        return {
            success: true,
            data: {
                id: config.id,
                proveedor: config.proveedor,
                modelo: config.modelo,
                limiteGastoMensualUsd: config.limiteGastoMensualUsd,
                gastoAcumuladoMesUsd: config.gastoAcumuladoMesUsd,
                temperatura: config.temperatura,
                activo: config.activo,
                hasApiKey: hasKey,
                apiKeyMasked: masked,
                actualizadoPor: config.actualizadoPor,
                updatedAt: config.updatedAt.toISOString()
            }
        }
    } catch (error: any) {
        console.error('Error al obtener config IA:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Guardar o actualizar la configuración de IA (Requiere permiso manage_config_ia_multas)
 */
export async function guardarConfigIaAction(data: {
    proveedor: string
    modelo: string
    apiKeyNueva?: string
    limiteGastoMensualUsd: number
    temperatura: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureIaConfigTables()
        const { authorized, user } = await checkMultasPermission('manage_config_ia_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para configurar parámetros o credenciales de IA' }
        }

        const actual = await prisma.multas_Config_IA.findFirst({
            where: { activo: true },
            orderBy: { updatedAt: 'desc' }
        })

        const userName = user.name || user.username || user.email || 'Administrador'
        let apiKeyEnc = actual?.apiKeyEnc

        if (data.apiKeyNueva && data.apiKeyNueva.trim() !== '') {
            apiKeyEnc = encryptApiKey(data.apiKeyNueva.trim())
        }

        if (actual) {
            await prisma.multas_Config_IA.update({
                where: { id: actual.id },
                data: {
                    proveedor: data.proveedor,
                    modelo: data.modelo,
                    limiteGastoMensualUsd: Number(data.limiteGastoMensualUsd) || 20.0,
                    temperatura: Number(data.temperatura) || 0.2,
                    apiKeyEnc,
                    actualizadoPor: userName
                }
            })
        } else {
            await prisma.multas_Config_IA.create({
                data: {
                    proveedor: data.proveedor,
                    modelo: data.modelo,
                    limiteGastoMensualUsd: Number(data.limiteGastoMensualUsd) || 20.0,
                    temperatura: Number(data.temperatura) || 0.2,
                    apiKeyEnc: apiKeyEnc || null,
                    actualizadoPor: userName,
                    activo: true
                }
            })
        }

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'CONFIGURAR_IA_MULTAS',
            modulo: 'Multas · Inteligencia Artificial',
            detalle: `Se actualizó la configuración de IA. Proveedor: ${data.proveedor}, Modelo: ${data.modelo}, Límite: $${data.limiteGastoMensualUsd} USD`
        })

        revalidatePath('/dashboard/areas/multas/analisis-ia')

        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar config IA:', error)
        return { success: false, error: error.message || 'Error al guardar configuración' }
    }
}

/**
 * Obtener historial de consumos de IA (Requiere manage_config_ia_multas)
 */
export async function getLogsConsumoIaAction(): Promise<{
    success: boolean
    data: LogConsumoIaDTO[]
    totalGastoMesUsd: number
    error?: string
}> {
    try {
        await ensureIaConfigTables()
        const { authorized } = await checkMultasPermission('manage_config_ia_multas')
        if (!authorized) {
            return { success: false, data: [], totalGastoMesUsd: 0, error: 'No tienes permisos para ver los logs de consumo de IA' }
        }

        const logs = await prisma.multas_Log_Consumo_IA.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        })

        const mapped: LogConsumoIaDTO[] = logs.map(l => ({
            id: l.id,
            folio: l.folio,
            usuario: l.usuario,
            tipoOperacion: l.tipoOperacion,
            modeloUsado: l.modeloUsado,
            tokensPrompt: l.tokensPrompt,
            tokensRespuesta: l.tokensRespuesta,
            costoEstimadoUsd: l.costoEstimadoUsd,
            tiempoRespuestaMs: l.tiempoRespuestaMs,
            exitoso: l.exitoso,
            createdAt: l.createdAt.toISOString()
        }))

        const totalGasto = mapped.reduce((acc, curr) => acc + curr.costoEstimadoUsd, 0)

        return { success: true, data: mapped, totalGastoMesUsd: Number(totalGasto.toFixed(4)) }
    } catch (error: any) {
        return { success: false, data: [], totalGastoMesUsd: 0, error: error.message }
    }
}

/**
 * Analizar un folio específico con el asistente IA
 */
export async function analizarFolioIaAction(folio: string): Promise<{
    success: boolean
    data?: AnalisisIaResultado
    error?: string
}> {
    try {
        await ensureIaConfigTables()
        const { authorized, user } = await checkMultasPermission('view_ia_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ejecutar el análisis de multas con IA' }
        }

        // Validar alcance de RBD
        const allowedRbds = await getUserEffectiveRbds()
        if (allowedRbds !== null) {
            const acta = await prisma.multas_Elementos_Esenciales_Cab.findUnique({
                where: { folioOriginal: folio },
                select: { rbd: true }
            })
            if (acta && !allowedRbds.includes(acta.rbd)) {
                return { success: false, error: 'No tienes autorización para consultar el acta de este establecimiento' }
            }
        }

        const userName = user.name || user.username || 'Usuario'
        const res = await analizarFolioConIa({ folio, userName })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'ANALISIS_IA_FOLIO',
            modulo: 'Multas · Inteligencia Artificial',
            detalle: `Se generó análisis de defensa asistido por IA para el folio #${folio}. Éxito: ${res.probabilidadExito}`
        })

        return { success: true, data: res }
    } catch (error: any) {
        console.error('Error al analizar folio con IA:', error)
        return { success: false, error: error.message || 'Error al procesar análisis con IA' }
    }
}

/**
 * Extraer datos de la planilla de pesaje con visión computacional
 */
export async function extraerPesajeIaAction(formData: FormData): Promise<{
    success: boolean
    data?: ExtraccionPesajeResultado
    error?: string
}> {
    try {
        await ensureIaConfigTables()
        const { authorized, user } = await checkMultasPermission('view_ia_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ejecutar extracción de pesaje con IA' }
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'No se subió ningún archivo' }
        }

        // Validación de tamaño máximo (5MB)
        if (file.size > 5 * 1024 * 1024) {
            return { success: false, error: 'El archivo excede el tamaño máximo permitido de 5 MB' }
        }

        // Validación de tipo de archivo permitido
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        const mimeType = file.type || 'image/jpeg'
        if (!allowedTypes.includes(mimeType)) {
            return { success: false, error: 'Formato de imagen no soportado. Se admiten archivos JPG, PNG y WebP' }
        }

        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const userName = user.name || user.username || 'Usuario'

        const res = await extraerPesajeConVision({
            imageBase64: base64,
            mimeType,
            userName
        })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'EXTRACCION_PESAJE_VISION_IA',
            modulo: 'Multas · Inteligencia Artificial',
            detalle: `Extracción de planilla de pesaje con IA: Nivel ${res.nivelSugerido || 'No detectado'}, ${res.bandejasEvaluadas || 0} bandejas evaluadas.`
        })

        return { success: true, data: res }
    } catch (error: any) {
        console.error('Error al extraer pesaje con IA:', error)
        return { success: false, error: error.message || 'Error al procesar imagen de pesaje' }
    }
}
