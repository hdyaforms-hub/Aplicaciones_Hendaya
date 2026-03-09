'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateColegio } from '../actions'
import { ColegioData } from '../actions'

type ColegioRecord = ColegioData & { id: string }

export default function EditColegioForm({ colegio }: { colegio: ColegioRecord }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [formData, setFormData] = useState({
        institucion: colegio.institucion,
        sucursal: colegio.sucursal,
        nombreEstablecimiento: colegio.nombreEstablecimiento,
        direccionEstablecimiento: colegio.direccionEstablecimiento,
        comuna: colegio.comuna
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        const result = await updateColegio(colegio.id, formData)

        if (result.error) {
            setError(result.error)
        } else {
            setSuccess('Los datos del colegio fueron actualizados exitosamente.')
            router.refresh()
            // Redirect after slight delay
            setTimeout(() => {
                router.push('/dashboard/colegios')
            }, 1500)
        }
        setLoading(false)
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5 max-w-3xl">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium">{success}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institución</label>
                    <input
                        type="text"
                        name="institucion"
                        value={formData.institucion}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                    <input
                        type="text"
                        name="sucursal"
                        value={formData.sucursal}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Establecimiento</label>
                    <input
                        type="text"
                        name="nombreEstablecimiento"
                        value={formData.nombreEstablecimiento}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección del Establecimiento</label>
                    <input
                        type="text"
                        name="direccionEstablecimiento"
                        value={formData.direccionEstablecimiento}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comuna</label>
                    <input
                        type="text"
                        name="comuna"
                        value={formData.comuna}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                    />
                </div>
            </div>

            <div className="pt-4 flex gap-3 sm:justify-end">
                <button
                    type="button"
                    onClick={() => router.push('/dashboard/colegios')}
                    className="px-5 py-2.5 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors w-full sm:w-auto text-center"
                >
                    Volver
                </button>
                <button
                    type="submit"
                    disabled={loading || !!success}
                    className="px-6 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none w-full sm:w-auto"
                >
                    {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
            </div>
        </form>
    )
}
