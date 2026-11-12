import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

        await ensureMultasEETables()

        let canDeleteIndividual = isAdmin
        if (!isAdmin && session.user.id) {
            const priv = await prisma.multas_Privilegio_EE.findUnique({
                where: { userId: session.user.id }
            })
            if (priv?.puedeEliminarIndividual) {
                canDeleteIndividual = true
            }
        }

        if (!canDeleteIndividual) {
            return NextResponse.json(
                { error: 'Acceso denegado: No posee privilegios para eliminar registros en Carga de Elementos Esenciales' },
                { status: 403 }
            )
        }

        const { id } = await params

        // Buscar el registro para obtener la ruta del archivo, folio y rbd
        const acta = await prisma.elementosEsenciales_Cab.findUnique({
            where: { id },
            select: { id: true, folio: true, link: true, rbd: true }
        })

        if (!acta) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
        }

        let userAssignedRbds: number[] | null = null
        if (!isAdmin && session.user.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { rbds: true }
            })
            const directRbds = (dbUser?.rbds || session.user.rbds || [])
                .map(Number)
                .filter((n: number) => !isNaN(n) && n >= 0)

            if (directRbds.length > 0) {
                userAssignedRbds = Array.from(new Set(directRbds))
            }
        }

        if (userAssignedRbds && userAssignedRbds.length > 0 && acta.rbd && !userAssignedRbds.includes(acta.rbd)) {
            return NextResponse.json(
                { error: 'No tiene autorización para eliminar actas correspondientes a RBDs fuera de su perfil asignado' },
                { status: 403 }
            )
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
                const filePath = join(process.cwd(), 'public', acta.link)
                await unlink(filePath)
            } catch (err) {
                console.warn('No se pudo eliminar el archivo físico:', err)
            }
        }

        // Registro en Auditoría
        await logAuditAction({
            username: session.user.username || session.user.name || 'Usuario',
            userId: session.user.id,
            action: 'ELIMINACION_INDIVIDUAL_EE',
            modulo: 'Elementos Esenciales',
            detalle: `Eliminada acta EE con folio: ${acta.folio || 'Sin folio'} (RBD: ${acta.rbd || 'N/A'})`
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error al eliminar acta:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}
