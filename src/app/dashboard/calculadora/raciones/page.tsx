import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import UploadModalRaciones from './UploadModalRaciones'
import RacionesSearch from './RacionesSearch'
import EditCantidadModal from './EditCantidadModal'

export default async function RacionesPage({
    searchParams
}: {
    searchParams: Promise<{ licitacion?: string, page?: string, rbd?: string, ut?: string, mes?: string, anio?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_raciones')) {
        redirect('/dashboard')
    }

    const resolvedParams = await searchParams
    const filters = {
        licitacion: resolvedParams.licitacion || '',
        rbd: resolvedParams.rbd || '',
        ut: resolvedParams.ut || '',
        mes: resolvedParams.mes || '',
        anio: resolvedParams.anio || '',
    }

    const whereClause: any = {}
    if (filters.licitacion) {
        whereClause.licitacion = { contains: filters.licitacion, mode: 'insensitive' }
    }

    if (filters.rbd) {
        const isNum = !isNaN(Number(filters.rbd)) && filters.rbd.trim() !== ''
        if (isNum) {
            whereClause.rbd = Number(filters.rbd)
        } else {
            const matchingColegios = await prisma.colegios.findMany({
                where: { nombreEstablecimiento: { contains: filters.rbd, mode: 'insensitive' } },
                select: { colRBD: true }
            })
            const matchingRBDs = matchingColegios.map(c => c.colRBD)
            whereClause.rbd = { in: matchingRBDs }
        }
    }

    if (filters.ut) {
        const isNum = !isNaN(Number(filters.ut)) && filters.ut.trim() !== ''
        if (isNum) {
            whereClause.ut = Number(filters.ut)
        }
    }

    if (filters.mes) {
        const isNum = !isNaN(Number(filters.mes)) && filters.mes.trim() !== ''
        if (isNum) {
            whereClause.mes = Number(filters.mes)
        }
    }

    if (filters.anio) {
        const isNum = !isNaN(Number(filters.anio)) && filters.anio.trim() !== ''
        if (isNum) {
            whereClause.anio = Number(filters.anio)
        }
    }

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 20

    const totalCount = await prisma.raciones.count({
        where: whereClause
    })
    const totalPages = Math.ceil(totalCount / limit)

    const raciones = await prisma.raciones.findMany({
        where: whereClause,
        orderBy: [
            { createdAt: 'desc' }
        ],
        skip: (currentPage - 1) * limit,
        take: limit,
    })

    // Map RBDs to School Names
    const rbdList = Array.from(new Set(raciones.map(r => r.rbd)))
    const colegios = await prisma.colegios.findMany({
        where: { colRBD: { in: rbdList } }
    })
    const rbdNameMap = colegios.reduce((acc, curr) => {
        acc[curr.colRBD] = curr.nombreEstablecimiento
        return acc
    }, {} as Record<number, string>)

    // Map UTs to UT Names
    const utList = Array.from(new Set(raciones.map(r => r.ut)))
    const uts = await prisma.uT.findMany({
        where: { codUT: { in: utList } },
        include: { sucursal: true }
    })
    const utNameMap = uts.reduce((acc, curr) => {
        acc[curr.codUT] = curr.sucursal?.nombre || `UT ${curr.codUT}`
        return acc
    }, {} as Record<number, string>)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="text-3xl">🍽️</span> Mantenedor de Raciones
                    </h2>
                    <p className="text-gray-500 font-bold text-sm ml-1">Gestión de raciones y servicios</p>
                </div>

                <UploadModalRaciones />
            </div>

            <RacionesSearch 
                initialLicitacion={filters.licitacion} 
                initialRbd={filters.rbd}
                initialUt={filters.ut}
                initialMes={filters.mes}
                initialAnio={filters.anio}
            />

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    <table className="w-full text-left text-sm whitespace-nowrap relative">
                        <thead className="bg-slate-50 text-slate-500 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Licitación</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Servicio</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">RBD / Colegio</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">UT</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Programa</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Cocina / Área</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Mes / Año</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                            {raciones.map((r: any) => (
                                <tr key={r.id} className="hover:bg-teal-50/40 transition-colors group">
                                    <td className="px-6 py-4 font-black text-gray-900 text-xs">{r.licitacion}</td>
                                    <td className="px-6 py-4 font-black text-gray-800 text-sm truncate max-w-[150px]">{r.servicio}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-blue-700 text-[10px] uppercase tracking-tighter">RBD: {r.rbd}</span>
                                            <span className="text-xs font-bold text-gray-500 truncate max-w-[150px]">{rbdNameMap[r.rbd] || 'Colegio no encontrado'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-purple-700 text-[10px] uppercase tracking-tighter">UT: {r.ut}</span>
                                            <span className="text-xs font-bold text-gray-500 truncate max-w-[120px]">{utNameMap[r.ut] || 'UT no encontrada'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-indigo-700 text-[10px] uppercase tracking-tighter">Prog: {r.numeroPrograma}</span>
                                            <span className="text-xs font-bold text-gray-500 truncate max-w-[150px]">{r.programa}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-emerald-700 text-[10px] uppercase tracking-tighter">Cocina: {r.numeroCocina}</span>
                                            <span className="font-black text-amber-700 text-[10px] uppercase tracking-tighter">Área: {r.numeroArea}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-700">{r.mes} / {r.anio}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <EditCantidadModal 
                                            racionId={r.id} 
                                            initialCantidad={r.cantidad} 
                                        />
                                    </td>
                                </tr>
                            ))}

                            {raciones.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-6xl mb-6 grayscale animate-pulse">🔎</span>
                                            <p className="text-slate-400 font-black text-xl tracking-tight">No se encontraron resultados</p>
                                            <p className="text-slate-300 text-sm mt-2 font-bold">Intenta ajustar tu búsqueda o carga nuevos datos.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="px-8 py-5 bg-slate-50/50 border-t border-gray-100 flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Mostrando <span className="text-slate-900">{raciones.length}</span> de <span className="text-slate-900">{totalCount}</span> raciones
                        </p>
                        <div className="flex gap-3">
                            <a
                                href={`?page=${currentPage - 1}&licitacion=${filters.licitacion}&rbd=${filters.rbd}&ut=${filters.ut}&mes=${filters.mes}&anio=${filters.anio}`}
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
                                href={`?page=${currentPage + 1}&licitacion=${filters.licitacion}&rbd=${filters.rbd}&ut=${filters.ut}&mes=${filters.mes}&anio=${filters.anio}`}
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
