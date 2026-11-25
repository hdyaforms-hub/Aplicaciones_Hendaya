'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureCicloLegalTables } from '@/lib/multas/ciclo-legal-db-init'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { checkMultasPermission } from '@/lib/multas/permisos'
import { calcularFechaPlazoHabil, estaPlazoVencido } from '@/lib/multas/fechas'

export interface DescargoFormalDTO {
    id: string
    notificacionId: string
    numeroResolucion: string
    periodoMes: number
    periodoAnio: number
    licitacionNombre: string | null
    codigoIngreso: string
    fechaIngreso: string
    fechaPlazoRespuesta: string | null
    diasPlazoLegal: number
    diasRestantes: number | null
    estado: 'BORRADOR' | 'PRESENTADO' | 'EN_EVALUACION' | 'PLAZO_VENCIDO' | 'RESPONDIDO_PARCIAL' | 'CERRADO'
    montoImpugnadoUtm: number
    montoImpugnadoPesos: number | null
    montoRebajadoUtm: number
    porcentajeExito: number
    resumenArgumentos: string | null
    documentoUrl: string | null
    documentoNombre: string | null
    abogadoResponsable: string | null
    totalFolios: number
    creadoPor: string
    createdAt: string
    updatedAt: string
}

export interface DescargoFolioDTO {
    id: string
    descargoId: string
    folio: string
    rbd: number | null
    aspecto: string
    montoNotificadoUtm: number
    montoImpugnadoUtm: number
    montoRebajadoUtm: number
    estado: 'IMPUGNADO' | 'ACOGIDO_TOTAL' | 'ACOGIDO_PARCIAL' | 'RECHAZADO'
    argumentoPrincipal: string | null
}

export interface ResuelveDTO {
    id: string
    descargoId: string
    numeroResolucion: string
    fechaResolucion: string
    fechaNotificacion: string | null
    dictamen: 'ACOGIDO_TOTAL' | 'ACOGIDO_PARCIAL' | 'RECHAZADO'
    montoRatificadoUtm: number
    montoRebajadoUtm: number
    porcentajeRebaja: number
    fundamentoResuelve: string | null
    documentoUrl: string | null
    documentoNombre: string | null
    registradoPor: string
    createdAt: string
}

export interface RecursoAdminDTO {
    id: string
    descargoId: string
    tipoRecurso: 'REPOSICION' | 'JERARQUICO' | 'REVISION_EXTRAORDINARIA'
    codigoPresentacion: string
    fechaPresentacion: string
    autoridadDestino: string | null
    estado: 'INGRESADO' | 'EN_TRAMITE' | 'ACOGIDO' | 'RECHAZADO' | 'ACOGIDO_PARCIAL'
    resolucionRespuesta: string | null
    montoRebajaExtraUtm: number
    fundamentosRecurso: string | null
    documentoUrl: string | null
    documentoNombre: string | null
    abogado: string | null
    registradoPor: string
    createdAt: string
}

export interface ProcesoJudicialDTO {
    id: string
    descargoId: string
    tribunal: string
    rolCausa: string
    caratulado: string | null
    fechaIngreso: string
    cuantiaDemandaPesos: number | null
    estadoProcesal: string
    resultadoSentencia: string | null
    abogadoExterno: string | null
    notas: string | null
    documentoUrl: string | null
    documentoNombre: string | null
    registradoPor: string
    createdAt: string
}

export interface ResumenKpiCicloLegal {
    totalDescargos: number
    enTramite: number
    plazosVencidos: number
    proximosVencer: number
    montoTotalImpugnadoUtm: number
    montoTotalRebajadoUtm: number
    tasaExitoGlobal: number
}

export interface HitoTimelineDTO {
    id: string
    fecha: string
    tipo: 'SUPERVISION' | 'NOTIFICACION_REX' | 'DESCARGO_FORMAL' | 'RESUELVE' | 'RECURSO_ADMIN' | 'PROCESO_JUDICIAL'
    titulo: string
    subtitulo: string
    descripcion: string | null
    estado: string | null
    montoUtm: number | null
    montoPesos: number | null
    documentoUrl: string | null
    documentoNombre: string | null
    responsable: string | null
    detallesBadge: string | null
}

// Utility para verificar permisos con consulta directa a BD usando el validador central
async function checkCicloLegalPermission(perm: string | string[]): Promise<{ authorized: boolean; user: any }> {
    const res = await checkMultasPermission(perm)
    return { authorized: res.authorized, user: res.user }
}

/**
 * Obtiene el listado general de descargos formales con métricas ejecutivas
 */
