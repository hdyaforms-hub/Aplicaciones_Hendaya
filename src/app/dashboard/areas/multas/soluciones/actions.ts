'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureSolucionesPlanTables } from '@/lib/multas/soluciones-plan-db-init'
import { checkMultasPermission, getUserEffectiveRbds } from '@/lib/multas/permisos'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export interface PlanAccionDTO {
    id: string
    folio: string
    rbd: number | null
    licitacionId: number | null
    licitacionNombre: string | null
    sucursal: string | null
    estado: 'PENDIENTE' | 'EN_PROCESO' | 'EVIDENCIA_SUBIDA' | 'VALIDADO' | 'CERRADO'
    prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
    fechaCompromiso: string | null
    responsableAsignado: string | null
    cerradoPor: string | null
    fechaCierre: string | null
    observacionesCierre: string | null
    totalItems: number
    itemsResueltos: number
    porcentajeAvance: number
    createdAt: string
    updatedAt: string
    items: PlanAccionItemDTO[]
}

export interface PlanAccionItemDTO {
    id: string
    planId: string
    aspecto: string
    hallazgoDetectado: string
    accionTomada: string | null
    evidenciaUrl: string | null
    evidenciaNombre: string | null
    estadoItem: 'PENDIENTE' | 'CORREGIDO' | 'RECHAZADO' | 'VERIFICADO'
    fechaEjecucion: string | null
    ejecutadoPor: string | null
    createdAt: string
    updatedAt: string
}

export interface DiccionarioSolucionDTO {
    id: string
    aspecto: string
    tipoNC: string
    accionCorrectivaTipo: string
    plazoDiasEstandar: number
    evidenciaRequerida: string | null
    activo: boolean
}

export interface ResumenPlanesDTO {
    totalPlanes: number
    pendientes: number
    enProceso: number
    evidenciaSubida: number
    cerrados: number
    efectividadGlobal: number
}

// Helper para formatear fechas en zona horaria local de Chile (America/Santiago)
function formatDateChile(d: Date | null): string | null {
    if (!d) return null
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
}

/**
 * Obtener lista de planes de acción con filtros y control de acceso por RBD
 */
