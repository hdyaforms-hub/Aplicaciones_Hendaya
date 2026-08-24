import { rawPrisma } from '@/lib/prisma'

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface DependencyRule {
    predecessorId: string
    type: DependencyType
    lagDays: number // Desfase en días (positivo o negativo)
}

export interface EngineItem {
    id: string
    ganttId: string
    taskId?: string | null
    parentId?: string | null
    isMilestone: boolean
    title: string
    startDate: Date
    endDate: Date
    progress: number
    color?: string | null
    assignedTo?: string | null
    collaborators?: string | null
    dependencies?: string | null
    earlyStart?: Date | null
    earlyFinish?: Date | null
    lateStart?: Date | null
    lateFinish?: Date | null
    totalFloat?: number | null
    isCritical?: boolean
    order: number
}

const MS_PER_DAY = 86400000

/**
 * Parsea dependencias tanto en formato simple (array de IDs)
 * como estructurado ([{ predecessorId, type, lag }]).
 */
export function parseDependencies(raw: string | null | undefined): DependencyRule[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return parsed.map((item: any): DependencyRule => {
                if (typeof item === 'string') {
                    return { predecessorId: item, type: 'FS' as DependencyType, lagDays: 0 }
                }
                return {
                    predecessorId: item.predecessorId || item.id,
                    type: (item.type as DependencyType) || 'FS',
                    lagDays: Number(item.lag || item.lagDays || 0)
                }
            }).filter(d => !!d.predecessorId)
        }
    } catch {}
    return []
}

/**
 * Serializa reglas de dependencia para almacenamiento.
 */
export function stringifyDependencies(rules: DependencyRule[]): string {
    return JSON.stringify(rules)
}

/**
 * Motor central de planificación y cálculo CPM:
 * 1. Resuelve dependencias (FS, SS, FF, SF + Lag) en orden topológico acíclico.
 * 2. Realiza Forward Pass (ES, EF) y Backward Pass (LS, LF) para determinar Ruta Crítica y Holgura (Slack).
 * 3. Ejecuta Rollup jerárquico para tareas padre (fechas y % de avance consolidado).
 */