export async function getDescargosFormalesListAction(): Promise<{
    success: boolean
    data?: DescargoFormalDTO[]
    resumen?: ResumenKpiCicloLegal
    error?: string
}> {
    try {
        await ensureCicloLegalTables()
        const { authorized } = await checkCicloLegalPermission(['view_ciclo_legal_multas', 'manage_ciclo_legal_multas'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar el ciclo legal de multas.' }
        }

        const list = await prisma.multas_Descargo_Formal.findMany({
            include: {
                notificacion: {
                    select: {
                        numeroResolucion: true,
                        periodoMes: true,
                        periodoAnio: true,
                        licitacionNombre: true
                    }
                },
                folios: {
                    select: {
                        id: true,
                        montoImpugnadoUtm: true,
                        montoRebajadoUtm: true
                    }
                },
                resuelves: {
                    select: {
                        montoRebajadoUtm: true
                    }
                }
            },
            orderBy: { fechaIngreso: 'desc' }
        })

        const now = new Date()
        let enTramite = 0
        let plazosVencidos = 0
        let proximosVencer = 0
        let totalImpugnadoUtm = 0
        let totalRebajadoUtm = 0
        const idsVencidos: string[] = []

        const dtos: DescargoFormalDTO[] = list.map(d => {
            const rebajadoResuelves = d.resuelves.reduce((acc, r) => acc + r.montoRebajadoUtm, 0)
            const rebajadoFolios = d.folios.reduce((acc, f) => acc + f.montoRebajadoUtm, 0)
            const montoRebajadoUtm = Math.max(rebajadoResuelves, rebajadoFolios)

            let diasRestantes: number | null = null
            if (d.fechaPlazoRespuesta) {
                const diffTime = d.fechaPlazoRespuesta.getTime() - now.getTime()
                diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            }

            // Evaluar auto-marcado de PLAZO_VENCIDO si está abierto y expiró su fecha límite
            let estadoActual = d.estado as DescargoFormalDTO['estado']
            const estaVencido = (d.estado === 'PRESENTADO' || d.estado === 'EN_EVALUACION' || d.estado === 'BORRADOR') &&
                estaPlazoVencido(d.fechaPlazoRespuesta)

            if (estaVencido) {
                estadoActual = 'PLAZO_VENCIDO'
                plazosVencidos++
                if (d.estado !== 'PLAZO_VENCIDO') {
                    idsVencidos.push(d.id)
                }
            } else if (d.estado === 'PLAZO_VENCIDO') {
                plazosVencidos++
            } else if (d.estado === 'PRESENTADO' || d.estado === 'EN_EVALUACION' || d.estado === 'RESPONDIDO_PARCIAL') {
                enTramite++
                if (diasRestantes !== null) {
                    if (diasRestantes <= 5) proximosVencer++
                }
            }

            totalImpugnadoUtm += d.montoImpugnadoUtm
            totalRebajadoUtm += montoRebajadoUtm

            const pctExito = d.montoImpugnadoUtm > 0
                ? Math.round((montoRebajadoUtm / d.montoImpugnadoUtm) * 100)
                : 0

            return {
                id: d.id,
                notificacionId: d.notificacionId,
                numeroResolucion: d.notificacion.numeroResolucion,
                periodoMes: d.notificacion.periodoMes,
                periodoAnio: d.notificacion.periodoAnio,
                licitacionNombre: d.notificacion.licitacionNombre,
                codigoIngreso: d.codigoIngreso,
                fechaIngreso: d.fechaIngreso.toISOString().split('T')[0],
                fechaPlazoRespuesta: d.fechaPlazoRespuesta ? d.fechaPlazoRespuesta.toISOString().split('T')[0] : null,
                diasPlazoLegal: d.diasPlazoLegal,
                diasRestantes,
                estado: estadoActual,
                montoImpugnadoUtm: d.montoImpugnadoUtm,
                montoImpugnadoPesos: d.montoImpugnadoPesos,
                montoRebajadoUtm,
                porcentajeExito: pctExito,
                resumenArgumentos: d.resumenArgumentos,
                documentoUrl: d.documentoUrl,
                documentoNombre: d.documentoNombre,
                abogadoResponsable: d.abogadoResponsable,
                totalFolios: d.folios.length,
                creadoPor: d.creadoPor,
                createdAt: d.createdAt.toISOString(),
                updatedAt: d.updatedAt.toISOString()
            }
        })

        // Sincronizar en base de datos los descargos vencidos detectados
        if (idsVencidos.length > 0) {
            try {
                await prisma.multas_Descargo_Formal.updateMany({
                    where: { id: { in: idsVencidos } },
                    data: { estado: 'PLAZO_VENCIDO' }
                })
            } catch (errSync) {
                console.error('Error sincronizando estado PLAZO_VENCIDO en descargos:', errSync)
            }
        }

        const tasaExitoGlobal = totalImpugnadoUtm > 0
            ? Math.round((totalRebajadoUtm / totalImpugnadoUtm) * 100)
            : 0

        const resumen: ResumenKpiCicloLegal = {
            totalDescargos: list.length,
            enTramite,
            plazosVencidos,
            proximosVencer,
            montoTotalImpugnadoUtm: Math.round(totalImpugnadoUtm * 1000) / 1000,
            montoTotalRebajadoUtm: Math.round(totalRebajadoUtm * 1000) / 1000,
            tasaExitoGlobal
        }

        return { success: true, data: dtos, resumen }
    } catch (e: any) {
        console.error('Error al obtener lista de descargos formales:', e)
        return { success: false, error: e.message || 'Error al obtener descargos.' }
    }
}

/**
 * Obtiene el detalle completo de un descargo formal (folios, resuelves, recursos, juicio)
 */
export async function getDescargoFormalDetalleAction(id: string): Promise<{
    success: boolean
    descargo?: DescargoFormalDTO
    folios?: DescargoFolioDTO[]
    resuelves?: ResuelveDTO[]
    recursos?: RecursoAdminDTO[]
    procesosJudiciales?: ProcesoJudicialDTO[]
    error?: string
}> {
    try {
        await ensureCicloLegalTables()
        const { authorized } = await checkCicloLegalPermission(['view_ciclo_legal_multas', 'manage_ciclo_legal_multas'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ver el detalle del descargo.' }
        }

        const d = await prisma.multas_Descargo_Formal.findUnique({
            where: { id },
            include: {
                notificacion: {
                    select: {
                        numeroResolucion: true,
                        periodoMes: true,
                        periodoAnio: true,
                        licitacionNombre: true
                    }
                },
                folios: {
                    orderBy: [{ folio: 'asc' }, { aspecto: 'asc' }]
                },
                resuelves: {
                    orderBy: { fechaResolucion: 'desc' }
                },
                recursos: {
                    orderBy: { fechaPresentacion: 'desc' }
                },
                procesosJudiciales: {
                    orderBy: { fechaIngreso: 'desc' }
                }
            }
        })

        if (!d) {
            return { success: false, error: 'Descargo formal no encontrado.' }
        }

        const now = new Date()
        let diasRestantes: number | null = null
        if (d.fechaPlazoRespuesta) {
            const diffTime = d.fechaPlazoRespuesta.getTime() - now.getTime()
            diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        }

        const rebajadoResuelves = d.resuelves.reduce((acc, r) => acc + r.montoRebajadoUtm, 0)
        const rebajadoFolios = d.folios.reduce((acc, f) => acc + f.montoRebajadoUtm, 0)
        const montoRebajadoUtm = Math.max(rebajadoResuelves, rebajadoFolios)
        const pctExito = d.montoImpugnadoUtm > 0
            ? Math.round((montoRebajadoUtm / d.montoImpugnadoUtm) * 100)
            : 0

        let estadoActual = d.estado as DescargoFormalDTO['estado']
        if ((d.estado === 'PRESENTADO' || d.estado === 'EN_EVALUACION' || d.estado === 'BORRADOR') && estaPlazoVencido(d.fechaPlazoRespuesta)) {
            estadoActual = 'PLAZO_VENCIDO'
            try {
                await prisma.multas_Descargo_Formal.update({
                    where: { id: d.id },
                    data: { estado: 'PLAZO_VENCIDO' }
                })
            } catch (e) {
                console.error('Error auto-marcando PLAZO_VENCIDO en detalle:', e)
            }
        }

        const descargoDto: DescargoFormalDTO = {
            id: d.id,
            notificacionId: d.notificacionId,
            numeroResolucion: d.notificacion.numeroResolucion,
            periodoMes: d.notificacion.periodoMes,
            periodoAnio: d.notificacion.periodoAnio,
            licitacionNombre: d.notificacion.licitacionNombre,
            codigoIngreso: d.codigoIngreso,
            fechaIngreso: d.fechaIngreso.toISOString().split('T')[0],
            fechaPlazoRespuesta: d.fechaPlazoRespuesta ? d.fechaPlazoRespuesta.toISOString().split('T')[0] : null,
            diasPlazoLegal: d.diasPlazoLegal,
            diasRestantes,
            estado: estadoActual,
            montoImpugnadoUtm: d.montoImpugnadoUtm,
            montoImpugnadoPesos: d.montoImpugnadoPesos,
            montoRebajadoUtm,
            porcentajeExito: pctExito,
            resumenArgumentos: d.resumenArgumentos,
            documentoUrl: d.documentoUrl,
            documentoNombre: d.documentoNombre,
            abogadoResponsable: d.abogadoResponsable,
            totalFolios: d.folios.length,
            creadoPor: d.creadoPor,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString()
        }

        const foliosDto: DescargoFolioDTO[] = d.folios.map(f => ({
            id: f.id,
            descargoId: f.descargoId,
            folio: f.folio,
            rbd: f.rbd,
            aspecto: f.aspecto,
            montoNotificadoUtm: f.montoNotificadoUtm,
            montoImpugnadoUtm: f.montoImpugnadoUtm,
            montoRebajadoUtm: f.montoRebajadoUtm,
            estado: f.estado as any,
            argumentoPrincipal: f.argumentoPrincipal
        }))

        const resuelvesDto: ResuelveDTO[] = d.resuelves.map(r => ({
            id: r.id,
            descargoId: r.descargoId,
            numeroResolucion: r.numeroResolucion,
            fechaResolucion: r.fechaResolucion.toISOString().split('T')[0],
            fechaNotificacion: r.fechaNotificacion ? r.fechaNotificacion.toISOString().split('T')[0] : null,
            dictamen: r.dictamen as any,
            montoRatificadoUtm: r.montoRatificadoUtm,
            montoRebajadoUtm: r.montoRebajadoUtm,
            porcentajeRebaja: r.porcentajeRebaja,
            fundamentoResuelve: r.fundamentoResuelve,
            documentoUrl: r.documentoUrl,
            documentoNombre: r.documentoNombre,
            registradoPor: r.registradoPor,
            createdAt: r.createdAt.toISOString()
        }))

        const recursosDto: RecursoAdminDTO[] = d.recursos.map(rc => ({
            id: rc.id,
            descargoId: rc.descargoId,
            tipoRecurso: rc.tipoRecurso as any,
            codigoPresentacion: rc.codigoPresentacion,
            fechaPresentacion: rc.fechaPresentacion.toISOString().split('T')[0],
            autoridadDestino: rc.autoridadDestino,
            estado: rc.estado as any,
            resolucionRespuesta: rc.resolucionRespuesta,
            montoRebajaExtraUtm: rc.montoRebajaExtraUtm,
            fundamentosRecurso: rc.fundamentosRecurso,
            documentoUrl: rc.documentoUrl,
            documentoNombre: rc.documentoNombre,
            abogado: rc.abogado,
            registradoPor: rc.registradoPor,
            createdAt: rc.createdAt.toISOString()
        }))

        const procesosDto: ProcesoJudicialDTO[] = d.procesosJudiciales.map(p => ({
            id: p.id,
            descargoId: p.descargoId,
            tribunal: p.tribunal,
            rolCausa: p.rolCausa,
            caratulado: p.caratulado,
            fechaIngreso: p.fechaIngreso.toISOString().split('T')[0],
            cuantiaDemandaPesos: p.cuantiaDemandaPesos,
            estadoProcesal: p.estadoProcesal,
            resultadoSentencia: p.resultadoSentencia,
            abogadoExterno: p.abogadoExterno,
            notas: p.notas,
            documentoUrl: p.documentoUrl,
            documentoNombre: p.documentoNombre,
            registradoPor: p.registradoPor,
            createdAt: p.createdAt.toISOString()
        }))

        return {
            success: true,
            descargo: descargoDto,
            folios: foliosDto,
            resuelves: resuelvesDto,
            recursos: recursosDto,
            procesosJudiciales: procesosDto
        }
    } catch (e: any) {
        console.error('Error al obtener detalle del descargo:', e)
        return { success: false, error: e.message || 'Error al obtener detalle.' }
    }
}

/**
 * Obtiene las REX disponibles para crear un nuevo descargo formal
 */
export async function getNotificacionesDisponiblesAction(): Promise<{
    success: boolean
    data?: Array<{ id: string; numeroResolucion: string; periodo: string; totalItems: number; montoTotalNotificado: number }>
    error?: string
}> {
    try {
        await ensureCicloLegalTables()
        const { authorized } = await checkMultasPermission(['view_ciclo_legal_multas', 'manage_ciclo_legal_multas'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar las notificaciones REX del ciclo legal.' }
        }

        const list = await prisma.multas_Notificacion_REX.findMany({
            select: {
                id: true,
                numeroResolucion: true,
                periodoMes: true,
                periodoAnio: true,
                totalFilasNotif: true,
                montoTotalNotificado: true
            },
            orderBy: [{ periodoAnio: 'desc' }, { periodoMes: 'desc' }]
        })

        return {
            success: true,
            data: list.map(r => ({
                id: r.id,
                numeroResolucion: r.numeroResolucion,
                periodo: `${r.periodoMes}/${r.periodoAnio}`,
                totalItems: r.totalFilasNotif,
                montoTotalNotificado: r.montoTotalNotificado
            }))
        }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * Registra un nuevo descargo formal asociando los folios de una REX
 */
export async function crearDescargoFormalAction(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await ensureCicloLegalTables()
        const { authorized, user } = await checkCicloLegalPermission('manage_ciclo_legal_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para registrar descargos formales.' }
        }

        const notificacionId = (formData.get('notificacionId') as string || '').trim()
        const codigoIngreso = (formData.get('codigoIngreso') as string || '').trim()
        const fechaIngresoStr = (formData.get('fechaIngreso') as string || '').trim()
        const diasPlazoLegal = parseInt(formData.get('diasPlazoLegal') as string || '30', 10)
        const abogadoResponsable = (formData.get('abogadoResponsable') as string || '').trim() || null
        const resumenArgumentos = (formData.get('resumenArgumentos') as string || '').trim() || null
        const montoPesosStr = formData.get('montoImpugnadoPesos') as string || ''
        const montoImpugnadoPesos = montoPesosStr ? parseFloat(montoPesosStr) : null

        if (!notificacionId) return { success: false, error: 'Debes seleccionar una resolución REX notificada.' }
        if (!codigoIngreso) return { success: false, error: 'El código de ingreso ante JUNAEB es obligatorio.' }
        if (!fechaIngresoStr) return { success: false, error: 'La fecha de ingreso es obligatoria.' }

        const fechaIngreso = new Date(fechaIngresoStr)
        // Cálculo del plazo legal en días hábiles administrativos
        const fechaPlazoRespuesta = calcularFechaPlazoHabil(fechaIngreso, diasPlazoLegal)

        // Obtener items de la REX notificada para asociar sus folios
        const rexItems = await prisma.multas_Notificacion_Item.findMany({
            where: { notificacionId }
        })

        if (rexItems.length === 0) {
            return { success: false, error: 'La resolución seleccionada no contiene items ni folios para impugnar.' }
        }

        // Se impugnan los ítems notificados por JUNAEB (excluyendo 'NO_INCLUIDO' que no fue notificado)
        const itemsAImpugnar = rexItems.filter(item => item.montoNotificado > 0 && item.estadoConciliacion !== 'NO_INCLUIDO')
        const itemsFinales = itemsAImpugnar.length > 0 ? itemsAImpugnar : rexItems.filter(item => item.montoNotificado > 0)

        if (itemsFinales.length === 0) {
            return { success: false, error: 'No se encontraron ítems con monto notificado por JUNAEB para impugnar.' }
        }

        // Sumar monto impugnado en UTM basado estrictamente en lo notificado por JUNAEB
        let totalImpugnadoUtm = 0
        const foliosToCreate = itemsFinales.map(item => {
            const montoImpugnado = item.montoNotificado
            totalImpugnadoUtm += montoImpugnado
            return {
                notificacionItemId: item.id,
                folio: item.folio,
                rbd: item.rbd,
                aspecto: item.aspecto,
                montoNotificadoUtm: item.montoNotificado,
                montoImpugnadoUtm: montoImpugnado,
                montoRebajadoUtm: 0.0,
                estado: 'IMPUGNADO',
                argumentoPrincipal: item.motivoClasificacion || item.infraccionDetalle
            }
        })

        const userName = user.name || user.username || 'Usuario'

        const created = await prisma.multas_Descargo_Formal.create({
            data: {
                notificacionId,
                codigoIngreso,
                fechaIngreso,
                fechaPlazoRespuesta,
                diasPlazoLegal,
                estado: 'PRESENTADO',
                montoImpugnadoUtm: Math.round(totalImpugnadoUtm * 1000) / 1000,
                montoImpugnadoPesos,
                resumenArgumentos,
                abogadoResponsable,
                creadoPor: userName,
                folios: {
                    create: foliosToCreate
                }
            }
        })

        // Actualizar estado de la REX
        await prisma.multas_Notificacion_REX.update({
            where: { id: notificacionId },
            data: { estado: 'EN_DESCARGO' }
        })

        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CREAR_DESCARGO_FORMAL',
            modulo: 'Multas · Ciclo Legal',
            detalle: `Registro de Descargo Formal ${codigoIngreso} para REX: ${foliosToCreate.length} folios, total ${totalImpugnadoUtm.toFixed(2)} UTM impugnadas.`
        })

        revalidatePath('/dashboard/areas/multas/ciclo-legal')
        return { success: true, id: created.id }
    } catch (e: any) {
        console.error('Error al crear descargo formal:', e)
        if (e.code === 'P2002') {
            return { success: false, error: 'Ya existe un descargo registrado con ese mismo código de ingreso para esta resolución.' }
        }
        return { success: false, error: e.message || 'Error al registrar descargo.' }
    }
}

/**
 * Registra el Resuelve (Fallo de JUNAEB al descargo)
 */
export async function registrarResuelveAction(params: {
    descargoId: string
    numeroResolucion: string
    fechaResolucion: string
    fechaNotificacion?: string
    dictamen: 'ACOGIDO_TOTAL' | 'ACOGIDO_PARCIAL' | 'RECHAZADO'
    montoRatificadoUtm: number
    montoRebajadoUtm: number
    fundamentoResuelve?: string
    documentoUrl?: string
    documentoNombre?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureCicloLegalTables()
        const { authorized, user } = await checkCicloLegalPermission('manage_ciclo_legal_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para registrar resoluciones de respuesta (Resuelve).' }
        }

        const { descargoId, numeroResolucion, fechaResolucion, fechaNotificacion, dictamen, montoRatificadoUtm, montoRebajadoUtm, fundamentoResuelve, documentoUrl, documentoNombre } = params
        if (!descargoId || !numeroResolucion || !fechaResolucion) {
            return { success: false, error: 'Número de resolución y fecha son obligatorios.' }
        }

        if (montoRatificadoUtm < 0 || montoRebajadoUtm < 0) {
            return { success: false, error: 'Los montos ratificados o rebajados no pueden ser negativos.' }
        }

        const descargo = await prisma.multas_Descargo_Formal.findUnique({
            where: { id: descargoId },
            include: {
                resuelves: { select: { montoRebajadoUtm: true } }
            }
        })
        if (!descargo) {
            return { success: false, error: 'Descargo formal no encontrado.' }
        }

        const rebajadoPrevio = descargo.resuelves.reduce((acc, r) => acc + (r.montoRebajadoUtm || 0), 0)
        const nuevoTotalRebajado = rebajadoPrevio + montoRebajadoUtm

        if (descargo.montoImpugnadoUtm > 0 && nuevoTotalRebajado > descargo.montoImpugnadoUtm) {
            return {
                success: false,
                error: `El total rebajado acumulado (${nuevoTotalRebajado.toLocaleString('es-CL')} UTM: ${rebajadoPrevio.toLocaleString('es-CL')} previas + ${montoRebajadoUtm.toLocaleString('es-CL')} nueva) no puede superar el monto impugnado (${descargo.montoImpugnadoUtm.toLocaleString('es-CL')} UTM).`
            }
        }

        const totalEvaluado = montoRatificadoUtm + montoRebajadoUtm
        const pctRebaja = totalEvaluado > 0 ? Math.round((montoRebajadoUtm / totalEvaluado) * 100) : (dictamen === 'ACOGIDO_TOTAL' ? 100 : 0)
        const userName = user.name || user.username || 'Usuario'

        await prisma.multas_Resuelve.create({
            data: {
                descargoId,
                numeroResolucion: numeroResolucion.trim(),
                fechaResolucion: new Date(fechaResolucion),
                fechaNotificacion: fechaNotificacion ? new Date(fechaNotificacion) : null,
                dictamen,
                montoRatificadoUtm,
                montoRebajadoUtm,
                porcentajeRebaja: pctRebaja,
                fundamentoResuelve: fundamentoResuelve?.trim(),
                documentoUrl,
                documentoNombre,
                registradoPor: userName
            }
        })

        // Actualizar estado del descargo y de sus folios según el dictamen formal
        const nuevoEstadoDescargo = dictamen === 'ACOGIDO_TOTAL' || dictamen === 'RECHAZADO'
            ? 'CERRADO'
            : 'RESPONDIDO_PARCIAL'

        await prisma.multas_Descargo_Formal.update({
            where: { id: descargoId },
            data: { estado: nuevoEstadoDescargo }
        })

        // Actualizar estado de los folios controvertidos
        if (dictamen === 'ACOGIDO_TOTAL') {
            await prisma.multas_Descargo_Folio.updateMany({
                where: { descargoId },
                data: {
                    estado: 'ACOGIDO_TOTAL',
                    montoRebajadoUtm: montoRebajadoUtm // o prorrateado
                }
            })
        } else if (dictamen === 'RECHAZADO') {
            await prisma.multas_Descargo_Folio.updateMany({
                where: { descargoId },
                data: {
                    estado: 'RECHAZADO',
                    montoRebajadoUtm: 0.0
                }
            })
        } else {
            await prisma.multas_Descargo_Folio.updateMany({
                where: { descargoId },
                data: {
                    estado: 'ACOGIDO_PARCIAL'
                }
            })
        }

        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'REGISTRAR_RESUELVE_JUNAEB',
            modulo: 'Multas · Ciclo Legal',
            detalle: `Registro de Resuelve ${numeroResolucion}: Dictamen ${dictamen}, Rebaja ${montoRebajadoUtm.toFixed(2)} UTM (${pctRebaja}%).`
        })

        revalidatePath(`/dashboard/areas/multas/ciclo-legal/${descargoId}`)
        revalidatePath('/dashboard/areas/multas/ciclo-legal')
        return { success: true }
    } catch (e: any) {
        console.error('Error al registrar resuelve:', e)
        return { success: false, error: e.message || 'Error al registrar resuelve.' }
    }
}

