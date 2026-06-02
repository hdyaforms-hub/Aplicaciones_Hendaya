'use client'

import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import CreateManipuladoraForm from './CreateManipuladoraForm'
import EditManipuladoraForm from './EditManipuladoraForm'
import { deleteManipuladora } from './actions'
import { useRouter } from 'next/navigation'

type UserData = {
    id: string
    username: string
    name: string | null
    email: string | null
    isActive: boolean
    isDeleted: boolean
    sucursales: { id: string, nombre: string }[]
    rbds: number[]
    createdAt: string
}

export default function ManipuladorasClientPage({
    users,
    sucursales
}: {
    users: UserData[]
    sucursales: { id: string, nombre: string }[]
}) {
    const router = useRouter()
    
    // Filters
    const [searchSucursal, setSearchSucursal] = useState('')
    const [searchNombre, setSearchNombre] = useState('')
    const [searchUsername, setSearchUsername] = useState('')
    const [searchRbd, setSearchRbd] = useState('')
    
    // Sorting
    const [sortCol, setSortCol] = useState<keyof UserData>('createdAt')
    const [sortAsc, setSortAsc] = useState(false)
    
    // Pagination
    const [page, setPage] = useState(1)
    const itemsPerPage = 10
    
    // Bulk load state
    const [loadingBulk, setLoadingBulk] = useState(false)
    const [bulkResult, setBulkResult] = useState<{message: string, omitidos: string[]}|null>(null)

    // Filter Logic
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (searchSucursal && !u.sucursales.some(s => s.nombre.toLowerCase().includes(searchSucursal.toLowerCase()))) return false
            if (searchNombre && !(u.name || '').toLowerCase().includes(searchNombre.toLowerCase())) return false
            if (searchUsername && !u.username.toLowerCase().includes(searchUsername.toLowerCase())) return false
            if (searchRbd && !u.rbds.some(r => r.toString().includes(searchRbd))) return false
            return true
        }).sort((a, b) => {
            let valA: any = a[sortCol]
            let valB: any = b[sortCol]
            
            if (sortCol === 'sucursales') {
                valA = a.sucursales.map(s => s.nombre).join(', ')
                valB = b.sucursales.map(s => s.nombre).join(', ')
            }
            if (sortCol === 'name') {
                valA = a.name || ''
                valB = b.name || ''
            }
            
            if (valA < valB) return sortAsc ? -1 : 1
            if (valA > valB) return sortAsc ? 1 : -1
            return 0
        })
    }, [users, searchSucursal, searchNombre, searchUsername, searchRbd, sortCol, sortAsc])

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
    const paginatedUsers = filteredUsers.slice((page - 1) * itemsPerPage, page * itemsPerPage)

    const handleSort = (col: keyof UserData) => {
        if (sortCol === col) setSortAsc(!sortAsc)
        else {
            setSortCol(col)
            setSortAsc(true)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`¿Estás seguro que deseas eliminar (ocultar) a la manipuladora ${name}?`)) {
            await deleteManipuladora(id)
        }
    }

    const downloadTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([{
            NombreCompleto: "Maria Lopez",
            NombreUsuario: "mlopez",
            CorreoElectronico: "maria@empresa.com",
            SucursalesPermitidas: "CD COPIAPO, CD METRO",
            EstablecimientoTrabajo: "421, 580"
        }])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla")
        XLSX.writeFile(workbook, "plantilla_manipuladoras.xlsx")
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        setLoadingBulk(true)
        setBulkResult(null)
        
        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const data = XLSX.utils.sheet_to_json(ws)
                
                const res = await fetch('/api/users/manipuladoras/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rows: data })
                })
                
                const result = await res.json()
                setBulkResult({ message: result.message, omitidos: result.usuariosOmitidos || [] })
                router.refresh()
            } catch (err) {
                console.error(err)
                setBulkResult({ message: 'Error al procesar el archivo Excel.', omitidos: [] })
            } finally {
                setLoadingBulk(false)
                if (e.target) e.target.value = ''
            }
        }
        reader.readAsBinaryString(file)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>👩‍🍳</span> Gestión de Manipuladoras
                    </h2>
                    <p className="text-gray-500 mt-1">Carga masiva y administración exclusiva</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <button onClick={downloadTemplate} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                        📄 Formato Excel
                    </button>
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
                        {loadingBulk ? 'Procesando...' : '📥 Carga Masiva'}
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={loadingBulk} />
                    </label>
                    <CreateManipuladoraForm sucursales={sucursales} />
                </div>
            </div>

            {bulkResult && (
                <div className={`p-4 rounded-xl border ${bulkResult.omitidos.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    <p className="font-semibold">{bulkResult.message}</p>
                    {bulkResult.omitidos.length > 0 && (
                        <div className="mt-2 text-sm max-h-32 overflow-y-auto">
                            <strong>Usuarios Omitidos:</strong>
                            <ul className="list-disc ml-5 mt-1">
                                {bulkResult.omitidos.map((o, i) => <li key={i}>{o}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <input type="text" placeholder="Filtrar por Nombre Completo..." value={searchNombre} onChange={e => setSearchNombre(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    <input type="text" placeholder="Filtrar por Usuario..." value={searchUsername} onChange={e => setSearchUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    <input type="text" placeholder="Filtrar por Sucursal..." value={searchSucursal} onChange={e => setSearchSucursal(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    <input type="text" placeholder="Filtrar por RBD..." value={searchRbd} onChange={e => setSearchRbd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort('username')}>Usuario {sortCol === 'username' ? (sortAsc ? '↑' : '↓') : ''}</th>
                                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>Nombre {sortCol === 'name' ? (sortAsc ? '↑' : '↓') : ''}</th>
                                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort('isActive')}>Estado {sortCol === 'isActive' ? (sortAsc ? '↑' : '↓') : ''}</th>
                                <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort('sucursales')}>Sucursales {sortCol === 'sucursales' ? (sortAsc ? '↑' : '↓') : ''}</th>
                                <th className="px-4 py-3 font-semibold">RBDs</th>
                                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {paginatedUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{u.username}</div>
                                        <div className="text-xs text-gray-400">{u.email || 'Sin correo'}</div>
                                    </td>
                                    <td className="px-4 py-3">{u.name || '-'}</td>
                                    <td className="px-4 py-3">
                                        {u.isActive ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Vigente</span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">No Vigente</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="max-w-[150px] truncate" title={u.sucursales.map(s => s.nombre).join(', ')}>
                                            {u.sucursales.length > 0 ? u.sucursales.map(s => s.nombre).join(', ') : 'Ninguna'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="max-w-[150px] truncate" title={u.rbds.join(', ')}>
                                            {u.rbds.length > 0 ? u.rbds.join(', ') : 'Ninguno'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <EditManipuladoraForm user={u as any} sucursales={sucursales} />
                                        <button onClick={() => handleDelete(u.id, u.username)} className="text-red-600 hover:text-red-800 transition-colors font-medium text-xs px-2 py-1 bg-red-50 hover:bg-red-100 rounded border border-red-200">
                                            🗑️ Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {paginatedUsers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        No se encontraron manipuladoras
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        Mostrando {Math.min(filteredUsers.length, (page - 1) * itemsPerPage + 1)} a {Math.min(filteredUsers.length, page * itemsPerPage)} de {filteredUsers.length}
                    </span>
                    <div className="flex gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50 text-sm">Anterior</button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50 text-sm">Siguiente</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
