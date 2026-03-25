'use client'

import { useRouter } from 'next/navigation'

interface FilterProps {
    filters: any
    sucursales: string[]
    uts: number[]
    rbds: any[]
}

export default function ColegiosFilterForm({ filters, sucursales, uts, rbds }: FilterProps) {
    const router = useRouter()

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const form = e.target.form
        if (!form) return
        
        const formData = new FormData(form)
        const params = new URLSearchParams()
        
        formData.forEach((value, key) => {
            if (value) params.set(key, value.toString())
        })
        
        // Si cambia sucursal, reseteamos UT y RBD para forzar la cascada limpia
        if (e.target.name === 'sucursal') {
            params.delete('ut')
            params.delete('rbd')
        }
        // Si cambia UT, reseteamos RBD
        if (e.target.name === 'ut') {
            params.delete('rbd')
        }

        router.push(`/dashboard/colegios?${params.toString()}`)
    }

    return (
        <form className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 tracking-widest">Sucursal</label>
                <select
                    name="sucursal"
                    defaultValue={filters.sucursal || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black text-sm appearance-none"
                >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 tracking-widest">UT</label>
                <select
                    name="ut"
                    defaultValue={filters.ut || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black text-sm appearance-none"
                >
                    <option value="">Todas las UT</option>
                    {uts.map(u => (
                        <option key={u} value={u}>UT {u}</option>
                    ))}
                </select>
            </div>

            <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-500 uppercase mb-1 tracking-widest">RBD / Establecimiento</label>
                <select
                    name="rbd"
                    defaultValue={filters.rbd || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-black text-sm appearance-none"
                >
                    <option value="">Seleccione colegio...</option>
                    {rbds.map(r => (
                        <option key={r.colRBD} value={r.colRBD}>[{r.colRBD}] {r.nombreEstablecimiento}</option>
                    ))}
                </select>
            </div>

            <div className="flex items-end gap-2">
                <button type="submit" className="flex-1 py-2 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-md font-black uppercase tracking-widest transition-colors text-sm">
                    Filtrar
                </button>
                <a href="/dashboard/colegios" className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-black uppercase tracking-widest text-center">
                    Limpiar
                </a>
            </div>
        </form>
    )
}
