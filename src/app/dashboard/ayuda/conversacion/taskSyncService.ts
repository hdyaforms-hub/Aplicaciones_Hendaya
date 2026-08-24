import { rawPrisma } from '@/lib/prisma'

export interface ScheduleUpdatePayload {
    itemId: string
    startDate: string
    endDate: string
    progress?: number
    dependencies?: string[]
}

/**
 * Recalcula fechas de tareas dependientes usando algoritmo Finish-to-Start
 * y sincroniza de forma transaccional tanto el item del Gantt como la CollabTask vinculada.
 */
export async function syncGanttSchedule(ganttId: string, updates: ScheduleUpdatePayload) {
    try {
        // 1. Obtener todos los items del cronograma Gantt actual
        const allItems = await (rawPrisma as any).collabGanttItem.findMany({
            where: { ganttId },
            orderBy: { order: 'asc' }
        })

        const itemMap = new Map<string, any>()
        allItems.forEach((it: any) => itemMap.set(it.id, { ...it }))

        const target = itemMap.get(updates.itemId)
        if (!target) return { error: 'Item no encontrado' }

        // Actualizar fechas del item objetivo
        const newStart = new Date(updates.startDate)
        const newEnd = new Date(updates.endDate)
        const durationMs = newEnd.getTime() - newStart.getTime()

        target.startDate = newStart
        target.endDate = newEnd
        if (updates.progress !== undefined) target.progress = updates.progress
        if (updates.dependencies !== undefined) target.dependencies = JSON.stringify(updates.dependencies)

        // 2. Propagación en cascada Finish-to-Start a dependientes
        // Un item B que depende de A debe iniciar al menos cuando termina A
        const queue: string[] = [target.id]
        const visited = new Set<string>()
        const warnings: string[] = []

        while (queue.length > 0) {
            const currentId = queue.shift()!
            if (visited.has(currentId)) {
                warnings.push(`Detección de ciclo de dependencia circular en item ${currentId}`)
                continue
            }
            visited.add(currentId)

            const currentItem = itemMap.get(currentId)
            if (!currentItem) continue

            // Buscar items que dependan del currentItem
            for (const [, item] of itemMap) {
                let deps: string[] = []
                try {
                    if (item.dependencies) deps = JSON.parse(item.dependencies)
                } catch {}

                if (deps.includes(currentId)) {
                    // Si el item dependiente inicia antes de que termine el predecesor, desplazarlo
                    const currentEndTime = new Date(currentItem.endDate).getTime()
                    const itemStartTime = new Date(item.startDate).getTime()

                    if (itemStartTime < currentEndTime) {
                        const itemDurationMs = new Date(item.endDate).getTime() - itemStartTime
                        const adjustedStart = new Date(currentEndTime)
                        const adjustedEnd = new Date(currentEndTime + itemDurationMs)

                        item.startDate = adjustedStart
                        item.endDate = adjustedEnd

                        queue.push(item.id)
                    }
                }
            }
        }

        // 3. Ejecutar actualización transaccional en la BD
        const modifiedItems = Array.from(itemMap.values())
        
        await (rawPrisma as any).$transaction(async (tx: any) => {
            for (const it of modifiedItems) {
                await tx.collabGanttItem.update({
                    where: { id: it.id },
                    data: {
                        startDate: new Date(it.startDate),
                        endDate: new Date(it.endDate),
                        progress: it.progress,
                        dependencies: typeof it.dependencies === 'string' ? it.dependencies : JSON.stringify(it.dependencies || [])
                    }
                })

                // Si tiene una tarea de Trello vinculada (taskId), sincronizar su dueDate
                if (it.taskId) {
                    await tx.collabTask.updateMany({
                        where: { id: it.taskId },
                        data: {
                            dueDate: new Date(it.endDate)
                        }
                    })
                }
            }
        })

        return {
            success: true,
            warnings: warnings.length > 0 ? warnings : undefined,
            updatedItems: modifiedItems.map(it => ({
                id: it.id,
                ganttId: it.ganttId,
                taskId: it.taskId,
                title: it.title,
                startDate: new Date(it.startDate).toISOString(),
                endDate: new Date(it.endDate).toISOString(),
                progress: it.progress,
                dependencies: typeof it.dependencies === 'string' ? JSON.parse(it.dependencies || '[]') : (it.dependencies || []),
                assignedTo: it.assignedTo
            }))
        }
    } catch (e: any) {
        console.error('Error en TaskSyncService:', e)
        return { error: e.message || 'Error al sincronizar dependencias y fechas.' }
    }
}
