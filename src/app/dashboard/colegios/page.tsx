import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UploadModalColegio from './UploadModalColegio'
import ColegiosFilterForm from './ColegiosFilterForm'

export default async function ColegiosPage({
    searchParams
}: {
    searchParams: Promise<{ rbd?: string, sucursal?: string, ut?: string, page?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_colegios')) {
        redirect('/dashboard')
    }

    const resolvedParams = await searchParams
    const filters = {
        rbd: resolvedParams.rbd && !isNaN(Number(resolvedParams.rbd)) ? Number(resolvedParams.rbd) : undefined,
        sucursal: resolvedParams.sucursal || '',
        ut: resolvedParams.ut && !isNaN(Number(resolvedParams.ut)) ? Number(resolvedParams.ut) : undefined,
    }

    // Limpiar query where
    const whereClause: any = {}
    if (filters.rbd !== undefined) whereClause.colRBD = filters.rbd
    if (filters.sucursal) whereClause.sucursal = { contains: filters.sucursal }
    if (filters.ut !== undefined) whereClause.colut = filters.ut

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
    
    // Si el usuario ya filtró por una UT específica, verificamos que esté en sus permitidas (opcional, por seguridad)
    if (filters.ut !== undefined) {
        if (!allowedUTs.includes(filters.ut)) {
            // Si intenta ver una UT que no le corresponde, forzamos vacío o error
            // whereClause.colut = -1 
        }
    } else {
        whereClause.colut = { in: allowedUTs }
    }

    // Obtener listas para los dropdowns
    // Nota: Usamos las sucursales permitidas para el usuario para filtrar los dropdowns también si se prefiere, 
    // pero aquí mostraremos todas las que existen en los colegios permitidos por seguridad.
    // Obtener listas para los dropdowns con lógica de CASCADA
    const sucursalesDropdown = await prisma.colegios.findMany({
        where: { colut: { in: allowedUTs } },
        select: { sucursal: true },
        distinct: ['sucursal'],
        orderBy: { sucursal: 'asc' }
    }).then(rows => rows.map(r => r.sucursal))

    const utsDropdown = await prisma.colegios.findMany({
        where: { 
            colut: { in: allowedUTs },
            sucursal: filters.sucursal || undefined
        },
        select: { colut: true },
        distinct: ['colut'],
        orderBy: { colut: 'asc' }
    }).then(rows => rows.map(r => r.colut))

    const rbdsDropdown = await prisma.colegios.findMany({
        where: { 
            colut: filters.ut !== undefined ? filters.ut : { in: allowedUTs },
            sucursal: filters.sucursal || undefined
        },
        select: { colRBD: true, nombreEstablecimiento: true },
        distinct: ['colRBD'],
        orderBy: { nombreEstablecimiento: 'asc' }
    })

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 15

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

    // Helper para mantener filtros en la paginación
    const getPageUrl = (p: number) => {
        const params = new URLSearchParams()
        if (filters.rbd !== undefined) params.set('rbd', filters.rbd.toString())
        if (filters.sucursal) params.set('sucursal', filters.sucursal)
        if (filters.ut !== undefined) params.set('ut', filters.ut.toString())
        params.set('page', p.toString())
        return `/dashboard/colegios?${params.toString()}`
    }

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

            {/* Panel de Filtros con Cascada Live */}
            <ColegiosFilterForm 
                filters={{ ...filters, rbd: resolvedParams.rbd || '' }} 
                sucursales={sucursalesDropdown}
                uts={utsDropdown}
                rbds={rbdsDropdown}
            />

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
                            href={getPageUrl(1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Primera página"
                        >
                            &laquo;
                        </Link>

                        <Link
                            href={getPageUrl(currentPage - 1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página anterior"
                        >
                            &lsaquo;
                        </Link>

                        <span className="text-sm font-semibold text-gray-700 px-3 bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                            {currentPage} / {totalPages || 1}
                        </span>

                        <Link
                            href={getPageUrl(currentPage + 1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-bold shadow-sm ${currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                            aria-label="Página siguiente"
                        >
                            &rsaquo;
                        </Link>

                        <Link
                            href={getPageUrl(totalPages)}
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
