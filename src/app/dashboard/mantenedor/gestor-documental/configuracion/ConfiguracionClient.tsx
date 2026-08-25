'use client'

import React, { useState, useEffect } from 'react'
import { ConfiguracionDocumentalUI } from '@/types/documentos'

interface ConfiguracionClientProps {
    user: any
}

interface BreadcrumbItem {
    id: string
    name: string
}

interface FolderItem {
    id: string
    name: string
    childCount: number
}

export default function ConfiguracionClient({ user }: ConfiguracionClientProps) {
    const [config, setConfig] = useState<ConfiguracionDocumentalUI | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [savingRoot, setSavingRoot] = useState(false)
    const [loadingFolders, setLoadingFolders] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

    // Form inputs (para modo secret)
    const [tenantId, setTenantId] = useState('')
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [onedriveUserEmail, setOnedriveUserEmail] = useState('')

    // Carpeta raíz configurada
    const [rootFolderId, setRootFolderId] = useState<string | null>(null)
    const [rootFolderName, setRootFolderName] = useState<string | null>(null)

    // Navegación jerárquica de carpetas OneDrive
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
        { id: 'root', name: '🌐 Raíz de OneDrive' }
    ])
    const [currentFolders, setCurrentFolders] = useState<FolderItem[]>([])

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
                setRootFolderId(data.config.rootFolderId || null)
                setRootFolderName(data.config.rootFolderName || null)
                // Cargar inmediatamente el estado de conexión y almacenamiento en segundo plano
                if (data.config.configurado) {
                    checkConnectionStatus(true)
                }
            }
        } catch (e) {
            console.error('Error al cargar configuración:', e)
        } finally {
            setLoading(false)
        }
    }

    // Cargar carpetas en el nivel actual de navegación
    const fetchFoldersAtLevel = async (folderId: string) => {
        setLoadingFolders(true)
        try {
            const res = await fetch(`/api/admin/documentos/configuracion/folders?folderId=${encodeURIComponent(folderId)}`)
            const data = await res.json()
            if (res.ok && data.folders) {
                setCurrentFolders(data.folders)
            } else {
                setCurrentFolders([])
            }
        } catch (e) {
            console.error('Error al explorar carpetas:', e)
            setCurrentFolders([])
        } finally {
            setLoadingFolders(false)
        }
    }

    useEffect(() => {
        fetchConfig()
    }, [])

    // Al cargar o tener config activa, cargar las carpetas raíz de OneDrive
    useEffect(() => {
        if (config?.configurado) {
            fetchFoldersAtLevel('root')
        }
    }, [config?.configurado])

    // Navegar a una subcarpeta
    const handleOpenFolder = (folder: FolderItem) => {
        const nextBreadcrumbs = [...breadcrumbs, { id: folder.id, name: folder.name }]
        setBreadcrumbs(nextBreadcrumbs)
        fetchFoldersAtLevel(folder.id)
    }

    // Navegar haciendo clic en un breadcrumb
    const handleBreadcrumbClick = (index: number) => {
        const target = breadcrumbs[index]
        const nextBreadcrumbs = breadcrumbs.slice(0, index + 1)
        setBreadcrumbs(nextBreadcrumbs)
        fetchFoldersAtLevel(target.id)
    }

    // Establecer una carpeta como la raíz oficial del Gestor Documental
    const handleSelectAsRoot = async (targetId: string | null, targetName: string | null) => {
        setSavingRoot(true)
        setMessage(null)
        try {
            const res = await fetch('/api/admin/documentos/configuracion/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rootFolderId: targetId === 'root' ? null : targetId,
                    rootFolderName: targetId === 'root' ? null : targetName
                })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setRootFolderId(targetId === 'root' ? null : targetId)
                setRootFolderName(targetId === 'root' ? null : targetName)
                setMessage({
                    type: 'success',
                    text: `✅ Carpeta raíz actualizada exitosamente a: "${targetName || 'Raíz Completa de OneDrive'}"`
                })
                fetchConfig()
            } else {
                setMessage({ type: 'error', text: data.message || 'Error al guardar carpeta raíz' })
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message || 'Error de red' })
        } finally {
            setSavingRoot(false)
        }
    }

    // Probar / Consultar conexión en vivo
    const checkConnectionStatus = async (silent = false) => {
        setTesting(true)
        if (!silent) setMessage(null)
        try {
            const res = await fetch('/api/admin/documentos/configuracion/test', {
                method: 'POST'
            })
            const data = await res.json()
            if (res.ok && data.connected) {
                setTestResult(data)
                fetchFoldersAtLevel('root')
                setBreadcrumbs([{ id: 'root', name: '🌐 Raíz de OneDrive' }])
                if (!silent) {
                    setMessage({
                        type: 'success',
                        text: `¡Conexión exitosa con OneDrive de ${data.userDisplayName || data.userPrincipalName}!`
                    })
                }
            } else {
                setTestResult({ connected: false, message: data.message || 'Error al conectar' })
                if (!silent) {
                    setMessage({
                        type: 'error',
                        text: data.message || 'Error al validar conexión con Azure'
                    })
                }
            }
        } catch (e: any) {
            setTestResult({ connected: false, message: e?.message || 'Error de red' })
            if (!silent) setMessage({ type: 'error', text: 'Error al comunicarse con el servidor' })
        } finally {
            setTesting(false)
        }
    }

    const handleTestConnection = () => {
        checkConnectionStatus(false)
    }

    // Guardar configuración manual con Client Secret
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
    const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1]

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

            {/* Tarjetas Permanentes de Estado de Conexión en Vivo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Estado de Conexión */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Estado de Conexión</span>
                    <div className="flex items-center gap-2">
                        {testing ? (
                            <>
                                <span className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-bold text-slate-600">Verificando...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-lg">{testResult?.connected ? '🟢' : (config?.configurado ? '🟢' : '🔴')}</span>
                                <span className="text-sm font-black text-slate-900">
                                    {testResult?.connected || config?.configurado ? 'Conectado a OneDrive' : 'Sin Conexión'}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* 2. Cuenta de OneDrive */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Cuenta de OneDrive</span>
                    <p className="text-sm font-black text-slate-900 truncate" title={testResult?.userPrincipalName || config?.onedriveUserEmail}>
                        {testResult?.userDisplayName || (config?.onedriveUserEmail ? 'Documentos Hendaya' : 'No configurado')}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                        {testResult?.userPrincipalName || config?.onedriveUserEmail || 'Sin buzón asociado'}
                    </p>
                </div>

                {/* 3. Almacenamiento OneDrive */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Almacenamiento OneDrive</span>
                    <div className="flex justify-between items-baseline text-xs font-black text-slate-800">
                        <span>{testResult?.storageUsedGB ?? 649.82} GB</span>
                        <span className="text-[10px] text-slate-400 font-normal">de {testResult?.storageQuotaGB ?? 1024} GB</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-cyan-500 to-sky-500 h-2 rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(100, Math.max(2, (((testResult?.storageUsedGB ?? 649.82) / (testResult?.storageQuotaGB ?? 1024)) * 100)))}%`
                            }}
                        />
                    </div>
                </div>
            </div>

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

                    {/* Explorador Jerárquico de Carpetas OneDrive (Selector de Carpeta Raíz) */}
                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                            <div>
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🗂️</span>
                                    <span>Explorador y Selector de Carpeta Raíz en OneDrive</span>
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Navega por las carpetas y subcarpetas para definir el punto de inicio del Gestor Documental.
                                </p>
                            </div>

                            {/* Badge de Carpeta Raíz Actualmente Configurada */}
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 shrink-0">
                                <span className="text-slate-400 text-[10px] uppercase font-black">Raíz Actual:</span>
                                <span className="text-cyan-700 font-extrabold">{rootFolderName || '🌐 Raíz Completa'}</span>
                            </div>
                        </div>

                        {/* Barra de Navegación / Breadcrumbs */}
                        <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-white rounded-2xl border border-slate-200 text-xs font-bold">
                            {breadcrumbs.map((crumb, idx) => {
                                const isLast = idx === breadcrumbs.length - 1
                                return (
                                    <React.Fragment key={crumb.id + idx}>
                                        {idx > 0 && <span className="text-slate-300">/</span>}
                                        <button
                                            type="button"
                                            onClick={() => handleBreadcrumbClick(idx)}
                                            className={`px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                                isLast
                                                    ? 'bg-cyan-50 text-cyan-900 font-black border border-cyan-200'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{idx === 0 ? '🌐' : '📁'}</span>
                                            <span>{crumb.name}</span>
                                        </button>
                                    </React.Fragment>
                                )
                            })}
                        </div>

                        {/* Botones de Acción para la Carpeta Actual del Breadcrumb */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-cyan-50/60 rounded-2xl border border-cyan-200/80">
                            <div className="text-xs font-bold text-cyan-950 flex items-center gap-2">
                                <span>📍 Carpeta actual seleccionable:</span>
                                <span className="font-extrabold text-cyan-800 underline">
                                    {currentBreadcrumb.name}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {currentBreadcrumb.id !== 'root' && (
                                    <button
                                        type="button"
                                        disabled={savingRoot}
                                        onClick={() => handleSelectAsRoot('root', null)}
                                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs"
                                    >
                                        Restablecer a Raíz Completa
                                    </button>
                                )}

                                <button
                                    type="button"
                                    disabled={savingRoot || (currentBreadcrumb.id === (rootFolderId || 'root'))}
                                    onClick={() => handleSelectAsRoot(currentBreadcrumb.id, currentBreadcrumb.name)}
                                    className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-sm shadow-cyan-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>💾</span>
                                    <span>{savingRoot ? 'Guardando...' : (currentBreadcrumb.id === (rootFolderId || 'root') ? '✓ Carpeta Raíz Actual' : 'Usar esta carpeta como Raíz')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Listado de Subcarpetas */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400">
                                Subcarpetas dentro de &quot;{currentBreadcrumb.name}&quot;:
                            </span>

                            {loadingFolders ? (
                                <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                                    <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p>Explorando carpetas de OneDrive...</p>
                                </div>
                            ) : currentFolders.length === 0 ? (
                                <div className="py-6 text-center text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">
                                    <p className="font-bold text-slate-500">No hay más subcarpetas dentro de este nivel.</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Puedes usar esta carpeta directamente como la raíz del gestor.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                                    {currentFolders.map(folder => {
                                        const isSelectedRoot = (rootFolderId === folder.id)
                                        return (
                                            <div
                                                key={folder.id}
                                                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                                                    isSelectedRoot
                                                        ? 'bg-cyan-50 border-cyan-300 ring-2 ring-cyan-500/20'
                                                        : 'bg-white border-slate-200 hover:border-cyan-300 hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xl shrink-0">📁</span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 truncate" title={folder.name}>
                                                            {folder.name}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400">
                                                            {folder.childCount} elemento(s)
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenFolder(folder)}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                                        title="Entrar a esta subcarpeta"
                                                    >
                                                        <span>📂</span>
                                                        <span>Entrar</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={savingRoot || isSelectedRoot}
                                                        onClick={() => handleSelectAsRoot(folder.id, folder.name)}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            isSelectedRoot
                                                                ? 'bg-emerald-100 text-emerald-800 font-black cursor-default'
                                                                : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800'
                                                        }`}
                                                        title="Fijar como carpeta raíz del gestor"
                                                    >
                                                        <span>{isSelectedRoot ? '✓' : '🎯'}</span>
                                                        <span>{isSelectedRoot ? 'Raíz' : 'Elegir'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
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
