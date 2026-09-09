'use client'

import { useMemo } from 'react'
import RolesAccordionList from './RolesAccordionList'
import RoleForm from './RoleForm'

type Props = {
    roles: any[]
    availablePermissions: any[]
    users?: any[]
    colegios?: any[]
}

export default function RolesTabs({ roles, availablePermissions, users = [] }: Props) {
    const stats = useMemo(() => {
        const totalRoles = roles.length
        const rolesWithUsers = roles.filter(r => (r.users ? r.users.length : (r._count?.users ?? 0)) > 0).length
        const totalUsers = users.length > 0
            ? users.length
            : roles.reduce((acc, r) => acc + (r.users ? r.users.length : (r._count?.users ?? 0)), 0)
        const totalPerms = availablePermissions.length

        return {
            totalRoles,
            rolesWithUsers,
            totalUsers,
            totalPerms
        }
    }, [roles, availablePermissions, users])

    return (
        <div className="space-y-6">
            {/* Header Principal con Identidad Corporativa */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-700/50 text-white">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm">
                            <span>🛡️</span> Matriz de Seguridad y Privilegios
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            Roles y Perfiles
                        </h1>
                        <p className="text-slate-300 text-sm max-w-xl">
                            Administra los perfiles de usuario, define matrices de autorización granulares y controla el acceso a cada área, menú y aplicación de la plataforma.
                        </p>
                    </div>

                    <div className="shrink-0 self-stretch md:self-auto flex items-center">
                        <RoleForm availablePermissions={availablePermissions} />
                    </div>
                </div>

                {/* Tarjetas KPI Resumen */}
                <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-700/60">
                    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Perfiles Totales</span>
                            <span className="text-lg">🛡️</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                            {stats.totalRoles}
                        </div>
                        <span className="text-[11px] text-cyan-400 font-medium">Registrados en sistema</span>
                    </div>

                    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Roles en Uso</span>
                            <span className="text-lg">👥</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1">
                            {stats.rolesWithUsers}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Con usuarios asignados</span>
                    </div>

                    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuarios Activos</span>
                            <span className="text-lg">👤</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                            {stats.totalUsers}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Colaboradores vinculados</span>
                    </div>

                    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Privilegios Totales</span>
                            <span className="text-lg">🔑</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                            {stats.totalPerms}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Permisos configurables</span>
                    </div>
                </div>
            </div>

            {/* Listado de Acordeones y Búsqueda */}
            <RolesAccordionList roles={roles} availablePermissions={availablePermissions} />
        </div>
    )
}
