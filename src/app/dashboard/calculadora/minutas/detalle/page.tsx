import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import EditMinutaForm from './EditMinutaForm'

export default async function MinutaDetallePage({
    searchParams
}: {
    searchParams: Promise<{ licitacion?: string; numero?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_minutas')) {
        redirect('/dashboard')
    }

    const { licitacion, numero } = await searchParams

    if (!licitacion || !numero) {
        redirect('/dashboard/calculadora/minutas')
    }

    const minutas = await prisma.minutas.findMany({
        where: {
            licitacion: licitacion,
            numeroMinuta: numero
        }
    })

    if (minutas.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black text-gray-900 mb-2">Minuta no encontrada</h2>
                <p className="text-gray-500 mb-6 font-bold">No pudimos encontrar registros para la minuta {numero}.</p>
                <a href="/dashboard/calculadora/minutas" className="inline-flex items-center px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all">
                    Volver al Listado
                </a>
            </div>
        )
    }

    const first = minutas[0]

    // Obtener los nombres de las preparaciones asociadas
    const prepNumbers = Array.from(new Set(minutas.map(m => Number(m.numeroPreparacion))))
    const prepDetails = await prisma.preparaciones.findMany({
        where: {
            licitacion: licitacion,
            numeroPreparacion: { in: prepNumbers }
        },
        select: {
            numeroPreparacion: true,
            nombrePreparacion: true
        }
    })

    // Crear un mapa para búsqueda rápida
    const prepNamesMap = prepDetails.reduce((acc, curr) => {
        acc[curr.numeroPreparacion] = curr.nombrePreparacion
        return acc
    }, {} as Record<number, string>)

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <a href="/dashboard" className="hover:text-indigo-600 transition-colors">Inicio</a>
                <span>/</span>
                <a href="/dashboard/calculadora/minutas" className="hover:text-indigo-600 transition-colors">Minutas</a>
                <span>/</span>
                <span className="text-slate-900">Detalle #{numero}</span>
            </div>

            <EditMinutaForm 
                licitacion={licitacion}
                numeroMinuta={numero}
                metaData={{
                    numeroPrograma: first.numeroPrograma,
                    programa: first.programa,
                    numeroCocina: first.numeroCocina,
                    cocina: first.cocina,
                    dia: first.dia,
                    mes: first.mes,
                    anio: first.anio,
                    sucid: first.sucid
                }}
                initialEntries={minutas.map(m => ({
                    id: m.id,
                    numeroPreparacion: String(m.numeroPreparacion),
                    nombrePreparacion: prepNamesMap[Number(m.numeroPreparacion)] || 'Nombre no encontrado',
                    codigoServicio: m.codigoServicio,
                    nombreServicio: m.nombreServicio,
                    codigoEnlace: m.codigoEnlace,
                    nombreEnlace: m.nombreEnlace
                }))}
            />
        </div>
    )
}
