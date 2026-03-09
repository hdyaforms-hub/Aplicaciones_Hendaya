import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UploadModal from './UploadModal'

export default async function PMPAPage({
    searchParams
}: {
    searchParams: Promise<{ sucursal?: string, ano?: string, mes?: string, page?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_pmpa')) {
        redirect('/dashboard')
    }

    const resolvedParams = await searchParams

    const dbUser = await (prisma.user as any).findUnique({
        where: { id: session?.user?.id as string },
        include: { sucursales: true }
    })
    const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

    const filters = {
        sucursal: resolvedParams.sucursal || '',
        ano: resolvedParams.ano ? parseInt(resolvedParams.ano) : undefined,
        mes: resolvedParams.mes ? parseInt(resolvedParams.mes) : undefined,
    }

    // Limpiar query where nulos
    const whereClause: any = {}
    if (filters.sucursal) {
        if (!userSucursales.includes(filters.sucursal)) {
            whereClause.sucursal = { in: [] }
        } else {
            whereClause.sucursal = filters.sucursal
        }
    } else {
        whereClause.sucursal = { in: userSucursales }
    }

    if (filters.ano) whereClause.ano = filters.ano
    if (filters.mes) whereClause.mes = filters.mes

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 10

    const totalCount = await prisma.pMPA.count({ where: whereClause })
    const totalPages = Math.ceil(totalCount / limit)

    // Obtener los datos filtrados
    const pmpaData = await prisma.pMPA.findMany({
        where: whereClause,
        skip: (currentPage - 1) * limit,
        take: limit,
        orderBy: [
            { ano: 'desc' },
            { mes: 'desc' },
            { sucursal: 'asc' }
        ]
    })

    // Agrupar para los combos usando queries directas sobre valores únicos
    const combos = await prisma.pMPA.groupBy({
        by: ['sucursal', 'ano', 'mes'],
        where: { sucursal: { in: userSucursales } },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { sucursal: 'asc' }]
    })

    // Generar opciones únicas
    const sucursales = Array.from(new Set(combos.map((c: any) => c.sucursal as string))) as string[]
    const anos = Array.from(new Set(combos.map((c: any) => c.ano as number))) as number[]
    const meses = Array.from(new Set(combos.map((c: any) => c.mes as number))) as number[]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📁</span> Módulo PMPA
                    </h2>
                    <p className="text-gray-500 mt-1">Visor y cargador de registros aplicativos</p>
                </div>

                <UploadModal />
            </div>

            {/* Panel de Filtros */}
            <form className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                    <select
                        name="sucursal"
                        defaultValue={filters.sucursal}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 appearance-none"
                    >
                        <option value="">Todas</option>
                        {sucursales.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                    <select
                        name="ano"
                        defaultValue={filters.ano?.toString() || ''}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 appearance-none"
                    >
                        <option value="">Todos</option>
                        {anos.map((a: number) => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                    <select
                        name="mes"
                        defaultValue={filters.mes?.toString() || ''}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 appearance-none"
                    >
                        <option value="">Todos</option>
                        {meses.map((m: number) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                <div className="flex items-end">
                    <button type="submit" className="px-6 py-2.5 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-medium transition-colors w-full sm:w-auto flex items-center justify-center gap-2">
                        🔍 Filtrar
                    </button>
                    {/* Botón para limpiar filtros */}
                    <a href="/dashboard/pmpa" className="ml-2 px-6 py-2.5 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 shadow-sm border border-slate-200 font-medium transition-colors w-full sm:w-auto flex items-center justify-center">
                        Limpiar
                    </a>
                </div>
            </form>

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                    <table className="w-full text-left text-sm whitespace-nowrap relative">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200 sticky top-0 z-10 shadow-sm shadow-slate-200/50">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Sucursal</th>
                                <th className="px-6 py-4 font-semibold">Año</th>
                                <th className="px-6 py-4 font-semibold">Mes</th>
                                <th className="px-6 py-4 font-semibold">RBD</th>
                                <th className="px-6 py-4 font-semibold">Programa</th>
                                <th className="px-6 py-4 font-semibold">Estrato</th>
                                <th className="px-6 py-4 font-semibold">Raceq</th>
                                <th className="px-6 py-4 font-semibold">Servicio</th>
                                <th className="px-6 py-4 font-semibold border-l border-gray-200 bg-cyan-50 text-cyan-800">Cargado Por</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {pmpaData.map((d: any) => (
                                <tr key={d.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900">{d.sucursal}</td>
                                    <td className="px-6 py-3">{d.ano}</td>
                                    <td className="px-6 py-3">{d.mes}</td>
                                    <td className="px-6 py-3">{d.rbd}</td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                            {d.programa}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">{d.estrato}</td>
                                    <td className="px-6 py-3">{d.raceq}</td>
                                    <td className="px-6 py-3">{d.servicio}</td>
                                    <td className="px-6 py-3 border-l border-gray-100 border-dashed text-xs text-gray-500">
                                        {d.uploadedBy}
                                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(d.createdAt).toLocaleDateString()}</div>
                                    </td>
                                </tr>
                            ))}

                            {pmpaData.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center h-48">
                                        <span className="text-4xl block mb-3 text-slate-300">📁</span>
                                        <p className="text-slate-500 font-medium">No se encontraron registros bajo este criterio.</p>
                                        <p className="text-slate-400 text-sm mt-1">Usa los filtros superiores o adjunta un nuevo archivo Excel.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {pmpaData.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-2">
                    <div className="text-xs text-gray-500 font-medium">
                        Mostrando registros {((currentPage - 1) * limit) + 1} al {Math.min(currentPage * limit, totalCount)} de un total de {totalCount}.
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Link
                            href={`/dashboard/pmpa?sucursal=${filters.sucursal}&ano=${filters.ano || ''}&mes=${filters.mes || ''}&page=1`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Primera página"
                        >
                            &laquo;
                        </Link>

                        <Link
                            href={`/dashboard/pmpa?sucursal=${filters.sucursal}&ano=${filters.ano || ''}&mes=${filters.mes || ''}&page=${currentPage - 1}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página anterior"
                        >
                            &lsaquo;
                        </Link>

                        <span className="text-sm font-semibold text-gray-700 px-3 bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                            {currentPage} / {totalPages || 1}
                        </span>

                        <Link
                            href={`/dashboard/pmpa?sucursal=${filters.sucursal}&ano=${filters.ano || ''}&mes=${filters.mes || ''}&page=${currentPage + 1}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página siguiente"
                        >
                            &rsaquo;
                        </Link>

                        <Link
                            href={`/dashboard/pmpa?sucursal=${filters.sucursal}&ano=${filters.ano || ''}&mes=${filters.mes || ''}&page=${totalPages}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Última página"
                        >
                            &raquo;
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
