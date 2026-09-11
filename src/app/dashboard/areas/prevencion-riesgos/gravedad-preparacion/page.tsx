import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { rawPrisma } from '@/lib/prisma'
import { getGravedadPreparaciones, getFiltrosDisponiblesAction } from './actions'
import GravedadPreparacionClient from './GravedadPreparacionClient'

export const metadata: Metadata = {
    title: 'Gravedad en Preparación | Prev. de riesgos | Hendaya',
    description: 'Matriz de asignación de gravedad y criticidad de preparaciones alimentarias para Prevención de Riesgos.'
}

export default async function GravedadPreparacionPage({
    searchParams
}: {
    searchParams: Promise<{
        licitacion?: string
        nombre?: string
        subservicio?: string
        gravedad?: string
        page?: string
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
    }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('view_prev_gravedad_preparacion')) {
        redirect('/dashboard')
    }

    const canManage = isAdmin || permissions.includes('manage_prev_gravedad_preparacion')

    // Auto-sincronización inicial si la tabla está vacía
    const totalExistente = await rawPrisma.prevGravedadPreparacion.count()
    if (totalExistente === 0) {
        try {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "hend_app"."Prev_GravedadPreparacion" (
                    "id", "licitacion", "numeroPreparacion", "nombrePreparacion", 
                    "codigoSubServicio", "nombreSubServicio", "gravedad", "updatedAt", "createdAt"
                )
                SELECT 
                    gen_random_uuid(), 
                    p."licitacion", 
                    p."numeroPreparacion", 
                    p."nombrePreparacion", 
                    p."codigoSubServicio", 
                    p."nombreSubServicio", 
                    'SIN_ASIGNAR', 
                    NOW(), 
                    NOW()
                FROM (
                    SELECT DISTINCT ON ("licitacion", "numeroPreparacion") 
                        "licitacion", "numeroPreparacion", "nombrePreparacion", "codigoSubServicio", "nombreSubServicio"
                    FROM "hend_app"."Preparaciones"
                ) p
                ON CONFLICT ("licitacion", "numeroPreparacion") DO NOTHING;
            `)
        } catch (e) {
            console.error('Error en auto-sincronización inicial:', e)
        }
    }

    const resolvedParams = await searchParams
    const pageNumber = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1

    const [dataResult, filtrosDisponibles] = await Promise.all([
        getGravedadPreparaciones({
            licitacion: resolvedParams.licitacion,
            nombrePreparacion: resolvedParams.nombre,
            nombreSubServicio: resolvedParams.subservicio,
            gravedad: resolvedParams.gravedad,
            page: pageNumber,
            sortBy: resolvedParams.sortBy,
            sortOrder: resolvedParams.sortOrder,
        }),
        getFiltrosDisponiblesAction()
    ])

    return (
        <GravedadPreparacionClient
            initialItems={dataResult.items || []}
            totalCount={dataResult.total || 0}
            currentPage={dataResult.page || 1}
            totalPages={dataResult.totalPages || 1}
            kpis={dataResult.kpis || { totalGlobal: 0, asignadas: 0, sinAsignar: 0, alto: 0, medio: 0, leve: 0 }}
            licitacionesList={filtrosDisponibles.licitaciones}
            subServiciosList={filtrosDisponibles.subServicios}
            canManage={canManage}
        />
    )
}
