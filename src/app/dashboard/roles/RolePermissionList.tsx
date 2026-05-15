'use client'

import { useState } from 'react'

type PermissionDef = {
    id: string
    name: string
    description: string
    category: string
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
                
                return (
                    <div key={category} className={`overflow-hidden rounded-xl border transition-all ${isExpanded ? 'bg-gray-50/50 border-gray-200' : 'bg-transparent border-transparent'}`}>
                        <button
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between p-2 hover:bg-gray-100/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isExpanded ? 'text-indigo-600' : 'text-gray-500'}`}>
                                    {isSubCategory ? '↳ ' : '📁 '} {category}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold bg-gray-200/50 px-1.5 py-0.5 rounded-full text-gray-500">
                                {perms.length}
                            </span>
                        </button>

                        {isExpanded && (
                            <div className="p-2 pt-0 animate-in slide-in-from-top-1 duration-200">
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {perms.map(p => (
                                        <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium bg-white text-gray-700 border border-gray-100 shadow-sm">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                            {p.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {unmappedPerms.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-transparent">
                     <button
                            type="button"
                            onClick={() => toggleCategory('otros')}
                            className="w-full flex items-center justify-between p-2 hover:bg-gray-100/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] transition-transform duration-200 ${expandedCategories['otros'] ? 'rotate-90' : ''}`}>▶</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Otros / Sistema</span>
                            </div>
                            <span className="text-[10px] font-bold bg-gray-200/50 px-1.5 py-0.5 rounded-full text-gray-400">
                                {unmappedPerms.length}
                            </span>
                        </button>
                    {expandedCategories['otros'] && (
                        <div className="p-2 pt-0">
                            <div className="flex flex-wrap gap-2 pt-1">
                                {unmappedPerms.map(p => (
                                    <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-100 border-dashed">
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
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
