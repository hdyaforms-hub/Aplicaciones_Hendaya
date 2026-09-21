import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { ensureRegCapTables, getRegistrosCapacitacion, getCapacitacionMetadata } from './actions'
import RegistroCapacitacionClient from './RegistroCapacitacionClient'

export const dynamic = 'force-dynamic'

export default async function RegistroCapacitacionPage() {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    const userPerms: string[] = (session.user.role as any)?.permissions || []
    const isAdmin = roleName.includes('admin') || userPerms.includes('admin')

    const canView = isAdmin || userPerms.includes('view_registro_capacitacion')
    if (!canView) {
        return (
            <div className="max-w-4xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-4xl block mb-2">🔒</span>
                <h1 className="text-xl font-bold text-slate-800">Acceso No Autorizado</h1>
                <p className="text-sm text-slate-500 mt-2">
                    No tienes los privilegios necesarios para acceder al módulo <strong>Registro de Capacitación</strong>.
                </p>
            </div>
        )
    }

    const canManage = isAdmin || userPerms.includes('manage_registro_capacitacion')

    // Garantizar que las tablas RegCap_ existan en PostgreSQL
    await ensureRegCapTables()

    // Obtener datos iniciales y metadatos de licitaciones y sucursales
    const [res, metadata] = await Promise.all([
        getRegistrosCapacitacion(),
        getCapacitacionMetadata()
    ])
    const registros = res.success && res.data ? res.data : []

    const currentUserName = session.user.name || session.user.username || 'Usuario'

    return (
        <RegistroCapacitacionClient
            initialRegistros={registros}
            metadata={metadata}
            canManage={canManage}
            isAdmin={isAdmin}
            currentUserName={currentUserName}
        />
    )
}
