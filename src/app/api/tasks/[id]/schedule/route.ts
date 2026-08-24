import { NextRequest, NextResponse } from 'next/server'
import { syncGanttSchedule } from '@/app/dashboard/ayuda/conversacion/taskSyncService'

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: itemId } = await context.params
        const body = await request.json()
        const ganttId = body.ganttId
        if (!ganttId) {
            return NextResponse.json({ error: 'ganttId es requerido' }, { status: 400 })
        }

        const result = await syncGanttSchedule(ganttId, {
            itemId,
            startDate: body.startDate,
            endDate: body.endDate,
            progress: body.progress,
            dependencies: body.dependencies
        })

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error al programar tarea' }, { status: 500 })
    }
}
