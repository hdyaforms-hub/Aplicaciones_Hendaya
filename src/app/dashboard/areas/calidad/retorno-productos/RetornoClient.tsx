'use client'

import { useState } from 'react'
import CrearAlertaForm from './CrearAlertaForm'
import MovimientoSucursalForm from './MovimientoSucursalForm'
import { eliminarAlertaEnCascada } from './actions'
import { useRouter } from 'next/navigation'

export default function RetornoClient({ alertas, user }: { alertas: any[], user: any }) {
    const [crearModalOpen, setCrearModalOpen] = useState(false)
    const [selectedAlerta, setSelectedAlerta] = useState<any | null>(null)
    const [filter, setFilter] = useState<'TODAS' | 'ABIERTA' | 'CERRADA'>('ABIERTA')
    const [deletingAlerta, setDeletingAlerta] = useState<any | null>(null)
    const [deleteMotivo, setDeleteMotivo] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const userAreas = user.areas || []
    const isCalidad = userAreas.some((a: any) => a.nombre.toUpperCase() === 'CALIDAD')
    const canCreate = isCalidad

    // Sort: Newest to oldest
    const sortedAlertas = [...alertas].sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())

    // Filter
    const filteredAlertas = sortedAlertas.filter(a => {
        if (filter === 'TODAS') return true
        return a.estado === filter
    })

    const colorMaps: Record<string, string> = {
        'yellow': 'bg-yellow-200 border-yellow-300',
        'pink': 'bg-pink-200 border-pink-300',
        'cyan': 'bg-cyan-200 border-cyan-300',
        'green': 'bg-green-200 border-green-300',
        'purple': 'bg-purple-200 border-purple-300'
    }

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!deletingAlerta || user.role.name !== 'Administrador') return

        setIsDeleting(true)
        const res = await eliminarAlertaEnCascada(deletingAlerta.id, deleteMotivo, user.username, user.role.name)
        setIsDeleting(false)

        if (res.error) {
            alert('Error: ' + res.error)
        } else {
            setDeletingAlerta(null)
            setDeleteMotivo('')
            router.refresh()
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <span className="text-sm font-bold text-gray-500 ml-2">Filtrar por:</span>
                    <div className="flex gap-1">
                        {(['TODAS', 'ABIERTA', 'CERRADA'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            >
                                {f === 'TODAS' ? 'Ver Todas' : f === 'ABIERTA' ? 'Abiertas' : 'Finalizadas'}
                            </button>
                        ))}
                    </div>
                </div>

                {canCreate && (
                    <button 
                        onClick={() => setCrearModalOpen(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                        + Crear Nueva Alerta
                    </button>
                )}
            </div>

            {/* Corkboard Background */}
            <div className="bg-[#cd9a5b] p-8 rounded-3xl shadow-[inset_0_10px_20px_rgba(0,0,0,0.3)] min-h-[600px] relative mt-8 border-[12px] border-[#8b5a2b]">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] opacity-30 pointer-events-none rounded-xl mix-blend-multiply"></div>
                
                {filteredAlertas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#5c3a21] font-bold text-xl opacity-50 relative z-10 min-h-[400px]">
                        <span className="text-6xl mb-4">📌</span>
                        No hay alertas {filter !== 'TODAS' ? filter.toLowerCase() + 's' : ''} registradas.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 relative z-10">
                        {filteredAlertas.map((alerta: any, index: number) => {
                            const colorClass = colorMaps[alerta.color || 'yellow'] || colorMaps['yellow']
                            const rotation = index % 2 === 0 ? '-rotate-2' : 'rotate-2'
                            const validSucursales = alerta.sucursalesEstado.filter((s:any) => s.sucursal?.nombre !== 'CASA MATRIZ')
                            const cerradasCount = validSucursales.filter((s:any)=>s.estado === 'FINALIZADO').length
                            const totalCount = validSucursales.length
                            const progress = totalCount > 0 ? Math.round((cerradasCount/totalCount)*100) : 0

                            return (
                                <div 
                                    key={alerta.id}
                                    onClick={() => setSelectedAlerta(alerta)}
                                    className={`
                                        ${colorClass} ${rotation} relative p-6 rounded-sm shadow-[3px_5px_15px_rgba(0,0,0,0.3)] 
                                        transition-all duration-300 hover:z-20 hover:scale-105 hover:-rotate-1 hover:shadow-[5px_8px_20px_rgba(0,0,0,0.4)] cursor-pointer group flex flex-col min-h-[250px]
                                    `}
                                >
                                    {/* Post-it pin/tape */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-4 bg-white/40 backdrop-blur-sm shadow-sm rotate-2"></div>
                                    
                                    {/* Badges de Tipo de Bloqueo y Alcance */}
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2 relative z-10">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm border ${
                                            alerta.tipoBloqueo === 'Permanente'
                                                ? 'bg-red-600 text-white border-red-700'
                                                : 'bg-amber-400 text-amber-950 border-amber-500'
                                        }`}>
                                            {alerta.tipoBloqueo === 'Permanente' ? '🔴 Permanente' : '🟡 Preventivo'}
                                        </span>
                                        {alerta.alcance && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 text-gray-800 border border-black/10">
                                                {alerta.alcance === 'A Hendaya' ? '🏢 A Hendaya' : '🌐 Otras Emp.'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-extrabold text-gray-900 text-base leading-tight uppercase relative z-10 w-full overflow-hidden text-ellipsis whitespace-nowrap" title={alerta.titulo}>
                                            {alerta.titulo}
                                        </h3>
                                        {user.role.name === 'Administrador' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setDeletingAlerta(alerta) }}
                                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:scale-110 transition-all font-bold p-1 bg-white/50 backdrop-blur-sm rounded-md shadow-sm z-30"
                                                title="Eliminar Alerta en Cascada"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>

                                    {/* Bloque de Información del Producto */}
                                    <div className="bg-white/50 rounded-lg p-2.5 mb-2.5 border border-black/10 text-xs space-y-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-bold text-gray-900 truncate">
                                                📦 {alerta.nombreProducto || 'Producto no especificado'}
                                            </span>
                                        </div>
                                        {alerta.marcaProducto && (
                                            <div className="text-gray-700 truncate">
                                                <span className="font-semibold text-gray-800">Marca:</span> {alerta.marcaProducto}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-700">
                                            {alerta.lote && (
                                                <span className="bg-black/5 px-1.5 py-0.5 rounded font-mono font-bold">
                                                    Lote: {alerta.lote}
                                                </span>
                                            )}
                                            {(alerta.fechaElaboracion || alerta.fechaVencimiento) && (
                                                <span className="text-[10px] text-gray-600">
                                                    {alerta.fechaVencimiento ? `Vence: ${alerta.fechaVencimiento}` : `Elab: ${alerta.fechaElaboracion}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <p className="text-gray-800 text-xs mb-3 flex-1 break-words overflow-hidden italic" 
                                       style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'}}>
                                        "{alerta.observacion}"
                                    </p>

                                    <div className="mt-auto space-y-3">
                                        {/* Progress Bar */}
                                        <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-black/40 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                        </div>
                                        
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs font-medium text-gray-600">
                                                Avance: {cerradasCount} / {totalCount}
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${alerta.estado === 'CERRADA' ? 'bg-green-500/20 text-green-800' : 'bg-amber-500/20 text-amber-800'}`}>
                                                {alerta.estado}
                                            </div>
                                        </div>
                                        <div className="text-center mt-2 border-t border-black/10 pt-2">
                                            <span className="text-xs text-gray-800 font-bold tracking-wide">
                                                🗓️ Creado: {new Date(alerta.fechaCreacion).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            {crearModalOpen && (
                <CrearAlertaForm onClose={() => setCrearModalOpen(false)} user={user} />
            )}

            {selectedAlerta && (
                <MovimientoSucursalForm alerta={selectedAlerta} onClose={() => setSelectedAlerta(null)} user={user} />
            )}

            {deletingAlerta && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-red-500 p-6 text-white flex justify-between items-center relative overflow-hidden">
                            <h2 className="text-xl font-bold relative z-10 flex items-center gap-2">
                                <span>⚠️</span> Eliminar Alerta (Solo Admin)
                            </h2>
                            <button onClick={() => { setDeletingAlerta(null); setDeleteMotivo('') }} className="text-white/80 hover:text-white relative z-10 text-xl font-bold p-2">✕</button>
                        </div>
                        
                        <form onSubmit={handleDelete} className="p-6 space-y-4">
                            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm mb-4 border border-red-200">
                                <strong>¡Peligro!</strong> Estás a punto de borrar permanentemente la alerta <strong>"{deletingAlerta.titulo}"</strong>. Esto eliminará en cascada todos los movimientos y estados de sucursales asociados. Quedará un registro en el historial de borrado.
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo de la eliminación (Obligatorio)</label>
                                <textarea 
                                    className="w-full px-4 py-3 rounded-xl border border-red-200 focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[100px] resize-none"
                                    placeholder="Justifique el motivo de la eliminación de este registro..."
                                    value={deleteMotivo}
                                    onChange={(e) => setDeleteMotivo(e.target.value)}
                                    required
                                    minLength={5}
                                />
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button 
                                    type="button" 
                                    onClick={() => { setDeletingAlerta(null); setDeleteMotivo('') }}
                                    className="px-6 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isDeleting || deleteMotivo.trim().length < 5}
                                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-all disabled:opacity-50"
                                >
                                    {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
