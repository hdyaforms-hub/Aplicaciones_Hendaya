import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import { getArgumentosBibliotecaAction } from './actions'
import BibliotecaArgumentosClient from './BibliotecaArgumentosClient'

export const metadata = {
    title: 'Biblioteca de Argumentos y Precedentes | Hendaya',
    description: 'Repositorio institucional de argumentos jurídicos y técnicos estandarizados y precedentes exitosos ante JUNAEB.'
}

export default async function BibliotecaArgumentosPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const permissions = session.user.role?.permissions || []
    const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin'

    const hasAccess = isAdmin ||
        permissions.includes('view_biblioteca_argumentos') ||
        permissions.includes('manage_biblioteca_argumentos')

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const canManage = isAdmin || permissions.includes('manage_biblioteca_argumentos')

    // Registrar en auditoría
    await logAuditAction({
        username: (session.user.username || session.user.email) as string,
        userId: session.user.id || null,
        action: 'ACCESO_BIBLIOTECA_ARGUMENTOS',
        modulo: 'Multas · Biblioteca de Argumentos',
        detalle: 'Acceso a la biblioteca institucional de argumentos y precedentes.'
    })

    const res = await getArgumentosBibliotecaAction()

    return (
        <div className="w-full py-4 sm:py-6 px-2 sm:px-6 space-y-6">
            {/* Header del Módulo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-cyan-700 font-extrabold tracking-widest text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200">
                            HENDAYA · LITIGIOS Y DEFENSAS JUNAEB
                        </span>
                        <span className="text-slate-400 text-xs font-semibold">
                            Módulo C8: Biblioteca de Precedentes
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <span className="w-2.5 h-6 bg-cyan-600 rounded-full inline-block"></span>
                        Biblioteca de Argumentos y Precedentes
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                        Repositorio institucional de plantillas jurídicas oficiales, criterios jurisprudenciales estandarizados y descargos exitosos con alto historial de rebaja ante JUNAEB.
                    </p>
                </div>
            </div>

            <BibliotecaArgumentosClient
                argumentosIniciales={res.data || []}
                canManage={canManage}
                userName={session.user.name || session.user.username || 'Usuario'}
            />
        </div>
    )
}