export function computeGanttScheduleAndCPM(items: EngineItem[]) {
    const itemMap = new Map<string, EngineItem>()
    items.forEach(it => {
        itemMap.set(it.id, {
            ...it,
            startDate: new Date(it.startDate),
            endDate: new Date(it.endDate)
        })
    })

    // 1. Construir grafo de adyacencia para dependencias
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, Array<{ targetId: string; rule: DependencyRule }>>()

    itemMap.forEach((_, id) => {
        inDegree.set(id, 0)
        adjList.set(id, [])
    })

    itemMap.forEach((item, id) => {
        const deps = parseDependencies(item.dependencies)
        deps.forEach(rule => {
            if (itemMap.has(rule.predecessorId) && rule.predecessorId !== id) {
                adjList.get(rule.predecessorId)?.push({ targetId: id, rule })
                inDegree.set(id, (inDegree.get(id) || 0) + 1)
            }
        })
    })

    // 2. Orden Topológico (Kahn Algorithm)
    const queue: string[] = []
    inDegree.forEach((deg, id) => {
        if (deg === 0) queue.push(id)
    })

    const topoOrder: string[] = []
    while (queue.length > 0) {
        const u = queue.shift()!
        topoOrder.push(u)
        const neighbors = adjList.get(u) || []
        for (const { targetId } of neighbors) {
            const nextDeg = (inDegree.get(targetId) || 1) - 1
            inDegree.set(targetId, nextDeg)
            if (nextDeg === 0) queue.push(targetId)
        }
    }

    // Agregar items restantes en caso de ciclos para no excluirlos
    itemMap.forEach((_, id) => {
        if (!topoOrder.includes(id)) topoOrder.push(id)
    })

    // 3. Propagación y Ajuste de Fechas según tipo de dependencia
    for (const uId of topoOrder) {
        const currentItem = itemMap.get(uId)!
        const neighbors = adjList.get(uId) || []

        for (const { targetId, rule } of neighbors) {
            const targetItem = itemMap.get(targetId)
            if (!targetItem) continue

            const lagMs = rule.lagDays * MS_PER_DAY
            const durationMs = targetItem.isMilestone
                ? 0
                : Math.max(0, targetItem.endDate.getTime() - targetItem.startDate.getTime())

            let requiredStart = targetItem.startDate.getTime()
            let requiredEnd = targetItem.endDate.getTime()

            switch (rule.type) {
                case 'FS': // Finish-to-Start: Sucesor inicia tras fin de predecesor
                    const minStartFS = currentItem.endDate.getTime() + lagMs
                    if (targetItem.startDate.getTime() < minStartFS) {
                        requiredStart = minStartFS
                        requiredEnd = targetItem.isMilestone ? requiredStart : requiredStart + durationMs
                    }
                    break

                case 'SS': // Start-to-Start: Sucesor inicia tras inicio de predecesor
                    const minStartSS = currentItem.startDate.getTime() + lagMs
                    if (targetItem.startDate.getTime() < minStartSS) {
                        requiredStart = minStartSS
                        requiredEnd = targetItem.isMilestone ? requiredStart : requiredStart + durationMs
                    }
                    break

                case 'FF': // Finish-to-Finish: Sucesor termina tras fin de predecesor
                    const minEndFF = currentItem.endDate.getTime() + lagMs
                    if (targetItem.endDate.getTime() < minEndFF) {
                        requiredEnd = minEndFF
                        requiredStart = targetItem.isMilestone ? requiredEnd : requiredEnd - durationMs
                    }
                    break

                case 'SF': // Start-to-Finish: Sucesor termina tras inicio de predecesor
                    const minEndSF = currentItem.startDate.getTime() + lagMs
                    if (targetItem.endDate.getTime() < minEndSF) {
                        requiredEnd = minEndSF
                        requiredStart = targetItem.isMilestone ? requiredEnd : requiredEnd - durationMs
                    }
                    break
            }

            targetItem.startDate = new Date(requiredStart)
            targetItem.endDate = new Date(requiredEnd)
        }
    }

    // 4. Algoritmo CPM (Critical Path Method)
    // A) Forward Pass: Early Start (ES) & Early Finish (EF)
    for (const uId of topoOrder) {
        const item = itemMap.get(uId)!
        const deps = parseDependencies(item.dependencies)

        if (deps.length === 0) {
            item.earlyStart = new Date(item.startDate)
            item.earlyFinish = new Date(item.endDate)
        } else {
            let maxES = item.startDate.getTime()
            for (const rule of deps) {
                const pred = itemMap.get(rule.predecessorId)
                if (!pred) continue
                const lagMs = rule.lagDays * MS_PER_DAY
                if (rule.type === 'FS') {
                    maxES = Math.max(maxES, (pred.earlyFinish?.getTime() || pred.endDate.getTime()) + lagMs)
                } else if (rule.type === 'SS') {
                    maxES = Math.max(maxES, (pred.earlyStart?.getTime() || pred.startDate.getTime()) + lagMs)
                }
            }
            item.earlyStart = new Date(maxES)
            const durationMs = item.isMilestone ? 0 : Math.max(0, item.endDate.getTime() - item.startDate.getTime())
            item.earlyFinish = new Date(maxES + durationMs)
        }
    }

    // Fecha de término global del proyecto
    let projectEndMs = 0
    itemMap.forEach(it => {
        const ef = it.earlyFinish?.getTime() || it.endDate.getTime()
        if (ef > projectEndMs) projectEndMs = ef
    })

    // B) Backward Pass: Late Finish (LF) & Late Start (LS)
    const reverseTopo = [...topoOrder].reverse()
    for (const uId of reverseTopo) {
        const item = itemMap.get(uId)!
        const successors = adjList.get(uId) || []

        if (successors.length === 0) {
            item.lateFinish = new Date(projectEndMs)
            const durationMs = item.isMilestone ? 0 : Math.max(0, item.endDate.getTime() - item.startDate.getTime())
            item.lateStart = new Date(projectEndMs - durationMs)
        } else {
            let minLF = projectEndMs
            for (const { targetId, rule } of successors) {
                const succ = itemMap.get(targetId)
                if (!succ) continue
                const lagMs = rule.lagDays * MS_PER_DAY
                if (rule.type === 'FS') {
                    const succLS = succ.lateStart?.getTime() || succ.startDate.getTime()
                    minLF = Math.min(minLF, succLS - lagMs)
                } else if (rule.type === 'FF') {
                    const succLF = succ.lateFinish?.getTime() || succ.endDate.getTime()
                    minLF = Math.min(minLF, succLF - lagMs)
                }
            }
            item.lateFinish = new Date(minLF)
            const durationMs = item.isMilestone ? 0 : Math.max(0, item.endDate.getTime() - item.startDate.getTime())
            item.lateStart = new Date(minLF - durationMs)
        }

        // C) Holgura Total (Slack) y Ruta Crítica
        const es = item.earlyStart?.getTime() || item.startDate.getTime()
        const ls = item.lateStart?.getTime() || item.startDate.getTime()
        const slackDays = Math.round((ls - es) / MS_PER_DAY)

        item.totalFloat = Math.max(0, slackDays)
        item.isCritical = slackDays <= 0
    }

    // 5. Rollup Jerárquico para tareas padre (Barras Resumen)
    const parentIds = new Set<string>()
    itemMap.forEach(it => {
        if (it.parentId && itemMap.has(it.parentId)) {
            parentIds.add(it.parentId)
        }
    })

    parentIds.forEach(pId => {
        const parent = itemMap.get(pId)
        if (!parent) return

        const children = Array.from(itemMap.values()).filter(it => it.parentId === pId)
        if (children.length > 0) {
            const minStart = Math.min(...children.map(c => c.startDate.getTime()))
            const maxEnd = Math.max(...children.map(c => c.endDate.getTime()))
            const totalProg = children.reduce((acc, c) => acc + c.progress, 0)

            parent.startDate = new Date(minStart)
            parent.endDate = new Date(maxEnd)
            parent.progress = Math.round(totalProg / children.length)
            parent.isCritical = children.some(c => c.isCritical)
        }
    })

    return Array.from(itemMap.values())
}

