import { NextResponse } from 'next/server'
import { writeFile, mkdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { UPLOADS_DIR, uploadPath } from '@/lib/storage'

/**
 * ⚠ ENDPOINT TEMPORAL DE RECUPERACIÓN DE ARCHIVOS — ELIMINAR DESPUÉS DE USAR
 *
 * Recibe un archivo y lo guarda en el volumen con un nombre exacto (el que ya
 * está registrado en la columna `link` de la BD). Sirve para reponer los
 * archivos perdidos por los deploys sin volumen.
 *
 * Uso (POST multipart/form-data):
 *   - key:          SESSION_SECRET (autenticación)
 *   - targetLink:   ruta exacta como está en la BD, ej "/uploads/elementos-esenciales/1778...pdf"
 *   - file:         el binario del archivo
 *
 * Responde con overwritten=true si el archivo ya existía (para evitar duplicar).
 */
export async function POST(request: Request) {
    try {
        const form = await request.formData()
        const key = form.get('key') as string | null
        const targetLink = form.get('targetLink') as string | null
        const file = form.get('file') as File | null

        if (!key || key !== process.env.SESSION_SECRET) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        if (!targetLink || !file) {
            return NextResponse.json({ error: 'Faltan targetLink o file' }, { status: 400 })
        }
        // Aceptamos solo rutas dentro de /uploads/ para no escribir fuera del volumen
        if (!targetLink.startsWith('/uploads/')) {
            return NextResponse.json({ error: 'targetLink inválido' }, { status: 400 })
        }
        // Blindaje contra path traversal
        if (targetLink.includes('..')) {
            return NextResponse.json({ error: 'targetLink inválido' }, { status: 400 })
        }

        // Convertir "/uploads/elementos-esenciales/archivo.pdf" → ruta física en el volumen
        // (quitamos el prefijo "/uploads/" porque UPLOADS_DIR ya es la raíz de uploads)
        const relative = targetLink.replace(/^\/uploads\//, '')
        const filePath = uploadPath(relative)

        // Verificar si ya existe (para no reescribirlo silenciosamente si no se quiere)
        let overwritten = false
        try {
            await stat(filePath)
            overwritten = true
        } catch { /* no existe, es lo esperado */ }

        // Crear directorio destino si no existe y escribir
        await mkdir(dirname(filePath), { recursive: true })
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filePath, buffer)

        return NextResponse.json({
            ok: true,
            path: filePath,
            bytes: buffer.length,
            overwritten,
        })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
