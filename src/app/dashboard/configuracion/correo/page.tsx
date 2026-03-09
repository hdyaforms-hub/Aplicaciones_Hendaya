import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import EmailConfigForm from './EmailConfigForm'

export default async function EmailConfigPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_correo')) {
        redirect('/dashboard')
    }

    const config = await prisma.emailConfig.findUnique({
        where: { id: 'global' },
        select: {
            id: true,
            email: true,
            provider: true,
            updatedBy: true,
            updatedAt: true
        } // Nunca traemos la clave
    })

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📧</span> Configuración de Correo
                    </h2>
                    <p className="text-gray-500 mt-1">Configura y almacena las credenciales de Office 365 para envíos automáticos del sistema.</p>
                </div>
            </div>

            <EmailConfigForm initialConfig={config} />
        </div>
    )
}
