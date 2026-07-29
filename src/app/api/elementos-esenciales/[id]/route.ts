import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const isAdmin = session.user.role?.name === 'Administrador';
        const hasPermission = session.user.role?.permissions?.includes('view_elementos_esenciales');
        if (!isAdmin && !hasPermission) {
            return NextResponse.json({ error: 'Acceso denegado: Permisos insuficientes' }, { status: 403 });
        }

        const { id } = await params

        // Buscar el registro para obtener la ruta del archivo y folio
        const acta = await prisma.elementosEsenciales_Cab.findUnique({
            where: { id },
            select: { id: true, folio: true, link: true }
        })

        if (!acta) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
        }

        // Eliminar multas asociadas al folio si existe
        if (acta.folio) {
            await prisma.multas_Elementos_Esenciales_Cab.deleteMany({
                where: { folioOriginal: acta.folio }
            })
        }

        // Eliminar de la base de datos (Cascade borrará los detalles de ElementosEsenciales_Det)
        await prisma.elementosEsenciales_Cab.delete({
            where: { id }
        })

        // Intentar eliminar el archivo físico si existe el link
        if (acta.link) {
            try {
                // acta.link suele ser '/uploads/elementos-esenciales/filename.pdf'
                // Reconstruimos la ruta física en el directorio 'public'
                const filePath = join(process.cwd(), 'public', acta.link)
                await unlink(filePath)
            } catch (err) {
                console.warn('No se pudo eliminar el archivo físico:', err)
                // No lanzamos error para que la eliminación de DB sea exitosa aunque falte el archivo
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error al eliminar acta:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}
