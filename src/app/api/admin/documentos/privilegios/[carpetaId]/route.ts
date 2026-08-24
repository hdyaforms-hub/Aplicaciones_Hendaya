import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { PrivilegioUI, NivelPermiso, TipoPrivilegio } from '@/types/documentos'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ carpetaId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_privilegios')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const { carpetaId } = await context.params

        const [privilegios, roles, users, carpeta] = await Promise.all([
            rawPrisma.privilegioDocumental.findMany({
                where: { carpetaId },
                orderBy: { creadoEn: 'desc' }
            }),
            rawPrisma.role.findMany({
                select: { id: true, name: true }
            }),
            rawPrisma.user.findMany({
                where: { isDeleted: false },
                select: { id: true, name: true, username: true }
            }),
            rawPrisma.carpetaDocumental.findUnique({
                where: { id: carpetaId }
            })
        ])

        if (!carpeta) {
            return NextResponse.json({ message: 'Carpeta no encontrada' }, { status: 404 })
        }

        const roleMap = new Map(roles.map(r => [r.id, r.name]))
        const userMap = new Map(users.map(u => [u.id, u.name ? `${u.name} (@${u.username})` : `@${u.username}`]))

        const uiPrivilegios: PrivilegioUI[] = privilegios.map(p => {
            const referenciaNombre = p.tipo === 'rol'
                ? (roleMap.get(p.referenciaId) || `Rol #${p.referenciaId}`)
                : (userMap.get(p.referenciaId) || `Usuario #${p.referenciaId}`)

            return {
                id: p.id,
                carpetaId: p.carpetaId,
                carpetaNombre: carpeta.nombre,
                tipo: p.tipo as TipoPrivilegio,
                referenciaId: p.referenciaId,
                referenciaNombre,
                permiso: p.permiso as NivelPermiso,
                creadoEn: p.creadoEn.toISOString()
            }
        })

        return NextResponse.json({
            carpeta: {
                id: carpeta.id,
                nombre: carpeta.nombre,
                rutaCompleta: carpeta.rutaCompleta
            },
            privilegios: uiPrivilegios,
            roles: roles.map(r => ({ id: r.id, name: r.name })),
            usuarios: users.map(u => ({ id: u.id, name: u.name || u.username, username: u.username }))
        })
    } catch (error: any) {
        console.error('Error al obtener privilegios de carpeta:', error?.message)
        return NextResponse.json({ message: 'Error interno' }, { status: 500 })
    }
}
