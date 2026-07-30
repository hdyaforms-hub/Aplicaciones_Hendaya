'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, MouseEvent } from 'react'
import { RAW_MENU_ITEMS, MenuItemConfig as MenuItem } from '@/lib/menu-config'

type User = {
    username: string
    name: string | null
    role: {
        name: string
        permissions: string[]
    }
    areas?: { id: number, nombre: string }[]
    sucursales?: { id: string, nombre: string }[]
}

export default function Sidebar({ user, menuOrders = [] }: { user: User, menuOrders?: any[] }) {
    const pathname = usePathname()
    const router = useRouter()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }

    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        'Aplicaciones': false,
        'Mantenedor': false,
        'Mantenedor-Operaciones': false,
        'Reportes': false,
        'Áreas': false
    })

    const toggleMenu = (e: MouseEvent, name: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (isCollapsed) setIsCollapsed(false)
        setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }))
    }

    const rawPermissions: string[] = Array.isArray(user.role.permissions)
        ? user.role.permissions
        : (typeof user.role.permissions === 'string'
            ? JSON.parse(user.role.permissions)
            : [])

    const isAdmin = user.role.name === 'admin' || user.role.name === 'Administrador'
    const permissions = isAdmin && !rawPermissions.includes('view_tablero_distancias')
        ? [...rawPermissions, 'view_tablero_distancias']
        : rawPermissions

    const menuItems: MenuItem[] = RAW_MENU_ITEMS

    // Recursive search to filter items based on user permissions
    const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
        return items.map(item => {
            if (item.subItems) {
                const visibleSubItems = filterMenuItems(item.subItems)
                return { ...item, subItems: visibleSubItems }
            }
            return item
        }).filter(item => {
            const isAdmin = user.role.name === 'admin' || user.role.name === 'Administrador'
            
            const hasPermission = !item.requiredPermission || (
                Array.isArray(item.requiredPermission)
                    ? item.requiredPermission.some((p: string) => permissions.includes(p))
                    : permissions.includes(item.requiredPermission)
            )

            const hasArea = !item.requiredArea || isAdmin || (
                user.areas?.some(a => a.nombre.toLowerCase().includes(item.requiredArea!.toLowerCase()))
            )

            const customCondition = item.showCondition ? item.showCondition(user) : true

            if (item.subItems) {
                return customCondition && hasPermission && hasArea && item.subItems.length > 0
            }
            return customCondition && hasPermission && hasArea
        })
    }

    const sortItems = (items: MenuItem[], parentName = ''): MenuItem[] => {
        const sorted = [...items].map((item, idx) => ({ item, defaultIndex: idx }))
        sorted.sort((a, b) => {
            const orderA = menuOrders.find(o => o.parentKey === parentName && o.itemKey === a.item.name)?.position
            const orderB = menuOrders.find(o => o.parentKey === parentName && o.itemKey === b.item.name)?.position
            
            if (orderA !== undefined && orderB !== undefined) {
                return orderA - orderB
            }
            if (orderA !== undefined) return -1
            if (orderB !== undefined) return 1
            return a.defaultIndex - b.defaultIndex
        })
        
        return sorted.map(({ item }) => {
            if (item.subItems) {
                return {
                    ...item,
                    subItems: sortItems(item.subItems, item.name)
                }
            }
            return item
        })
    }

    const visibleItems = sortItems(filterMenuItems(menuItems))

    // Recursive Sidebar Item Component
    const SidebarNavItem = ({ item, depth = 0, parentPath = '' }: { item: MenuItem, depth: number, parentPath: string }) => {
        const itemKey = parentPath ? `${parentPath}-${item.name}` : item.name
        const hasSubItems = item.subItems && item.subItems.length > 0
        const isActive = item.href ? (pathname === item.href || pathname.startsWith(`${item.href}/`)) : false
        const isExpanded = expandedMenus[itemKey]

        const baseStyles = "w-full flex items-center justify-between transition-all duration-200 group"
        
        // Dynamic styling based on depth
        const depthStyles = depth === 0 
            ? "px-3 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white"
            : depth === 1
                ? "px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800"
                : depth === 2
                    ? "px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800"
                    : "px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-slate-800"

        const activeStyles = depth === 0
            ? "bg-cyan-500/10 text-cyan-400 font-medium"
            : "text-cyan-400 font-medium"

        if (hasSubItems) {
            return (
                <div key={item.name} className={depth > 0 ? "mt-1" : ""}>
                    <button
                        onClick={(e) => toggleMenu(e, itemKey)}
                        className={`${baseStyles} ${depthStyles} ${isActive ? activeStyles : ''} ${isCollapsed && depth === 0 ? 'justify-center px-0' : ''}`}
                        title={isCollapsed ? item.name : undefined}
                    >
                        <div className={`flex items-center gap-3 ${isCollapsed && depth === 0 ? 'justify-center' : ''}`}>
                            {item.icon && (
                                <span className="text-xl transition-transform duration-200 group-hover:scale-110">
                                    {item.icon}
                                </span>
                            )}
                            {!isCollapsed && (
                                <span className={depth === 0 ? "" : "truncate"}>{item.name}</span>
                            )}
                        </div>
                        {!isCollapsed && (
                            <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} style={{ fontSize: depth === 0 ? '12px' : '10px' }}>
                                ▼
                            </span>
                        )}
                    </button>

                    {isExpanded && (
                        <div className={`mt-1 space-y-1 border-l border-slate-700/50 pl-3 ${depth === 0 ? "ml-9" : depth === 1 ? "ml-4" : "ml-4"}`}>
                            {item.subItems!.map((sub) => (
                                <SidebarNavItem key={sub.name} item={sub} depth={depth + 1} parentPath={itemKey} />
                            ))}
                        </div>
                    )}
                </div>
            )
        }

        return (
            <Link
                key={item.name}
                href={item.href!}
                className={`${baseStyles} ${depthStyles} ${isActive ? activeStyles : ''} ${isCollapsed && depth === 0 ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.name : undefined}
            >
                <div className={`flex items-center gap-3 ${isCollapsed && depth === 0 ? 'justify-center' : ''}`}>
                    {item.icon && (
                        <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                            {item.icon}
                        </span>
                    )}
                    {!isCollapsed && (
                        <span className={depth === 0 ? "font-medium" : ""}>{item.name}</span>
                    )}
                </div>
            </Link>
        )
    }

    return (
        <>
            {/* Mobile Header Button */}
            <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden fixed top-3 left-4 z-40 p-2 rounded-xl bg-white shadow-sm border border-gray-200 text-gray-700 flex items-center justify-center transition-colors hover:bg-gray-50"
            >
                <span className="text-xl">☰</span>
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/50">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {!isCollapsed ? (
                            <span className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.2)]">HENDAYA</span>
                        ) : (
                            <span className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-400 ml-1">H</span>
                        )}
                    </div>
                    {/* Collapse Toggle Button */}
                    <button 
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/40 transition-all cursor-pointer shadow-sm group"
                        title={isCollapsed ? "Expandir menú lateral" : "Ocultar / Contraer menú lateral"}
                    >
                        <span className="text-xs font-black transition-transform group-hover:scale-125">
                            {isCollapsed ? '▶' : '◀'}
                        </span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-hide">
                    {!isCollapsed && (
                        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Menú Principal
                        </p>
                    )}
                    {visibleItems.map((item) => (
                        <SidebarNavItem key={item.name} item={item} depth={0} parentPath="" />
                    ))}
                </nav>

                {/* Bottom User Area */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={`flex w-full items-center gap-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                        title={isCollapsed ? "Cerrar Sesión" : undefined}
                    >
                        <span className="text-xl group-hover:-translate-x-1 transition-transform">🚪</span>
                        {!isCollapsed && (
                            <span className="font-medium">{isLoggingOut ? 'Saliendo...' : 'Cerrar Sesión'}</span>
                        )}
                    </button>
                    {!isCollapsed && user.name && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800/50">
                            <p className="text-xs text-slate-500 truncate">Usuario</p>
                            <p className="text-sm font-bold text-slate-300 truncate">{user.name}</p>
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}
