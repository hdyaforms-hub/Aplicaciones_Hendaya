import { NextRequest, NextResponse } from 'next/server'
import { getMentionsAction, markMentionAsReadAction, markAllMentionsAsReadAction } from '@/app/dashboard/ayuda/conversacion/actions'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const unreadOnly = searchParams.get('unread') === 'true'
        const page = parseInt(searchParams.get('page') || '1', 10)
        const limit = parseInt(searchParams.get('limit') || '30', 10)

        const result = await getMentionsAction({ unreadOnly, page, limit })
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 401 })
        }

        return NextResponse.json(result)
    } catch (e) {
        return NextResponse.json({ error: 'Error al consultar menciones' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        if (body.all) {
            const res = await markAllMentionsAsReadAction()
            return NextResponse.json(res)
        } else if (body.id) {
            const res = await markMentionAsReadAction(body.id)
            return NextResponse.json(res)
        }
        return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    } catch (e) {
        return NextResponse.json({ error: 'Error al actualizar menciones' }, { status: 500 })
    }
}
