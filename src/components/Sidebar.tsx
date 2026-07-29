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
    areas?: { id: number, nombre: string }[]
    sucursales?: { id: string, nombre: string }[]
}

interface MenuItem {
    name: string
    href?: string
    icon?: string
    requiredPermission?: string | string[] | null
    requiredArea?: string | null
    showCondition?: (user: User) => boolean
    subItems?: MenuItem[]
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

    const menuItems: MenuItem[] = [
        { name: 'Inicio', href: '/dashboard', icon: '🏠', requiredPermission: null },
        {
            name: 'Tableros y Avances',
            icon: '📈',
            requiredPermission: ['view_tablero', 'view_tablero_pan', 'view_tablero_gas', 'view_tablero_retiro', 'view_tablero_elementos', 'view_tablero_multas_ee', 'view_tablero_organigrama', 'view_tablero_distancias', 'view_tablero_auditoria'],
            subItems: [
                { name: 'Avance PMPA', href: '/dashboard/tablero', requiredPermission: 'view_tablero' },
                { name: 'Organigrama por zonas', href: '/dashboard/tablero/organigrama', requiredPermission: 'view_tablero_organigrama' },
                { name: 'Solicitudes de Pan', href: '/dashboard/tablero/solicitudes-pan', requiredPermission: 'view_tablero_pan' },
                { name: 'Solicitud de Gas', href: '/dashboard/tablero/solicitud-gas', requiredPermission: 'view_tablero_gas' },
                { name: 'Retiro de Saldos', href: '/dashboard/tablero/retiro-saldos', requiredPermission: 'view_tablero_retiro' },
                { name: 'Carga de Elementos Esenciales', href: '/dashboard/tablero/elementos-esenciales', requiredPermission: 'view_tablero_elementos' },
                { name: 'Multas EE', href: '/dashboard/tablero/multas-ee', requiredPermission: 'view_tablero_multas_ee' },
                { name: 'Tablero de Kilometraje', href: '/dashboard/tablero/kilometraje', requiredPermission: 'view_tablero_distancias' },
                { name: 'Auditoría', href: '/dashboard/tablero/auditoria', requiredPermission: 'view_tablero_auditoria' }
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
            name: 'Áreas',
            icon: '🏢',
            requiredPermission: 'view_areas',
            subItems: [
                {
                    name: 'Operaciones',
                    requiredPermission: 'view_operaciones',
                    requiredArea: 'Operaciones',
                    subItems: [
                        {
                            name: 'Trabajos Preventivos / Correctivos',
                            requiredPermission: 'view_trabajos_prev_corr_menu',
                            subItems: [
                                { name: 'Cargar OT', href: '/dashboard/trabajos-preventivos', requiredPermission: 'view_trabajos_preventivos' },
                                { name: 'Presupuesto', href: '/dashboard/trabajos-preventivos/presupuesto', requiredPermission: 'manage_presupuesto' },
                                { name: 'Estado de Avance', href: '/dashboard/trabajos-preventivos/avance', requiredPermission: 'view_estado_avance_tp' }
                            ]
                        },
                        {
                            name: 'Carga de Elementos Esenciales',
                            href: '/dashboard/areas/operaciones/elementos-esenciales',
                            requiredPermission: 'view_elementos_esenciales'
                        },
                        {
                            name: 'Descargas PAE Online',
                            href: '/dashboard/areas/operaciones/descargas-pae',
                            requiredPermission: 'view_operaciones_descargas_pae'
                        },
                        {
                            name: 'Cargar PaeOnline',
                            href: '/dashboard/areas/operaciones/cargar-pae',
                            requiredPermission: 'view_operaciones_cargar_pae'
                        }
                    ]
                },
                {
                    name: 'Manipuladoras',
                    requiredPermission: 'view_manipuladoras',
                    requiredArea: 'Manipuladoras',
                    subItems: [
                        {
                            name: 'Cálculo de gramaje',
                            href: '/dashboard/areas/manipuladoras/captura-certificacion',
                            requiredPermission: 'view_captura_certificacion'
                        }
                    ]
                },
                {
                    name: 'Calidad',
                    requiredPermission: null,
                    requiredArea: null,
                    showCondition: (user: User) => {
                        const isAdmin = user.role.name === 'Administrador' || user.role.name === 'admin';
                        const hasCalidad = user.areas?.some(a => a.nombre.toLowerCase().includes('calidad'));
                        const hasPerm = user.role.permissions.includes('view_calidad') || user.role.permissions.includes('view_retorno_productos');
                        return !!(isAdmin || hasCalidad || hasPerm);
                    },
                    subItems: [
                        { 
                            name: 'Retirada de Productos', 
                            href: '/dashboard/areas/calidad/retorno-productos', 
                            requiredPermission: null,
                            showCondition: (user: User) => {
                                const isAdmin = user.role.name === 'Administrador' || user.role.name === 'admin';
                                const hasCalidad = user.areas?.some(a => a.nombre.toLowerCase().includes('calidad'));
                                const hasPerm = user.role.permissions.includes('view_retorno_productos');
                                return !!(isAdmin || hasCalidad || hasPerm);
                            }
                        },
                        {
                            name: 'Subir Actas Estándar PAE',
                            href: '/dashboard/areas/calidad/subir-actas-pae',
                            requiredPermission: 'view_calidad_subir_actas_estandar_pae'
                        }
                    ]
                },
                {
                    name: 'Multas',
                    requiredPermission: 'view_multas_areas',
                    subItems: [
                        {
                            name: 'Cálculos de Elementos Esenciales',
                            href: '/dashboard/areas/multas/calculos',
                            requiredPermission: 'manage_calculos_ee'
                        },
                        {
                            name: 'Descargos de actas',
                            href: '/dashboard/areas/multas/descargos',
                            requiredPermission: 'manage_descargos'
                        }
                    ]
                }
            ]
        },

        {
            name: 'Matriz de riesgo',
            icon: '📋',
            requiredPermission: ['view_matriz_riesgo', 'fill_nueva_matriz', 'view_detalle_matriz', 'manage_matriz_2026', 'manage_evaluacion_detallada', 'manage_mitigacion', 'close_matriz_riesgo', 'view_estado_avance', 'view_auditoria', 'view_inf_auditoria_mitigacion', 'view_hoja_b_estandar_pae'],
            subItems: [
                { name: 'Ingresar nueva Matriz', href: '/dashboard/matriz-riesgo/ingresar', requiredPermission: 'fill_nueva_matriz' },
                { name: 'Detalle Matriz', href: '/dashboard/matriz-riesgo/detalle', requiredPermission: 'view_detalle_matriz' },
                { name: 'Cierre de Mitigación', href: '/dashboard/matriz-riesgo/mitigacion', requiredPermission: 'manage_mitigacion' },
                { name: 'Sol. desviación Matriz', href: '/dashboard/matriz-riesgo/cerrar-matriz', requiredPermission: 'close_matriz_riesgo' },
                { name: 'Estado de Avance', href: '/dashboard/matriz-riesgo/estado-avance', requiredPermission: 'view_estado_avance' },
                { name: 'Auditoría', href: '/dashboard/matriz-riesgo/auditoria', requiredPermission: 'view_auditoria' },
                { name: 'Inf. Auditoria Mitigación', href: '/dashboard/matriz-riesgo/inf-auditoria-mitigacion', requiredPermission: 'view_inf_auditoria_mitigacion' },
                { name: 'Hoja B Estandar Pae', href: '/dashboard/matriz-riesgo/hoja-b-estandar-pae', requiredPermission: 'view_hoja_b_estandar_pae' },
                {
                    name: 'Matriz 2026',
                    requiredPermission: ['manage_matriz_2026', 'manage_evaluacion_detallada'],
                    subItems: [
                        { name: 'Ingresar nueva Matriz', href: '/dashboard/matriz-riesgo/matriz-2026/ingresar', requiredPermission: 'manage_matriz_2026' },
                        { name: 'Evaluación Detallada', href: '/dashboard/matriz-riesgo/matriz-2026/evaluacion-detallada', requiredPermission: 'manage_evaluacion_detallada' }
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
            requiredPermission: ['view_colegios', 'view_productos', 'view_pmpa', 'view_consumo_gas', 'view_preparaciones', 'view_minutas', 'view_raciones', 'view_codigo_causa', 'manage_sucursales', 'manage_areas', 'manage_vehiculos', 'manage_zonales', 'manage_jefe_operacion', 'manage_supervisor', 'manage_manipuladoras_masiva', 'manage_colegios_matriz', 'manage_nueva_matriz'],
            subItems: [
                {
                    name: 'Operaciones',
                    requiredPermission: ['view_pmpa', 'view_colegios', 'view_consumo_gas', 'manage_sucursales', 'manage_vehiculos', 'manage_zonales', 'manage_jefe_operacion', 'manage_supervisor'],
                    subItems: [
                        { name: 'Sucursal', href: '/dashboard/mantenedor/operaciones/sucursales', requiredPermission: 'manage_sucursales' },
                        { name: 'PMPA', href: '/dashboard/mantenedor/operaciones/pmpa', requiredPermission: 'view_pmpa' },
                        { name: 'Colegio', href: '/dashboard/mantenedor/operaciones/colegios', requiredPermission: 'view_colegios' },
                        { name: 'Consumo de Gas x RBD', href: '/dashboard/mantenedor/operaciones/consumo-gas', requiredPermission: 'view_consumo_gas' },
                        { name: 'Vehículos', href: '/dashboard/mantenedor/operaciones/vehiculos', requiredPermission: 'manage_vehiculos' },
                        { name: 'Zonales', href: '/dashboard/mantenedor/operaciones/personal?tab=zonales', requiredPermission: 'manage_zonales' },
                        { name: 'Jefes de Operación', href: '/dashboard/mantenedor/operaciones/personal?tab=jefe-operacion', requiredPermission: 'manage_jefe_operacion' },
                        { name: 'Supervisores', href: '/dashboard/mantenedor/operaciones/personal?tab=supervisor', requiredPermission: 'manage_supervisor' }
                    ]
                },
                {
                    name: 'Manipuladora',
                    requiredPermission: 'manage_manipuladoras_masiva',
                    subItems: [
                        { name: 'Carga Masiva de usuario', href: '/dashboard/mantenedor/manipuladoras', requiredPermission: 'manage_manipuladoras_masiva' }
                    ]
                },
                {
                    name: 'Matriz de Riesgo',
                    requiredPermission: ['manage_colegios_matriz', 'manage_nueva_matriz'],
                    subItems: [
                        { name: 'Colegios Activos', href: '/dashboard/mantenedor/matriz-riesgo/colegios-activos', requiredPermission: 'manage_colegios_matriz' },
                        { name: 'Nueva Matriz', href: '/dashboard/mantenedor/matriz-riesgo/nueva-matriz', requiredPermission: 'manage_nueva_matriz' }
                    ]
                },
                { name: 'Área', href: '/dashboard/mantenedor/areas', requiredPermission: 'manage_areas' },
                { name: 'Productos', href: '/dashboard/productos', requiredPermission: 'view_productos' },
                {
                    name: 'Pae Online',
                    requiredPermission: 'view_codigo_causa',
                    subItems: [
                        { name: 'Código de Causa', href: '/dashboard/mantenedor/pae-online/codigo-causa', requiredPermission: 'view_codigo_causa' }
                    ]
                },
                {
                    name: 'Multas',
                    requiredPermission: 'manage_utm',
                    subItems: [
                        { name: 'UTM', href: '/dashboard/mantenedor/multas/utm', requiredPermission: 'manage_utm' },
                        { name: 'Fórmulas de Aspecto EE', href: '/dashboard/mantenedor/multas/aspectos-ee', requiredPermission: 'manage_aspectos_ee' },
                        { name: 'Servicios', href: '/dashboard/mantenedor/multas/servicios', requiredPermission: 'manage_multa_servicios' }
                    ]
                },
                {
                    name: 'Calculadora',
                    requiredPermission: ['view_preparaciones', 'view_minutas', 'view_raciones'],
                    subItems: [
                        { name: 'Preparaciones', href: '/dashboard/calculadora/preparaciones', requiredPermission: 'view_preparaciones' },
                        { name: 'Minutas', href: '/dashboard/calculadora/minutas', requiredPermission: 'view_minutas' },
                        { name: 'Raciones', href: '/dashboard/calculadora/raciones', requiredPermission: 'view_raciones' }
                    ]
                }
            ]
        },
        {
            name: 'Configuración',
            icon: '🔧',
            requiredPermission: ['manage_correo', 'manage_listas', 'manage_notificaciones', 'manage_users', 'manage_roles', 'manage_menu_reorder'],
            subItems: [
                { name: 'Gestión de Usuarios', href: '/dashboard/users', requiredPermission: 'manage_users' },
                { name: 'Roles y Perfiles', href: '/dashboard/roles', requiredPermission: 'manage_roles' },
                { name: 'Reubicación de Aplicaciones', href: '/dashboard/configuracion/reubicacion', requiredPermission: 'manage_menu_reorder' },
                { name: 'Configuración de Correo', href: '/dashboard/configuracion/correo', requiredPermission: 'manage_correo' },
                { name: 'Listas de Distribución', href: '/dashboard/configuracion/listas-correo', requiredPermission: 'manage_listas' },
                { name: 'Notificaciones por Pantalla', href: '/dashboard/configuracion/notificaciones', requiredPermission: 'manage_notificaciones' }
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
