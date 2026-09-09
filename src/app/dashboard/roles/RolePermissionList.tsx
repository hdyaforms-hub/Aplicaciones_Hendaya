'use client'

import { useState } from 'react'

type PermissionDef = {
    id: string
    name: string
    description: string
    category: string
}

function getCategoryBadge(category: string) {
    const cat = category.toUpperCase()
    if (cat.includes('LOGÍSTICA') || cat.includes('LOGISTICA')) {
        return { icon: '🚚', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' }
    }
    if (cat.includes('OPERACIONES')) {
        return { icon: '⚙️', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' }
    }
    if (cat.includes('CALIDAD')) {
        return { icon: '🧪', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' }
    }
    if (cat.includes('MULTAS')) {
        return { icon: '⚖️', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' }
    }
    if (cat.includes('MATRIZ')) {
        return { icon: '🛡️', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' }
    }
    if (cat.includes('TABLERO')) {
        return { icon: '📈', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' }
    }
    if (cat.includes('APLICACIONES')) {
        return { icon: '📱', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' }
    }
    if (cat.includes('FORMULARIO')) {
        return { icon: '📝', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' }
    }
    if (cat.includes('ACTAS')) {
        return { icon: '📜', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' }
    }
    if (cat.includes('GESTOR') || cat.includes('DOCUMENTAL')) {
        return { icon: '🗄️', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' }
    }
    if (cat.includes('COLABORADORES')) {
        return { icon: '👥', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' }
    }
    return { icon: '📁', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-cyan-600' }
}

export default function RolePermissionList({ 
    rolePerms, 
    availablePermissions 
}: { 
    rolePerms: string[], 
    availablePermissions: PermissionDef[] 
}) {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
    }

    // Group permissions that the role has
    const groupedPermissions = availablePermissions.reduce((acc, p) => {
        if (rolePerms.includes(p.id)) {
            if (!acc[p.category]) acc[p.category] = []
            acc[p.category].push(p)
        }
        return acc
    }, {} as Record<string, PermissionDef[]>)

    const unmappedPerms = rolePerms.filter(rp => !availablePermissions.find(ap => ap.id === rp))

    return (
        <div className="space-y-2">
            {Object.entries(groupedPermissions).map(([category, perms]) => {
                const isExpanded = expandedCategories[category]
                const isSubCategory = category.includes('->')
                const badge = getCategoryBadge(category)
                
                return (
                    <div 
                        key={category} 
                        className={`overflow-hidden rounded-xl border transition-all ${
                            isExpanded 
                                ? 'bg-white border-cyan-200 shadow-sm' 
                                : 'bg-white/70 border-slate-200/70 hover:border-slate-300'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between p-2.5 sm:p-3 hover:bg-slate-50/80 transition-colors select-none"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`text-[9px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-cyan-600' : ''}`}>
                                    ▶
                                </span>
                                <span className="text-sm shrink-0">{badge.icon}</span>
                                <span className={`text-xs font-bold uppercase tracking-wider truncate ${
                                    isExpanded ? 'text-cyan-800 font-extrabold' : 'text-slate-700'
                                }`}>
                                    {isSubCategory ? category.replace('ÁREAS -> ', '↳ ') : category}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                                    {perms.length} {perms.length === 1 ? 'permiso' : 'permisos'}
                                </span>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="p-3 pt-1 border-t border-slate-100 bg-slate-50/40 animate-in slide-in-from-top-1 duration-150">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                    {perms.map(p => (
                                        <div 
                                            key={p.id} 
                                            className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs hover:border-cyan-300 transition-all group"
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${badge.dot}`}></span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">
                                                    {p.name}
                                                </div>
                                                <div className="text-[10px] text-slate-500 leading-snug line-clamp-1 mt-0.5">
                                                    {p.description}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {unmappedPerms.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={() => toggleCategory('otros')}
                        className="w-full flex items-center justify-between p-2.5 hover:bg-slate-100/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className={`text-[9px] text-slate-400 transition-transform duration-200 ${expandedCategories['otros'] ? 'rotate-90' : ''}`}>
                                ▶
                            </span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                ⚙️ Otros Permisos de Sistema
                            </span>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                            {unmappedPerms.length}
                        </span>
                    </button>
                    {expandedCategories['otros'] && (
                        <div className="p-3 pt-1 border-t border-slate-200">
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {unmappedPerms.map(p => (
                                    <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
