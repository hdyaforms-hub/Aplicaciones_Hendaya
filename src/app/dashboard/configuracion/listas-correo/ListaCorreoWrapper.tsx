'use client'

import { useState } from 'react'
import { deleteListaCorreo } from './actions'
import ListaCorreoForm from './ListaCorreoForm'
import { useRouter } from 'next/navigation'

type ListaRecord = {
    id: string;
    nombre: string;
    descripcion: string | null;
    para: string;
    cc: string | null;
    sucursalId?: string | null;
    sucursal?: { id: string; nombre: string } | null;
    updatedAt: Date;
}

export default function ListaCorreoWrapper({ listas, sucursales }: { listas: ListaRecord[], sucursales: {id: string, nombre: string}[] }) {
    const router = useRouter()
    const [selectedLista, setSelectedLista] = useState<ListaRecord | undefined>(undefined)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleOpenCreate = () => {
        setSelectedLista(undefined)
        setIsFormOpen(true)
    }

    const handleOpenEdit = (lista: ListaRecord) => {
        setSelectedLista(lista)
        setIsFormOpen(true)
    }

    const handleClose = () => {
        setIsFormOpen(false)
        setSelectedLista(undefined)
        router.refresh()
    }

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro que deseas ELIMINAR la lista de distribución "${nombre}"?`)) return;

        setDeletingId(id)
        await deleteListaCorreo(id)
        setDeletingId(null)
        router.refresh()
    }

    // Helper para mostrar cuantos correos hay en un string JSON
    const countEmails = (jsonString: string | null) => {
        if (!jsonString) return 0;
        try {
            const arr = JSON.parse(jsonString);
            return Array.isArray(arr) ? arr.length : 0;
        } catch {
            return 0;
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>👥</span> Listas de Distribución
                    </h2>
                    <p className="text-gray-500 mt-1">Crea listas con múltiples correos para notificar de manera automática de forma ágil desde otros módulos. Puedes asociarlas a una Sucursal para identificar el destino de las notificaciones.</p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleOpenCreate}
                        className="w-full sm:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-xl transition-all shadow-md shadow-cyan-600/20 active:scale-95 flex justify-center items-center gap-2"
                    >
                        <span>➕</span> Nueva Lista
                    </button>
                    <button onClick={() => router.refresh()} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-all active:scale-95 flex items-center gap-2">
                        🔄
                    </button>
                </div>
            </div>

            {listas.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-2xl py-16 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-5xl opacity-80 mb-4 block">📭</span>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No hay listas creadas</h3>
                    <p className="text-gray-500 max-w-sm mb-6">Agrega listas como "Logística" o "Abastecimiento" para tener tus destinatarios precargados y enviar información en un solo paso.</p>
                    <button onClick={handleOpenCreate} className="px-6 py-2.5 bg-cyan-50 text-cyan-700 border border-cyan-100 hover:bg-cyan-100 font-bold rounded-xl transition-colors shadow-sm">
                        Crear tu primera Lista
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listas.map((l) => (
                        <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow group relative">
                            {/* Decorative top bar */}
                            <div className="h-2 w-full bg-gradient-to-r from-cyan-400 to-sky-400"></div>

                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{l.nombre}</h3>
                                        {l.sucursal && (
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded border border-indigo-100">
                                                Sucursal: {l.sucursal.nombre}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenEdit(l)}
                                            className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 transition-colors"
                                            title="Editar Lista"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(l.id, l.nombre)}
                                            disabled={deletingId === l.id}
                                            className={`w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors ${deletingId === l.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            title="Eliminar Lista"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {l.descripcion && (
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">{l.descripcion}</p>
                                )}

                                <div className="grid grid-cols-2 gap-3 mt-auto">
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 shadow-sm">PARA</span>
                                        <div className="flex items-center gap-1.5 text-sky-700 font-bold text-xl">
                                            <span className="text-sm">📥</span> {countEmails(l.para)}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 shadow-sm">CC</span>
                                        <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xl">
                                            <span className="text-sm">👁️</span> {countEmails(l.cc)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50/50 px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                                Actualizada: {new Date(l.updatedAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isFormOpen && (
                <ListaCorreoForm lista={selectedLista} sucursales={sucursales} onClose={handleClose} />
            )}
        </div>
    )
}
