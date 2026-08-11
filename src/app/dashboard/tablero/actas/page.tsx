import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ActasDashboardClient from './ActasDashboardClient'

export default async function TableroActasPage() {
    const session = await getSession()

    if (!session?.user?.role?.permissions.includes('view_tablero_actas')) {
        redirect('/dashboard')
    }

    // 1. Obtener todas las respuestas de actas registradas
    const actas = await (prisma as any).actaSupervisionRespuesta.findMany({
        include: {
            plantilla: {
                select: {
                    id: true,
                    nombre: true,
                    licitacionId: true,
                    anio: true,
                    instituciones: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    // 2. Obtener licitaciones para filtro
    const licitaciones = await (prisma as any).licitacion.findMany({
        select: {
            licId: true,
            licitacionHomologada: true
        },
        orderBy: { licId: 'asc' }
    })

    // 3. Obtener colegios (RBDs) para la búsqueda inteligente de autocompletado
    const colegios = await (prisma as any).colegios.findMany({
        select: {
            colRBD: true,
            nombreEstablecimiento: true,
            institucion: true,
            sucursal: true,
            comuna: true
        },
        orderBy: { colRBD: 'asc' }
    })

    // Serializar respuestas para cliente
    const formattedActas = actas.map((a: any) => ({
        id: a.id,
        plantillaId: a.plantillaId,
        licitacionId: a.licitacionId || a.plantilla?.licitacionId || null,
        anio: a.anio || (a.createdAt ? new Date(a.createdAt).getFullYear() : 2026),
        mes: a.createdAt ? new Date(a.createdAt).getMonth() + 1 : 1,
        rbd: a.rbd,
        nombreEstablecimiento: a.nombreEstablecimiento || 'Sin Nombre',
        institucion: a.institucion || 'JUNAEB',
        sucursal: a.sucursal || 'Sin Sucursal',
        fechaCreacion: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
        supervisorNombre: a.supervisorNombre || a.usuario || 'Desconocido',
        usuario: a.usuario || 'Desconocido',
        estado: a.estado || 'Borrador',
        plantillaNombre: a.plantilla?.nombre || 'Acta sin Nombre',
        correlativo: a.correlativo || null,
        hasFirma: Boolean(
            ['Finalizado', 'Finalizada', 'Firmado', 'Firmada', 'Completado', 'Completada'].includes(a.estado) ||
            (a.respuestasData && (a.respuestasData.includes('data:image') || a.respuestasData.includes('"firma"')))
        )
    }))

    return (
        <ActasDashboardClient
            initialActas={formattedActas}
            licitaciones={licitaciones}
            colegiosList={colegios}
        />
    )
}
