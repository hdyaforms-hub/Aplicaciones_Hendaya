'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveMatrixHeader, deleteMatrix, duplicateMatrix, toggleMatrixState } from './actions'

type Licitacion = {
    licId: number
    licitacionHomologada: string | null
    estado: number
}

type Matriz = {
    id: string
    licId: number
    anio: number
    titulo: string
    estado: boolean
    licitacion: Licitacion
    _count: {
        respuestas: number
    }
}

interface NuevaMatrizDashboardProps {
    initialLicitaciones: Licitacion[]
    initialMatrices: Matriz[]
}

export default function NuevaMatrizDashboard({
    initialLicitaciones,
    initialMatrices
}: NuevaMatrizDashboardProps) {
    const router = useRouter()
    const [matrices, setMatrices] = useState<Matriz[]>(initialMatrices)
    const [licitaciones] = useState<Licitacion[]>(initialLicitaciones)

    // Form states
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
    const [licId, setLicId] = useState<string>('')
    const [anio, setAnio] = useState<string>('')
    const [titulo, setTitulo] = useState<string>('')
    const [estado, setEstado] = useState<boolean>(true)

    const [loading, setLoading] = useState(false)
    const [actionId, setActionId] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Duplicate Modal State
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
    const [matrizToDuplicate, setMatrizToDuplicate] = useState<Matriz | null>(null)
    const [duplicateLicId, setDuplicateLicId] = useState<string>('')
    const [duplicateTitulo, setDuplicateTitulo] = useState<string>('')
    const [duplicateAnio, setDuplicateAnio] = useState<string>('')
    const [duplicateEstado, setDuplicateEstado] = useState<boolean>(false)

    const handleReset = () => {
        setSelectedId(undefined)
        setLicId('')
        setAnio('')
        setTitulo('')
        setEstado(true)
        setMessage(null)
    }

    const handleEditHeaderClick = (matriz: Matriz) => {
        setSelectedId(matriz.id)
        setLicId(matriz.licId.toString())
        setAnio(matriz.anio.toString())
        setTitulo(matriz.titulo)
        setEstado(matriz.estado)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!licId || !anio || !titulo) {
            setMessage({ type: 'error', text: 'Por favor complete todos los campos requeridos.' })
            return
        }

        setLoading(true)
        setMessage(null)

        const res = await saveMatrixHeader({
            id: selectedId,
            licId: Number(licId),
            anio: Number(anio),
            titulo,
            estado
        })

        setLoading(false)

        if (res.success && res.matrix) {
            setMessage({
                type: 'success',
                text: selectedId ? '¡Cabecera de matriz actualizada correctamente!' : '¡Cabecera de matriz creada con éxito!'
            })
            if (!selectedId) {
                // If new, redirect to Screen 2 to build questions
                router.push(`/dashboard/mantenedor/matriz-riesgo/nueva-matriz/${res.matrix.id}`)
            } else {
                handleReset()
                router.refresh()
                // Update local state by refetching page or manual refresh
                setTimeout(() => window.location.reload(), 1000)
            }
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al guardar.' })
        }
    }

    const handleDelete = async (matriz: Matriz) => {
        if (matriz._count.respuestas > 0) {
            alert('Regla de negocio: Esta matriz no se puede eliminar porque ya cuenta con respuestas contestadas.')
            return
        }

        if (!confirm(`¿Está seguro que desea eliminar la matriz "${matriz.titulo}"? Esta acción es irreversible.`)) {
            return
        }

        setActionId(matriz.id)
        const res = await deleteMatrix(matriz.id)
        setActionId(null)

        if (res.success) {
            setMatrices(prev => prev.filter(m => m.id !== matriz.id))
            router.refresh()
        } else {
            alert(res.error || 'Error al eliminar la matriz.')
        }
    }

    const handleDuplicateClick = (matriz: Matriz) => {
        setMatrizToDuplicate(matriz)
        setDuplicateLicId(matriz.licId.toString())
        setDuplicateTitulo(`Copia de ${matriz.titulo}`)
        setDuplicateAnio(matriz.anio.toString())
        setDuplicateEstado(false) // Default to inactive
        setIsDuplicateModalOpen(true)
    }

    const confirmDuplicate = async () => {
        if (!matrizToDuplicate || !duplicateLicId || !duplicateTitulo || !duplicateAnio) {
            alert('Por favor complete todos los campos.')
            return
        }

        setActionId(matrizToDuplicate.id)
        setIsDuplicateModalOpen(false)
        const res = await duplicateMatrix(matrizToDuplicate.id, Number(duplicateLicId), duplicateTitulo, Number(duplicateAnio), duplicateEstado)
        setActionId(null)

        if (res.success && res.duplicatedId) {
            alert('¡Copia creada con éxito! Puede editar los detalles de la nueva matriz.')
            router.push(`/dashboard/mantenedor/matriz-riesgo/nueva-matriz/${res.duplicatedId}`)
        } else {
            alert(res.error || 'Error al duplicar la matriz.')
        }
        setMatrizToDuplicate(null)
    }

    const handleToggleState = async (matriz: Matriz) => {
        setActionId(matriz.id)
        const newState = !matriz.estado
        const res = await toggleMatrixState(matriz.id, newState)
        setActionId(null)

        if (res.success) {
            setMatrices(prev => prev.map(m => m.id === matriz.id ? { ...m, estado: newState } : m))
            router.refresh()
        } else {
            alert(res.error || 'Error al cambiar el estado.')
        }
    }

    return (
        <div className="space-y-8">
            {/* Header Title */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -z-1" />
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <span>🛡️</span> Matriz de Riesgo - Constructor de Plantillas
                </h1>
                <p className="text-slate-300 mt-2 text-sm max-w-2xl">
                    Configure las cabeceras de sus matrices de riesgo. Luego haga clic en el título de la matriz para construir y ordenar sus preguntas, ponderaciones de riesgo y hoja de estándar PAE.
                </p>
            </div>

            {/* Form & Actions */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-cyan-600 rounded-full"></span>
                    {selectedId ? 'Editar Cabecera de Matriz' : 'Crear Nueva Matriz'}
                </h2>

                {message && (
                    <div className={`p-4 rounded-2xl mb-6 text-sm font-semibold border ${
                        message.type === 'success' 
                            ? 'bg-green-50 text-green-700 border-green-100' 
                            : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    {/* Licitacion dropdown */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Licitación *</label>
                        <select
                            value={licId}
                            onChange={(e) => setLicId(e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-black font-semibold text-sm"
                            required
                        >
                            <option value="">Seleccione...</option>
                            {licitaciones.map(l => (
                                <option key={l.licId} value={l.licId}>
                                    {l.licitacionHomologada || `Licitación ${l.licId}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Año input */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Año *</label>
                        <input
                            type="number"
                            min="2020"
                            max="2050"
                            value={anio}
                            onChange={(e) => setAnio(e.target.value)}
                            placeholder="Ej: 2026"
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-black font-semibold text-sm"
                            required
                        />
                    </div>

                    {/* Título input */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Título de la Matriz *</label>
                        <input
                            type="text"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ej: Segundo Semestre / 2026"
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-black font-semibold text-sm"
                            required
                        />
                    </div>

                    {/* Estado toggle & submit */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Estado</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEstado(!estado)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${estado ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${estado ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className={`text-xs font-bold ${estado ? 'text-emerald-700' : 'text-gray-400'}`}>
                                    {estado ? 'VIGENTE' : 'NO VIGENTE'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 shrink-0">
                            {selectedId && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-cyan-500/10 disabled:opacity-50"
                            >
                                {loading ? 'Procesando...' : selectedId ? 'Guardar Cambios' : 'Crear y Continuar ➔'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-md font-bold text-slate-800 uppercase tracking-wide">Matrices Registradas</h3>
                    <span className="text-xs bg-slate-200 px-3 py-1 rounded-full text-slate-600 font-bold">
                        {matrices.length} plantillas
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-100 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Licitación</th>
                                <th className="px-6 py-4">Año</th>
                                <th className="px-6 py-4">Título (Editar Preguntas)</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {matrices.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-semibold text-slate-900">
                                        {m.licitacion?.licitacionHomologada || `Licitación ${m.licId}`}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600">{m.anio}</td>
                                    <td className="px-6 py-4">
                                        <Link
                                            href={`/dashboard/mantenedor/matriz-riesgo/nueva-matriz/${m.id}`}
                                            className="font-black text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-1.5 transition-all"
                                        >
                                            <span>{m.titulo}</span>
                                            <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-semibold border border-cyan-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                                🛠️ Editar plantilla
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => handleToggleState(m)}
                                            disabled={actionId === m.id}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                                m.estado 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100' 
                                                    : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                                            } ${actionId === m.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            title="Clic para cambiar el estado"
                                        >
                                            <span className={`w-2 h-2 rounded-full shadow-inner ${m.estado ? 'bg-emerald-500 shadow-emerald-400/50' : 'bg-slate-400 shadow-slate-300/50'}`}></span>
                                            {m.estado ? 'Vigente' : 'No vigente'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEditHeaderClick(m)}
                                                disabled={actionId === m.id}
                                                className="px-3 py-1.5 bg-white border border-gray-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all"
                                            >
                                                Editar Cabecera
                                            </button>
                                            <button
                                                onClick={() => handleDuplicateClick(m)}
                                                disabled={actionId === m.id}
                                                className="px-3 py-1.5 bg-sky-50 border border-sky-100 text-sky-700 rounded-lg text-xs font-bold hover:bg-sky-100 transition-all"
                                            >
                                                Hacer una copia
                                            </button>
                                            <button
                                                onClick={() => handleDelete(m)}
                                                disabled={actionId === m.id}
                                                className="px-3 py-1.5 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {matrices.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                                        No se han registrado matrices aún. Use el formulario superior para crear una.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Duplicate Modal */}
            {isDuplicateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-slate-800 mb-2">Duplicar Matriz</h3>
                        <p className="text-sm text-slate-500 mb-6">Se copiarán todas las preguntas y configuraciones de la matriz original.</p>
                        
                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Licitación de destino</label>
                                    <select
                                        value={duplicateLicId}
                                        onChange={(e) => setDuplicateLicId(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-800 font-semibold text-sm"
                                    >
                                        <option value="">Seleccione...</option>
                                        {licitaciones.map(l => (
                                            <option key={l.licId} value={l.licId}>
                                                {l.licitacionHomologada || `Licitación ${l.licId}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Año</label>
                                    <input
                                        type="number"
                                        min="2020"
                                        max="2050"
                                        value={duplicateAnio}
                                        onChange={(e) => setDuplicateAnio(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-800 font-semibold text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nuevo Título</label>
                                <input
                                    type="text"
                                    value={duplicateTitulo}
                                    onChange={(e) => setDuplicateTitulo(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-800 font-semibold text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado Inicial</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setDuplicateEstado(!duplicateEstado)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${duplicateEstado ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${duplicateEstado ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                    <span className={`text-xs font-bold ${duplicateEstado ? 'text-emerald-700' : 'text-gray-400'}`}>
                                        {duplicateEstado ? 'VIGENTE' : 'NO VIGENTE'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setIsDuplicateModalOpen(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDuplicate}
                                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-sky-600/20"
                            >
                                Confirmar y Duplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
