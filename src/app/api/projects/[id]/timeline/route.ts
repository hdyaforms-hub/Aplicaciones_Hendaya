import { NextRequest, NextResponse } from 'next/server'
import { getProjectTimelineAction } from '@/app/dashboard/ayuda/conversacion/actions'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await context.params
        const searchParams = request.nextUrl.searchParams
        const type = searchParams.get('type') || undefined
        const username = searchParams.get('username') || undefined
        const page = parseInt(searchParams.get('page') || '1', 10)
        const limit = parseInt(searchParams.get('limit') || '20', 10)

        const result = await getProjectTimelineAction(projectId, {
            type,
            username,
            page,
            limit
        })

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