export async function getPlanesAccionListAction(filtros?: {
    estado?: string
    sucursal?: string
    rbd?: number
    search?: string
}): Promise<{
    success: boolean
    data: PlanAccionDTO[]
    resumen: ResumenPlanesDTO
    error?: string
}> {
    try {
        await ensureSolucionesPlanTables()
        const { authorized, user } = await checkMultasPermission('view_soluciones_multas')
        if (!authorized) {
            return {
                success: false,
                data: [],
                resumen: { totalPlanes: 0, pendientes: 0, enProceso: 0, evidenciaSubida: 0, cerrados: 0, efectividadGlobal: 0 },
                error: 'No tienes permisos para consultar los planes de acción'
            }
        }

        const where: any = {}

        // Restricción por RBD del usuario (supervisores o delegados)
        const allowedRbds = await getUserEffectiveRbds()
        if (allowedRbds !== null) {
            where.rbd = { in: allowedRbds }
        }

        if (filtros?.estado && filtros.estado !== 'TODOS') {
            where.estado = filtros.estado
        }

        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            where.sucursal = filtros.sucursal
        }

        if (filtros?.rbd) {
            where.rbd = filtros.rbd
        }

        if (filtros?.search && filtros.search.trim() !== '') {
            const s = filtros.search.trim()
            where.OR = [
                { folio: { contains: s, mode: 'insensitive' } },
                { licitacionNombre: { contains: s, mode: 'insensitive' } },
                { responsableAsignado: { contains: s, mode: 'insensitive' } },
                { sucursal: { contains: s, mode: 'insensitive' } }
            ]
        }

        const planes = await prisma.multas_Plan_Accion.findMany({
            where,
            include: {
                items: {
                    orderBy: { aspecto: 'asc' }
                }
            },
            orderBy: [
                { createdAt: 'desc' }
            ]
        })

        const mapped: PlanAccionDTO[] = planes.map(p => {
            const resueltos = p.items.filter(i => i.estadoItem === 'CORREGIDO' || i.estadoItem === 'VERIFICADO').length
            const total = p.items.length || p.totalItems || 1
            const pct = Math.round((resueltos / total) * 100)

            return {
                id: p.id,
                folio: p.folio,
                rbd: p.rbd,
                licitacionId: p.licitacionId,
                licitacionNombre: p.licitacionNombre,
                sucursal: p.sucursal,
                estado: p.estado as any,
                prioridad: p.prioridad as any,
                fechaCompromiso: formatDateChile(p.fechaCompromiso),
                responsableAsignado: p.responsableAsignado,
                cerradoPor: p.cerradoPor,
                fechaCierre: formatDateChile(p.fechaCierre),
                observacionesCierre: p.observacionesCierre,
                totalItems: p.items.length,
                itemsResueltos: resueltos,
                porcentajeAvance: pct,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
                items: p.items.map(it => ({
                    id: it.id,
                    planId: it.planId,
                    aspecto: it.aspecto,
                    hallazgoDetectado: it.hallazgoDetectado,
                    accionTomada: it.accionTomada,
                    evidenciaUrl: it.evidenciaUrl,
                    evidenciaNombre: it.evidenciaNombre,
                    estadoItem: it.estadoItem as any,
                    fechaEjecucion: formatDateChile(it.fechaEjecucion),
                    ejecutadoPor: it.ejecutadoPor,
                    createdAt: it.createdAt.toISOString(),
                    updatedAt: it.updatedAt.toISOString()
                }))
            }
        })

        const pendientes = mapped.filter(p => p.estado === 'PENDIENTE').length
        const enProceso = mapped.filter(p => p.estado === 'EN_PROCESO').length
        const evidenciaSubida = mapped.filter(p => p.estado === 'EVIDENCIA_SUBIDA').length
        const cerrados = mapped.filter(p => p.estado === 'CERRADO' || p.estado === 'VALIDADO').length
        const efectividadGlobal = mapped.length > 0 ? Math.round((cerrados / mapped.length) * 100) : 0

        return {
            success: true,
            data: mapped,
            resumen: {
                totalPlanes: mapped.length,
                pendientes,
                enProceso,
                evidenciaSubida,
                cerrados,
                efectividadGlobal
            }
        }
    } catch (error: any) {
        console.error('Error al obtener planes de accion:', error)
        return {
            success: false,
            data: [],
            resumen: { totalPlanes: 0, pendientes: 0, enProceso: 0, evidenciaSubida: 0, cerrados: 0, efectividadGlobal: 0 },
            error: error.message || 'Error al obtener planes de acción'
        }
    }
}

/**
 * Obtener detalle de un plan de acción por ID
 */
