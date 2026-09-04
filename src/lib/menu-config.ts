export interface MenuItemConfig {
    name: string
    href?: string
    icon?: string
    requiredPermission?: string | string[] | null
    requiredArea?: string | null
    showCondition?: (user: any) => boolean
    subItems?: MenuItemConfig[]
}

export interface MenuSection {
    id: string
    label: string
    parentKey: string
    items: string[]
}

export const RAW_MENU_ITEMS: MenuItemConfig[] = [
    { name: 'Inicio', href: '/dashboard', icon: '🏠', requiredPermission: null },
    {
        name: 'Tableros y Avances',
        icon: '📈',
        requiredPermission: ['view_tablero', 'view_tablero_pan', 'view_tablero_gas', 'view_tablero_retiro', 'view_tablero_elementos', 'view_tablero_multas_ee', 'view_tablero_organigrama', 'view_tablero_distancias', 'view_tablero_actas', 'view_tablero_auditoria', 'view_tablero_verificador_temperaturas', 'view_tablero_widgets'],
        subItems: [
            { name: 'Avance PMPA', href: '/dashboard/tablero', requiredPermission: 'view_tablero' },
            { name: 'Widgets', href: '/dashboard/tablero/widgets', requiredPermission: 'view_tablero_widgets' },
            { name: 'Organigrama por zonas', href: '/dashboard/tablero/organigrama', requiredPermission: 'view_tablero_organigrama' },
            { name: 'Solicitudes de Pan', href: '/dashboard/tablero/solicitudes-pan', requiredPermission: 'view_tablero_pan' },
            { name: 'Solicitud de Gas', href: '/dashboard/tablero/solicitud-gas', requiredPermission: 'view_tablero_gas' },
            { name: 'Retiro de Saldos', href: '/dashboard/tablero/retiro-saldos', requiredPermission: 'view_tablero_retiro' },
            { name: 'Carga de Elementos Esenciales', href: '/dashboard/tablero/elementos-esenciales', requiredPermission: 'view_tablero_elementos' },
            { name: 'Multas EE', href: '/dashboard/tablero/multas-ee', requiredPermission: 'view_tablero_multas_ee' },
            { name: 'Tablero de Kilometraje', href: '/dashboard/tablero/kilometraje', requiredPermission: 'view_tablero_distancias' },
            { name: 'Tablero Actas', href: '/dashboard/tablero/actas', requiredPermission: 'view_tablero_actas' },
            { name: 'Verificador de temperaturas', href: '/dashboard/tablero/verificador-temperaturas', requiredPermission: 'view_tablero_verificador_temperaturas' },
            { name: 'Auditoría', href: '/dashboard/tablero/auditoria', requiredPermission: 'view_tablero_auditoria' }
        ]
    },
    {
        name: 'Aplicaciones',
        icon: '📱',
        requiredPermission: ['view_ingreso_raciones', 'view_solicitud_pan', 'view_solicitud_gas', 'view_retiro_saldos'],
        subItems: [
            { name: 'Ingreso de Raciones', href: '/dashboard/ingreso-raciones', requiredPermission: 'view_ingreso_raciones' },
            { name: 'Solicitud de Pan', href: '/dashboard/solicitud-pan', requiredPermission: 'view_solicitud_pan' },
            { name: 'Solicitud de Gas', href: '/dashboard/solicitud-gas', requiredPermission: 'view_solicitud_gas' },
            { name: 'Retiro de Saldos', href: '/dashboard/retiro-saldos', requiredPermission: 'view_retiro_saldos' }
        ]
    },
    {
        name: 'Gestor Documental',
        icon: '🗄️',
        href: '/dashboard/documentos',
        requiredPermission: 'view_documentos'
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
                showCondition: (user: any) => {
                    const isAdmin = user.role.name === 'Administrador' || user.role.name === 'admin'
                    const hasCalidad = user.areas?.some((a: any) => a.nombre.toLowerCase().includes('calidad'))
                    const hasPerm = user.role.permissions.includes('view_calidad') || 
                                   user.role.permissions.includes('view_retorno_productos') ||
                                   user.role.permissions.includes('view_verificador_temperaturas')
                    return !!(isAdmin || hasCalidad || hasPerm)
                },
                subItems: [
                    { 
                        name: 'Retirada de Productos', 
                        href: '/dashboard/areas/calidad/retorno-productos', 
                        requiredPermission: null,
                        showCondition: (user: any) => {
                            const isAdmin = user.role.name === 'Administrador' || user.role.name === 'admin'
                            const hasCalidad = user.areas?.some((a: any) => a.nombre.toLowerCase().includes('calidad'))
                            const hasPerm = user.role.permissions.includes('view_retorno_productos')
                            return !!(isAdmin || hasCalidad || hasPerm)
                        }
                    },
                    {
                        name: 'Verificador de Temperaturas',
                        href: '/dashboard/areas/calidad/verificador-temperaturas',
                        requiredPermission: 'view_verificador_temperaturas'
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
        icon: '🛡️',
        requiredPermission: ['view_matriz_riesgo', 'fill_nueva_matriz', 'view_detalle_matriz', 'manage_matriz_2026', 'manage_evaluacion_detallada', 'manage_mitigacion', 'close_matriz_riesgo', 'view_historico_matriz', 'view_estado_avance', 'view_auditoria', 'view_inf_auditoria_mitigacion', 'view_hoja_b_estandar_pae'],
        subItems: [
            { name: 'Ingresar nueva Matriz', href: '/dashboard/matriz-riesgo/ingresar', requiredPermission: 'fill_nueva_matriz' },
            { name: 'Detalle Matriz', href: '/dashboard/matriz-riesgo/detalle', requiredPermission: 'view_detalle_matriz' },
            { name: 'Cierre de Mitigación', href: '/dashboard/matriz-riesgo/mitigacion', requiredPermission: 'manage_mitigacion' },
            { name: 'Sol. desviación Matriz', href: '/dashboard/matriz-riesgo/cerrar-matriz', requiredPermission: 'close_matriz_riesgo' },
            { name: 'Histórico de Matrices', href: '/dashboard/matriz-riesgo/historico', requiredPermission: 'view_historico_matriz' },
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
        name: 'Actas',
        icon: '📜',
        requiredPermission: ['view_generar_actas', 'view_descargar_actas'],
        subItems: [
            { name: 'Generar Acta', href: '/dashboard/actas/generar-acta', requiredPermission: 'view_generar_actas' },
            { name: 'Descargar Actas', href: '/dashboard/actas/descargar-actas', requiredPermission: 'view_descargar_actas' }
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
        requiredPermission: ['view_colegios', 'view_productos', 'view_pmpa', 'view_consumo_gas', 'view_preparaciones', 'view_minutas', 'view_raciones', 'view_codigo_causa', 'manage_sucursales', 'manage_areas', 'manage_vehiculos', 'manage_zonales', 'manage_jefe_operacion', 'manage_supervisor', 'manage_manipuladoras_masiva', 'manage_colegios_matriz', 'manage_nueva_matriz', 'manage_actas_supervision', 'manage_doc_configuracion', 'manage_doc_carpetas', 'manage_doc_privilegios'],
        subItems: [
            {
                name: 'Gestor Documental',
                requiredPermission: ['manage_doc_configuracion', 'manage_doc_carpetas', 'manage_doc_privilegios'],
                subItems: [
                    { name: 'Configuración', href: '/dashboard/mantenedor/gestor-documental/configuracion', requiredPermission: 'manage_doc_configuracion' },
                    { name: 'Carpetas y Documentos', href: '/dashboard/mantenedor/gestor-documental/carpetas', requiredPermission: 'manage_doc_carpetas' },
                    { name: 'Privilegios de Acceso', href: '/dashboard/mantenedor/gestor-documental/privilegios', requiredPermission: 'manage_doc_privilegios' }
                ]
            },
            {
                name: 'Actas de Supervisión',
                requiredPermission: 'manage_actas_supervision',
                subItems: [
                    { name: 'Crear Acta', href: '/dashboard/mantenedor/actas-supervision/crear', requiredPermission: 'manage_actas_supervision' },
                    { name: 'Asociar RBD a usuario', href: '/dashboard/mantenedor/actas-supervision/asociar-rbd', requiredPermission: 'manage_actas_supervision' }
                ]
            },
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
        requiredPermission: ['manage_global_config', 'manage_correo', 'manage_listas', 'manage_notificaciones', 'manage_users', 'manage_roles', 'manage_menu_reorder'],
        subItems: [
            { name: 'Global', href: '/dashboard/configuracion/global', requiredPermission: 'manage_global_config' },
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
        requiredPermission: ['manage_anexos', 'view_anexos', 'view_conversacion'],
        subItems: [
            { name: 'Conversación', href: '/dashboard/ayuda/conversacion', requiredPermission: 'view_conversacion' },
            { name: 'Agregar Anexos', href: '/dashboard/ayuda/agregar', requiredPermission: 'manage_anexos' },
            { name: 'Ver Anexos', href: '/dashboard/ayuda/ver', requiredPermission: 'view_anexos' }
        ]
    }
]

/**
 * Genera automáticamente todas las secciones de reubicación dinámicamente a partir de la estructura del menú.
 */
export function getDynamicMenuSections(items: MenuItemConfig[] = RAW_MENU_ITEMS): MenuSection[] {
    const sections: MenuSection[] = [
        {
            id: 'main',
            label: 'Menú Principal (Nivel Superior)',
            parentKey: '',
            items: items.map(i => i.name)
        }
    ]

    function traverse(subItems: MenuItemConfig[], path: string[]) {
        for (const item of subItems) {
            if (item.subItems && item.subItems.length > 0) {
                const currentPath = [...path, item.name]
                const label = currentPath.length === 1
                    ? (item.name === 'Áreas' || item.name === 'Mantenedor' ? `${item.name} (Submenú Principal)` : item.name)
                    : currentPath.join(' -> ')

                const id = currentPath
                    .map(p => p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_'))
                    .join('_')

                sections.push({
                    id,
                    label,
                    parentKey: item.name,
                    items: item.subItems.map(s => s.name)
                })

                traverse(item.subItems, currentPath)
            }
        }
    }

    traverse(items, [])
    return sections
}

export const MENU_SECTIONS: MenuSection[] = getDynamicMenuSections()
