import { NextResponse } from 'next/server'
import { getMyDayData } from '@/app/dashboard/ayuda/conversacion/actions'

export async function GET() {
    try {
        const result = await getMyDayData()
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 401 })
        }
        return NextResponse.json(result)
    } catch (e) {
        return NextResponse.json({ error: 'Error al obtener resumen de Mi Día' }, { status: 500 })
    }
}
