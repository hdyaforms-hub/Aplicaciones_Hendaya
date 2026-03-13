'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveEmailConfig, testSmtpConnection } from './actions'

type ConfigData = {
    id: string;
    email: string;
    provider: string;
    updatedBy: string | null;
    updatedAt: Date;
} | null;

export default function EmailConfigForm({ initialConfig }: { initialConfig: ConfigData }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [testLoading, setTestLoading] = useState(false)
    const [testResult, setTestResult] = useState<{ success?: boolean, error?: string } | null>(null)

    const [isEditing, setIsEditing] = useState(!initialConfig)

    const [email, setEmail] = useState(initialConfig?.email || '')
    const [password, setPassword] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        if (!email) {
            setError('El correo es obligatorio')
            setLoading(false)
            return
        }

        const result = await saveEmailConfig(email, password)

        if (result.error) {
            setError(result.error)
            setLoading(false)
        } else {
            setSuccess('Configuración de correo actualizada correctamente. Las credenciales de Office 365 han sido encriptadas y guardadas.')
            setPassword('') // Limpiamos la contraseña tipeada en la vista

            setTimeout(() => {
                setSuccess('')
                setIsEditing(false) // Ocultar formulario de edición si existe, volvemos a la tabla
                router.refresh()
            }, 2000)
            setLoading(false)
        }
    }

    const handleTest = async () => {
        setTestLoading(true)
        setTestResult(null)
        setError('')
        
        const result = await testSmtpConnection(email, password)
        
        if (result.success) {
            setTestResult({ success: true })
        } else {
            setTestResult({ error: result.error })
        }
        setTestLoading(false)
    }

    return (
        <div className="space-y-6">
            {!isEditing && initialConfig && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-6 animate-in fade-in zoom-in duration-300">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <span>📋</span> Cuenta Emisora Configurada
                        </h3>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-sm px-4 py-2 bg-white border border-gray-200 shadow-sm text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span>✏️</span> Editar Credenciales
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Proveedor</th>
                                    <th className="px-6 py-4 font-semibold">Correo Electrónico</th>
                                    <th className="px-6 py-4 font-semibold border-l border-gray-200 bg-sky-50 text-sky-800">Actualizado Por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                <tr className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                        {initialConfig.provider === 'office365' ? 'Office 365' : initialConfig.provider}
                                    </td>
                                    <td className="px-6 py-4 text-cyan-700 font-bold text-base">{initialConfig.email}</td>
                                    <td className="px-6 py-4 border-l border-gray-100 border-dashed">
                                        <span className="font-medium text-gray-700">{initialConfig.updatedBy || 'Sistema'}</span>
                                        <div className="text-[11px] text-gray-400 mt-0.5">{new Date(initialConfig.updatedAt).toLocaleString()}</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isEditing && (
                <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5 max-w-2xl mt-6 relative animate-in fade-in slide-in-from-bottom-2">
                    {initialConfig && (
                        <button
                            type="button"
                            onClick={() => { setIsEditing(false); setError(''); setSuccess(''); }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                            title="Cerrar edición"
                        >
                            ✕
                        </button>
                    )}

                    <h3 className="font-bold text-lg text-gray-800 mb-2 border-b border-gray-100 pb-2">
                        {initialConfig ? 'Actualizar Credenciales' : 'Registrar Credenciales Office 365'}
                    </h3>

                    <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 mb-2">
                        <p className="text-sm text-sky-800 font-medium">
                            <span className="text-xl inline-block align-middle mr-2">ℹ️</span>
                            Estas credenciales serán guardadas usando cifrado de grado militar (AES-256) directo a base de datos.
                        </p>
                    </div>

                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium">{success}</div>}

                    <div className="grid grid-cols-1 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico Office 365</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ejemplo@outlook.office365.com"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900 font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={initialConfig ? "Dejar en blanco para mantener la clave cifrada actual" : "Ingresa la contraseña del correo"}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-gray-900"
                            />
                            {initialConfig && (
                                <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg inline-block border border-gray-100">
                                    💡 <strong>Nota segura:</strong> Al dejar este campo vacío, la contraseña almacenada actualmente no será expuesta ni sobrescrita.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Servidor SMTP</label>
                            <input
                                type="text"
                                disabled
                                value="smtp.office365.com"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-100 text-gray-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 mt-1">Este valor viene configurado por defecto para todos los clientes M365.</p>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        {initialConfig && (
                            <button
                                type="button"
                                onClick={() => { setIsEditing(false); setError(''); setSuccess(''); }}
                                className="px-6 py-2.5 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors w-full sm:w-auto text-center"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !!success}
                            className="px-6 py-2.5 rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none w-full sm:w-auto"
                        >
                            {loading ? 'Validando...' : '💾 Guardar Credenciales'}
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-slate-800">Verificar Conexión SMTP</h4>
                                <p className="text-xs text-slate-500">Prueba si el servidor de Hendaya (Office 365) acepta estas credenciales actualmente.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={testLoading || !email}
                                className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm ${
                                    testLoading ? 'bg-slate-200 text-slate-400' : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 active:scale-95'
                                }`}
                            >
                                {testLoading ? '⏳ Probando...' : '👁️ Probar Conexión'}
                            </button>
                        </div>
                        
                        {testResult && (
                            <div className={`mt-3 p-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-1 ${
                                testResult.success ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                            }`}>
                                {testResult.success ? (
                                    <div className="flex items-center gap-2">
                                        <span>✅</span> ¡Conexión Exitosa! El servidor SMTP ha validado las credenciales.
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5">❌</span> 
                                        <div>
                                            <div className="font-bold">Error de Conexión:</div>
                                            <div className="mt-1 text-xs opacity-90">{testResult.error}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </form>
            )}
        </div>
    )
}
