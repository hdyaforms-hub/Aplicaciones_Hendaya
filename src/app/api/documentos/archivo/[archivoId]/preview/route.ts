import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getFileStream, getFileMetadata } from '@/lib/graph-client'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ archivoId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const { archivoId } = await context.params
        const rangeHeader = request.headers.get('range')

        const streamResult = await getFileStream(archivoId, rangeHeader)

        if (!streamResult.body) {
            return NextResponse.json({ message: 'No se pudo obtener el contenido del archivo' }, { status: 404 })
        }

        const headers = new Headers()
        headers.set('Content-Type', streamResult.contentType || 'application/octet-stream')
        headers.set('X-Content-Type-Options', 'nosniff')
        headers.set('Cache-Control', 'private, max-age=1800')

        if (streamResult.contentLength !== undefined) {
            headers.set('Content-Length', streamResult.contentLength.toString())
        }

        if (streamResult.contentRange) {
            headers.set('Content-Range', streamResult.contentRange)
            headers.set('Accept-Ranges', 'bytes')
        }

        return new NextResponse(streamResult.body as any, {
            status: streamResult.status || 200,
            headers
        })
    } catch (error: any) {
        console.error('Error al previsualizar archivo:', error?.message)
        return NextResponse.json({ message: 'Error al previsualizar archivo' }, { status: 500 })
    }
}
