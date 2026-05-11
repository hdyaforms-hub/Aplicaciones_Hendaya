import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import UploadModalMinutas from './UploadModalMinutas'
import MinutasSearch from './MinutasSearch'
import DeleteMassiveMinutasModal from './DeleteMassiveMinutasModal'

export default async function MinutasPage({
    searchParams
}: {
    searchParams: Promise<{ numero?: string, codigo?: string, mes?: string, anio?: string, programa?: string, page?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_minutas')) {
        redirect('/dashboard')
    }

    const resolvedParams = await searchParams
    const filters = {
        numero: resolvedParams.numero || '',
        codigo: resolvedParams.codigo || '',
        mes: resolvedParams.mes || '',
        anio: resolvedParams.anio || '',
        programa: resolvedParams.programa || '',
    }

    const whereClause: any = {}
    if (filters.numero) {
        whereClause.numeroMinuta = { contains: filters.numero, mode: 'insensitive' }
    }
    if (filters.codigo) {
        whereClause.licitacion = { contains: filters.codigo, mode: 'insensitive' }
    }
    if (filters.programa) {
        whereClause.OR = [
            { programa: { contains: filters.programa, mode: 'insensitive' } },
            { numeroPrograma: { contains: filters.programa, mode: 'insensitive' } }
        ]
    }
    if (filters.mes) {
        whereClause.mes = parseInt(filters.mes)
    }
    if (filters.anio) {
        whereClause.anio = parseInt(filters.anio)
    }

    console.log('--- Minutas Filter Debug ---')
    console.log('Filters:', filters)
    console.log('WhereClause:', JSON.stringify(whereClause, null, 2))

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 15

    // Contar grupos únicos para la paginación
    const totalCount = await prisma.minutas.count({
        where: whereClause,
        // Nota: count() con distinct no está soportado directamente en todas las versiones
        // Usamos findMany para obtener los IDs únicos si es necesario, o agrupamos
    })

    // Alternativa para count preciso con filtros
    const [uniqueGroups, totalRecordsCount] = await Promise.all([
        prisma.minutas.groupBy({
            by: ['licitacion', 'numeroMinuta'],
            where: whereClause
        }),
        prisma.minutas.count({
            where: whereClause
        })
    ])
    const totalGroupsCount = uniqueGroups.length
    const totalPages = Math.ceil(totalGroupsCount / limit)

    const minutasGrouped = await prisma.minutas.findMany({
        where: whereClause,
        distinct: ['licitacion', 'numeroMinuta'],
        orderBy: [
            { numeroMinuta: 'desc' }
        ],
        skip: (currentPage - 1) * limit,
        take: limit,
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="text-3xl">📅</span> Mantenedor de Minutas
                    </h2>
                    <p className="text-gray-500 font-bold text-sm ml-1">Planificación y gestión de servicios diarios</p>
                </div>

                <div className="flex gap-3">
                    <DeleteMassiveMinutasModal />
                    <UploadModalMinutas />
                </div>
            </div>

            <MinutasSearch 
                initialNumero={filters.numero} 
                initialLicitacion={filters.codigo} 
                initialMes={filters.mes}
                initialAnio={filters.anio}
                initialPrograma={filters.programa}
            />

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 450px)' }}>
                    <table className="w-full text-left text-sm whitespace-nowrap relative">
                        <thead className="bg-slate-50 text-slate-500 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Licitación</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">N° Minuta</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Programa</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Cocina</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Fecha</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                            {minutasGrouped.map((m: any) => (
                                <tr key={`${m.licitacion}-${m.numeroMinuta}`} className="hover:bg-indigo-50/40 transition-colors group">
                                    <td className="px-6 py-4 font-black text-gray-900 text-xs">{m.licitacion}</td>
                                    <td className="px-6 py-4">
                                        <a 
                                            href={`/dashboard/calculadora/minutas/detalle?licitacion=${m.licitacion}&numero=${m.numeroMinuta}`}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                                        >
                                            #{m.numeroMinuta}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-800 text-xs truncate max-w-[150px]">{m.programa}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800 text-xs truncate max-w-[150px]">{m.cocina}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
                                            {m.dia}/{m.mes}/{m.anio}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <a 
                                            href={`/dashboard/calculadora/minutas/detalle?licitacion=${m.licitacion}&numero=${m.numeroMinuta}`}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group-hover:scale-105"
                                        >
                                            ✏️ Gestionar Minuta
                                        </a>
                                    </td>
                                </tr>
                            ))}

                            {minutasGrouped.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-6xl mb-6 opacity-40 grayscale animate-pulse">📅</span>
                                            <p className="text-slate-400 font-black text-xl tracking-tight">No se encontraron minutas</p>
                                            <p className="text-slate-300 text-sm mt-2 font-bold">Ajusta los filtros para refinar la búsqueda.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="px-8 py-5 bg-slate-50/50 border-t border-gray-100 flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Mostrando <span className="text-slate-900">{minutasGrouped.length}</span> de <span className="text-slate-900">{totalGroupsCount}</span> minutas únicas 
                            <span className="ml-2 text-slate-300">({totalRecordsCount.toLocaleString()} registros totales)</span>
                        </p>
                        <div className="flex gap-3">
                            <a
                                href={`?page=${currentPage - 1}&numero=${filters.numero}&codigo=${filters.codigo}&mes=${filters.mes}&anio=${filters.anio}&programa=${filters.programa}`}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm ${
                                    currentPage <= 1 ? 'pointer-events-none opacity-40 bg-gray-100 text-gray-400' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                Anterior
                            </a>
                            <div className="flex items-center px-5 rounded-xl bg-slate-900 text-xs font-black text-white shadow-xl">
                                {currentPage} de {totalPages}
                            </div>
                            <a
                                href={`?page=${currentPage + 1}&numero=${filters.numero}&codigo=${filters.codigo}&mes=${filters.mes}&anio=${filters.anio}&programa=${filters.programa}`}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm ${
                                    currentPage >= totalPages ? 'pointer-events-none opacity-40 bg-gray-100 text-gray-400' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                Siguiente
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