/**
 * Registra un recurso administrativo (Reposición o Jerárquico)
 */
export async function registrarRecursoAdminAction(params: {
    descargoId: string
    tipoRecurso: 'REPOSICION' | 'JERARQUICO' | 'REVISION_EXTRAORDINARIA'
    codigoPresentacion: string
    fechaPresentacion: string
    autoridadDestino?: string
    fundamentosRecurso?: string
    abogado?: string
    documentoUrl?: string
    documentoNombre?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureCicloLegalTables()
        const { authorized, user } = await checkCicloLegalPermission('manage_ciclo_legal_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para interponer recursos administrativos.' }
        }

        const { descargoId, tipoRecurso, codigoPresentacion, fechaPresentacion, autoridadDestino, fundamentosRecurso, abogado, documentoUrl, documentoNombre } = params
        if (!descargoId || !codigoPresentacion || !fechaPresentacion) {
            return { success: false, error: 'Código de presentación y fecha son obligatorios.' }
        }

        const userName = user.name || user.username || 'Usuario'

        await prisma.multas_Recurso_Admin.create({
            data: {
                descargoId,
                tipoRecurso,
                codigoPresentacion: codigoPresentacion.trim(),
                fechaPresentacion: new Date(fechaPresentacion),
                autoridadDestino: autoridadDestino?.trim(),
                fundamentosRecurso: fundamentosRecurso?.trim(),
                abogado: abogado?.trim(),
                documentoUrl,
                documentoNombre,
                registradoPor: userName,
                estado: 'INGRESADO'
            }
        })

        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'REGISTRAR_RECURSO_ADMIN',
            modulo: 'Multas · Ciclo Legal',
            detalle: `Interposición de Recurso ${tipoRecurso} (${codigoPresentacion}) ante ${autoridadDestino || 'JUNAEB'}.`
        })

        revalidatePath(`/dashboard/areas/multas/ciclo-legal/${descargoId}`)
        return { success: true }
    } catch (e: any) {
        console.error('Error al registrar recurso administrativo:', e)
        return { success: false, error: e.message || 'Error al registrar recurso.' }
    }
}

