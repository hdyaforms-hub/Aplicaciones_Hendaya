'use client'

import { useState } from 'react'
import RolesAccordionList from './RolesAccordionList'
import AsociarRbdClient from '../mantenedor/actas-supervision/asociar-rbd/AsociarRbdClient'
import RoleForm from './RoleForm'

type Props = {
    roles: any[]
    availablePermissions: any[]
    users: any[]
    colegios: any[]
}

export default function RolesTabs({ roles, availablePermissions, users, colegios }: Props) {
    const [activeTab, setActiveTab] = useState<'roles' | 'rbd'>('roles')

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 bg-white px-6 pt-4 rounded-t-3xl shadow-sm border-x border-t border-gray-100">
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`pb-4 px-4 text-sm font-bold border-b-2 transition-all ${
                        activeTab === 'roles'
                            ? 'border-cyan-600 text-cyan-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    🛡️ Roles y Perfiles
                </button>
                <button
                    onClick={() => setActiveTab('rbd')}
                    className={`pb-4 px-4 text-sm font-bold border-b-2 transition-all ${
                        activeTab === 'rbd'
                            ? 'border-cyan-600 text-cyan-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    🏫 Asociar RBD a Usuario
                </button>
            </div>

            {/* Tab Contents */}
            <div>
                {activeTab === 'roles' ? (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-b-3xl rounded-tr-3xl shadow-sm border-x border-b border-gray-100">
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
                ) : (
                    <div className="bg-white p-6 rounded-b-3xl rounded-tr-3xl shadow-sm border-x border-b border-gray-100">
                        <AsociarRbdClient 
                            initialUsers={users}
                            roles={roles}
                            colegios={colegios}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
