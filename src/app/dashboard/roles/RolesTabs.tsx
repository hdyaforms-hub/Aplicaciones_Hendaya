'use client'

import RolesAccordionList from './RolesAccordionList'
import RoleForm from './RoleForm'

type Props = {
    roles: any[]
    availablePermissions: any[]
    users?: any[]
    colegios?: any[]
}

export default function RolesTabs({ roles, availablePermissions }: Props) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🛡️</span> Roles y Perfiles
                    </h2>
                    <p className="text-gray-500 mt-1">Configura los niveles de acceso y permisos del sistema</p>
                </div>
                <RoleForm availablePermissions={availablePermissions} />
            </div>
            <RolesAccordionList roles={roles} availablePermissions={availablePermissions} />
        </div>
    )
}