/**
 * Registra un proceso judicial en tribunales
 */
export async function registrarProcesoJudicialAction(params: {
    descargoId: string
    tribunal: string
    rolCausa: string
    caratulado?: string
    fechaIngreso: string
    cuantiaDemandaPesos?: number
    estadoProcesal?: string
    abogadoExterno?: string
    notas?: string
    documentoUrl?: string
    documentoNombre?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureCicloLegalTables()
        const { authorized, user } = await checkCicloLegalPermission('manage_ciclo_legal_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para registrar procesos judiciales.' }
        }

        const { descargoId, tribunal, rolCausa, caratulado, fechaIngreso, cuantiaDemandaPesos, estadoProcesal, abogadoExterno, notas, documentoUrl, documentoNombre } = params
        if (!descargoId || !tribunal || !rolCausa || !fechaIngreso) {
            return { success: false, error: 'Tribunal, Rol/Causa y fecha de ingreso son obligatorios.' }
        }

        const userName = user.name || user.username || 'Usuario'

        await prisma.multas_Proceso_Judicial.create({
            data: {
                descargoId,
                tribunal: tribunal.trim(),
                rolCausa: rolCausa.trim(),
                caratulado: caratulado?.trim(),
                fechaIngreso: new Date(fechaIngreso),
                cuantiaDemandaPesos,
                estadoProcesal: estadoProcesal || 'DEMANDA',
                abogadoExterno: abogadoExterno?.trim(),
                notas: notas?.trim(),
                documentoUrl,
                documentoNombre,
                registradoPor: userName
            }
        })

        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'REGISTRAR_PROCESO_JUDICIAL',
            modulo: 'Multas · Ciclo Legal',
            detalle: `Registro de causa judicial Rol ${rolCausa} en ${tribunal}.`
        })

        revalidatePath(`/dashboard/areas/multas/ciclo-legal/${descargoId}`)
        return { success: true }
    } catch (e: any) {
        console.error('Error al registrar proceso judicial:', e)
        return { success: false, error: e.message || 'Error al registrar proceso judicial.' }
    }
}