export async function getPlanAccionDetalleAction(id: string): Promise<{
    success: boolean
    data?: PlanAccionDTO
    error?: string
}> {
    try {
        await ensureSolucionesPlanTables()
        const { authorized } = await checkMultasPermission('view_soluciones_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar el detalle del plan de acción' }
        }

        const p = await prisma.multas_Plan_Accion.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: { aspecto: 'asc' }
                }
            }
        })

        if (!p) {
            return { success: false, error: 'Plan de acción no encontrado' }
        }

        const resueltos = p.items.filter(i => i.estadoItem === 'CORREGIDO' || i.estadoItem === 'VERIFICADO').length
        const total = p.items.length || 1

        const mapped: PlanAccionDTO = {
            id: p.id,
            folio: p.folio,
            rbd: p.rbd,
            licitacionId: p.licitacionId,
            licitacionNombre: p.licitacionNombre,
            sucursal: p.sucursal,
            estado: p.estado as any,
            prioridad: p.prioridad as any,
            fechaCompromiso: formatDateChile(p.fechaCompromiso),
            responsableAsignado: p.responsableAsignado,
            cerradoPor: p.cerradoPor,
            fechaCierre: formatDateChile(p.fechaCierre),
            observacionesCierre: p.observacionesCierre,
            totalItems: p.items.length,
            itemsResueltos: resueltos,
            porcentajeAvance: Math.round((resueltos / total) * 100),
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            items: p.items.map(it => ({
                id: it.id,
                planId: it.planId,
                aspecto: it.aspecto,
                hallazgoDetectado: it.hallazgoDetectado,
                accionTomada: it.accionTomada,
                evidenciaUrl: it.evidenciaUrl,
                evidenciaNombre: it.evidenciaNombre,
                estadoItem: it.estadoItem as any,
                fechaEjecucion: formatDateChile(it.fechaEjecucion),
                ejecutadoPor: it.ejecutadoPor,
                createdAt: it.createdAt.toISOString(),
                updatedAt: it.updatedAt.toISOString()
            }))
        }

        return { success: true, data: mapped }
    } catch (error: any) {
        console.error('Error al obtener detalle del plan:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Generar automáticamente planes de acción masivos para todas las actas con No Conformidades
 */
export async function generarPlanesAccionMasivosAction(): Promise<{
    success: boolean
    creados?: number
    existentes?: number
    error?: string
}> {
    try {
        await ensureSolucionesPlanTables()
        const { authorized, user } = await checkMultasPermission('manage_soluciones_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para generar planes de acción' }
        }

        // Buscar actas calculadas con aspectos sancionados (monto > 0)
        const actasConMulta = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where: {
                detalles: {
                    some: {
                        montoMulta: { gt: 0 }
                    }
                }
            },
            include: {
                detalles: {
                    where: {
                        montoMulta: { gt: 0 }
                    }
                }
            }
        })

        if (!actasConMulta || actasConMulta.length === 0) {
            return { success: true, creados: 0, existentes: 0 }
        }

        // Obtener posibles colegios para resolver la sucursal del RBD
        const rbds = Array.from(new Set(actasConMulta.map(a => a.rbd).filter(Boolean)))
        const colegios = await prisma.colegios.findMany({
            where: { colRBD: { in: rbds } },
            select: { colRBD: true, sucursal: true }
        })
        const rbdSucursalMap = new Map<number, string>()
        for (const col of colegios) {
            if (col.sucursal) {
                rbdSucursalMap.set(col.colRBD, col.sucursal)
            }
        }

        // Agrupar por folio
        const foliosMap = new Map<string, {
            rbd: number | null
            licitacionNombre: string | null
            sucursal: string | null
            items: { aspecto: string; hallazgo: string }[]
        }>()

        for (const acta of actasConMulta) {
            const folio = acta.folioOriginal
            if (!folio) continue

            const sucursalNombre = acta.rbd ? (rbdSucursalMap.get(acta.rbd) || null) : null

            foliosMap.set(folio, {
                rbd: acta.rbd,
                licitacionNombre: acta.licitacion,
                sucursal: sucursalNombre,
                items: acta.detalles.map(d => ({
                    aspecto: d.letraAspecto,
                    hallazgo: d.descripcion || `Multa calculada en Aspecto ${d.letraAspecto}`
                }))
            })
        }

        // Optimización: consultar todos los folios existentes en una sola consulta
        const todosLosFolios = Array.from(foliosMap.keys())
        const planesExistentes = await prisma.multas_Plan_Accion.findMany({
            where: { folio: { in: todosLosFolios } },
            select: { folio: true }
        })
        const foliosExistentesSet = new Set(planesExistentes.map(p => p.folio))

        let creados = 0
        let existentes = 0

        for (const [folio, data] of foliosMap.entries()) {
            if (foliosExistentesSet.has(folio)) {
                existentes++
                continue
            }

            // Plazo compromiso estándar: 5 días hábiles a partir de hoy
            const compromiso = new Date()
            compromiso.setDate(compromiso.getDate() + 7)

            await prisma.multas_Plan_Accion.create({
                data: {
                    folio,
                    rbd: data.rbd,
                    licitacionNombre: data.licitacionNombre,
                    sucursal: data.sucursal,
                    estado: 'PENDIENTE',
                    prioridad: data.items.length >= 3 ? 'ALTA' : 'MEDIA',
                    fechaCompromiso: compromiso,
                    totalItems: data.items.length,
                    itemsResueltos: 0,
                    items: {
                        create: data.items.map(it => ({
                            aspecto: it.aspecto,
                            hallazgoDetectado: it.hallazgo,
                            estadoItem: 'PENDIENTE'
                        }))
                    }
                }
            })

            creados++
        }

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'GENERAR_PLANES_ACCION_MASIVOS',
            modulo: 'Multas · Soluciones y Planes de Acción',
            detalle: `Generación masiva de planes: ${creados} nuevos creados, ${existentes} ya existentes.`
        })

        revalidatePath('/dashboard/areas/multas/soluciones')

        return { success: true, creados, existentes }
    } catch (error: any) {
        console.error('Error al generar planes masivos:', error)
        return { success: false, error: error.message || 'Error al generar planes de acción' }
    }
}

