'use client'

import React, { useState, useEffect } from 'react'
import { ConfiguracionDocumentalUI } from '@/types/documentos'

interface ConfiguracionClientProps {
    user: any
}

export default function ConfiguracionClient({ user }: ConfiguracionClientProps) {
    const [config, setConfig] = useState<ConfiguracionDocumentalUI | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

    // Form inputs
    const [tenantId, setTenantId] = useState('')
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [onedriveUserEmail, setOnedriveUserEmail] = useState('')
    const [rootFolderId, setRootFolderId] = useState('')
    const [rootFolderName, setRootFolderName] = useState('')
    const [availableRootFolders, setAvailableRootFolders] = useState<{ id: string; name: string }[]>([])

    // Test result state
    const [testResult, setTestResult] = useState<{
        connected: boolean
        userDisplayName?: string
        userPrincipalName?: string
        storageUsedGB?: number
        storageQuotaGB?: number
        rootFolderName?: string
        message?: string
    } | null>(null)

    // Cargar configuración existente
    const fetchConfig = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/documentos/configuracion')
            const data = await res.json()
            if (res.ok && data.config) {
                setConfig(data.config)
                setOnedriveUserEmail(data.config.onedriveUserEmail || '')
                setRootFolderId(data.config.rootFolderId || '')
                setRootFolderName(data.config.rootFolderName || '')
            }
        } catch (e) {
            console.error('Error al cargar configuración:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchConfig()
    }, [])

    // Probar conexión
    const handleTestConnection = async () => {
        setTesting(true)
        setMessage(null)
        setTestResult(null)
        try {
            const res = await fetch('/api/admin/documentos/configuracion/test', {
                method: 'POST'
            })
            const data = await res.json()
            if (res.ok && data.connected) {
                setTestResult(data)
                if (data.availableRootFolders) {
                    setAvailableRootFolders(data.availableRootFolders)
                }
                setMessage({
                    type: 'success',
                    text: `¡Conexión exitosa con OneDrive de ${data.userDisplayName || data.userPrincipalName}!`
                })
            } else {
                setTestResult({ connected: false, message: data.message || 'Error al conectar' })
                setMessage({
                    type: 'error',
                    text: data.message || 'Error al validar conexión con Azure'
                })
            }
        } catch (e: any) {
            setTestResult({ connected: false, message: e?.message || 'Error de red' })
            setMessage({ type: 'error', text: 'Error al comunicarse con el servidor' })
        } finally {
            setTesting(false)
        }
    }

    // Guardar configuración
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        try {
            const res = await fetch('/api/admin/documentos/configuracion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    clientId,
                    clientSecret,
                    onedriveUserEmail,
                    rootFolderId: rootFolderId || null,
                    rootFolderName: rootFolderName || null
                })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setMessage({ type: 'success', text: 'Configuración guardada y cifrada correctamente.' })
                fetchConfig()
                handleTestConnection()
            } else {
                setMessage({ type: 'error', text: data.message || 'Error al guardar la configuración' })
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message || 'Error de red al guardar' })
        } finally {
            setSaving(false)
        }
    }

    const isCertAuth = config?.authType === 'certificate'

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
            {/* Cabecera */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full text-cyan-300 text-xs font-black tracking-wider uppercase">
                        <span>⚙️</span>
                        <span>Mantenedor • Conexión Microsoft Graph API</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">
                        Configuración Microsoft Graph API
                    </h1>
                    <p className="text-xs text-slate-400 font-medium">
                        Autenticación con Azure AD y repositorio de almacenamiento OneDrive corporativo.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !config?.configurado}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto shrink-0"
                >
                    <span>⚡</span>
                    <span>{testing ? 'Comprobando...' : 'Probar Conexión'}</span>
                </button>
            </div>

            {/* Alerta de Mensaje */}
            {message && (
                <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center gap-3 animate-in fade-in duration-200 ${
                    message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : message.type === 'info'
                        ? 'bg-blue-50 text-blue-900 border-blue-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}>
                    <span className="text-lg">{message.type === 'success' ? '✅' : message.type === 'info' ? 'ℹ️' : '❌'}</span>
                    <span className="leading-relaxed">{message.text}</span>
                </div>
            )}

            {/* Tarjeta de Estado de Conexión en Vivo */}
            {testResult && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Estado de Conexión</span>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{testResult.connected ? '🟢' : '🔴'}</span>
                            <span className="text-sm font-black text-slate-900">
                                {testResult.connected ? 'Conectado a OneDrive' : 'Sin Conexión'}
                            </span>
                        </div>
                    </div>

                    {testResult.connected && (
                        <>
                            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                                <span className="text-[10px] font-black uppercase text-slate-400">Cuenta de OneDrive</span>
                                <p className="text-sm font-black text-slate-900 truncate" title={testResult.userPrincipalName}>
                                    {testResult.userDisplayName || testResult.userPrincipalName}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{testResult.userPrincipalName}</p>
                            </div>

                            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                                <span className="text-[10px] font-black uppercase text-slate-400">Almacenamiento OneDrive</span>
                                <div className="flex justify-between items-baseline text-xs font-black text-slate-800">
                                    <span>{testResult.storageUsedGB || 0} GB</span>
                                    <span className="text-[10px] text-slate-400 font-normal">de {testResult.storageQuotaGB || 0} GB</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-cyan-500 to-sky-500 h-2 rounded-full"
                                        style={{
                                            width: `${Math.min(100, Math.max(2, ((testResult.storageUsedGB || 0) / (testResult.storageQuotaGB || 1)) * 100))}%`
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Tarjeta Informativa de Autenticación con Certificado */}
            {isCertAuth ? (
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📜</span>
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                    Autenticación por Certificado X.509 (Activa)
                                </h2>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Esta instancia está operando mediante firma criptográfica con certificado digital X.509 y llave privada RSA.
                            </p>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-extrabold shadow-2xs shrink-0">
                            <span>🛡️</span>
                            <span>Certificado X.509 RSA-SHA256</span>
                        </span>
                    </div>

                    {/* Grilla de Datos de Configuración */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">Directory (Tenant) ID</span>
                            <p className="text-xs font-mono font-bold text-slate-900">
                                {config?.tenantIdPreview || 'Cargando...'}
                            </p>
                            <p className="text-[10px] text-slate-400">Inquilino de Azure AD de Hendaya</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">Application (Client) ID</span>
                            <p className="text-xs font-mono font-bold text-slate-900">
                                {config?.clientIdPreview || 'Cargando...'}
                            </p>
                            <p className="text-[10px] text-slate-400">ID del Registro de Aplicación en Azure</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">Huella Digital (Thumbprint SHA-1)</span>
                            <p className="text-xs font-mono font-bold text-slate-900 break-all">
                                {config?.certThumbprintPreview || 'No especificado'}
                            </p>
                            <p className="text-[10px] text-slate-400">Identificador único del certificado X.509</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">Llave Privada (.pem)</span>
                            <p className="text-xs font-mono font-bold text-emerald-700">
                                🔑 {config?.certKeyPath || 'certs/private-key.pem'} (Cargada)
                            </p>
                            <p className="text-[10px] text-slate-400">Archivo utilizado para la aserción JWT</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 md:col-span-2">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">Cuenta de OneDrive Asociada</span>
                            <p className="text-xs font-bold text-slate-900">
                                📧 {config?.onedriveUserEmail}
                            </p>
                            <p className="text-[10px] text-slate-400">Buzón de Microsoft 365 donde residen los documentos corporativos</p>
                        </div>
                    </div>

                    {/* Guía de Permisos Requeridos en Azure */}
                    <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2 text-xs text-amber-950">
                        <div className="flex items-center gap-2 font-black text-amber-900">
                            <span>📋</span>
                            <span>Permisos de API requeridos en Microsoft Entra ID (Azure Portal):</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-amber-900 text-[11px] leading-relaxed">
                            <li>
                                <strong>Files.ReadWrite.All</strong> (Tipo: <em>Application / Aplicación</em>): Permite crear carpetas, subir y descargar archivos.
                            </li>
                            <li>
                                <strong>User.Read.All</strong> (Tipo: <em>Application / Aplicación</em>): Permite verificar el usuario y cuota del OneDrive.
                            </li>
                            <li>
                                <strong>Consentimiento de Administrador</strong>: Es indispensable hacer clic en <em>&quot;Conceder consentimiento de administrador para [Organización]&quot;</em>.
                            </li>
                        </ul>
                    </div>

                    {/* Selector de Carpeta Raíz */}
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                        <div className="space-y-0.5">
                            <label className="block text-xs font-bold text-slate-800">
                                Carpeta Raíz en OneDrive
                            </label>
                            <p className="text-[11px] text-slate-500">
                                Limita el gestor documental a una subcarpeta específica o utiliza la raíz completa.
                            </p>
                        </div>

                        {availableRootFolders.length > 0 ? (
                            <select
                                value={rootFolderId}
                                onChange={(e) => {
                                    const selectedId = e.target.value
                                    setRootFolderId(selectedId)
                                    const found = availableRootFolders.find(f => f.id === selectedId)
                                    setRootFolderName(found ? found.name : '')
                                }}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="">🌐 Raíz Completa de OneDrive</option>
                                {availableRootFolders.map(folder => (
                                    <option key={folder.id} value={folder.id}>
                                        📁 {folder.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={rootFolderName || 'Raíz Completa de OneDrive'}
                                    disabled
                                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 font-bold"
                                />
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Cargar carpetas disponibles
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Formulario para configuración manual con Client Secret */
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                Credenciales Azure App Registration
                            </h2>
                            <p className="text-xs text-slate-500">
                                Se requiere una aplicación registrada en Microsoft Entra ID con permisos de tipo Application `Files.ReadWrite.All`.
                            </p>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[10px] font-extrabold">
                            <span>🔒</span>
                            <span>Cifrado AES-256-GCM</span>
                        </span>
                    </div>

                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Directory (Tenant) ID *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value)}
                                    placeholder={config?.tenantIdPreview || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Application (Client) ID *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder={config?.clientIdPreview || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Client Secret *
                                </label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={(e) => setClientSecret(e.target.value)}
                                    placeholder={config?.tieneSecret ? '••••••••••••••••••••••••' : 'Valor del secreto'}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700">
                                    Correo del Dueño de OneDrive *
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={onedriveUserEmail}
                                    onChange={(e) => setOnedriveUserEmail(e.target.value)}
                                    placeholder="ejemplo@hendaya.cl"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs shadow-lg shadow-cyan-600/25 transition-all cursor-pointer flex items-center gap-2"
                            >
                                <span>💾</span>
                                <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
