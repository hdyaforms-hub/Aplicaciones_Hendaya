'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLicitacion, updateLicitacion, createUT, updateUT, createSucursal, updateSucursal } from './actions'

type Licitacion = { licId: number, estado: number }
type UT = { codUT: number, licId: number, estado: number, sucursalId: string | null }
type Sucursal = { id: string, nombre: string, uts: UT[] }

export default function SucursalesDashboard({
    licitaciones, uts, sucursales
}: {
    licitaciones: Licitacion[], uts: UT[], sucursales: Sucursal[]
}) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'licitacion' | 'ut' | 'sucursal'>('licitacion')

    // Globals Loading/Feedback
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form logic helpers
    const showMessage = (err: string | null, succ: string | null) => {
        setError(err || '')
        setSuccess(succ || '')
        if (succ) {
            router.refresh()
            setTimeout(() => setSuccess(''), 3000)
        }
    }

    // --- LICITACION LOGIC ---
    const [licForm, setLicForm] = useState<{ licId: string, estado: number, isEdit: boolean }>({ licId: '', estado: 1, isEdit: false })
    const handleLicSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const id = parseInt(licForm.licId)
        if (isNaN(id)) return showMessage('ID inválido', null)

        const res = licForm.isEdit ? await updateLicitacion(id, licForm.estado) : await createLicitacion(id, licForm.estado)
        setLoading(false)
        if (res?.error) showMessage(res.error, null)
        else { showMessage(null, 'Licitación guardada con éxito.'); setLicForm({ licId: '', estado: 1, isEdit: false }) }
    }

    // --- UT LOGIC ---
    const [utForm, setUtForm] = useState<{ codUT: string, licId: string, estado: number, isEdit: boolean }>({ codUT: '', licId: '', estado: 1, isEdit: false })
    const handleUtSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const cUT = parseInt(utForm.codUT)
        const lId = parseInt(utForm.licId)
        if (isNaN(cUT) || isNaN(lId)) return showMessage('Campos inválidos', null)

        const res = utForm.isEdit ? await updateUT(cUT, lId, utForm.estado) : await createUT(cUT, lId, utForm.estado)
        setLoading(false)
        if (res?.error) showMessage(res.error, null)
        else { showMessage(null, 'Unidad Territorial guardada con éxito.'); setUtForm({ codUT: '', licId: '', estado: 1, isEdit: false }) }
    }

    // --- SUCURSAL LOGIC ---
    const [sucForm, setSucForm] = useState<{ id: string, nombre: string, uts: number[], isEdit: boolean }>({ id: '', nombre: '', uts: [], isEdit: false })
    const handleSucSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const res = sucForm.isEdit
            ? await updateSucursal(sucForm.id, sucForm.nombre, sucForm.uts)
            : await createSucursal(sucForm.nombre, sucForm.uts)

        setLoading(false)
        if (res?.error) showMessage(res.error, null)
        else { showMessage(null, 'Sucursal guardada con éxito.'); setSucForm({ id: '', nombre: '', uts: [], isEdit: false }) }
    }

    const handleUtToggle = (cod: number) => {
        setSucForm(prev => {
            const has = prev.uts.includes(cod)
            return { ...prev, uts: has ? prev.uts.filter(u => u !== cod) : [...prev.uts, cod] }
        })
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🏢</span> Organización y Sucursales
                    </h2>
                    <p className="text-gray-500 mt-1">Mantenedores para Licitaciones, Unidades Territoriales (UT) y Sucursales.</p>
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    onClick={() => { setActiveTab('licitacion'); setError(''); setSuccess('') }}
                    className={`px-6 py-3 font-semibold text-sm rounded-t-xl transition-colors ${activeTab === 'licitacion' ? 'bg-white border-t border-l border-r border-gray-200 text-cyan-700' : 'text-gray-500 hover:text-cyan-600 hover:bg-gray-50'}`}
                >
                    📑 Licitaciones
                </button>
                <button
                    onClick={() => { setActiveTab('ut'); setError(''); setSuccess('') }}
                    className={`px-6 py-3 font-semibold text-sm rounded-t-xl transition-colors ${activeTab === 'ut' ? 'bg-white border-t border-l border-r border-gray-200 text-cyan-700' : 'text-gray-500 hover:text-cyan-600 hover:bg-gray-50'}`}
                >
                    🗺️ Unidades Territoriales (UT)
                </button>
                <button
                    onClick={() => { setActiveTab('sucursal'); setError(''); setSuccess('') }}
                    className={`px-6 py-3 font-semibold text-sm rounded-t-xl transition-colors ${activeTab === 'sucursal' ? 'bg-white border-t border-l border-r border-gray-200 text-cyan-700' : 'text-gray-500 hover:text-cyan-600 hover:bg-gray-50'}`}
                >
                    🏢 Sucursales
                </button>
            </div>

            {/* NOTIFICATIONS */}
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 mb-4">{error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium mb-4">{success}</div>}

            {/* CONTENT TABS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ---------- FORM CONTAINER ---------- */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <div className="mb-4 pb-2 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-lg">
                            {activeTab === 'licitacion' ? (licForm.isEdit ? 'Editar Licitación' : 'Nueva Licitación') :
                                activeTab === 'ut' ? (utForm.isEdit ? 'Editar UT' : 'Nueva UT') :
                                    (sucForm.isEdit ? 'Editar Sucursal' : 'Nueva Sucursal')}
                        </h3>
                        {/* Cancel Edit Buttons */}
                        {activeTab === 'licitacion' && licForm.isEdit && <button onClick={() => setLicForm({ licId: '', estado: 1, isEdit: false })} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">Cancelar</button>}
                        {activeTab === 'ut' && utForm.isEdit && <button onClick={() => setUtForm({ codUT: '', licId: '', estado: 1, isEdit: false })} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">Cancelar</button>}
                        {activeTab === 'sucursal' && sucForm.isEdit && <button onClick={() => setSucForm({ id: '', nombre: '', uts: [], isEdit: false })} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">Cancelar</button>}
                    </div>

                    {/* Licitacion Form */}
                    {activeTab === 'licitacion' && (
                        <form onSubmit={handleLicSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Licitación (LicId)</label>
                                <input type="number" required disabled={licForm.isEdit} value={licForm.licId} onChange={e => setLicForm({ ...licForm, licId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estado (Vigencia)</label>
                                <select value={licForm.estado} onChange={e => setLicForm({ ...licForm, estado: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900">
                                    <option value={1}>1 - Vigente</option>
                                    <option value={0}>0 - No Vigente</option>
                                </select>
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                                {loading ? 'Guardando...' : (licForm.isEdit ? 'Actualizar Licitación' : 'Guardar Licitación')}
                            </button>
                        </form>
                    )}

                    {/* UT Form */}
                    {activeTab === 'ut' && (
                        <form onSubmit={handleUtSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Código UT (CodUT)</label>
                                <input type="number" required disabled={utForm.isEdit} value={utForm.codUT} onChange={e => setUtForm({ ...utForm, codUT: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Licitación (LicId)</label>
                                <select required value={utForm.licId} onChange={e => setUtForm({ ...utForm, licId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900">
                                    <option value="" disabled>Seleccione una Licitación</option>
                                    {licitaciones.map(lic => (
                                        <option key={lic.licId} value={lic.licId}>LicId: {lic.licId} ({lic.estado === 1 ? 'Vigente' : 'No Vigente'})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estado (Vigencia)</label>
                                <select value={utForm.estado} onChange={e => setUtForm({ ...utForm, estado: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900">
                                    <option value={1}>1 - Vigente</option>
                                    <option value={0}>0 - No Vigente</option>
                                </select>
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                                {loading ? 'Guardando...' : (utForm.isEdit ? 'Actualizar UT' : 'Guardar UT')}
                            </button>
                        </form>
                    )}

                    {/* Sucursal Form */}
                    {activeTab === 'sucursal' && (
                        <form onSubmit={handleSucSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Sucursal</label>
                                <input type="text" required value={sucForm.nombre} onChange={e => setSucForm({ ...sucForm, nombre: e.target.value })} placeholder="Ej: Sucursal Norte" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Unidades Territoriales (UT) Asociadas</label>
                                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 space-y-1">
                                    {uts.map(ut => (
                                        <label key={ut.codUT} className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={sucForm.uts.includes(ut.codUT)}
                                                onChange={() => handleUtToggle(ut.codUT)}
                                                className="w-4 h-4 text-cyan-600 rounded border-gray-300 mr-3"
                                            />
                                            <span className="text-sm text-gray-700">UT: <strong className="text-gray-900">{ut.codUT}</strong> (Lic. {ut.licId}) {ut.sucursalId && ut.sucursalId !== sucForm.id ? <span className="text-red-500 text-xs ml-1">(Ya en otra)</span> : ''}</span>
                                        </label>
                                    ))}
                                    {uts.length === 0 && <p className="text-sm text-gray-400 p-2 text-center">No hay UTs creadas aún.</p>}
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 mt-4">
                                {loading ? 'Guardando...' : (sucForm.isEdit ? 'Actualizar Sucursal' : 'Guardar Sucursal')}
                            </button>
                        </form>
                    )}
                </div>

                {/* ---------- DATA TABLES CONTAINER ---------- */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-sm">
                    {/* TABLA LICITACION */}
                    {activeTab === 'licitacion' && (
                        <div className="overflow-x-auto h-full max-h-[600px]">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">LicId (Licitación)</th>
                                        <th className="px-6 py-4 font-bold">Estado</th>
                                        <th className="px-6 py-4 font-bold text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {licitaciones.map(lic => (
                                        <tr key={lic.licId} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-bold text-gray-900">{lic.licId}</td>
                                            <td className="px-6 py-3">
                                                {lic.estado === 1
                                                    ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold">1 - Vigente</span>
                                                    : <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">0 - No Vigente</span>}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button onClick={() => setLicForm({ licId: String(lic.licId), estado: lic.estado, isEdit: true })} className="text-cyan-600 hover:text-cyan-800 font-medium px-3 py-1 bg-cyan-50 hover:bg-cyan-100 rounded-lg">Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {licitaciones.length === 0 && <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500">No exiten Licitaciones.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TABLA UTS */}
                    {activeTab === 'ut' && (
                        <div className="overflow-x-auto h-full max-h-[600px]">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">CodUT</th>
                                        <th className="px-6 py-4 font-bold">Licitación (LicId)</th>
                                        <th className="px-6 py-4 font-bold">Estado</th>
                                        <th className="px-6 py-4 font-bold">¿En Sucursal?</th>
                                        <th className="px-6 py-4 font-bold text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {uts.map(ut => (
                                        <tr key={ut.codUT} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-bold text-gray-900 text-base">{ut.codUT}</td>
                                            <td className="px-6 py-3 text-gray-700 font-medium">{ut.licId}</td>
                                            <td className="px-6 py-3">
                                                {ut.estado === 1
                                                    ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold">1 - Vigente</span>
                                                    : <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">0 - No Vigente</span>}
                                            </td>
                                            <td className="px-6 py-3">
                                                {ut.sucursalId ? <span className="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-1 rounded">Sí, existe rel.</span> : <span className="text-gray-400 text-xs">Libre</span>}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button onClick={() => setUtForm({ codUT: String(ut.codUT), licId: String(ut.licId), estado: ut.estado, isEdit: true })} className="text-cyan-600 hover:text-cyan-800 font-medium px-3 py-1 bg-cyan-50 hover:bg-cyan-100 rounded-lg">Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {uts.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No existen Unidades Territoriales (UT).</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TABLA SUCURSAL */}
                    {activeTab === 'sucursal' && (
                        <div className="overflow-x-auto h-full max-h-[600px]">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Nombre Sucursal</th>
                                        <th className="px-6 py-4 font-bold">Unidades Territoriales Asociadas</th>
                                        <th className="px-6 py-4 font-bold text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 cursor-default">
                                    {sucursales.map(suc => (
                                        <tr key={suc.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-sky-800 text-base">{suc.nombre}</td>
                                            <td className="px-6 py-4">
                                                {suc.uts && suc.uts.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {suc.uts.map(u => (
                                                            <span key={u.codUT} className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-700 text-xs rounded-md font-medium">UT: {u.codUT}</span>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-gray-400 italic text-xs">Sin UTs</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => setSucForm({ id: suc.id, nombre: suc.nombre, uts: suc.uts.map(u => u.codUT), isEdit: true })} className="text-cyan-600 hover:text-cyan-800 font-medium px-3 py-1 bg-cyan-50 hover:bg-cyan-100 rounded-lg">Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sucursales.length === 0 && <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500">No existen Sucursales.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
