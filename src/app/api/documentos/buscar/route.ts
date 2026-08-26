import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { getFolderIdsForUser, getUserFolderPermissions } from '@/lib/doc-permissions'
import { searchFiles } from '@/lib/graph-client'
import { ArchivoUI } from '@/types/documentos'

function determineFileType(mimeType: string = '', filename: string = ''): 'pdf' | 'imagen' | 'video' | 'documento' | 'otro' {
    const mime = mimeType.toLowerCase()
    const name = filename.toLowerCase()

    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(name)) return 'imagen'
    if (mime.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv|wmv)$/.test(name)) return 'video'
    if (
        mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') ||
        mime.includes('document') || mime.includes('sheet') || mime.includes('presentation') ||
        /\.(docx?|xlsx?|pptx?|csv|txt|rtf)$/.test(name)
    ) return 'documento'

    return 'otro'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')?.trim() || ''
        const carpetaId = searchParams.get('carpetaId')

        if (!q || q.length < 2) {
            return NextResponse.json({ archivos: [] })
        }

        let onedriveFolderId: string | undefined

        if (carpetaId) {
            const carpeta = await rawPrisma.carpetaDocumental.findUnique({
                where: { id: carpetaId }
            })
            if (carpeta) {
                const perms = await getUserFolderPermissions(session.user, carpeta.id)
                if (!perms.puedeVer) {
                    return NextResponse.json({ message: 'Sin acceso a la carpeta solicitada' }, { status: 403 })
                }
                onedriveFolderId = carpeta.onedriveId
            }
        }

        const items = await searchFiles(q, onedriveFolderId)
        const fileItems = items.filter(item => item.file)

        // Obtener carpetas activas del usuario para asociar nombres
        const allowedFolderIds = await getFolderIdsForUser(session.user)
        const userFolders = await rawPrisma.carpetaDocumental.findMany({
            where: { id: { in: allowedFolderIds } },
            select: { id: true, nombre: true, onedriveId: true }
        })

        const folderMap = new Map<string, { id: string; nombre: string }>()
        userFolders.forEach(f => folderMap.set(f.onedriveId, { id: f.id, nombre: f.nombre }))

        const archivos: ArchivoUI[] = fileItems.map(item => {
            const sizeBytes = item.size || 0
            const tamanoMB = Number((sizeBytes / (1024 * 1024)).toFixed(2))
            const mimeType = item.file?.mimeType || 'application/octet-stream'

            return {
                id: item.id,
                nombre: item.name,
                tamanoMB,
                fechaModificacion: item.lastModifiedDateTime,
                tipoMime: mimeType,
                tipoArchivo: determineFileType(mimeType, item.name),
                carpetaId: carpetaId || '',
                puedeDescargar: true
            }
        })

        return NextResponse.json({ archivos })
    } catch (error: any) {
        console.error('Error al buscar archivos:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error en búsqueda' }, { status: 500 })
    }
}
