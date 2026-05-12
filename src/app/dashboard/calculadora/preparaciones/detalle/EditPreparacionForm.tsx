'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePreparacionProducts, createPreparacionProduct, deletePreparacionProduct } from '../actions'

type ProductEntry = {
    id: string
    codigoProducto: string
    nombreProducto: string
    cantPreparacion: number
    porcentajePerdida: number
}

interface EditPreparacionFormProps {
    licitacion: string
    numeroPreparacion: number
    nombrePreparacion: string
    metaData: {
        numeroPrograma: string
        programa: string
        numeroCocina: number
        cocina: string
        numeroArea: string
        area: string
        codigoSubServicio: string
        nombreSubServicio: string
    }
    initialProducts: ProductEntry[]
}

export default function EditPreparacionForm({
    licitacion,
    numeroPreparacion,
    nombrePreparacion,
    metaData,
    initialProducts
}: EditPreparacionFormProps) {
    const [products, setProducts] = useState<ProductEntry[]>(initialProducts)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newProduct, setNewProduct] = useState({
        codigoProducto: '',
        nombreProducto: '',
        cantPreparacion: 0,
        porcentajePerdida: 0
    })

    const router = useRouter()

    const handleInputChange = (id: string, field: keyof ProductEntry, value: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (field === 'cantPreparacion' || field === 'porcentajePerdida') {
                    return { ...p, [field]: parseFloat(value) || 0 }
                }
                return { ...p, [field]: value }
            }
            return p
        }))
    }

    const handleSave = async () => {
        setLoading(true)
        setMessage(null)

        const result = await updatePreparacionProducts(products.map(p => ({
            id: p.id,
            codigoProducto: p.codigoProducto,
            nombreProducto: p.nombreProducto,
            cantPreparacion: p.cantPreparacion,
            porcentajePerdida: p.porcentajePerdida
        })))

        if (result.success) {
            setMessage({ type: 'success', text: 'Cambios guardados correctamente.' })
            setTimeout(() => {
                setMessage(null)
                router.refresh()
            }, 2000)
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al actualizar.' })
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar este producto de la preparación?')) return

        setLoading(true)
        const result = await deletePreparacionProduct(id)
        if (result.success) {
            setProducts(prev => prev.filter(p => p.id !== id))
            setMessage({ type: 'success', text: 'Producto eliminado correctamente.' })
            router.refresh()
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al eliminar.' })
        }
        setLoading(false)
    }

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const result = await createPreparacionProduct({
            licitacion,
            numeroPreparacion,
            nombrePreparacion,
            ...metaData,
            ...newProduct
        })

        if (result.success) {
            setMessage({ type: 'success', text: 'Producto agregado correctamente.' })
            setShowAddModal(false)
            setNewProduct({ codigoProducto: '', nombreProducto: '', cantPreparacion: 0, porcentajePerdida: 0 })
            router.refresh()
            // Recargar para ver el nuevo ID de la BD
            window.location.reload()
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al agregar.' })
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-cyan-600">#{numeroPreparacion}</span> - {nombrePreparacion}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Licitación: <span className="text-gray-900">{licitacion}</span></p>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Programa: <span className="text-gray-900">{metaData.programa}</span></p>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Cocina: <span className="text-gray-900">{metaData.cocina}</span></p>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Área: <span className="text-gray-900">{metaData.area}</span></p>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 flex-1 md:flex-none rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold text-sm transition-colors border border-gray-200"
                    >
                        Volver
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 flex-1 md:flex-none rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                        ➕ Agregar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 flex-1 md:flex-none rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? '...' : '💾 Guardar Todo'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-bold border animate-in fade-in slide-in-from-top-1 ${
                    message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px]">Código Producto</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px]">Nombre Producto</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px] text-right">Cantidad</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px] text-right">% Pérdida</th>
                                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[11px] text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-bold">
                            {products.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-cyan-800">
                                        <input
                                            type="text"
                                            value={p.codigoProducto}
                                            onChange={(e) => handleInputChange(p.id, 'codigoProducto', e.target.value)}
                                            className="w-32 px-2 py-1 rounded border border-transparent hover:border-gray-300 focus:border-cyan-500 bg-transparent focus:bg-white outline-none transition-all font-bold"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        <input
                                            type="text"
                                            value={p.nombreProducto}
                                            onChange={(e) => handleInputChange(p.id, 'nombreProducto', e.target.value)}
                                            className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-300 focus:border-cyan-500 bg-transparent focus:bg-white outline-none transition-all font-bold"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={p.cantPreparacion}
                                            onChange={(e) => handleInputChange(p.id, 'cantPreparacion', e.target.value)}
                                            className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-cyan-500 outline-none text-right font-black text-gray-900 bg-gray-50 group-hover:bg-white"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <input
                                                type="number"
                                                value={p.porcentajePerdida}
                                                onChange={(e) => handleInputChange(p.id, 'porcentajePerdida', e.target.value)}
                                                className="w-16 px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-cyan-500 outline-none text-right font-black text-gray-900 bg-gray-50 group-hover:bg-white"
                                            />
                                            <span className="text-gray-400">%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Eliminar producto"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Agregar Producto */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in fade-in duration-200">
                        <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                            <span>📦</span> Agregar Nuevo Producto
                        </h3>

                        <form onSubmit={handleAddProduct} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Código del Producto</label>
                                <input
                                    required
                                    type="text"
                                    value={newProduct.codigoProducto}
                                    onChange={(e) => setNewProduct({ ...newProduct, codigoProducto: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 font-bold"
                                    placeholder="Ej: PRD-1002"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nombre del Producto</label>
                                <input
                                    required
                                    type="text"
                                    value={newProduct.nombreProducto}
                                    onChange={(e) => setNewProduct({ ...newProduct, nombreProducto: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 font-bold"
                                    placeholder="Ej: ARROZ GRADO 1"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Cantidad</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={newProduct.cantPreparacion}
                                        onChange={(e) => setNewProduct({ ...newProduct, cantPreparacion: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 font-bold text-right"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">% Pérdida</label>
                                    <input
                                        required
                                        type="number"
                                        value={newProduct.porcentajePerdida}
                                        onChange={(e) => setNewProduct({ ...newProduct, porcentajePerdida: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 font-bold text-right"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold transition-colors border border-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 w-full rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Agregando...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