/**
 * Actualizar un ítem de acción (registrar qué se hizo en terreno y subir evidencia)
 */
export async function actualizarItemPlanAccionAction(
    itemId: string,
    data: {
        accionTomada: string
        evidenciaUrl?: string | null
        evidenciaNombre?: string | null
        estadoItem?: 'PENDIENTE' | 'CORREGIDO' | 'RECHAZADO' | 'VERIFICADO'
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureSolucionesPlanTables()
        const { authorized, user } = await checkMultasPermission('manage_soluciones_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para actualizar acciones correctivas' }
        }

        // Verificar que el ítem exista y que su plan NO esté CERRADO o VALIDADO
        const itemExistente = await prisma.multas_Plan_Accion_Item.findUnique({
            where: { id: itemId },
            include: { plan: true }
        })

        if (!itemExistente) {
            return { success: false, error: 'Ítem de plan de acción no encontrado' }
        }

        if (itemExistente.plan.estado === 'CERRADO' || itemExistente.plan.estado === 'VALIDADO') {
            return {
                success: false,
                error: 'No se pueden editar ítems de un plan de acción que ya ha sido CERRADO o VALIDADO.'
            }
        }

        // Validar que evidenciaUrl sea un enlace válido si se especifica
        if (data.evidenciaUrl && data.evidenciaUrl.trim() !== '') {
            const urlTrim = data.evidenciaUrl.trim()
            if (!urlTrim.startsWith('http://') && !urlTrim.startsWith('https://') && !urlTrim.startsWith('/')) {
                return { success: false, error: 'La URL de la evidencia debe comenzar con http:// o https://' }
            }
        }

        const ejecutor = user.name || user.username || 'Usuario Terreno'

        const item = await prisma.multas_Plan_Accion_Item.update({
            where: { id: itemId },
            data: {
                accionTomada: data.accionTomada.trim(),
                evidenciaUrl: data.evidenciaUrl ? data.evidenciaUrl.trim() : null,
                evidenciaNombre: data.evidenciaNombre ? data.evidenciaNombre.trim() : null,
                estadoItem: data.estadoItem || 'CORREGIDO',
                fechaEjecucion: new Date(),
                ejecutadoPor: ejecutor
            },
            include: { plan: { include: { items: true } } }
        })

        // Comprobar estado global del plan
        const allItems = item.plan.items
        const resueltos = allItems.filter(i => i.estadoItem === 'CORREGIDO' || i.estadoItem === 'VERIFICADO').length
        let nuevoEstadoPlan = item.plan.estado

        if (resueltos === allItems.length) {
            nuevoEstadoPlan = 'EVIDENCIA_SUBIDA'
        } else if (resueltos > 0 && nuevoEstadoPlan === 'PENDIENTE') {
            nuevoEstadoPlan = 'EN_PROCESO'
        }

        await prisma.multas_Plan_Accion.update({
            where: { id: item.planId },
            data: {
                estado: nuevoEstadoPlan,
                itemsResueltos: resueltos
            }
        })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'ACTUALIZAR_ITEM_PLAN_ACCION',
            modulo: 'Multas · Soluciones y Planes de Acción',
            detalle: `Se actualizó la acción correctiva del Aspecto ${item.aspecto} en el folio ${item.plan.folio}. Estado: ${data.estadoItem || 'CORREGIDO'}`
        })

        revalidatePath(`/dashboard/areas/multas/soluciones/${item.planId}`)
        revalidatePath('/dashboard/areas/multas/soluciones')

        return { success: true }
    } catch (error: any) {
        console.error('Error al actualizar item del plan:', error)
        return { success: false, error: error.message || 'Error al guardar acción correctiva' }
    }
}

