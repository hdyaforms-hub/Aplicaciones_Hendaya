import { NextRequest, NextResponse } from 'next/server'
import { getProjectDecisions } from '@/app/dashboard/ayuda/conversacion/actions'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await context.params
        const result = await getProjectDecisions(projectId)
        return NextResponse.json(result)
    } catch (e) {
        return NextResponse.json({ error: 'Error al obtener decisiones' }, { status: 500 })
    }
}
