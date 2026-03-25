import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import RoleForm from './RoleForm'
import EditRoleForm from './EditRoleForm'

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
        { id: 'view_tablero', name: 'Tablero de Control', description: 'Acceso visual al reporte gráfico general.', category: 'Tableros' },
        { id: 'view_tablero_pan', name: 'Tablero Avance Pan', description: 'Acceso detallado al tablero de analítica de pan.', category: 'Tableros' },
        { id: 'view_tablero_gas', name: 'Tablero Avance Gas', description: 'Acceso detallado al tablero de analítica de gas.', category: 'Tableros' },
        { id: 'view_tablero_retiro', name: 'Tablero Avance Retiro', description: 'Acceso detallado al tablero de analítica de retiro de saldos.', category: 'Tableros' },
        { id: 'manage_users', name: 'Gestionar Usuarios', description: 'Crear, editar o eliminar usuarios.', category: 'Administración' },
        { id: 'manage_roles', name: 'Gestionar Roles', description: 'Administrar mantenedor de perfiles y permisos.', category: 'Administración' },
        { id: 'view_reports', name: 'Ver Reportes', description: 'Acceso a visualización de datos de negocio.', category: 'Reportes' },
        { id: 'view_solicitud_pan_report', name: 'Reporte Solicitud de Pan', description: 'Acceso al informe histórico de solicitudes de pan.', category: 'Reportes' },
        { id: 'view_solicitud_gas_report', name: 'Reporte Solicitud de Gas', description: 'Acceso al informe histórico de solicitudes de gas.', category: 'Reportes' },
        { id: 'view_retiro_report', name: 'Reporte Retiro de Saldos', description: 'Acceso al informe histórico de retiro de saldos.', category: 'Reportes' },
        { id: 'view_pmpa', name: 'Módulo PMPA', description: 'Acceso a carga de Excel y listado PMPA.', category: 'Mantenedores' },
        { id: 'view_ingreso_raciones', name: 'Ingreso de Raciones', description: 'Gestión y auditoría de raciones por colegio.', category: 'Aplicaciones' },
        { id: 'view_solicitud_pan', name: 'Solicitud de Pan', description: 'Acceso a la aplicación de Solicitud de Pan.', category: 'Aplicaciones' },
        { id: 'view_solicitud_gas', name: 'Solicitud de Gas', description: 'Acceso a la aplicación de Solicitud de Gas.', category: 'Aplicaciones' },
        { id: 'view_retiro_saldos', name: 'Retiro de Saldos', description: 'Acceso a la aplicación de Retiro de Saldos y Rebaja de Stock.', category: 'Aplicaciones' },
        { id: 'view_colegios', name: 'Mantenedor de Colegios', description: 'Acceso a mantenedor y carga masiva de Colegios.', category: 'Mantenedores' },
        { id: 'view_productos', name: 'Mantenedor de Productos', description: 'Acceso a mantenedor y carga masiva de Productos.', category: 'Mantenedores' },
        { id: 'view_consumo_gas', name: 'Consumo de Gas por RBD', description: 'Administrar límites y consumos de gas por cada RBD.', category: 'Mantenedores' },
        { id: 'manage_correo', name: 'Configuración de Correo', description: 'Acciones sobre credenciales de correo (Office365).', category: 'Administración' },
        { id: 'manage_listas', name: 'Listas de Distribución', description: 'Gestión de destinatarios y listas de correos.', category: 'Administración' },
        { id: 'manage_notificaciones', name: 'Notificaciones por Pantalla', description: 'Asociar listas de distribución a notificaciones de la aplicación.', category: 'Administración' },
        { id: 'manage_sucursales', name: 'Mantenedor de Sucursales', description: 'Administración de Licitaciones, UTs y Sucursales.', category: 'Administración' },
        { id: 'view_formularios', name: 'Ver Módulo Formularios', description: 'Acceso general al sistema de formularios.', category: 'Formularios' },
        { id: 'create_formularios', name: 'Crear Formulario', description: 'Acceso al constructor de formularios dinámicos.', category: 'Formularios' },
        { id: 'fill_formularios', name: 'Abrir Formulario', description: 'Acceso a completar y enviar respuestas a formularios creados.', category: 'Formularios' },
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
                                    <h3 className="text-xl font-bold text-gray-900">{role.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{role.description || 'Sin descripción principal.'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border border-cyan-100">
                                        {role._count.users} Usuarios
                                    </div>
                                    <EditRoleForm role={role} availablePermissions={availablePermissions} />
                                </div>
                            </div>

                            <div className="space-y-3 mt-6 border-t border-gray-50 pt-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Permisos Habilitados</p>

                                {rolePerms.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {rolePerms.map(p => {
                                            const permInfo = availablePermissions.find(ap => ap.id === p)
                                            return (
                                                <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    {permInfo?.name || p}
                                                </span>
                                            )
                                        })}
                                    </div>
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