/**
 * Cerrar o Validar formalmente un Plan de Acción (Perfil de gestión / Calidad)
 */
export async function cerrarPlanAccionAction(
    planId: string,
    data: {
        estado: 'VALIDADO' | 'CERRADO'
        observaciones: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureSolucionesPlanTables()
        const { authorized, user } = await checkMultasPermission('manage_soluciones_multas')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para cerrar o validar planes de acción' }
        }

        const plan = await prisma.multas_Plan_Accion.findUnique({
            where: { id: planId },
            include: { items: true }
        })

        if (!plan) {
            return { success: false, error: 'Plan de acción no encontrado' }
        }

        // Bloquear cierre si hay ítems pendientes
        const tienePendientes = plan.items.some(i => i.estadoItem === 'PENDIENTE')
        if (tienePendientes) {
            return {
                success: false,
                error: 'No se puede cerrar ni validar un plan de acción que aún tiene ítems pendientes de corrección.'
            }
        }

        const cerradoPor = user.name || user.username || 'Jefatura Calidad'

        const updated = await prisma.multas_Plan_Accion.update({
            where: { id: planId },
            data: {
                estado: data.estado,
                cerradoPor,
                fechaCierre: new Date(),
                observacionesCierre: data.observaciones.trim()
            }
        })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'CERRAR_PLAN_ACCION',
            modulo: 'Multas · Soluciones y Planes de Acción',
            detalle: `Se cerró formalmente el Plan de Acción del folio ${updated.folio} en estado ${data.estado}.`
        })

        revalidatePath(`/dashboard/areas/multas/soluciones/${planId}`)
        revalidatePath('/dashboard/areas/multas/soluciones')

        return { success: true }
    } catch (error: any) {
        console.error('Error al cerrar plan de accion:', error)
        return { success: false, error: error.message || 'Error al cerrar plan' }
    }
}

/**
 * Obtener soluciones predeterminadas del Diccionario por aspecto
 */
export async function getDiccionarioSolucionesAction(aspecto?: string): Promise<{
    success: boolean
    data: DiccionarioSolucionDTO[]
    error?: string
}> {
    try {
        await ensureSolucionesPlanTables()
        const { authorized } = await checkMultasPermission('view_soluciones_multas')
        if (!authorized) {
            return { success: false, data: [], error: 'No tienes permisos para consultar el diccionario de soluciones' }
        }

        const where: any = { activo: true }
        if (aspecto && aspecto !== 'TODOS') {
            where.aspecto = aspecto.toUpperCase()
        }

        const items = await prisma.multas_Diccionario_Solucion.findMany({
            where,
            orderBy: [{ aspecto: 'asc' }, { tipoNC: 'asc' }]
        })

        const mapped: DiccionarioSolucionDTO[] = items.map(d => ({
            id: d.id,
            aspecto: d.aspecto,
            tipoNC: d.tipoNC,
            accionCorrectivaTipo: d.accionCorrectivaTipo,
            plazoDiasEstandar: d.plazoDiasEstandar,
            evidenciaRequerida: d.evidenciaRequerida,
            activo: d.activo
        }))

        return { success: true, data: mapped }
    } catch (error: any) {
        console.error('Error al consultar diccionario de soluciones:', error)
        return { success: false, data: [], error: error.message }
    }
}
