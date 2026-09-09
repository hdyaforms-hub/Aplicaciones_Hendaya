import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import WidgetsDashboardClient from './WidgetsDashboardClient'
import { getUserWidgetLayoutsAction, fetchPlatformWidgetsDataAction } from './actions'

export const metadata = {
    title: 'Widgets Personalizables | Hendaya',
    description: 'Tablero dinámico de control con widgets modulares y esqueletos personalizables.'
}

export default async function WidgetsPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const roleName = (session.user.role?.name || '').toLowerCase()
    const isAdmin = roleName.includes('admin') || roleName.includes('administrador')

    // Control de acceso por Roles y Perfiles
    if (!isAdmin && !permissions.includes('view_tablero_widgets')) {
        redirect('/dashboard')
    }

    // Cargar formatos guardados, datos consolidados iniciales y metadatos de filtros
    const [layouts, platformData, licitaciones, sucursales, colegiosList, uts, supervisores] = await Promise.all([
        getUserWidgetLayoutsAction(),
        fetchPlatformWidgetsDataAction(),
        prisma.licitacion.findMany({
            where: { estado: 1 },
            select: { licId: true, licitacionHomologada: true },
            orderBy: { licId: 'asc' }
        }),
        prisma.sucursal.findMany({
            select: { id: true, nombre: true },
            orderBy: { nombre: 'asc' }
        }),
        prisma.colegios.findMany({
            select: { colRBD: true, nombreEstablecimiento: true, sucursal: true, colut: true, comuna: true, institucion: true },
            orderBy: { colRBD: 'asc' }
        }),
        prisma.uT.findMany({
            select: { codUT: true, licId: true, sucursalId: true }
        }),
        prisma.supervisor.findMany({
            where: { vigente: true },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                rbdsAuditar: { select: { rbd: true } },
                jefeOperacion: {
                    select: {
                        jefeZonal: {
                            select: {
                                sucursales: { select: { sucursal: { select: { nombre: true } } } },
                                licitaciones: { select: { licitacionId: true } }
                            }
                        }
                    }
                },
                jefeZonal: {
                    select: {
                        sucursales: { select: { sucursal: { select: { nombre: true } } } },
                        licitaciones: { select: { licitacionId: true } }
                    }
                }
            },
            orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }]
        })
    ])

    const currentUser = {
        username: session.user.username,
        name: session.user.name,
        roleName: session.user.role?.name
    }

    const filterMetadata = {
        licitaciones,
        sucursales,
        colegiosList,
        uts,
        supervisores
    }

    return (
        <WidgetsDashboardClient
            initialLayouts={layouts}
            initialData={platformData}
            currentUser={currentUser}
            filterMetadata={filterMetadata}
        />
    )
}
