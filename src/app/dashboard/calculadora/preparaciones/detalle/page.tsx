import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import EditPreparacionForm from './EditPreparacionForm'

export default async function PreparacionDetallePage({
    searchParams
}: {
    searchParams: Promise<{ licitacion?: string; numero?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_preparaciones')) {
        redirect('/dashboard')
    }

    const { licitacion, numero } = await searchParams

    if (!licitacion || !numero) {
        redirect('/dashboard/calculadora/preparaciones')
    }

    const numeroInt = parseInt(numero, 10)

    const preparaciones = await prisma.preparaciones.findMany({
        where: {
            licitacion: licitacion,
            numeroPreparacion: numeroInt
        },
        orderBy: {
            codigoProducto: 'asc'
        }
    })

    if (preparaciones.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Preparación no encontrada</h2>
                <p className="text-gray-500 mb-6">No pudimos encontrar registros para la licitación {licitacion} y número {numero}.</p>
                <a href="/dashboard/calculadora/preparaciones" className="inline-flex items-center px-6 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition-all">
                    Volver al Listado
                </a>
            </div>
        )
    }

    const first = preparaciones[0]

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                <a href="/dashboard" className="hover:text-cyan-600">Inicio</a>
                <span>/</span>
                <a href="/dashboard/calculadora/preparaciones" className="hover:text-cyan-600">Preparaciones</a>
                <span>/</span>
                <span className="text-gray-900 font-bold">Detalle #{numero}</span>
            </div>

            <EditPreparacionForm 
                licitacion={licitacion}
                numeroPreparacion={numeroInt}
                nombrePreparacion={first.nombrePreparacion}
                metaData={{
                    numeroPrograma: first.numeroPrograma,
                    programa: first.programa,
                    numeroCocina: first.numeroCocina,
                    cocina: first.cocina,
                    numeroArea: first.numeroArea,
                    area: first.area,
                    codigoSubServicio: first.codigoSubServicio,
                    nombreSubServicio: first.nombreSubServicio
                }}
                initialProducts={preparaciones.map(p => ({
                    id: p.id,
                    codigoProducto: p.codigoProducto,
                    nombreProducto: p.nombreProducto,
                    cantPreparacion: Number(p.cantPreparacion),
                    porcentajePerdida: p.porcentajePerdida
                }))}
            />
        </div>
    )
}
