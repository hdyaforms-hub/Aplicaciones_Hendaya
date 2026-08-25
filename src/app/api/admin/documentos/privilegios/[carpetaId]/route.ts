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

        const [privilegios, roles, users, sucursales, licitaciones, colegiosRaw, carpeta] = await Promise.all([
            rawPrisma.privilegioDocumental.findMany({
                where: { carpetaId },
                orderBy: { creadoEn: 'desc' }
            }),
            rawPrisma.role.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            }),
            rawPrisma.user.findMany({
                where: { isDeleted: false },
                select: { id: true, name: true, username: true },
                orderBy: { name: 'asc' }
            }),
            rawPrisma.sucursal.findMany({
                select: { id: true, nombre: true },
                orderBy: { nombre: 'asc' }
            }),
            rawPrisma.licitacion.findMany({
                select: { licId: true, licitacionHomologada: true },
                orderBy: { licId: 'asc' }
            }),
            rawPrisma.colegios.findMany({
                select: { colRBD: true, nombreEstablecimiento: true, sucursal: true },
                orderBy: { colRBD: 'asc' }
            }),
            rawPrisma.carpetaDocumental.findUnique({
                where: { id: carpetaId }
            })
        ])

        if (!carpeta) {
            return NextResponse.json({ message: 'Carpeta no encontrada' }, { status: 404 })
        }

        const uniqueColegiosMap = new Map<number, { rbd: number; nombre: string }>()
        for (const c of colegiosRaw) {
            if (!uniqueColegiosMap.has(c.colRBD)) {
                uniqueColegiosMap.set(c.colRBD, {
                    rbd: c.colRBD,
                    nombre: `${c.colRBD} - ${c.nombreEstablecimiento}${c.sucursal ? ` (${c.sucursal})` : ''}`
                })
            }
        }
        const colegios = Array.from(uniqueColegiosMap.values())

        const roleMap = new Map(roles.map(r => [r.id, r.name]))
        const userMap = new Map(users.map(u => [u.id, u.name ? `${u.name} (@${u.username})` : `@${u.username}`]))
        const sucursalMap = new Map(sucursales.map(s => [s.id, `Sucursal ${s.nombre}`]))
        const licitacionMap = new Map(licitaciones.map(l => [String(l.licId), l.licitacionHomologada ? `Licitación ${l.licitacionHomologada} (#${l.licId})` : `Licitación #${l.licId}`]))
        const colegioMap = new Map(colegios.map(c => [String(c.rbd), c.nombre]))

        const getReferenciaNombre = (pTipo: string, refId: string) => {
            switch (pTipo) {
                case 'rol': return roleMap.get(refId) || `Rol #${refId}`
                case 'usuario': return userMap.get(refId) || `Usuario #${refId}`
                case 'sucursal': return sucursalMap.get(refId) || `Sucursal #${refId}`
                case 'licitacion': return licitacionMap.get(refId) || `Licitación #${refId}`
                case 'rbd': return colegioMap.get(refId) || `RBD #${refId}`
                default: return refId
            }
        }

        const uiPrivilegios: PrivilegioUI[] = privilegios.map(p => ({
            id: p.id,
            carpetaId: p.carpetaId,
            carpetaNombre: carpeta.nombre,
            tipo: p.tipo as TipoPrivilegio,
            referenciaId: p.referenciaId,
            referenciaNombre: getReferenciaNombre(p.tipo, p.referenciaId),
            permiso: p.permiso as NivelPermiso,
            creadoEn: p.creadoEn.toISOString()
        }))

        return NextResponse.json({
            carpeta: {
                id: carpeta.id,
                nombre: carpeta.nombre,
                rutaCompleta: carpeta.rutaCompleta
            },
            privilegios: uiPrivilegios,
            roles: roles.map(r => ({ id: r.id, name: r.name })),
            usuarios: users.map(u => ({ id: u.id, name: u.name || u.username, username: u.username })),
            sucursales: sucursales.map(s => ({ id: s.id, nombre: s.nombre })),
            licitaciones: licitaciones.map(l => ({ id: String(l.licId), nombre: l.licitacionHomologada ? `${l.licitacionHomologada} (#${l.licId})` : `Licitación #${l.licId}` })),
            colegios: colegios
        })
    } catch (error: any) {
        console.error('Error al obtener privilegios de carpeta:', error?.message)
        return NextResponse.json({ message: 'Error interno' }, { status: 500 })
    }
}
