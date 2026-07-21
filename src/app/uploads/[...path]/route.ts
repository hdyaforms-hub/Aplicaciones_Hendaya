import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join, normalize } from 'path'
import { UPLOADS_DIR } from '@/lib/storage'

/**
 * Sirve los archivos subidos desde el volumen persistente.
 *
 * Antes, los archivos vivían en public/uploads y Next.js los servía como
 * estáticos. Ahora viven en el volumen (UPLOADS_DIR), fuera de public/, así que
 * esta ruta se encarga de entregarlos. Las rutas en la BD siguen siendo
 * "/uploads/..." — esta ruta las intercepta.
 */

// Tipos MIME básicos por extensión
const MIME: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
    txt: 'text/plain; charset=utf-8',
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: segments } = await params

    // Protección contra path traversal: normalizar y verificar que no se salga de UPLOADS_DIR
    const relative = normalize(join(...segments))
    if (relative.startsWith('..') || relative.includes('..')) {
        return new NextResponse('Ruta inválida', { status: 400 })
    }

    const filePath = join(UPLOADS_DIR, relative)

    try {
        const info = await stat(filePath)
        if (!info.isFile()) {
            return new NextResponse('No encontrado', { status: 404 })
        }

        const data = await readFile(filePath)
        const ext = (relative.split('.').pop() || '').toLowerCase()
        const contentType = MIME[ext] || 'application/octet-stream'

        return new NextResponse(data as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(info.size),
                'Cache-Control': 'private, max-age=3600',
            },
        })
    } catch {
        return new NextResponse('Archivo no encontrado', { status: 404 })
    }
}
