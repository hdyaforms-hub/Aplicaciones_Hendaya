import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UploadModal from './UploadModal'
import DeleteButtonPMPA from './DeleteButtonPMPA'

export default async function PMPAPage({
    searchParams
}: {
    searchParams: Promise<{ sucursal?: string, ano?: string, mes?: string, page?: string, institucion?: string, sort?: string, order?: string }>
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
        institucion: resolvedParams.institucion || '',
    }

    // Check if user is Administrador to potentially bypass sucursal filtering
    const isAdmin = session?.user?.role?.name === 'Administrador'
    const canSeeAll = isAdmin || permissions.includes('manage_sucursales')

    // Limpiar query where nulos
    const whereClause: any = {}
    if (filters.sucursal) {
        if (!canSeeAll && !userSucursales.includes(filters.sucursal)) {
            whereClause.ut = { sucursal: { nombre: { in: [] } } }
        } else {
            whereClause.ut = { sucursal: { nombre: filters.sucursal } }
        }
    } else {
        if (!canSeeAll) {
            whereClause.ut = { sucursal: { nombre: { in: userSucursales } } }
        }
    }

    if (filters.ano) whereClause.ano = filters.ano
    if (filters.mes) whereClause.mes = filters.mes
    // @ts-ignore
    if (filters.institucion) whereClause.institucion = filters.institucion

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 10

    const totalCount = await prisma.pMPA.count({ where: whereClause })
    const totalPages = Math.ceil(totalCount / limit)

    const sort = resolvedParams.sort || 'ano'
    const order = resolvedParams.order === 'asc' ? 'asc' : 'desc'

    let orderByClause: any = {}
    if (sort === 'sucursal') {
        orderByClause = { ut: { sucursal: { nombre: order } } }
    } else {
        orderByClause = { [sort]: order }
    }
    
    const finalOrderBy = [orderByClause]
    if (sort !== 'ano' && sort !== 'mes') {
        finalOrderBy.push({ ano: 'desc' }, { mes: 'desc' })
    }

    // Obtener los datos filtrados
    const pmpaData = await prisma.pMPA.findMany({
        where: whereClause,
        include: { ut: { include: { sucursal: true } } },
        skip: (currentPage - 1) * limit,
        take: limit,
        orderBy: finalOrderBy
    })

    // Agrupar para los combos
    const groupedAnosMeses = await prisma.pMPA.groupBy({
        by: ['ano', 'mes'],
        where: canSeeAll ? {} : { ut: { sucursal: { nombre: { in: userSucursales } } } },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }]
    })

    const sucursalesRecords = await prisma.sucursal.findMany({
        where: canSeeAll ? { uts: { some: { pmpas: { some: {} } } } } : { nombre: { in: userSucursales }, uts: { some: { pmpas: { some: {} } } } },
        select: { nombre: true },
        orderBy: { nombre: 'asc' }
    })

    // @ts-ignore
    const groupedInstituciones = await prisma.pMPA.groupBy({
        by: ['institucion'],
        where: canSeeAll ? {} : { ut: { sucursal: { nombre: { in: userSucursales } } } },
        orderBy: { institucion: 'asc' }
    })

    // Generar opciones únicas
    const sucursales = sucursalesRecords.map(s => s.nombre)
    const anos = Array.from(new Set(groupedAnosMeses.map((c: any) => c.ano as number))) as number[]
    const meses = Array.from(new Set(groupedAnosMeses.map((c: any) => c.mes as number))).sort((a, b) => a - b)
    const instituciones = groupedInstituciones.map((i: any) => i.institucion).filter(Boolean)
    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    const buildQueryString = (params: any) => {
        const urlParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                urlParams.append(key, String(value))
            }
        })
        return urlParams.toString()
    }

    const currentParams = {
        sucursal: filters.sucursal,
        ano: filters.ano,
        mes: filters.mes,
        institucion: filters.institucion,
        sort,
        order
    }

    const getSortLink = (field: string) => {
        const newOrder = sort === field && order === 'asc' ? 'desc' : 'asc'
        const params = { ...currentParams, sort: field, order: newOrder, page: 1 }
        return `/dashboard/mantenedor/operaciones/pmpa?${buildQueryString(params)}`
    }

    const SortIcon = ({ field }: { field: string }) => {
        if (sort !== field) return <span className="ml-1 opacity-20">↕</span>
        return <span className="ml-1 text-cyan-600">{order === 'asc' ? '↑' : '↓'}</span>
    }

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institución</label>
                    <select
                        name="institucion"
                        defaultValue={filters.institucion}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 appearance-none"
                    >
                        <option value="">Todas</option>
                        {instituciones.map((i: string) => <option key={i} value={i}>{i}</option>)}
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
                        {meses.map((m: number) => (
                            <option key={m} value={m}>
                                {MONTH_NAMES[m - 1] || m}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-end gap-2">
                    <button type="submit" className="px-6 py-2.5 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-medium transition-colors w-full sm:w-auto flex items-center justify-center gap-2">
                        🔍 Filtrar
                    </button>
                    
                    <DeleteButtonPMPA 
                        ano={filters.ano} 
                        mes={filters.mes} 
                        sucursal={filters.sucursal} 
                    />

                    {/* Botón para limpiar filtros */}
                    <a href="/dashboard/mantenedor/operaciones/pmpa" className="px-6 py-2.5 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 shadow-sm border border-slate-200 font-medium transition-colors w-full sm:w-auto flex items-center justify-center">
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
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('sucursal')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Sucursal <SortIcon field="sucursal" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('ano')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Año <SortIcon field="ano" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('mes')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Mes <SortIcon field="mes" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('institucion')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Institución <SortIcon field="institucion" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('rbd')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        RBD <SortIcon field="rbd" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('programa')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Programa <SortIcon field="programa" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('estrato')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Estrato <SortIcon field="estrato" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('raceqJunaeb')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Raceq <SortIcon field="raceqJunaeb" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold">
                                    <Link href={getSortLink('servicio')} className="flex items-center hover:text-cyan-600 transition-colors">
                                        Servicio <SortIcon field="servicio" />
                                    </Link>
                                </th>
                                <th className="px-6 py-4 font-semibold border-l border-gray-200 bg-cyan-50 text-cyan-800">Cargado Por</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {pmpaData.map((d: any) => (
                                <tr key={d.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900">{d.ut?.sucursal?.nombre || 'S/D'}</td>
                                    <td className="px-6 py-3">{d.ano}</td>
                                    <td className="px-6 py-3">{MONTH_NAMES[d.mes - 1] || d.mes}</td>
                                    <td className="px-6 py-3 font-semibold text-sky-700">{d.institucion || 'S/D'}</td>
                                    <td className="px-6 py-3">{d.rbd}</td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                            {d.programa}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">{d.estrato}</td>
                                    <td className="px-6 py-3">{d.raceqJunaeb}</td>
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
                            href={`/dashboard/mantenedor/operaciones/pmpa?${buildQueryString({ ...currentParams, page: 1 })}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Primera página"
                        >
                            &laquo;
                        </Link>

                        <Link
                            href={`/dashboard/mantenedor/operaciones/pmpa?${buildQueryString({ ...currentParams, page: currentPage - 1 })}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página anterior"
                        >
                            &lsaquo;
                        </Link>

                        <span className="text-sm font-semibold text-gray-700 px-3 bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                            {currentPage} / {totalPages || 1}
                        </span>

                        <Link
                            href={`/dashboard/mantenedor/operaciones/pmpa?${buildQueryString({ ...currentParams, page: currentPage + 1 })}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página siguiente"
                        >
                            &rsaquo;
                        </Link>

                        <Link
                            href={`/dashboard/mantenedor/operaciones/pmpa?${buildQueryString({ ...currentParams, page: totalPages })}`}
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
