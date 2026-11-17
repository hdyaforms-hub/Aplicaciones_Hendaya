'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureIaConfigTables } from '@/lib/multas/ia-config-db-init'
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
    actualizadoPor: string
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
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        await ensureIaConfigTables()

        const config = await prisma.multas_Config_IA.findFirst({
            where: { activo: true },
            orderBy: { updatedAt: 'desc' }
        })

        if (!config) {
            return { success: false, error: 'Configuración no encontrada' }
        }

        const rawKey = config.apiKeyEnc ? decryptApiKey(config.apiKeyEnc) : ''
        const hasKey = rawKey.length > 0
        const masked = hasKey
            ? `••••••••••••${rawKey.slice(-4)}`
            : 'No configurada (Modo Local Activo)'

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
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true }
        })
        const perms: string[] = currentUser?.role?.permissions
            ? (typeof currentUser.role.permissions === 'string'
                ? JSON.parse(currentUser.role.permissions)
                : currentUser.role.permissions)
            : []

        const canManage = perms.includes('*') || perms.includes('manage_config_ia_multas')
        if (!canManage) {
            return { success: false, error: 'No tienes permisos para modificar la configuración de IA' }
        }

        await ensureIaConfigTables()

        const config = await prisma.multas_Config_IA.findFirst({
            where: { activo: true },
            orderBy: { updatedAt: 'desc' }
        })

        const updateData: any = {
            proveedor: data.proveedor,
            modelo: data.modelo,
            limiteGastoMensualUsd: Number(data.limiteGastoMensualUsd || 50),
            temperatura: Number(data.temperatura || 0.2),
            actualizadoPor: session.user.name || session.user.username || 'Admin'
        }

        if (data.apiKeyNueva && data.apiKeyNueva.trim() !== '') {
            updateData.apiKeyEnc = encryptApiKey(data.apiKeyNueva.trim())
        }

        if (config) {
            await prisma.multas_Config_IA.update({
                where: { id: config.id },
                data: updateData
            })
        } else {
            await prisma.multas_Config_IA.create({
                data: updateData
            })
        }

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
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
 * Obtener historial de consumos de IA
 */
export async function getLogsConsumoIaAction(): Promise<{
    success: boolean
    data: LogConsumoIaDTO[]
    totalGastoMesUsd: number
    error?: string
}> {
    try {
        await ensureIaConfigTables()

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
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        const userName = session.user.name || session.user.username || 'Usuario'
        const res = await analizarFolioConIa({ folio, userName })

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
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
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'No se subió ningún archivo' }
        }

        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = file.type || 'image/jpeg'
        const userName = session.user.name || session.user.username || 'Usuario'

        const res = await extraerPesajeConVision({
            imageBase64: base64,
            mimeType,
            userName
        })

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'EXTRACCION_PESAJE_VISION_IA',
            modulo: 'Multas · Inteligencia Artificial',
            detalle: `Extracción de planilla de pesaje con IA: Nivel ${res.nivelSugerido}, ${res.bandejasEvaluadas} bandejas evaluadas.`
        })

        return { success: true, data: res }
    } catch (error: any) {
        console.error('Error al extraer pesaje con IA:', error)
        return { success: false, error: error.message || 'Error al procesar imagen de pesaje' }
    }
}
