
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchColegiosGas } from '../solicitud-gas/actions' // Reuse existing search
import { getNextRetiroFolio, searchProductosRetiro, saveRetiroSaldo } from './actions'

interface Product {
    codigo: string
    nombre: string
    cantidad: number
}

interface RetiroSaldosClientProps {
    userName: string
    userSucursales: string[]
}

export default function RetiroClient({ userName, userSucursales }: RetiroSaldosClientProps) {
    const router = useRouter()
    
    // Header States
    const [tipoOperacion, setTipoOperacion] = useState<'Retiro de saldo' | 'Rebaja de Stock'>('Retiro de saldo')
    const [folio, setFolio] = useState('')
    const [colegio, setColegio] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    
    // Detail States
    const [productos, setProductos] = useState<Product[]>([])
    const [isProductModalOpen, setIsProductModalOpen] = useState(false)
    const [productSearch, setProductSearch] = useState('')
    const [productResults, setProductResults] = useState<any[]>([])
    const [isSearchingProduct, setIsSearchingProduct] = useState(false)
    
    // Approval States
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false)
    const [nombreAutoriza, setNombreAutoriza] = useState('')
    const [rutAutoriza, setRutAutoriza] = useState('')
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    
    // UI States
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ text: '', type: '' })
    const systemDate = new Date().toLocaleDateString()

    // Fetch Initial Folio
    useEffect(() => {
        const fetchFolio = async () => {
            const nextFolio = await getNextRetiroFolio()
            setFolio(nextFolio)
        }
        fetchFolio()
    }, [])

    // Colegio Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2 && !colegio) {
                setIsSearching(true)
                const res = await searchColegiosGas(searchTerm)
                if (res.colegios) {
                    setResults(res.colegios)
                    setShowDropdown(true)
                }
                setIsSearching(false)
            } else {
                setShowDropdown(false)
            }
        }, 300)
        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm, colegio])

    // Product Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (productSearch.length >= 2) {
                setIsSearchingProduct(true)
                const res = await searchProductosRetiro(productSearch, tipoOperacion)
                setProductResults(res || [])
                setIsSearchingProduct(false)
            } else {
                setProductResults([])
            }
        }, 300)
        return () => clearTimeout(delayDebounceFn)
    }, [productSearch, tipoOperacion])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelectColegio = (col: any) => {
        setColegio(col)
        setSearchTerm(`${col.colRBD} - ${col.nombreEstablecimiento}`)
        setShowDropdown(false)
    }

    const [selectedProductForCant, setSelectedProductForCant] = useState<any>(null)
    const [tempCantidad, setTempCantidad] = useState('1')

    const handlePrepareProduct = (prod: any) => {
        const existing = productos.find(p => p.codigo === prod.codigo)
        if (existing) {
            setMessage({ text: 'El producto ya está en la lista', type: 'error' })
            return
        }
        setSelectedProductForCant(prod)
        setTempCantidad('1')
    }

    const handleConfirmAddProduct = () => {
        const cant = parseInt(tempCantidad)
        if (selectedProductForCant && cant > 0) {
            setProductos([...productos, {
                codigo: selectedProductForCant.codigo,
                nombre: selectedProductForCant.nombre,
                cantidad: cant
            }])
            setIsProductModalOpen(false)
            setProductSearch('')
            setSelectedProductForCant(null)
        }
    }

    const handleRemoveProduct = (codigo: string) => {
        setProductos(productos.filter(p => p.codigo !== codigo))
    }

    const handleEditProduct = (codigo: string) => {
        const prod = productos.find(p => p.codigo === codigo)
        if (!prod) return
        
        const newCant = prompt(`Editar cantidad para ${prod.nombre}:`, prod.cantidad.toString())
        if (newCant && parseInt(newCant) > 0) {
            setProductos(productos.map(p => 
                p.codigo === codigo ? { ...p, cantidad: parseInt(newCant) } : p
            ))
        }
    }

    // Signature Canvas Logic
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true)
        draw(e)
    }

    const stopDrawing = () => {
        setIsDrawing(false)
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx?.beginPath()
        }
    }

    const draw = (e: any) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX || e.touches?.[0].clientX) - rect.left
        const y = (e.clientY || e.touches?.[0].clientY) - rect.top

        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.strokeStyle = 'black'

        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const clearSignature = () => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
    }

    const handleFinalSubmit = async () => {
        if (!nombreAutoriza || !rutAutoriza) {
            alert('Nombre y RUT de autorización son obligatorios')
            return
        }

        const canvas = canvasRef.current
        const firmaBase64 = canvas?.toDataURL() || ''
        
        setLoading(true)
        const res = await saveRetiroSaldo({
            tipoOperacion,
            rbd: colegio.colRBD,
            nombreEstablecimiento: colegio.nombreEstablecimiento,
            ut: colegio.colut,
            sucursal: colegio.sucursal,
            nombreAutoriza,
            rutAutoriza,
            firmaBase64,
            productos
        })

        if (res.success) {
            if (res.emailWarning) {
                setMessage({ text: `✅ Folio ${res.folio} guardado con éxito. ⚠️ AVISO: ${res.emailWarning}`, type: 'success' })
            } else {
                setMessage({ text: `✅ Folio ${res.folio} guardado y notificado con éxito`, type: 'success' })
            }
            setIsApprovalModalOpen(false)
            // Reset state
            setProductos([])
            setColegio(null)
            setSearchTerm('')
            setNombreAutoriza('')
            setRutAutoriza('')
            // Update folio for next
            const next = await getNextRetiroFolio()
            setFolio(next)
        } else {
            alert(`Error: ${res.error}`)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Header */}
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-60" />
                
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-black mb-1 flex items-center gap-3">
                            <span className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200">📦</span>
                            Retiro de Saldos / Rebaja de Stock
                        </h2>
                        <p className="text-gray-500">Gestión de inventario y devoluciones físicas.</p>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">Folio</span>
                        <span className="text-2xl font-black text-indigo-600 tracking-tighter tabular-nums px-4 py-1 bg-indigo-50 rounded-xl border border-indigo-100">{folio}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Operation Type */}
                    <div>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Tipo de Operación</label>
                        <select
                            value={tipoOperacion}
                            onChange={(e: any) => setTipoOperacion(e.target.value)}
                            className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 font-bold text-black appearance-none cursor-pointer"
                        >
                            <option value="Retiro de saldo">Retiro de saldo</option>
                            <option value="Rebaja de Stock">Rebaja de Stock</option>
                        </select>
                    </div>

                    {/* Colegio Search */}
                    <div className="md:col-span-2 relative" ref={searchRef}>
                        <label className="block text-xs font-black text-black mb-2 uppercase tracking-widest">Establecimiento / RBD</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    if (colegio) setColegio(null)
                                }}
                                placeholder="Escriba RBD o Nombre..."
                                className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 transition-all font-bold text-black"
                            />
                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <span className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full block"></span>
                                </div>
                            )}
                        </div>

                        {showDropdown && results.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-60 overflow-y-auto divide-y divide-gray-50">
                                {results.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => handleSelectColegio(r)}
                                        className="w-full text-left px-5 py-4 hover:bg-indigo-50 transition-colors flex justify-between items-center group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-black group-hover:text-indigo-700">{r.colRBD} - {r.nombreEstablecimiento}</span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">UT: {r.colut} • Sucursal: {r.sucursal}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
                    <div className="bg-gray-50 p-4 rounded-2xl">
                        <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">Supervisor</span>
                        <span className="text-sm font-bold text-gray-700">{userName}</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl">
                        <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">Fecha</span>
                        <span className="text-sm font-bold text-gray-700">{systemDate}</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl">
                        <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">UT</span>
                        <span className="text-sm font-bold text-gray-700">{colegio?.colut || '--'}</span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl">
                        <span className="block text-[10px] font-black text-black uppercase tracking-widest mb-1">Sucursal</span>
                        <span className="text-sm font-bold text-gray-700">{colegio?.sucursal || '--'}</span>
                    </div>
                </div>
            </div>

            {/* Products List Section */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-black text-black uppercase tracking-widest flex items-center gap-2">
                        <span className="text-indigo-600">📑</span> Detalle de Productos
                    </h3>
                    <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-gray-200"
                    >
                        <span>➕</span> Nuevo Registro
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-[10px] font-black text-black uppercase tracking-wider">
                                <th className="px-6 py-4">Código</th>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4 text-center">Cantidad</th>
                                <th className="px-6 py-4 text-center w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                            {productos.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                                        No hay productos agregados a este folio.
                                    </td>
                                </tr>
                            ) : (
                                productos.map((p) => (
                                    <tr key={p.codigo} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 font-black text-indigo-600">{p.codigo}</td>
                                        <td className="px-6 py-4 text-black">{p.nombre}</td>
                                        <td className="px-6 py-4 text-center font-bold text-lg">{p.cantidad}</td>
                                        <td className="px-6 py-4 text-center space-x-2">
                                            <button onClick={() => handleEditProduct(p.codigo)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">✏️</button>
                                            <button onClick={() => handleRemoveProduct(p.codigo)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {productos.length > 0 && (
                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={() => setIsApprovalModalOpen(true)}
                            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 transition-all uppercase tracking-widest text-lg"
                        >
                            ✓ Aprobar y Guardar
                        </button>
                    </div>
                )}
            </div>

            {/* MESSAGES */}
            {message.text && (
                <div className={`p-4 rounded-2xl text-center font-black border transition-all ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {message.text}
                </div>
            )}

            {/* PRODUCT MODAL */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/30">
                            <h4 className="text-xl font-black text-black flex items-center gap-3 uppercase tracking-tighter">
                                <span className="text-2xl">🔎</span> Buscar Productos
                            </h4>
                            <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-black text-2xl">✕</button>
                        </div>
                        <div className="p-6">
                            <div className="relative mb-6">
                                <input
                                    autoFocus
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Nombre o Código del producto..."
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-gray-50 font-bold text-black"
                                />
                                {isSearchingProduct && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <span className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full block"></span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {selectedProductForCant ? (
                                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-200 animate-in slide-in-from-top-4 duration-300">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h5 className="font-black text-black text-lg">{selectedProductForCant.nombre}</h5>
                                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Cód: {selectedProductForCant.codigo} • {selectedProductForCant.unidad}</p>
                                            </div>
                                            <button onClick={() => setSelectedProductForCant(null)} className="text-gray-400 hover:text-black">✕</button>
                                        </div>
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">Cantidad a {tipoOperacion}</label>
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    value={tempCantidad}
                                                    onChange={(e) => setTempCantidad(e.target.value)}
                                                    className="w-full px-5 py-3.5 rounded-2xl border-2 border-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 font-black text-xl text-black bg-white"
                                                />
                                            </div>
                                            <button
                                                onClick={handleConfirmAddProduct}
                                                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all uppercase tracking-widest"
                                            >
                                                Añadir
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    productResults.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handlePrepareProduct(p)}
                                            className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex justify-between items-center group bg-white shadow-sm"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-black text-black group-hover:text-indigo-600">{p.nombre}</span>
                                                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Cód: {p.codigo} • {p.unidad}</span>
                                            </div>
                                            <span className="px-4 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-black uppercase group-hover:bg-indigo-600 group-hover:text-white transition-colors">Seleccionar</span>
                                        </button>
                                    ))
                                )}
                                {productSearch.length >= 2 && productResults.length === 0 && !isSearchingProduct && (
                                    <div className="text-center py-10 text-gray-400 italic">No se encontraron productos para "{tipoOperacion}"</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* APPROVAL MODAL */}
            {isApprovalModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500 border border-indigo-100">
                        <div className="p-8 text-center bg-indigo-600 text-white relative">
                            <div className="absolute top-4 right-4 cursor-pointer text-indigo-200 hover:text-white" onClick={() => setIsApprovalModalOpen(false)}>✕</div>
                            <h4 className="text-2xl font-black uppercase tracking-widest">Autorización</h4>
                            <p className="text-indigo-200 text-sm mt-1">Firma del responsable del retiro</p>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-1.5">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={nombreAutoriza}
                                        onChange={(e) => setNombreAutoriza(e.target.value)}
                                        placeholder="Escriba nombre..."
                                        className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-black bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-1.5">RUT Autoriza</label>
                                    <input
                                        type="text"
                                        value={rutAutoriza}
                                        onChange={(e) => setRutAutoriza(e.target.value)}
                                        placeholder="12.345.678-9"
                                        className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-black bg-gray-50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="block text-[10px] font-black text-black uppercase tracking-widest">Firma Digital</label>
                                    <button onClick={clearSignature} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Borrar</button>
                                </div>
                                <div className="border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50 overflow-hidden cursor-crosshair">
                                    <canvas
                                        ref={canvasRef}
                                        width={400}
                                        height={180}
                                        className="w-full h-40 touch-none"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleFinalSubmit}
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                {loading ? 'Enviando...' : 'Confirmar Guardado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    )
}
