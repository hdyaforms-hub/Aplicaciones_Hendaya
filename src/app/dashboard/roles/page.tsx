import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RolesTabs from './RolesTabs'

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

    // Cargar usuarios
    const users = await prisma.user.findMany({
        where: { isDeleted: false },
        include: { role: true, sucursales: true },
        orderBy: { name: 'asc' }
    })

    // Cargar colegios
    const colegios = await prisma.colegios.findMany({
        select: { colRBD: true, nombreEstablecimiento: true, sucursal: true, institucion: true },
        orderBy: { colRBD: 'asc' }
    })

    // Lista de permisos disponibles en el sistema
    const availablePermissions = [
        { id: 'view_dashboard_home', name: 'Estadísticas de Inicio', description: 'Acceso visual a estadísticas globales y Estado PMPA en la pantalla de inicio.', category: 'TABLEROS' },
        { id: 'view_tablero', name: 'Tablero Avance PMPA', description: 'Acceso visual al tablero de reporte gráfico de Avance PMPA.', category: 'TABLEROS' },
        { id: 'view_tablero_pan', name: 'Tablero Avance Pan', description: 'Acceso detallado al tablero de analítica de pan.', category: 'TABLEROS' },
        { id: 'view_tablero_gas', name: 'Tablero Avance Gas', description: 'Acceso detallado al tablero de analítica de gas.', category: 'TABLEROS' },
        { id: 'view_tablero_retiro', name: 'Tablero Avance Retiro', description: 'Acceso detallado al tablero de analítica de retiro de saldos.', category: 'TABLEROS' },
        { id: 'view_tablero_elementos', name: 'Tablero Carga de Elementos Esenciales', description: 'Visualización gráfica de cumplimiento de elementos esenciales.', category: 'TABLEROS' },
        { id: 'view_tablero_multas_ee', name: 'Tablero Multas EE', description: 'Acceso visual al reporte gráfico de multas de elementos esenciales.', category: 'TABLEROS' },
        { id: 'view_tablero_organigrama', name: 'Tablero Organigrama por zonas', description: 'Visualización gráfica de la jerarquía operativa (Jefe Zonal -> Jefe de Operaciones -> Supervisor) por sucursal.', category: 'TABLEROS' },
        { id: 'view_tablero_distancias', name: 'Tablero de Kilometraje', description: 'Visualización detallada de distancias y tiempos de viaje de supervisores por sucursal.', category: 'TABLEROS' },
        { id: 'view_tablero_actas', name: 'Tablero Actas', description: 'Acceso visual al tablero gerencial y ejecutivo de analítica de actas.', category: 'TABLEROS' },
        { id: 'view_tablero_verificador_temperaturas', name: 'Tablero Verificador de Temperaturas', description: 'Visualización gráfica de variaciones de temperaturas con límites máximos y mínimos.', category: 'TABLEROS' },
        { id: 'view_tablero_auditoria', name: 'Tablero Auditoría', description: 'Visualización y exportación de auditoría de actividad de usuarios.', category: 'TABLEROS' },
        
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
        { id: 'view_verificador_temperaturas', name: 'Verificador de Temperaturas (Ver)', description: 'Acceso al módulo Verificador de Temperaturas de Productos.', category: 'ÁREAS -> CALIDAD' },
        { id: 'manage_verificador_temperaturas', name: 'Verificador de Temperaturas (Gestionar)', description: 'Permite crear, editar y eliminar registros de temperaturas.', category: 'ÁREAS -> CALIDAD' },
        { id: 'config_verificador_temperaturas', name: 'Verificador de Temperaturas (Configurar Cámaras)', description: 'Permite configurar cámaras y temperaturas máximas permitidas.', category: 'ÁREAS -> CALIDAD' },
 
        { id: 'view_multas_areas', name: 'Menú Multas', description: 'Acceso al menú de Multas en Áreas.', category: 'ÁREAS -> MULTAS' },
        { id: 'manage_calculos_ee', name: 'Cálculos de Elementos Esenciales', description: 'Permite calcular multas en base a elementos esenciales no conformes.', category: 'ÁREAS -> MULTAS' },
        { id: 'manage_descargos', name: 'Descargos de Actas', description: 'Gestionar descargos, resoluciones y no soluciones de aspectos de actas.', category: 'ÁREAS -> MULTAS' },
 
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
        { id: 'view_historico_matriz', name: 'Histórico de Matrices', description: 'Consultar la historia completa de matrices de riesgo, trazabilidad cronológica de hallazgos y evidencias de mitigación.', category: 'MATRIZ DE RIESGO' },
        { id: 'view_estado_avance', name: 'Estado de Avance', description: 'Visualizar el estado de avance de la matriz de riesgo.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
        { id: 'view_auditoria', name: 'Auditoría Externa', description: 'Vista global completa de hallazgos y evidencias para auditores.', category: 'MATRIZ DE RIESGO -> DETALLE MATRIZ' },
 
        { id: 'view_productos', name: 'Mantenedor de Productos', description: 'Acceso a mantenedor y carga masiva de Productos.', category: 'MANTENEDORES' },
        { id: 'manage_areas', name: 'Área', description: 'Creación y administración de áreas de la compañía.', category: 'MANTENEDORES' },
 
        { id: 'manage_actas_supervision', name: 'Crear Acta de Supervisión', description: 'Crear, editar, copiar y administrar plantillas de Actas de Supervisión.', category: 'MANTENEDORES -> ACTAS DE SUPERVISIÓN' },
        { id: 'manage_user_rbds', name: 'Asociar RBD a usuario', description: 'Permite asociar y gestionar los RBDs autorizados para cada usuario.', category: 'MANTENEDORES -> ACTAS DE SUPERVISIÓN' },
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
 
        { id: 'view_generar_actas', name: 'Generar Acta', description: 'Permite visualizar el listado de actas iniciadas y crear nuevas a partir de plantillas.', category: 'ACTAS' },
        { id: 'view_descargar_actas', name: 'Descargar Actas', description: 'Acceso a la vista de consulta, descarga individual y descarga masiva de PDFs de actas.', category: 'ACTAS' },
        { id: 'manage_generar_actas', name: 'Eliminar Actas Generadas', description: 'Otorga el privilegio de eliminar respuestas de actas en progreso.', category: 'ACTAS' },
 
        { id: 'view_anexos', name: 'Ver Anexos', description: 'Acceso al directorio telefónico de la empresa.', category: 'AYUDA' },
        { id: 'manage_anexos', name: 'Gestionar Anexos', description: 'Acceso a crear, editar y subir de forma masiva los anexos.', category: 'AYUDA' },
        { id: 'view_conversacion', name: 'Conversación y Colaboración', description: 'Acceso a mensajería cifrada, gestión de tareas estilo Trello, citas/calendario y proyectos colaborativos.', category: 'AYUDA' },

        { id: 'view_documentos', name: 'Gestor Documental (Vista Usuario)', description: 'Permite explorar, previsualizar y descargar documentos según permisos asignados.', category: 'GESTOR DOCUMENTAL' },
        { id: 'manage_doc_configuracion', name: 'Configuración OneDrive', description: 'Permite configurar y vincular las credenciales de Microsoft Graph API / Azure.', category: 'GESTOR DOCUMENTAL' },
        { id: 'manage_doc_carpetas', name: 'Administrar Carpetas y Documentos', description: 'Permite crear carpetas, subir archivos y gestionar la estructura en OneDrive.', category: 'GESTOR DOCUMENTAL' },
        { id: 'manage_doc_privilegios', name: 'Privilegios de Acceso Documental', description: 'Permite otorgar y revocar permisos de visualización, descarga, subida y administración por carpeta.', category: 'GESTOR DOCUMENTAL' },
    ]
 
    return (
        <RolesTabs 
            roles={roles} 
            availablePermissions={availablePermissions} 
            users={users} 
            colegios={colegios} 
        />
    )
}
