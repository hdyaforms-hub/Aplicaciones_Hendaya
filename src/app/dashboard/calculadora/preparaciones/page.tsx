import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import UploadModalPreparaciones from './UploadModalPreparaciones'
import PreparacionesSearch from './PreparacionesSearch'

export default async function PreparacionesPage({
    searchParams
}: {
    searchParams: Promise<{ nombre?: string, codigo?: string, page?: string }>
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_preparaciones')) {
        redirect('/dashboard')
    }

    const resolvedParams = await searchParams
    const filters = {
        nombre: resolvedParams.nombre || '',
        codigo: resolvedParams.codigo || '',
    }

    const whereClause: any = {}
    if (filters.nombre) {
        const isNum = !isNaN(Number(filters.nombre)) && filters.nombre.trim() !== ''
        whereClause.OR = [
            { nombrePreparacion: { contains: filters.nombre, mode: 'insensitive' } },
            ...(isNum ? [{ numeroPreparacion: parseInt(filters.nombre) }] : [])
        ]
    }
    if (filters.codigo) {
        whereClause.licitacion = { contains: filters.codigo, mode: 'insensitive' }
    }

    const pageStr = resolvedParams.page
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1
    const limit = 15

    // Contar grupos únicos para la paginación
    const allGroups = await prisma.preparaciones.groupBy({
        by: ['licitacion', 'numeroPreparacion'],
        where: whereClause
    })
    const totalCount = allGroups.length
    const totalPages = Math.ceil(totalCount / limit)

    const preparacionesGrouped = await prisma.preparaciones.groupBy({
        by: ['licitacion', 'numeroPreparacion', 'nombrePreparacion', 'numeroPrograma', 'programa', 'numeroCocina', 'cocina'],
        where: whereClause,
        orderBy: [
            { numeroPreparacion: 'desc' }
        ],
        skip: (currentPage - 1) * limit,
        take: limit,
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="text-3xl">🍳</span> Mantenedor de Preparaciones
                    </h2>
                    <p className="text-gray-500 font-bold text-sm ml-1">Gestión avanzada de recetas y productos</p>
                </div>

                <UploadModalPreparaciones />
            </div>

            {/* Búsqueda Inteligente (Client Component) */}
            <PreparacionesSearch 
                initialNombre={filters.nombre} 
                initialLicitacion={filters.codigo} 
            />

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    <table className="w-full text-left text-sm whitespace-nowrap relative">
                        <thead className="bg-slate-50 text-slate-500 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Licitación</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">N° Prep.</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Nombre Preparación</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Programa</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Cocina</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                            {preparacionesGrouped.map((p: any) => (
                                <tr key={`${p.licitacion}-${p.numeroPreparacion}`} className="hover:bg-cyan-50/40 transition-colors group">
                                    <td className="px-6 py-4 font-black text-gray-900 text-xs">{p.licitacion}</td>
                                    <td className="px-6 py-4">
                                        <a 
                                            href={`/dashboard/calculadora/preparaciones/detalle?licitacion=${p.licitacion}&numero=${p.numeroPreparacion}`}
                                            className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-700 font-black text-xs hover:bg-cyan-600 hover:text-white transition-all shadow-sm border border-cyan-100"
                                        >
                                            #{p.numeroPreparacion}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 font-black text-gray-800 text-sm">{p.nombrePreparacion}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-indigo-700 text-[10px] uppercase tracking-tighter">Prog: {p.numeroPrograma}</span>
                                            <span className="text-xs font-bold text-gray-500 truncate max-w-[180px]">{p.programa}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-emerald-700 text-[10px] uppercase tracking-tighter">Cocina: {p.numeroCocina}</span>
                                            <span className="text-xs font-bold text-gray-500 truncate max-w-[180px]">{p.cocina}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <a 
                                            href={`/dashboard/calculadora/preparaciones/detalle?licitacion=${p.licitacion}&numero=${p.numeroPreparacion}`}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group-hover:scale-105 active:scale-95"
                                        >
                                            ✏️ Gestionar Productos
                                        </a>
                                    </td>
                                </tr>
                            ))}

                            {preparacionesGrouped.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-6xl mb-6 grayscale animate-pulse">🔎</span>
                                            <p className="text-slate-400 font-black text-xl tracking-tight">No se encontraron resultados</p>
                                            <p className="text-slate-300 text-sm mt-2 font-bold">Intenta ajustar tu búsqueda "inteligente" o carga nuevos datos.</p>
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
                            Mostrando <span className="text-slate-900">{preparacionesGrouped.length}</span> de <span className="text-slate-900">{totalCount}</span> recetas
                        </p>
                        <div className="flex gap-3">
                            <a
                                href={`?page=${currentPage - 1}&nombre=${filters.nombre}&codigo=${filters.codigo}`}
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
                                href={`?page=${currentPage + 1}&nombre=${filters.nombre}&codigo=${filters.codigo}`}
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
