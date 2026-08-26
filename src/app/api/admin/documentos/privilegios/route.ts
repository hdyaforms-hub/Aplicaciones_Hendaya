import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { logAuditAction } from '@/lib/audit'
import { PrivilegioUI, NivelPermiso, TipoPrivilegio } from '@/types/documentos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const carpetaId = searchParams.get('carpetaId')
        const searchColegio = searchParams.get('searchColegio')?.trim()

        const where: any = {}
        if (carpetaId) {
            where.carpetaId = carpetaId
        }

        const [privilegios, roles, users, sucursales, licitaciones] = await Promise.all([
            rawPrisma.privilegioDocumental.findMany({
                where,
                include: {
                    carpeta: {
                        select: { nombre: true }
                    }
                },
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
            })
        ])

        // Obtener colegios asignados en privilegios + muestra inicial o búsqueda
        const assignedRBDs = Array.from(new Set(
            privilegios
                .filter(p => p.tipo === 'rbd')
                .map(p => Number(p.referenciaId))
                .filter(n => !isNaN(n) && n > 0)
        ))

        let colegiosWhere: any = undefined
        if (searchColegio) {
            const parsedNum = Number(searchColegio)
            colegiosWhere = {
                OR: [
                    { nombreEstablecimiento: { contains: searchColegio, mode: 'insensitive' } },
                    ...(isNaN(parsedNum) ? [] : [{ colRBD: parsedNum }])
                ]
            }
        } else if (assignedRBDs.length > 0) {
            colegiosWhere = {
                OR: [
                    { colRBD: { in: assignedRBDs } }
                ]
            }
        }

        const [colegiosAsignados, colegiosCatalogo] = await Promise.all([
            assignedRBDs.length > 0 ? rawPrisma.colegios.findMany({
                where: { colRBD: { in: assignedRBDs } },
                select: { colRBD: true, nombreEstablecimiento: true, sucursal: true }
            }) : Promise.resolve([]),
            rawPrisma.colegios.findMany({
                where: colegiosWhere,
                select: { colRBD: true, nombreEstablecimiento: true, sucursal: true },
                take: 200,
                orderBy: { colRBD: 'asc' }
            })
        ])

        const colegiosRaw = [...colegiosAsignados, ...colegiosCatalogo]

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
            carpetaNombre: p.carpeta?.nombre || 'Carpeta',
            tipo: p.tipo as TipoPrivilegio,
            referenciaId: p.referenciaId,
            referenciaNombre: getReferenciaNombre(p.tipo, p.referenciaId),
            permiso: p.permiso as NivelPermiso,
            creadoEn: p.creadoEn.toISOString()
        }))

        return NextResponse.json({
            privilegios: uiPrivilegios,
            roles: roles.map(r => ({ id: r.id, name: r.name })),
            usuarios: users.map(u => ({ id: u.id, name: u.name || u.username, username: u.username })),
            sucursales: sucursales.map(s => ({ id: s.id, nombre: s.nombre })),
            licitaciones: licitaciones.map(l => ({ id: String(l.licId), nombre: l.licitacionHomologada ? `${l.licitacionHomologada} (#${l.licId})` : `Licitación #${l.licId}` })),
            colegios: colegios
        })
    } catch (error: any) {
        console.error('Error al obtener privilegios:', error?.message)
        return NextResponse.json({ message: 'Error interno al consultar privilegios' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
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

        const body = await request.json()
        const { carpetaId, tipo, referenciaId, permiso } = body

        if (!carpetaId || !tipo || !referenciaId || !permiso) {
            return NextResponse.json({ message: 'Todos los campos son requeridos' }, { status: 400 })
        }

        // Crear o actualizar privilegio
        const priv = await rawPrisma.privilegioDocumental.upsert({
            where: {
                carpetaId_tipo_referenciaId_permiso: {
                    carpetaId,
                    tipo,
                    referenciaId,
                    permiso
                }
            },
            create: {
                carpetaId,
                tipo,
                referenciaId,
                permiso
            },
            update: {
                permiso
            }
        })

        // Auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ASIGNAR_PRIVILEGIO_DOCUMENTAL',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Asignó permiso "${permiso}" de tipo "${tipo}" (Ref: ${referenciaId}) en la carpeta ID ${carpetaId}`
        })

        return NextResponse.json({ success: true, privilegio: priv })
    } catch (error: any) {
        console.error('Error al asignar privilegio:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al asignar privilegio' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ message: 'ID del privilegio requerido' }, { status: 400 })
        }

        const priv = await rawPrisma.privilegioDocumental.findUnique({
            where: { id }
        })

        if (!priv) {
            return NextResponse.json({ message: 'Privilegio no encontrado' }, { status: 404 })
        }

        await rawPrisma.privilegioDocumental.delete({
            where: { id }
        })

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'REVOCAR_PRIVILEGIO_DOCUMENTAL',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Revocó permiso "${priv.permiso}" de tipo "${priv.tipo}" en la carpeta ID ${priv.carpetaId}`
        })

        return NextResponse.json({ success: true, message: 'Privilegio revocado exitosamente' })
    } catch (error: any) {
        console.error('Error al revocar privilegio:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al revocar privilegio' }, { status: 500 })
    }
}
