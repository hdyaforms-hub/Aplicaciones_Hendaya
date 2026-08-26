import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { getUserFolderPermissions } from '@/lib/doc-permissions'
import { listFolderContents } from '@/lib/graph-client'
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

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ carpetaId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const { carpetaId } = await context.params

        const carpeta = await rawPrisma.carpetaDocumental.findUnique({
            where: { id: carpetaId }
        })

        if (!carpeta || !carpeta.activa) {
            return NextResponse.json({ message: 'Carpeta no encontrada o inactiva' }, { status: 404 })
        }

        const perms = await getUserFolderPermissions(session.user, carpeta.id)
        if (!perms.puedeVer) {
            return NextResponse.json({ message: 'No tienes permiso para ver esta carpeta' }, { status: 403 })
        }

        // Consultar contenido de la carpeta en OneDrive
        const items = await listFolderContents(carpeta.onedriveId)

        // Filtrar solo archivos (excluyendo subcarpetas de OneDrive)
        const fileItems = items.filter(item => item.file)

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
                carpetaId: carpeta.id,
                puedeDescargar: perms.puedeDescargar,
                puedeAdministrar: perms.puedeAdministrar
            }
        })

        return NextResponse.json({
            carpeta: {
                id: carpeta.id,
                nombre: carpeta.nombre,
                descripcion: carpeta.descripcion,
                icono: carpeta.icono,
                rutaCompleta: carpeta.rutaCompleta,
                puedeVer: perms.puedeVer,
                puedeDescargar: perms.puedeDescargar,
                puedeSubir: perms.puedeSubir,
                puedeAdministrar: perms.puedeAdministrar
            },
            archivos
        })
    } catch (error: any) {
        console.error('Error al obtener archivos de carpeta:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al obtener archivos' }, { status: 500 })
    }
}
