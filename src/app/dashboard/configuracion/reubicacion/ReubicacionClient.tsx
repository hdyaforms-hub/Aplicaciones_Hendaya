'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMenuOrderAction } from './actions'

interface SectionData {
    id: string
    label: string
    parentKey: string
    items: string[]
}

interface ReubicacionClientProps {
    initialStructure: SectionData[]
}

export default function ReubicacionClient({ initialStructure }: ReubicacionClientProps) {
    const router = useRouter()
    const [structure, setStructure] = useState<SectionData[]>(initialStructure)
    const [selectedSectionId, setSelectedSectionId] = useState<string>('main')
    const [isPending, startTransition] = useTransition()
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<boolean>(false)

    // Obtener la sección actualmente seleccionada
    const currentSection = structure.find(s => s.id === selectedSectionId) || structure[0]
    const currentItems = currentSection.items

    const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSectionId(e.target.value)
        setErrorMessage(null)
    }

    const moveItem = async (index: number, direction: 'up' | 'down') => {
        if (isPending) return

        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= currentItems.length) return

        // Crear una copia de los ítems de la sección actual
        const updatedItems = [...currentItems]
        
        // Intercambiar elementos
        const [movedItem] = updatedItems.splice(index, 1)
        updatedItems.splice(targetIndex, 0, movedItem)

        // Actualizar el estado local inmediatamente para feedback visual rápido
        const updatedStructure = structure.map(s => {
            if (s.id === selectedSectionId) {
                return { ...s, items: updatedItems }
            }
            return s
        })
        setStructure(updatedStructure)
        setErrorMessage(null)

        // Guardar automáticamente en la base de datos
        startTransition(async () => {
            const result = await updateMenuOrderAction(currentSection.id, updatedItems)
            if (result.error) {
                setErrorMessage(result.error)
                // Revertir el cambio local en caso de error
                setStructure(structure)
            } else {
                setSuccessMessage(true)
                // Ocultar mensaje de éxito tras 2 segundos
                setTimeout(() => setSuccessMessage(false), 2000)
                // Refrescar el layout para actualizar el Sidebar
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Header del Módulo */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🔄</span> Reubicación de Aplicaciones
                    </h2>
                    <p className="text-gray-500 mt-1">Reordena las opciones del menú lateral arrastrando o usando flechas de posición.</p>
                </div>
            </div>

            {/* Panel Principal */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                {/* Selector de Sección */}
                <div className="max-w-md space-y-2">
                    <label htmlFor="section-select" className="block text-sm font-semibold text-gray-700">
                        Selecciona el Menú o Submenú a ordenar:
                    </label>
                    <div className="relative">
                        <select
                            id="section-select"
                            value={selectedSectionId}
                            onChange={handleSectionChange}
                            className="block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 rounded-xl transition-all bg-white shadow-sm"
                            disabled={isPending}
                        >
                            {structure.map(section => (
                                <option key={section.id} value={section.id}>
                                    {section.label} ({section.items.length} {section.items.length === 1 ? 'opción' : 'opciones'})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Mensajes de Alerta */}
                {errorMessage && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2 animate-pulse">
                        <span>⚠️</span> {errorMessage}
                    </div>
                )}

                {/* Indicador de Guardado */}
                <div className="flex items-center gap-4 h-6 text-sm">
                    {isPending && (
                        <div className="flex items-center gap-2 text-cyan-600 font-medium">
                            <svg className="animate-spin h-4 w-4 text-cyan-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Guardando orden en tiempo real...
                        </div>
                    )}
                    {!isPending && successMessage && (
                        <div className="text-emerald-600 font-medium flex items-center gap-1.5 animate-bounce">
                            <span>✅</span> Orden actualizado y sincronizado
                        </div>
                    )}
                </div>

                {/* Lista de Ítems */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-inner bg-gray-50/50 p-2 sm:p-4">
                    {currentItems.length > 0 ? (
                        <div className="space-y-2">
                            {currentItems.map((item, index) => {
                                const isFirst = index === 0
                                const isLast = index === currentItems.length - 1

                                return (
                                    <div
                                        key={item}
                                        className="bg-white px-5 py-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-cyan-100 hover:shadow-md hover:scale-[1.01] transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200/50">
                                                {index + 1}
                                            </span>
                                            <span className="font-semibold text-slate-800 text-base">{item}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Botón Subir */}
                                            <button
                                                onClick={() => moveItem(index, 'up')}
                                                disabled={isFirst || isPending}
                                                className={`p-2 rounded-lg border transition-all flex items-center justify-center shrink-0 ${
                                                    isFirst
                                                        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                                        : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50 hover:text-cyan-600 hover:border-cyan-200 shadow-sm active:scale-95'
                                                }`}
                                                title="Subir opción"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                                </svg>
                                            </button>

                                            {/* Botón Bajar */}
                                            <button
                                                onClick={() => moveItem(index, 'down')}
                                                disabled={isLast || isPending}
                                                className={`p-2 rounded-lg border transition-all flex items-center justify-center shrink-0 ${
                                                    isLast
                                                        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                                        : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50 hover:text-cyan-600 hover:border-cyan-200 shadow-sm active:scale-95'
                                                }`}
                                                title="Bajar opción"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-slate-400 italic">
                            No hay elementos en esta sección del menú.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
