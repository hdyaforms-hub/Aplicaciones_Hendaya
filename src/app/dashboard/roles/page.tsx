import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import RoleForm from './RoleForm'
import EditRoleForm from './EditRoleForm'
import CopyRoleForm from './CopyRoleForm'
import RolePermissionList from './RolePermissionList'

export default async function RolesPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_roles')) {
        redirect('/dashboard')
    }

    const roles = await prisma.role.findMany({
        include: { _count: { select: { users: true } } },
        orderBy: { createdAt: 'desc' }
    })

    // Lista de permisos disponibles en el sistema
    const availablePermissions = [
        { id: 'view_dashboard_home', name: 'Estadísticas de Inicio', description: 'Acceso visual a estadísticas globales y Estado PMPA en la pantalla de inicio.', category: 'TABLEROS' },
        { id: 'view_tablero', name: 'Tablero de Control', description: 'Acceso visual al reporte gráfico general.', category: 'TABLEROS' },
        { id: 'view_tablero_pan', name: 'Tablero Avance Pan', description: 'Acceso detallado al tablero de analítica de pan.', category: 'TABLEROS' },
        { id: 'view_tablero_gas', name: 'Tablero Avance Gas', description: 'Acceso detallado al tablero de analítica de gas.', category: 'TABLEROS' },
        { id: 'view_tablero_retiro', name: 'Tablero Avance Retiro', description: 'Acceso detallado al tablero de analítica de retiro de saldos.', category: 'TABLEROS' },
        { id: 'view_tablero_elementos', name: 'Tablero Carga de Elementos Esenciales', description: 'Visualización gráfica de cumplimiento de elementos esenciales.', category: 'TABLEROS' },
        { id: 'view_tablero_multas_ee', name: 'Tablero Multas EE', description: 'Acceso visual al reporte gráfico de multas de elementos esenciales.', category: 'TABLEROS' },
        { id: 'view_tablero_organigrama', name: 'Tablero Organigrama por zonas', description: 'Visualización gráfica de la jerarquía operativa (Jefe Zonal -> Jefe de Operaciones -> Supervisor) por sucursal.', category: 'TABLEROS' },
        { id: 'view_tablero_distancias', name: 'Tablero de Kilometraje', description: 'Visualización detallada de distancias y tiempos de viaje de supervisores por sucursal.', category: 'TABLEROS' },
        
        { id: 'view_ingreso_raciones', name: 'Ingreso de Raciones', description: 'Gestión y auditoría de raciones por colegio.', category: 'APLICACIONES' },
        { id: 'view_solicitud_pan', name: 'Solicitud de Pan', description: 'Acceso a la aplicación de Solicitud de Pan.', category: 'APLICACIONES' },
        { id: 'view_solicitud_gas', name: 'Solicitud de Gas', description: 'Acceso a la aplicación de Solicitud de Gas.', category: 'APLICACIONES' },
        { id: 'view_retiro_saldos', name: 'Retiro de Saldos', description: 'Acceso a la aplicación de Retiro de Saldos y Rebaja de Stock.', category: 'APLICACIONES' },
        
        { id: 'view_areas', name: 'Menú Áreas', description: 'Acceso al menú principal de Áreas.', category: 'ÁREAS' },
        { id: 'view_operaciones', name: 'Submenú Operaciones', description: 'Acceso al submenú de Operaciones.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'view_trabajos_prev_corr_menu', name: 'Submenú Trabajos Preventivos / Correctivos', description: 'Acceso al nivel de agrupación de trabajos en el menú.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'view_trabajos_preventivos', name: 'Cargar OT (Trabajos Preventivos / Correctivos)', description: 'Registro y seguimiento de mantenimientos preventivos y correctivos.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'manage_presupuesto', name: 'Presupuesto (Trabajos Preventivos / Correctivos)', description: 'Gestionar el presupuesto anual y visualización trimestral por sucursal.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'view_estado_avance_tp', name: 'Estado de Avance (Trabajos Preventivos)', description: 'Visualizar el progreso semestral de trabajos preventivos.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'view_elementos_esenciales', name: 'Carga de Elementos Esenciales', description: 'Acceso al módulo de elementos esenciales, subir PDFs y exportar a Excel.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'view_operaciones_descargas_pae', name: 'Descargas PAE Online', description: 'Acceso al módulo de descargas automatizadas de informes PAE.', category: 'ÁREAS -> OPERACIONES' },
        { id: 'view_operaciones_cargar_pae', name: 'Carga de PAE', description: 'Acceso al módulo de carga de archivos PAE.', category: 'ÁREAS -> OPERACIONES' },
        
        { id: 'view_manipuladoras', name: 'Submenú Manipuladoras', description: 'Acceso al submenú de Manipuladoras.', category: 'ÁREAS -> MANIPULADORAS' },
        { id: 'view_captura_certificacion', name: 'Cálculo de gramaje', description: 'Acceso a la calculadora de brechas e insumos por RBD.', category: 'ÁREAS -> MANIPULADORAS' },
        { id: 'manage_manipuladoras_masiva', name: 'Gestión y Carga Masiva Manipuladoras', description: 'Permite crear, cargar desde Excel y editar manipuladoras.', category: 'ÁREAS -> MANIPULADORAS' },
        
        { id: 'view_calidad', name: 'Menú Calidad', description: 'Acceso al menú de Calidad en el Sidebar.', category: 'ÁREAS -> CALIDAD' },
        { id: 'view_retorno_productos', name: 'Retirada de productos', description: 'Acceso al dashboard de Retirada de productos.', category: 'ÁREAS -> CALIDAD' },
        { id: 'manage_retorno_productos', name: 'Crear Alerta de Calidad', description: 'Permite crear nuevas alertas de retirada de productos.', category: 'ÁREAS -> CALIDAD' },
        { id: 'view_calidad_subir_actas_estandar_pae', name: 'Subir Actas Estándar PAE', description: 'Acceso a la carga masiva y gestión de actas PDF del Estándar PAE.', category: 'ÁREAS -> CALIDAD' },

        { id: 'view_multas_areas', name: 'Menú Multas', description: 'Acceso al menú de Multas en Áreas.', category: 'ÁREAS -> MULTAS' },
        { id: 'manage_calculos_ee', name: 'Cálculos de Elementos Esenciales', description: 'Permite calcular multas en base a elementos esenciales no conformes.', category: 'ÁREAS -> MULTAS' },

        { id: 'view_matriz_riesgo', name: 'Ver Matriz de Riesgo', description: 'Acceso al menú principal de matrices de riesgo.', category: 'MATRIZ DE RIESGO' },
        { id: 'fill_nueva_matriz', name: 'Ingresar nueva Matriz', description: 'Responder encuestas basadas en plantillas dinámicas de matrices de riesgo.', category: 'MATRIZ DE RIESGO -> INGRESAR NUEVA MATRIZ' },

        { id: 'view_detalle_matriz', name: 'Ver Detalle Matriz', description: 'Permite visualizar el listado de respuestas de la matriz de riesgo.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
        { id: 'edit_detalle_matriz', name: 'Editar Detalle Matriz', description: 'Permite modificar, eliminar y descargar respuestas de la matriz de riesgo.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
        { id: 'view_inf_auditoria_mitigacion', name: 'Inf. Auditoria Mitigación', description: 'Permite visualizar y exportar a PDF el informe de auditoría de mitigación.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
        { id: 'view_hoja_b_estandar_pae', name: 'Hoja B Estandar Pae', description: 'Permite visualizar y exportar a PDF el reporte de Hoja B Estándar PAE.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },

        { id: 'manage_matriz_2026', name: 'Ingresar nueva Matriz 2026', description: 'Permite el ingreso de nuevas matrices de riesgo para el año 2026.', category: 'MATRIZ DE RIESGO -> MATRIZ 2026' },
        { id: 'manage_evaluacion_detallada', name: 'Evaluación Detallada', description: 'Realizar evaluación técnica detallada por puntos críticos.', category: 'MATRIZ DE RIESGO -> MATRIZ 2026' },
        { id: 'manage_mitigacion', name: 'Cierre de Mitigación', description: 'Gestionar plazos y evidencias de solución para hallazgos de la matriz.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
        { id: 'close_matriz_riesgo', name: 'Sol. desviación Matriz', description: 'Mitigar y enviar a supervisión las evaluaciones de matriz de riesgo asignadas.', category: 'MATRIZ DE RIESGO' },
        { id: 'view_estado_avance', name: 'Estado de Avance', description: 'Visualizar el estado de avance de la matriz de riesgo.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
        { id: 'view_auditoria', name: 'Auditoría Externa', description: 'Vista global completa de hallazgos y evidencias para auditores.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },

        { id: 'view_productos', name: 'Mantenedor de Productos', description: 'Acceso a mantenedor y carga masiva de Productos.', category: 'MANTENEDORES' },
        { id: 'manage_areas', name: 'Área', description: 'Creación y administración de áreas de la compañía.', category: 'MANTENEDORES' },

        { id: 'manage_nueva_matriz', name: 'Nueva Matriz', description: 'Crear, copiar, editar y eliminar plantillas de matriz de riesgo.', category: 'MANTENEDORES -> MATRIZ DE RIESGO' },
        { id: 'manage_colegios_matriz', name: 'Colegios Activos', description: 'Gestionar colegios habilitados para la matriz de riesgo.', category: 'MANTENEDORES -> MATRIZ DE RIESGO' },

        { id: 'view_pmpa', name: 'PMPA', description: 'Acceso a carga de Excel y listado PMPA.', category: 'MANTENEDORES -> OPERACIONES' },
        { id: 'view_colegios', name: 'Colegio', description: 'Acceso a mantenedor y carga masiva de Colegios.', category: 'MANTENEDORES -> OPERACIONES' },
        { id: 'view_consumo_gas', name: 'Consumo de Gas x RBD', description: 'Administrar límites y consumos de gas por cada RBD.', category: 'MANTENEDORES -> OPERACIONES' },
        
        { id: 'manage_vehiculos', name: 'Vehículos', description: 'Administración de flota de vehículos, tipos de vehículos y patentes.', category: 'MANTENEDORES -> OPERACIONES' },
        { id: 'manage_zonales', name: 'Zonales', description: 'Administración de Jefes Zonales, licitaciones y sucursales asignadas.', category: 'MANTENEDORES -> OPERACIONES' },
        { id: 'manage_jefe_operacion', name: 'Jefes de Operación', description: 'Administración de Jefes de Operación y su asignación a Jefes Zonales.', category: 'MANTENEDORES -> OPERACIONES' },
        { id: 'manage_supervisor', name: 'Supervisores', description: 'Administración de Supervisores, camionetas asociadas y RBDs a auditar.', category: 'MANTENEDORES -> OPERACIONES' },
        { id: 'manage_sucursales', name: 'Sucursal', description: 'Administración de Licitaciones, UTs y Sucursales.', category: 'MANTENEDORES -> OPERACIONES' },

        { id: 'manage_utm', name: 'Gestión de UTM', description: 'Acceso al mantenedor inteligente de UTM con sincronización SII.', category: 'MANTENEDORES -> MULTAS' },
        { id: 'manage_aspectos_ee', name: 'Fórmulas de Aspecto EE', description: 'Asociar fórmulas de multas a aspectos de elementos esenciales por licitación.', category: 'MANTENEDORES -> MULTAS' },
        { id: 'manage_multa_servicios', name: 'Servicios Multas', description: 'Mantenedor de códigos de servicio (D, A, O, C, T) para cálculos de multas.', category: 'MANTENEDORES -> MULTAS' },

        { id: 'view_preparaciones', name: 'Mantenedor de Preparaciones', description: 'Acceso a mantenedor y carga masiva de Preparaciones.', category: 'MANTENEDORES -> CALCULADORA' },
        { id: 'view_minutas', name: 'Mantenedor de Minutas', description: 'Acceso a mantenedor y carga masiva de Minutas.', category: 'MANTENEDORES -> CALCULADORA' },
        { id: 'view_raciones', name: 'Mantenedor de Raciones', description: 'Acceso a mantenedor y carga masiva de Raciones.', category: 'MANTENEDORES -> CALCULADORA' },
        
        { id: 'view_codigo_causa', name: 'Mantenedor Código de Causa', description: 'Acceso y mantenedor de códigos de causa de PAE Online.', category: 'MANTENEDORES -> PAE ONLINE' },

        { id: 'view_reports', name: 'Ver Reportes', description: 'Acceso a visualización de datos de negocio.', category: 'REPORTES' },
        { id: 'view_solicitud_pan_report', name: 'Reporte Solicitud de Pan', description: 'Acceso al informe histórico de solicitudes de pan.', category: 'REPORTES' },
        { id: 'view_solicitud_gas_report', name: 'Reporte Solicitud de Gas', description: 'Acceso al informe histórico de solicitudes de gas.', category: 'REPORTES' },
        { id: 'view_retiro_report', name: 'Reporte Retiro de Saldos', description: 'Acceso al informe histórico de retiro de saldos.', category: 'REPORTES' },

        { id: 'manage_users', name: 'Gestionar Usuarios', description: 'Crear, editar o eliminar usuarios.', category: 'ADMINISTRACIÓN' },
        { id: 'manage_roles', name: 'Gestionar Roles', description: 'Administrar mantenedor de perfiles y permisos.', category: 'ADMINISTRACIÓN' },
        { id: 'manage_menu_reorder', name: 'Reubicación de Aplicaciones', description: 'Permite reordenar la posición de los ítems de menú dentro de sus opciones padres.', category: 'ADMINISTRACIÓN' },
        { id: 'manage_correo', name: 'Configuración de Correo', description: 'Acciones sobre credenciales de correo (Office365).', category: 'ADMINISTRACIÓN' },
        { id: 'manage_listas', name: 'Listas de Distribución', description: 'Gestión de destinatarios y listas de correos.', category: 'ADMINISTRACIÓN' },
        { id: 'manage_notificaciones', name: 'Notificaciones por Pantalla', description: 'Asociar listas de distribución a notificaciones de la aplicación.', category: 'ADMINISTRACIÓN' },

        { id: 'view_formularios', name: 'Gestión de Formularios', description: 'Acceso a la activación, edición y configuración de calendarios/privilegios.', category: 'FORMULARIOS' },
        { id: 'create_formularios', name: 'Crear Formulario', description: 'Acceso al constructor para diseñar nuevos formularios dinámicos.', category: 'FORMULARIOS' },
        { id: 'fill_formularios', name: 'Completar Formulario', description: 'Acceso para el llenado y envío de respuestas (incluye modal PDF).', category: 'FORMULARIOS' },
        { id: 'view_respuestas', name: 'Respuestas de Formularios', description: 'Acceso a la visualización de respuestas históricas y descarga de PDFs.', category: 'FORMULARIOS' },

        { id: 'view_anexos', name: 'Ver Anexos', description: 'Acceso al directorio telefónico de la empresa.', category: 'AYUDA' },
        { id: 'manage_anexos', name: 'Gestionar Anexos', description: 'Acceso a crear, editar y subir de forma masiva los anexos.', category: 'AYUDA' },
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🛡️</span> Roles y Perfiles
                    </h2>
                    <p className="text-gray-500 mt-1">Configura los niveles de acceso y permisos</p>
                </div>

                <RoleForm availablePermissions={availablePermissions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {roles.map((role) => {
                    const rolePerms = JSON.parse(role.permissions) as string[]

                    return (
                        <div key={role.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-sky-50 to-cyan-50 rounded-bl-full -z-10 opacity-70 transition-transform group-hover:scale-110" />

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold text-gray-900">{role.name}</h3>
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold border border-gray-200">
                                            {rolePerms.filter(rp => availablePermissions.some(ap => ap.id === rp)).length} / {availablePermissions.length} aplicaciones asociadas
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{role.description || 'Sin descripción principal.'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border border-cyan-100">
                                        {role._count.users} Usuarios
                                    </div>
                                    <EditRoleForm role={role} availablePermissions={availablePermissions} />
                                    <CopyRoleForm role={role} />
                                </div>
                            </div>

                            <div className="space-y-3 mt-6 border-t border-gray-50 pt-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Permisos Habilitados</p>

                                {rolePerms.length > 0 ? (
                                    <RolePermissionList 
                                        rolePerms={rolePerms} 
                                        availablePermissions={availablePermissions} 
                                    />
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No tiene permisos operativos asignados.</p>
                                )}
                            </div>
                        </div>
                    )
                })}

                {roles.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                        <span className="text-4xl block mb-2">🤷‍♂️</span>
                        <p className="text-gray-500 font-medium">No se encontraron roles creados.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