/**
 * Servicio transaccional que actualiza un ítem y recalcula automáticamente
 * todo el cronograma con CPM y dependencias de forma atómica.
 */
export async function syncGanttScheduleAndRecalculate(
    ganttId: string,
    updatedItemData?: {
        itemId: string
        title?: string
        startDate?: string
        endDate?: string
        progress?: number
        color?: string
        assignedTo?: string | null
        collaborators?: string[]
        parentId?: string | null
        isMilestone?: boolean
        dependencies?: DependencyRule[] | string[]
    }
) {
    return await rawPrisma.$transaction(async (tx) => {
        // 1. Obtener todos los items del cronograma
        const allItemsDb = await (tx as any).collabGanttItem.findMany({
            where: { ganttId },
            orderBy: { order: 'asc' }
        })

        const mappedItems: EngineItem[] = allItemsDb.map((it: any) => ({
            id: it.id,
            ganttId: it.ganttId,
            taskId: it.taskId,
            parentId: it.parentId,
            isMilestone: it.isMilestone || false,
            title: it.title,
            startDate: it.startDate,
            endDate: it.endDate,
            progress: it.progress,
            color: it.color,
            assignedTo: it.assignedTo,
            collaborators: it.collaborators,
            dependencies: it.dependencies,
            earlyStart: it.earlyStart,
            earlyFinish: it.earlyFinish,
            lateStart: it.lateStart,
            lateFinish: it.lateFinish,
            totalFloat: it.totalFloat,
            isCritical: it.isCritical || false,
            order: it.order
        }))

        // Si se envió una actualización específica, aplicarla al conjunto antes del recálculo
        if (updatedItemData) {
            const target = mappedItems.find(it => it.id === updatedItemData.itemId)
            if (target) {
                if (updatedItemData.title !== undefined) target.title = updatedItemData.title.trim()
                if (updatedItemData.startDate !== undefined) target.startDate = new Date(updatedItemData.startDate)
                if (updatedItemData.endDate !== undefined) target.endDate = new Date(updatedItemData.endDate)
                if (updatedItemData.progress !== undefined) target.progress = updatedItemData.progress
                if (updatedItemData.color !== undefined) target.color = updatedItemData.color
                if (updatedItemData.assignedTo !== undefined) target.assignedTo = updatedItemData.assignedTo
                if (updatedItemData.collaborators !== undefined) target.collaborators = JSON.stringify(updatedItemData.collaborators)
                if (updatedItemData.parentId !== undefined) target.parentId = updatedItemData.parentId
                if (updatedItemData.isMilestone !== undefined) target.isMilestone = updatedItemData.isMilestone
                if (updatedItemData.dependencies !== undefined) target.dependencies = JSON.stringify(updatedItemData.dependencies)

                if (target.isMilestone) {
                    target.endDate = target.startDate
                }
            }
        }

        // 2. Ejecutar motor de cálculo CPM y resolución de dependencias
        const computedItems = computeGanttScheduleAndCPM(mappedItems)

        // 3. Persistir todos los cambios de forma atómica en la base de datos
        for (const item of computedItems) {
            await (tx as any).collabGanttItem.update({
                where: { id: item.id },
                data: {
                    title: item.title,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    progress: item.progress,
                    color: item.color,
                    assignedTo: item.assignedTo,
                    collaborators: item.collaborators,
                    parentId: item.parentId,
                    isMilestone: item.isMilestone,
                    dependencies: item.dependencies,
                    earlyStart: item.earlyStart,
                    earlyFinish: item.earlyFinish,
                    lateStart: item.lateStart,
                    lateFinish: item.lateFinish,
                    totalFloat: item.totalFloat,
                    isCritical: item.isCritical
                }
            })

            // Sincronizar automáticamente con CollabTask si está vinculada
            if (item.taskId) {
                try {
                    await (tx as any).collabTask.update({
                        where: { id: item.taskId },
                        data: {
                            dueDate: item.endDate,
                            assignedTo: item.assignedTo,
                            status: item.progress === 100 ? 'REALIZADO' : (item.progress > 0 ? 'EN_PROCESO' : 'PENDIENTE')
                        }
                    })
                } catch {}
            }
        }

        // Actualizar timestamp del cronograma
        await (tx as any).collabGanttChart.update({
            where: { id: ganttId },
            data: { updatedAt: new Date() }
        })

        return {
            success: true,
            items: computedItems
        }
    })
}
