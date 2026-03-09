import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UploadModalColegio from './UploadModalColegio'

export default async function ColegiosPage({
    searchParams
}: {
    searchParams: Promise<{ nombre?: string, rbd?: string, page?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_colegios')) {
        redirect('/dashboard')
    }

    const resolvedParams = await searchParams
    const rbdParam = resolvedParams.rbd
    const filters = {
        nombre: resolvedParams.nombre || '',
        rbd: rbdParam && !isNaN(Number(rbdParam)) ? Number(rbdParam) : undefined,
    }

    // Limpiar query where nulos
    const whereClause: any = {}
    if (filters.nombre) {
        whereClause.nombreEstablecimiento = { contains: filters.nombre } // case insensitive search needs mode: insensitive but sqlite doesn't support it natively in quite this way. We will use simple contains.
    }
    if (filters.rbd !== undefined) whereClause.colRBD = filters.rbd

    const dbUser = await (prisma.user as any).findUnique({
        where: { id: session?.user?.id as string },
        include: { sucursales: true }
    })
    const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

    const uts = await prisma.uT.findMany({
        where: {
            sucursal: {
                nombre: { in: userSucursales }
            }
        },
        select: { codUT: true }
    })
    const allowedUTs = uts.map(ut => ut.codUT)
    whereClause.colut = { in: allowedUTs }

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 10

    const totalCount = await prisma.colegios.count({ where: whereClause })
    const totalPages = Math.ceil(totalCount / limit)

    // Obtener los datos filtrados
    const colegiosData = await prisma.colegios.findMany({
        where: whereClause,
        skip: (currentPage - 1) * limit,
        take: limit,
        orderBy: [
            { nombreEstablecimiento: 'asc' }
        ]
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🏫</span> Mantenedor de Colegios
                    </h2>
                    <p className="text-gray-500 mt-1">Gestión y listado de instituciones registradas</p>
                </div>

                <UploadModalColegio />
            </div>

            {/* Panel de Filtros */}
            <form className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Colegio</label>
                    <input
                        name="nombre"
                        type="text"
                        defaultValue={filters.nombre}
                        placeholder="Ej: Colegio San José..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">RBD</label>
                    <input
                        name="rbd"
                        type="number"
                        defaultValue={resolvedParams.rbd || ''}
                        placeholder="Ej: 8532..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>

                <div className="flex items-end">
                    <button type="submit" className="px-6 py-2.5 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-medium transition-colors w-full sm:w-auto flex items-center justify-center gap-2">
                        🔍 Filtrar
                    </button>
                    {/* Botón para limpiar filtros */}
                    <a href="/dashboard/colegios" className="ml-2 px-6 py-2.5 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 shadow-sm border border-slate-200 font-medium transition-colors w-full sm:w-auto flex items-center justify-center">
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
                                <th className="px-6 py-4 font-semibold">RBD</th>
                                <th className="px-6 py-4 font-semibold">RBD-DV</th>
                                <th className="px-6 py-4 font-semibold">UT</th>
                                <th className="px-6 py-4 font-semibold">Institución</th>
                                <th className="px-6 py-4 font-semibold">Sucursal</th>
                                <th className="px-6 py-4 font-semibold min-w-[200px]">Nombre Establecimiento</th>
                                <th className="px-6 py-4 font-semibold min-w-[200px]">Dirección</th>
                                <th className="px-6 py-4 font-semibold">Comuna</th>
                                <th className="px-6 py-4 font-semibold border-l border-gray-200 bg-cyan-50 text-cyan-800">Cargado Por</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {colegiosData.map((d: any) => (
                                <tr key={d.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-6 py-3 font-bold text-gray-900 bg-gray-50/50">
                                        <Link href={`/dashboard/colegios/${d.id}`} className="text-cyan-700 hover:text-cyan-900 hover:underline flex items-center gap-1 group">
                                            {d.colRBD} <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-3">{d.colRBDDV}</td>
                                    <td className="px-6 py-3">{d.colut}</td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                            {d.institucion}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 max-w-[150px] truncate" title={d.sucursal}>{d.sucursal}</td>
                                    <td className="px-6 py-3 max-w-[250px] truncate font-medium text-cyan-700" title={d.nombreEstablecimiento}>{d.nombreEstablecimiento}</td>
                                    <td className="px-6 py-3 max-w-[250px] truncate text-gray-500" title={d.direccionEstablecimiento}>{d.direccionEstablecimiento}</td>
                                    <td className="px-6 py-3">{d.comuna}</td>
                                    <td className="px-6 py-3 border-l border-gray-100 border-dashed text-xs text-gray-500">
                                        {d.uploadedBy}
                                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(d.createdAt).toLocaleDateString()}</div>
                                    </td>
                                </tr>
                            ))}

                            {colegiosData.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center h-48">
                                        <span className="text-4xl block mb-3 text-slate-300">🏫</span>
                                        <p className="text-slate-500 font-medium">No se encontraron colegios.</p>
                                        <p className="text-slate-400 text-sm mt-1">Ajusta los filtros o realiza una carga masiva.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {colegiosData.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-2">
                    <div className="text-xs text-gray-500 font-medium">
                        Mostrando registros {((currentPage - 1) * limit) + 1} al {Math.min(currentPage * limit, totalCount)} de un total de {totalCount}.
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Link
                            href={`/dashboard/colegios?nombre=${filters.nombre}&rbd=${filters.rbd || ''}&page=1`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Primera página"
                        >
                            &laquo;
                        </Link>

                        <Link
                            href={`/dashboard/colegios?nombre=${filters.nombre}&rbd=${filters.rbd || ''}&page=${currentPage - 1}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página anterior"
                        >
                            &lsaquo;
                        </Link>

                        <span className="text-sm font-semibold text-gray-700 px-3 bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                            {currentPage} / {totalPages || 1}
                        </span>

                        <Link
                            href={`/dashboard/colegios?nombre=${filters.nombre}&rbd=${filters.rbd || ''}&page=${currentPage + 1}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página siguiente"
                        >
                            &rsaquo;
                        </Link>

                        <Link
                            href={`/dashboard/colegios?nombre=${filters.nombre}&rbd=${filters.rbd || ''}&page=${totalPages}`}
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
