import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CrearFormularioClient from './CrearFormularioClient'

export default async function CrearFormularioPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6">
            <CrearFormularioClient />
        </div>
    )
}
