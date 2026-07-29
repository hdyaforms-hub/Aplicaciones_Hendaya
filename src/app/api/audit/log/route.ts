import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'

export async function POST(request: Request) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const body = await request.json()
        const { action, modulo, detalle } = body

        if (!action || !modulo || !detalle) {
            return NextResponse.json({ message: 'Campos obligatorios faltantes' }, { status: 400 })
        }

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action,
            modulo,
            detalle,
        })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error: any) {
        console.error('Error en API audit/log:', error?.message)
        return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
    }
}
