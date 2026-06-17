import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !session.user) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { cabeceraId, ut, rbd, respuestas } = body

        if (!cabeceraId || !ut || !rbd || !respuestas) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos.' }, { status: 400 })
        }

        // We use user's session data for hidden fields
        const supervisorNombre = session.user.name || session.user.username
        const supervisorCorreo = session.user.email || ''
        const usuario = session.user.username

        // Get the Matrix template to know the licId
        const matrixTemplate = await prisma.matrizT_Cabecera.findUnique({
            where: { id: cabeceraId }
        })

        if (!matrixTemplate) {
            return NextResponse.json({ success: false, error: 'Matriz no encontrada.' }, { status: 404 })
        }

        // Create the Answer Header
        const respuestaCabecera = await prisma.matrizT_RespuestasCabecera.create({
            data: {
                cabeceraId,
                usuario,
                supervisorNombre,
                supervisorCorreo,
                licId: matrixTemplate.licId,
                ut: Number(ut),
                rbd: Number(rbd),
                fechaIngreso: new Date()
            }
        })

        // Create details
        if (respuestas.length > 0) {
            const dataToInsert = respuestas.map((r: any) => ({
                respuestaCabeceraId: respuestaCabecera.id,
                preguntaId: r.preguntaId,
                valor: r.valor,
                adjuntoUrl: r.adjuntoUrl // This will store the base64 JSON string
            }))

            await prisma.matrizT_RespuestasDetalle.createMany({
                data: dataToInsert
            })
        }

        return NextResponse.json({ success: true, id: respuestaCabecera.id })
    } catch (error) {
        console.error('Error guardando respuesta matriz:', error)
        return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 })
    }
}