/**
 * Reconstruye el Expediente Digital Unificado (Timeline) por Folio o por N° Resolución
 */
export async function getExpedienteTimelineAction(query: { folio?: string; numeroResolucion?: string }): Promise<{
    success: boolean
    hitos?: HitoTimelineDTO[]
    identificador?: string
    error?: string
}> {
    try {
        await ensureCicloLegalTables()
        const { authorized } = await checkCicloLegalPermission(['view_ciclo_legal_multas', 'manage_ciclo_legal_multas'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar el expediente digital.' }
        }

        const folio = query.folio?.trim()
        const numRex = query.numeroResolucion?.trim()
        if (!folio && !numRex) {
            return { success: false, error: 'Debes proporcionar un folio de acta o un número de resolución para buscar.' }
        }

        const hitos: HitoTimelineDTO[] = []
        const seenHitoIds = new Set<string>()

        const pushHito = (hito: HitoTimelineDTO) => {
            if (!seenHitoIds.has(hito.id)) {
                seenHitoIds.add(hito.id)
                hitos.push(hito)
            }
        }

        if (folio) {
            // 1. Acta de Supervisión
            const cab = await prisma.multas_Elementos_Esenciales_Cab.findUnique({
                where: { folioOriginal: folio },
                include: { detalles: true }
            })

            if (cab) {
                const totalAspectos = cab.detalles.length
                pushHito({
                    id: `sup_${cab.id}`,
                    fecha: cab.fechaSupervision.toISOString().split('T')[0],
                    tipo: 'SUPERVISION',
                    titulo: `Supervisión en Terreno — Acta #${folio}`,
                    subtitulo: `RBD ${cab.rbd} · Licitación: ${cab.licitacion || '-'}`,
                    descripcion: `Acta evaluada con ${totalAspectos} aspecto(s) observado(s). Monto calculado internamente: ${cab.montoTotalCalculado.toFixed(2)} UTM.`,
                    estado: cab.estadoCalculo,
                    montoUtm: cab.montoTotalCalculado,
                    montoPesos: null,
                    documentoUrl: null,
                    documentoNombre: null,
                    responsable: cab.usuarioCalculo,
                    detallesBadge: `Acta Original`
                })
            }

            // 2. Notificaciones REX donde figura este folio
            const notifItems = await prisma.multas_Notificacion_Item.findMany({
                where: { folio },
                include: { notificacion: true }
            })

            for (const ni of notifItems) {
                pushHito({
                    id: `notif_${ni.id}`,
                    fecha: ni.notificacion.fechaResolucion ? ni.notificacion.fechaResolucion.toISOString().split('T')[0] : ni.createdAt.toISOString().split('T')[0],
                    tipo: 'NOTIFICACION_REX',
                    titulo: `Notificación Oficial — ${ni.notificacion.numeroResolucion}`,
                    subtitulo: `Aspecto ${ni.aspecto} · Período ${ni.notificacion.periodoMes}/${ni.notificacion.periodoAnio}`,
                    descripcion: ni.infraccionDetalle || `Infracción notificada en Anexo 1 oficial.`,
                    estado: ni.estadoConciliacion,
                    montoUtm: ni.montoNotificado,
                    montoPesos: null,
                    documentoUrl: null,
                    documentoNombre: ni.notificacion.nombreArchivo,
                    responsable: ni.notificacion.cargadoPor,
                    detallesBadge: ni.clasificacionError ? `Clasificado: ${ni.clasificacionError}` : `Estado: ${ni.estadoConciliacion}`
                })
            }

            // 3. Descargos Formales
            const descargoFolios = await prisma.multas_Descargo_Folio.findMany({
                where: { folio },
                include: {
                    descargo: {
                        include: {
                            notificacion: true,
                            resuelves: true,
                            recursos: true,
                            procesosJudiciales: true
                        }
                    }
                }
            })

            for (const df of descargoFolios) {
                const d = df.descargo
                pushHito({
                    id: `desc_${d.id}`,
                    fecha: d.fechaIngreso.toISOString().split('T')[0],
                    tipo: 'DESCARGO_FORMAL',
                    titulo: `Descargo Formal Ingresado — ${d.codigoIngreso}`,
                    subtitulo: `Antecedentes REX ${d.notificacion.numeroResolucion} · Abogado: ${d.abogadoResponsable || 'No asignado'}`,
                    descripcion: df.argumentoPrincipal || d.resumenArgumentos || `Presentación formal de descargos ante oficina de partes de JUNAEB.`,
                    estado: d.estado,
                    montoUtm: df.montoImpugnadoUtm,
                    montoPesos: d.montoImpugnadoPesos,
                    documentoUrl: d.documentoUrl,
                    documentoNombre: d.documentoNombre,
                    responsable: d.creadoPor,
                    detallesBadge: `Plazo: ${d.diasPlazoLegal} días`
                })

                // Resuelves asociados
                for (const r of d.resuelves) {
                    pushHito({
                        id: `res_${r.id}`,
                        fecha: r.fechaResolucion.toISOString().split('T')[0],
                        tipo: 'RESUELVE',
                        titulo: `Dictamen de Término — ${r.numeroResolucion}`,
                        subtitulo: `Resultado JUNAEB: ${r.dictamen}`,
                        descripcion: r.fundamentoResuelve || `Resolución que resuelve los descargos presentados. Rebaja obtenida: ${r.montoRebajadoUtm.toFixed(2)} UTM (${r.porcentajeRebaja}% de éxito).`,
                        estado: r.dictamen,
                        montoUtm: r.montoRatificadoUtm,
                        montoPesos: null,
                        documentoUrl: r.documentoUrl,
                        documentoNombre: r.documentoNombre,
                        responsable: r.registradoPor,
                        detallesBadge: `Rebaja: ${r.montoRebajadoUtm.toFixed(2)} UTM`
                    })
                }

                // Recursos administrativos
                for (const rc of d.recursos) {
                    pushHito({
                        id: `rec_${rc.id}`,
                        fecha: rc.fechaPresentacion.toISOString().split('T')[0],
                        tipo: 'RECURSO_ADMIN',
                        titulo: `Recurso Administrativo (${rc.tipoRecurso}) — ${rc.codigoPresentacion}`,
                        subtitulo: `Presentado ante: ${rc.autoridadDestino || 'JUNAEB'}`,
                        descripcion: rc.fundamentosRecurso || `Impugnación administrativa en segunda instancia contra el dictamen emitido.`,
                        estado: rc.estado,
                        montoUtm: rc.montoRebajaExtraUtm > 0 ? rc.montoRebajaExtraUtm : null,
                        montoPesos: null,
                        documentoUrl: rc.documentoUrl,
                        documentoNombre: rc.documentoNombre,
                        responsable: rc.registradoPor,
                        detallesBadge: rc.estado
                    })
                }

                // Procesos judiciales
                for (const pj of d.procesosJudiciales) {
                    pushHito({
                        id: `jud_${pj.id}`,
                        fecha: pj.fechaIngreso.toISOString().split('T')[0],
                        tipo: 'PROCESO_JUDICIAL',
                        titulo: `Proceso Judicial — Rol ${pj.rolCausa}`,
                        subtitulo: `${pj.tribunal} · ${pj.caratulado || ''}`,
                        descripcion: pj.notas || `Litigio judicial en tribunales. Estado procesal: ${pj.estadoProcesal}.`,
                        estado: pj.estadoProcesal,
                        montoUtm: null,
                        montoPesos: pj.cuantiaDemandaPesos,
                        documentoUrl: pj.documentoUrl,
                        documentoNombre: pj.documentoNombre,
                        responsable: pj.registradoPor,
                        detallesBadge: pj.resultadoSentencia || pj.estadoProcesal
                    })
                }
            }
        } else if (numRex) {
            // Búsqueda por número de resolución (REX o Resuelve)
            const notificacionesRex = await prisma.multas_Notificacion_REX.findMany({
                where: { numeroResolucion: { contains: numRex, mode: 'insensitive' } },
                include: {
                    descargos: {
                        include: {
                            folios: true,
                            resuelves: true,
                            recursos: true,
                            procesosJudiciales: true
                        }
                    }
                }
            })

            for (const notif of notificacionesRex) {
                pushHito({
                    id: `rex_${notif.id}`,
                    fecha: notif.fechaResolucion ? notif.fechaResolucion.toISOString().split('T')[0] : notif.createdAt.toISOString().split('T')[0],
                    tipo: 'NOTIFICACION_REX',
                    titulo: `Notificación Oficial JUNAEB — REX ${notif.numeroResolucion}`,
                    subtitulo: `Período ${notif.periodoMes}/${notif.periodoAnio} · ${notif.totalFoliosNotif} folios notificados`,
                    descripcion: `Monto total notificado: ${notif.montoTotalNotificado.toFixed(2)} UTM. Estado: ${notif.estado}.`,
                    estado: notif.estado,
                    montoUtm: notif.montoTotalNotificado,
                    montoPesos: null,
                    documentoUrl: null,
                    documentoNombre: notif.nombreArchivo,
                    responsable: notif.cargadoPor,
                    detallesBadge: notif.estado
                })

                for (const d of notif.descargos) {
                    pushHito({
                        id: `desc_${d.id}`,
                        fecha: d.fechaIngreso.toISOString().split('T')[0],
                        tipo: 'DESCARGO_FORMAL',
                        titulo: `Descargo Formal Ingresado — ${d.codigoIngreso}`,
                        subtitulo: `REX ${notif.numeroResolucion} · Abogado: ${d.abogadoResponsable || 'No asignado'}`,
                        descripcion: d.resumenArgumentos || `Presentación formal de descargos ante oficina de partes de JUNAEB.`,
                        estado: d.estado,
                        montoUtm: d.montoImpugnadoUtm,
                        montoPesos: d.montoImpugnadoPesos,
                        documentoUrl: d.documentoUrl,
                        documentoNombre: d.documentoNombre,
                        responsable: d.creadoPor,
                        detallesBadge: `Plazo: ${d.diasPlazoLegal} días`
                    })

                    for (const r of d.resuelves) {
                        pushHito({
                            id: `res_${r.id}`,
                            fecha: r.fechaResolucion.toISOString().split('T')[0],
                            tipo: 'RESUELVE',
                            titulo: `Dictamen de Término — ${r.numeroResolucion}`,
                            subtitulo: `Resultado JUNAEB: ${r.dictamen}`,
                            descripcion: r.fundamentoResuelve || `Resolución que resuelve los descargos presentados. Rebaja: ${r.montoRebajadoUtm.toFixed(2)} UTM.`,
                            estado: r.dictamen,
                            montoUtm: r.montoRatificadoUtm,
                            montoPesos: null,
                            documentoUrl: r.documentoUrl,
                            documentoNombre: r.documentoNombre,
                            responsable: r.registradoPor,
                            detallesBadge: `Rebaja: ${r.montoRebajadoUtm.toFixed(2)} UTM`
                        })
                    }

                    for (const rc of d.recursos) {
                        pushHito({
                            id: `rec_${rc.id}`,
                            fecha: rc.fechaPresentacion.toISOString().split('T')[0],
                            tipo: 'RECURSO_ADMIN',
                            titulo: `Recurso Administrativo (${rc.tipoRecurso}) — ${rc.codigoPresentacion}`,
                            subtitulo: `Presentado ante: ${rc.autoridadDestino || 'JUNAEB'}`,
                            descripcion: rc.fundamentosRecurso || `Impugnación administrativa en segunda instancia contra el dictamen emitido.`,
                            estado: rc.estado,
                            montoUtm: rc.montoRebajaExtraUtm > 0 ? rc.montoRebajaExtraUtm : null,
                            montoPesos: null,
                            documentoUrl: rc.documentoUrl,
                            documentoNombre: rc.documentoNombre,
                            responsable: rc.registradoPor,
                            detallesBadge: rc.estado
                        })
                    }

                    for (const pj of d.procesosJudiciales) {
                        pushHito({
                            id: `jud_${pj.id}`,
                            fecha: pj.fechaIngreso.toISOString().split('T')[0],
                            tipo: 'PROCESO_JUDICIAL',
                            titulo: `Proceso Judicial — Rol ${pj.rolCausa}`,
                            subtitulo: `${pj.tribunal} · ${pj.caratulado || ''}`,
                            descripcion: pj.notas || `Litigio judicial en tribunales. Estado procesal: ${pj.estadoProcesal}.`,
                            estado: pj.estadoProcesal,
                            montoUtm: null,
                            montoPesos: pj.cuantiaDemandaPesos,
                            documentoUrl: pj.documentoUrl,
                            documentoNombre: pj.documentoNombre,
                            responsable: pj.registradoPor,
                            detallesBadge: pj.resultadoSentencia || pj.estadoProcesal
                        })
                    }
                }
            }

            // También buscar si el número coincide directamente con algún Resuelve
            const resuelvesDirectos = await prisma.multas_Resuelve.findMany({
                where: { numeroResolucion: { contains: numRex, mode: 'insensitive' } },
                include: {
                    descargo: {
                        include: {
                            notificacion: true,
                            recursos: true,
                            procesosJudiciales: true
                        }
                    }
                }
            })

            for (const r of resuelvesDirectos) {
                const d = r.descargo
                pushHito({
                    id: `desc_${d.id}`,
                    fecha: d.fechaIngreso.toISOString().split('T')[0],
                    tipo: 'DESCARGO_FORMAL',
                    titulo: `Descargo Formal Vinculado — ${d.codigoIngreso}`,
                    subtitulo: `REX ${d.notificacion.numeroResolucion}`,
                    descripcion: d.resumenArgumentos || `Presentación formal de descargos.`,
                    estado: d.estado,
                    montoUtm: d.montoImpugnadoUtm,
                    montoPesos: d.montoImpugnadoPesos,
                    documentoUrl: d.documentoUrl,
                    documentoNombre: d.documentoNombre,
                    responsable: d.creadoPor,
                    detallesBadge: `Plazo: ${d.diasPlazoLegal} días`
                })

                pushHito({
                    id: `res_${r.id}`,
                    fecha: r.fechaResolucion.toISOString().split('T')[0],
                    tipo: 'RESUELVE',
                    titulo: `Dictamen de Término — ${r.numeroResolucion}`,
                    subtitulo: `Resultado JUNAEB: ${r.dictamen}`,
                    descripcion: r.fundamentoResuelve || `Resolución que resuelve los descargos presentados. Rebaja: ${r.montoRebajadoUtm.toFixed(2)} UTM.`,
                    estado: r.dictamen,
                    montoUtm: r.montoRatificadoUtm,
                    montoPesos: null,
                    documentoUrl: r.documentoUrl,
                    documentoNombre: r.documentoNombre,
                    responsable: r.registradoPor,
                    detallesBadge: `Rebaja: ${r.montoRebajadoUtm.toFixed(2)} UTM`
                })
            }
        }

        // Ordenar cronológicamente
        hitos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

        return {
            success: true,
            hitos,
            identificador: folio ? `Folio #${folio}` : `Resolución ${numRex}`
        }
    } catch (e: any) {
        console.error('Error al obtener expediente timeline:', e)
        return { success: false, error: e.message || 'Error al obtener expediente.' }
    }
}
