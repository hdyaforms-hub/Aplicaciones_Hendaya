'use client'

import { useState, useTransition, useMemo } from 'react'
import { guardarCodigoCausa, eliminarCodigoCausa } from './actions'

type CodigoCausa = {
    id: number
    descripcion: string
    imputable: string
    definicion: string
    createdAt: Date
}

export default function CodigoCausaClient({ initialData }: { initialData: CodigoCausa[] }) {
    const [data, setData] = useState<CodigoCausa[]>(initialData)
    const [busqueda, setBusqueda] = useState('')
    
    // Estados del formulario
    const [idInput, setIdInput] = useState('')
    const [descripcionInput, setDescripcionInput] = useState('')
    const [imputableInput, setImputableInput] = useState('Imputable')
    const [definicionInput, setDefinicionInput] = useState('')
    const [editandoId, setEditandoId] = useState<number | null>(null)
    
    // Estados de UI y transición
    const [isPending, startTransition] = useTransition()
    const [alert, setAlert] = useState<{ tipo: 'success' | 'error', mensaje: string } | null>(null)
    const [modalEliminar, setModalEliminar] = useState<number | null>(null)

    // Mostrar alerta temporal
    const mostrarAlerta = (tipo: 'success' | 'error', mensaje: string) => {
        setAlert({ tipo, mensaje })
        setTimeout(() => {
            setAlert(null)
        }, 5000)
    }

    // Filtrar datos en tiempo real de acuerdo a la búsqueda
    const datosFiltrados = useMemo(() => {
        if (!busqueda.trim()) return data
        const query = busqueda.toLowerCase().trim()
        return data.filter(item => 
            item.id.toString().includes(query) || 
            item.descripcion.toLowerCase().includes(query) ||
            (item.imputable && item.imputable.toLowerCase().includes(query)) ||
            (item.definicion && item.definicion.toLowerCase().includes(query))
        )
    }, [data, busqueda])

    // Iniciar edición de un código
    const handleEditar = (item: CodigoCausa) => {
        setEditandoId(item.id)
        setIdInput(item.id.toString())
        setDescripcionInput(item.descripcion)
        setImputableInput(item.imputable || 'Imputable')
        setDefinicionInput(item.definicion || '')
        setAlert(null)
    }

    // Cancelar la edición y limpiar formulario
    const handleCancelarEdicion = () => {
        setEditandoId(null)
        setIdInput('')
        setDescripcionInput('')
        setImputableInput('Imputable')
        setDefinicionInput('')
    }

    // Manejar el guardado (Crear o Editar)
    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault()
        
        const id = parseInt(idInput, 10)
        const descripcion = descripcionInput.trim()
        const imputable = imputableInput
        const definicion = definicionInput.trim()

        // Validaciones en el cliente
        if (isNaN(id) || id <= 0) {
            mostrarAlerta('error', 'El ID debe ser un número entero mayor que cero.')
            return
        }

        if (!descripcion) {
            mostrarAlerta('error', 'La descripción es obligatoria.')
            return
        }

        if (imputable !== 'Imputable' && imputable !== 'No Imputable') {
            mostrarAlerta('error', 'La imputabilidad debe ser "Imputable" o "No Imputable".')
            return
        }

        startTransition(async () => {
            const isEdit = editandoId !== null
            const res = await guardarCodigoCausa(id, descripcion, imputable, definicion, isEdit)

            if (res.success) {
                mostrarAlerta('success', isEdit ? 'Código de causa actualizado con éxito.' : 'Código de causa creado con éxito.')
                
                if (isEdit) {
                    setData(prev => prev.map(item => item.id === id ? { ...item, descripcion, imputable, definicion } : item))
                } else {
                    const nuevo: CodigoCausa = {
                        id,
                        descripcion,
                        imputable,
                        definicion,
                        createdAt: new Date()
                    }
                    setData(prev => [...prev, nuevo].sort((a, b) => a.id - b.id))
                }

                // Limpiar formulario
                handleCancelarEdicion()
            } else {
                mostrarAlerta('error', res.error || 'Ocurrió un error al guardar.')
            }
        })
    }

    // Manejar la eliminación
    const handleConfirmarEliminar = (id: number) => {
        setModalEliminar(id)
    }

    const handleEliminar = async () => {
        if (modalEliminar === null) return

        const idAEliminar = modalEliminar
        setModalEliminar(null)

        startTransition(async () => {
            const res = await eliminarCodigoCausa(idAEliminar)
            if (res.success) {
                mostrarAlerta('success', 'Código de causa eliminado con éxito.')
                setData(prev => prev.filter(item => item.id !== idAEliminar))
                if (editandoId === idAEliminar) {
                    handleCancelarEdicion()
                }
            } else {
                mostrarAlerta('error', res.error || 'Ocurrió un error al eliminar.')
            }
        })
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulario de Registro / Edición */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span>{editandoId !== null ? '📝 Editar Código' : '➕ Nuevo Código'}</span>
                </h3>

                <form onSubmit={handleGuardar} className="space-y-4">
                    <div>
                        <label htmlFor="id-codigo" className="block text-sm font-semibold text-gray-800 mb-1">
                            Código (ID)
                        </label>
                        <input
                            id="id-codigo"
                            type="number"
                            min="1"
                            step="1"
                            disabled={editandoId !== null} // No se puede editar el ID (llave primaria única)
                            value={idInput}
                            onChange={(e) => setIdInput(e.target.value)}
                            placeholder="Ej: 10"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-gray-900 font-semibold bg-gray-50/50 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
                            required
                        />
                        {editandoId === null && (
                            <p className="text-[11px] text-gray-500 mt-1 font-medium">Este ID debe ser único y no se puede repetir.</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="descripcion-codigo" className="block text-sm font-semibold text-gray-800 mb-1">
                            Descripción / Significado
                        </label>
                        <textarea
                            id="descripcion-codigo"
                            value={descripcionInput}
                            onChange={(e) => setDescripcionInput(e.target.value)}
                            placeholder="Ej: Manipuladora con Licencia Médica"
                            rows={4}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-gray-900 font-semibold bg-gray-50/50 transition-all resize-none"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="imputable-codigo" className="block text-sm font-semibold text-gray-800 mb-1">
                            Imputabilidad
                        </label>
                        <select
                            id="imputable-codigo"
                            value={imputableInput}
                            onChange={(e) => setImputableInput(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-gray-900 font-semibold bg-gray-50/50 transition-all cursor-pointer"
                        >
                            <option value="Imputable">Imputable</option>
                            <option value="No Imputable">No Imputable</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="definicion-codigo" className="block text-sm font-semibold text-gray-800 mb-1">
                            Definición (Detalle adicional)
                        </label>
                        <textarea
                            id="definicion-codigo"
                            value={definicionInput}
                            onChange={(e) => setDefinicionInput(e.target.value)}
                            placeholder="Ej: Detalle adicional del significado del código de causa..."
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-gray-900 font-semibold bg-gray-50/50 transition-all resize-none"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? 'Procesando...' : (editandoId !== null ? 'Actualizar' : 'Guardar')}
                        </button>
                        
                        {editandoId !== null && (
                            <button
                                type="button"
                                onClick={handleCancelarEdicion}
                                className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-all"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Listado y Búsqueda */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                
                {/* Alertas */}
                {alert && (
                    <div className={`p-4 rounded-xl mb-4 font-bold border animate-in fade-in duration-200 flex items-center gap-3 ${
                        alert.tipo === 'success' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                        <span className="text-xl">{alert.tipo === 'success' ? '✅' : '⚠️'}</span>
                        <p className="text-sm">{alert.mensaje}</p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <span>📋 Códigos Registrados</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                            {data.length} total
                        </span>
                    </h3>

                    {/* Buscador */}
                    <div className="w-full sm:w-64 relative">
                        <input
                            type="text"
                            placeholder="Buscar código o descripción..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-gray-900 font-semibold"
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
                    </div>
                </div>

                {/* Tabla de Códigos */}
                <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-700 border-b border-gray-200 font-bold">
                            <tr>
                                <th className="px-6 py-4 font-bold text-slate-900 w-24">Código (ID)</th>
                                <th className="px-6 py-4 font-bold text-slate-900">Descripción / Significado</th>
                                <th className="px-6 py-4 font-bold text-slate-900 text-center w-36">Imputabilidad</th>
                                <th className="px-6 py-4 font-bold text-slate-900">Definición</th>
                                <th className="px-6 py-4 font-bold text-slate-900 border-l border-gray-200 text-center w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {datosFiltrados.map((item) => (
                                <tr 
                                    key={item.id} 
                                    className={`hover:bg-cyan-50/40 transition-colors ${editandoId === item.id ? 'bg-cyan-50/60 font-semibold' : ''}`}
                                >
                                    <td className="px-6 py-4 font-extrabold text-gray-900 bg-gray-50/30">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-cyan-100 text-cyan-900 border border-cyan-200 shadow-sm">
                                            {item.id}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-900 font-semibold max-w-md truncate" title={item.descripcion}>
                                        {item.descripcion}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${
                                            item.imputable === 'Imputable' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}>
                                            {item.imputable || 'Imputable'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700 font-medium max-w-xs truncate" title={item.definicion}>
                                        {item.definicion || <span className="text-gray-400 italic text-xs">Sin detalle adicional</span>}
                                    </td>
                                    <td className="px-6 py-4 border-l border-gray-100 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleEditar(item)}
                                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold border border-indigo-200 text-xs transition-colors flex items-center gap-1 shadow-sm"
                                                title="Editar descripción"
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={() => handleConfirmarEliminar(item.id)}
                                                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold border border-rose-200 text-xs transition-colors flex items-center gap-1 shadow-sm"
                                                title="Eliminar código"
                                            >
                                                🗑️ Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {datosFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center h-48">
                                        <span className="text-4xl block mb-2">📋</span>
                                        <p className="text-gray-800 font-bold text-base">No se encontraron códigos de causa</p>
                                        <p className="text-gray-500 text-sm mt-1">Crea uno nuevo usando el formulario lateral o ajusta tu búsqueda.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirmación de Eliminación */}
            {modalEliminar !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-xl animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <span>🚨 Confirmar Eliminación</span>
                        </h4>
                        <p className="text-gray-600 mb-6 font-semibold">
                            ¿Estás seguro de que deseas eliminar el código de causa <span className="text-cyan-600 font-extrabold">#{modalEliminar}</span>? 
                            Esta acción no se puede deshacer y afectará a la visualización de tooltips en los folios asociados.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setModalEliminar(null)}
                                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEliminar}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm"
                            >
                                Confirmar y Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
