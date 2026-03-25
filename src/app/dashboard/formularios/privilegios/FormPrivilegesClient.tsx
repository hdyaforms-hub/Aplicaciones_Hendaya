'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateFormPrivileges } from '../../actions'

export default function FormPrivilegesClient({ form, allUsers }: { form: any, allUsers: any[] }) {
    const router = useRouter()
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(form.allowedUserIds || [])
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [searchTerm, setSearchTerm] = useState('')

    const filteredUsers = allUsers.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const toggleUser = (userId: string) => {
        if (selectedUserIds.includes(userId)) {
            setSelectedUserIds(selectedUserIds.filter(id => id !== userId))
        } else {
            setSelectedUserIds([...selectedUserIds, userId])
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        const res = await updateFormPrivileges(form.id, selectedUserIds)
        if (res.success) {
            setMessage({ type: 'success', text: 'Privilegios actualizados con éxito' })
            setTimeout(() => router.push('/dashboard/formularios/abrir'), 1500)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al actualizar' })
            setIsSaving(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                <div className="bg-slate-900 p-8">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-2">← Volver</button>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3 lowercase first-letter:uppercase">
                        <span className="text-4xl">🔐</span> Privilegios: {form.title}
                    </h2>
                    <p className="text-slate-400 mt-2 font-medium italic">Selecciona qué usuarios pueden ver y completar este formulario. Si no seleccionas ninguno, será visible para todos.</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar usuario por nombre o username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 bg-gray-50 transition-all font-bold text-gray-800"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredUsers.length === 0 ? (
                            <div className="col-span-2 py-10 text-center text-gray-400 font-bold italic">No se encontraron usuarios</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    onClick={() => toggleUser(user.id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                                        selectedUserIds.includes(user.id) 
                                        ? 'bg-purple-50 border-purple-200 ring-2 ring-purple-500/10' 
                                        : 'bg-white border-gray-100 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-black uppercase tracking-tight ${selectedUserIds.includes(user.id) ? 'text-purple-700' : 'text-gray-900'}`}>{user.name || user.username}</span>
                                        <span className="text-[10px] text-gray-400 font-bold tracking-widest italic">{user.username}</span>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                        selectedUserIds.includes(user.id) ? 'bg-purple-600 text-white scale-110' : 'bg-gray-100 text-transparent group-hover:bg-gray-200'
                                    }`}>
                                        ✓
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                    <div className="text-xs font-bold text-gray-500 italic">
                        {selectedUserIds.length} usuarios seleccionados
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-100 transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Privilegios 🔐'}
                    </button>
                </div>
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>
    )
}
