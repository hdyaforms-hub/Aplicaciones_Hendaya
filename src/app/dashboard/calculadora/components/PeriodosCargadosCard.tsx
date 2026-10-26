import React from 'react'

export type PeriodoCargado = {
    anio: number
    mes: number
    mesNombre: string
    count: number
}

interface PeriodosCargadosCardProps {
    tituloModulo: string
    tipoDato: string // ej: "minutas" o "raciones"
    periodos: PeriodoCargado[]
    filtroActual?: {
        anio?: string
        mes?: string
    }
    baseUrl: string
}

export const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function PeriodosCargadosCard({
    tituloModulo,
    tipoDato,
    periodos,
    filtroActual,
    baseUrl
}: PeriodosCargadosCardProps) {
    const totalRegistros = periodos.reduce((acc, curr) => acc + curr.count, 0)
    const isFiltered = Boolean(filtroActual?.anio || filtroActual?.mes)

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md shadow-cyan-500/20">
                    📅
                </div>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                            Períodos Cargados ({tituloModulo})
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
                            {periodos.length} {periodos.length === 1 ? 'Mes cargado' : 'Meses cargados'}
                        </span>
                        <span className="text-[11px] font-bold text-gray-400">
                            • {totalRegistros.toLocaleString('es-CL')} {tipoDato} registradas
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                        Años y meses con datos activos en el sistema. Haz clic en un período para filtrar la tabla rápidamente.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {periodos.length === 0 ? (
                    <div className="px-3.5 py-2 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs font-semibold flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>No hay períodos cargados aún</span>
                    </div>
                ) : (
                    periodos.map((p) => {
                        const isSelected = String(filtroActual?.anio) === String(p.anio) && String(filtroActual?.mes) === String(p.mes)
                        return (
                            <a
                                key={`${p.anio}-${p.mes}`}
                                href={`${baseUrl}?anio=${p.anio}&mes=${p.mes}`}
                                title={`Filtrar por ${p.mesNombre} ${p.anio} (${p.count.toLocaleString('es-CL')} ${tipoDato})`}
                                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs border ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white border-cyan-700 shadow-md shadow-cyan-600/25 ring-2 ring-cyan-400/40'
                                        : 'bg-gray-50 hover:bg-cyan-50 text-gray-800 hover:text-cyan-900 border-gray-200 hover:border-cyan-300'
                                }`}
                            >
                                <span className={isSelected ? 'text-white' : 'text-cyan-600'}>🗓️</span>
                                <span>{p.mesNombre} {p.anio}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-black ${
                                    isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-white text-gray-600 border border-gray-200'
                                }`}>
                                    {p.count.toLocaleString('es-CL')}
                                </span>
                            </a>
                        )
                    })
                )}

                {isFiltered && (
                    <a
                        href={baseUrl}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl border border-rose-200 transition-colors"
                        title="Ver todos los períodos sin filtro de mes/año"
                    >
                        <span>✕</span>
                        <span>Ver todos</span>
                    </a>
                )}
            </div>
        </div>
    )
}
