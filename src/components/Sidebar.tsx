'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, MouseEvent } from 'react'

type User = {
    username: string
    name: string | null
    role: {
        name: string
        permissions: string[]
    }
}

export default function Sidebar({ user }: { user: User }) {
    const pathname = usePathname()
    const router = useRouter()
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }

    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        'Aplicaciones': true,
        'Mantenedor': false,
        'Reportes': false
    })

    const toggleMenu = (e: MouseEvent, name: string) => {
        e.preventDefault()
        setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }))
    }

    const permissions = user.role.permissions

    const menuItems = [
        { name: 'Inicio', href: '/dashboard', icon: '🏠', requiredPermission: null }, 
        {
            name: 'Tableros y Avances',
            icon: '📈',
            requiredPermission: ['view_tablero', 'view_tablero_pan', 'view_tablero_gas', 'view_tablero_retiro'],
            subItems: [
                { name: 'Avance PMPA', href: '/dashboard/tablero', requiredPermission: 'view_tablero' },
                { name: 'Solicitudes de Pan', href: '/dashboard/tablero/solicitudes-pan', requiredPermission: 'view_tablero_pan' },
                { name: 'Solicitud de Gas', href: '/dashboard/tablero/solicitud-gas', requiredPermission: 'view_tablero_gas' },
                { name: 'Retiro de Saldos', href: '/dashboard/tablero/retiro-saldos', requiredPermission: 'view_tablero_retiro' }
            ]
        },
        {
            name: 'Aplicaciones',
            icon: '📁',
            requiredPermission: ['view_ingreso_raciones', 'view_solicitud_pan', 'view_solicitud_gas', 'view_retiro_saldos'],
            subItems: [
                { name: 'Ingreso de Raciones', href: '/dashboard/ingreso-raciones', requiredPermission: 'view_ingreso_raciones' },
                { name: 'Solicitud de Pan', href: '/dashboard/solicitud-pan', requiredPermission: 'view_solicitud_pan' },
                { name: 'Solicitud de Gas', href: '/dashboard/solicitud-gas', requiredPermission: 'view_solicitud_gas' },
                { name: 'Retiro de Saldos', href: '/dashboard/retiro-saldos', requiredPermission: 'view_retiro_saldos' }
            ]
        },
        {
            name: 'Matriz de riesgo',
            icon: '📋',
            requiredPermission: ['view_matriz_riesgo', 'manage_matriz_2026', 'manage_colegios_matriz', 'manage_evaluacion_detallada', 'manage_mitigacion'],
            subItems: [
                { 
                    name: 'Matriz 2026', 
                    requiredPermission: ['manage_matriz_2026', 'manage_colegios_matriz', 'manage_evaluacion_detallada', 'manage_mitigacion', 'view_estado_avance'],
                    subItems: [
                        { name: 'Ingresar nueva Matriz', href: '/dashboard/matriz-riesgo/matriz-2026/ingresar', requiredPermission: 'manage_matriz_2026' },
                        { name: 'Colegios Activos', href: '/dashboard/matriz-riesgo/matriz-2026/colegios-activos', requiredPermission: 'manage_colegios_matriz' },
                        { name: 'Evaluación Detallada', href: '/dashboard/matriz-riesgo/matriz-2026/evaluacion-detallada', requiredPermission: 'manage_evaluacion_detallada' },
                        { name: 'Mitigación', href: '/dashboard/matriz-riesgo/matriz-2026/mitigacion', requiredPermission: 'manage_mitigacion' },
                        { name: 'Estado de Avance', href: '/dashboard/matriz-riesgo/matriz-2026/estado-avance', requiredPermission: 'view_estado_avance' }
                    ]
                }
            ]
        },
        {
            name: 'Formularios',
            icon: '📝',
            requiredPermission: ['view_formularios', 'create_formularios', 'fill_formularios', 'view_respuestas'],
            subItems: [
                { name: 'Gestión de Formularios', href: '/dashboard/formularios/gestion', requiredPermission: 'view_formularios' },
                { name: 'Crear Formulario', href: '/dashboard/formularios/crear', requiredPermission: 'create_formularios' },
                { name: 'Completar Formulario', href: '/dashboard/formularios/abrir', requiredPermission: 'fill_formularios' },
                { name: 'Respuestas de Formularios', href: '/dashboard/formularios/respuestas', requiredPermission: 'view_respuestas' }
            ]
        },
        {
            name: 'Reportes',
            icon: '📊',
            requiredPermission: ['view_reports', 'view_solicitud_pan_report', 'view_solicitud_gas_report', 'view_retiro_report'],
            subItems: [
                { name: 'Informe de Carga de Raciones', href: '/dashboard/reports/carga-raciones' },
                { name: 'Solicitud de Pan', href: '/dashboard/reports/solicitud-pan', requiredPermission: 'view_solicitud_pan_report' },
                { name: 'Solicitud de Gas', href: '/dashboard/reports/solicitud-gas', requiredPermission: 'view_solicitud_gas_report' },
                { name: 'Retiro de Saldos', href: '/dashboard/reports/retiro-saldos', requiredPermission: 'view_retiro_report' }
            ]
        },
        {
            name: 'Mantenedor',
            icon: '⚙️',
            requiredPermission: ['view_colegios', 'view_productos', 'view_pmpa', 'view_consumo_gas'],
            subItems: [
                { name: 'PMPA', href: '/dashboard/pmpa', requiredPermission: 'view_pmpa' },
                { name: 'Colegios', href: '/dashboard/colegios', requiredPermission: 'view_colegios' },
                { name: 'Productos', href: '/dashboard/productos', requiredPermission: 'view_productos' },
                { name: 'Consumo de Gas por RBD', href: '/dashboard/consumo-gas', requiredPermission: 'view_consumo_gas' }
            ]
        },
        {
            name: 'Configuración',
            icon: '🔧',
            requiredPermission: ['manage_correo', 'manage_listas', 'manage_notificaciones', 'manage_sucursales', 'manage_users', 'manage_roles'],
            subItems: [
                { name: 'Gestión de Usuarios', href: '/dashboard/users', requiredPermission: 'manage_users' },
                { name: 'Roles y Perfiles', href: '/dashboard/roles', requiredPermission: 'manage_roles' },
                { name: 'Configuración de Correo', href: '/dashboard/configuracion/correo', requiredPermission: 'manage_correo' },
                { name: 'Listas de Distribución', href: '/dashboard/configuracion/listas-correo', requiredPermission: 'manage_listas' },
                { name: 'Notificaciones por Pantalla', href: '/dashboard/configuracion/notificaciones', requiredPermission: 'manage_notificaciones' },
                { name: 'Mantenedor de Sucursales', href: '/dashboard/configuracion/sucursales', requiredPermission: 'manage_sucursales' },
                { name: 'Mantenedor de Áreas', href: '/dashboard/configuracion/areas', requiredPermission: 'manage_areas' }
            ]
        },
        {
            name: 'Ayuda',
            icon: '❓',
            requiredPermission: ['manage_anexos', 'view_anexos'],
            subItems: [
                { name: 'Agregar Anexos', href: '/dashboard/ayuda/agregar', requiredPermission: 'manage_anexos' },
                { name: 'Ver Anexos', href: '/dashboard/ayuda/ver', requiredPermission: 'view_anexos' }
            ]
        }
    ]

    // Recursive search to filter items based on user permissions
    const filterMenuItems = (items: any[]): any[] => {
        return items.map(item => {
            if (item.subItems) {
                const visibleSubItems = filterMenuItems(item.subItems)
                return { ...item, subItems: visibleSubItems }
            }
            return item
        }).filter(item => {
            // Check if item itself has permission
            const hasPermission = !item.requiredPermission || (
                Array.isArray(item.requiredPermission) 
                ? item.requiredPermission.some((p: string) => permissions.includes(p))
                : permissions.includes(item.requiredPermission)
            )

            // If it has subitems, it's visible if it has permission AND at least one visible subitem
            if (item.subItems) {
                return hasPermission && item.subItems.length > 0
            }
            return hasPermission
        })
    }

    const visibleItems = filterMenuItems(menuItems)

    const [isMobileOpen, setIsMobileOpen] = useState(false)

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

            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-screen shrink-0 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.2)]">HENDAYA</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Menú Principal
                    </p>
                    {visibleItems.map((item) => {
                        const hasSubItems = item.subItems && item.subItems.length > 0
                        const isActive = item.href ? (pathname === item.href || pathname.startsWith(`${item.href}/`)) : false
                        const isExpanded = expandedMenus[item.name]

                        return (
                            <div key={item.name}>
                                {hasSubItems ? (
                                    <button
                                        onClick={(e) => toggleMenu(e, item.name)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group hover:bg-slate-800 hover:text-white`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl transition-transform duration-200 group-hover:scale-110">
                                                {item.icon}
                                            </span>
                                            <span>{item.name}</span>
                                        </div>
                                        <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                            ▼
                                        </span>
                                    </button>
                                ) : (
                                    <Link
                                        href={item.href!}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                                        ${isActive
                                                ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                                                : 'hover:bg-slate-800 hover:text-white'
                                            }`}
                                    >
                                        <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                            {item.icon}
                                        </span>
                                        <span>{item.name}</span>
                                    </Link>
                                )}

                                {/* Rendereo de subItems si aplica */}
                                {hasSubItems && isExpanded && (
                                    <div className="ml-9 mt-1 space-y-1 border-l border-slate-700 pl-3">
                                        {item.subItems!.map((sub: any) => {
                                            const hasSubSubItems = sub.subItems && sub.subItems.length > 0
                                            const isSubExpanded = expandedMenus[`${item.name}-${sub.name}`]
                                            const isSubActive = sub.href ? (pathname === sub.href || pathname.startsWith(`${sub.href}/`)) : false

                                            return (
                                                <div key={sub.name}>
                                                    {hasSubSubItems ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => toggleMenu(e, `${item.name}-${sub.name}`)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isSubActive ? 'text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                                            >
                                                                <span>{sub.name}</span>
                                                                <span className={`text-[10px] transition-transform duration-200 ${isSubExpanded ? 'rotate-180' : ''}`}>
                                                                    ▼
                                                                </span>
                                                            </button>
                                                            {isSubExpanded && (
                                                                <div className="ml-4 mt-1 space-y-1 border-l border-slate-800 pl-3">
                                                                    {sub.subItems.map((ssub: any) => {
                                                                        const isSSubActive = pathname === ssub.href || pathname.startsWith(`${ssub.href}/`)
                                                                        return (
                                                                            <Link
                                                                                key={ssub.name}
                                                                                href={ssub.href}
                                                                                className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${isSSubActive ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                                                                            >
                                                                                {ssub.name}
                                                                            </Link>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <Link
                                                            href={sub.href}
                                                            className={`block px-3 py-2 rounded-lg text-sm transition-colors
                                                            ${isSubActive
                                                                    ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                                }`}
                                                        >
                                                            {sub.name}
                                                        </Link>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* Bottom User Area */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
                    >
                        <span className="text-xl group-hover:-translate-x-1 transition-transform">🚪</span>
                        <span className="font-medium">{isLoggingOut ? 'Saliendo...' : 'Cerrar Sesión'}</span>
                    </button>
                </div>
            </aside>
        </>
    )
}
