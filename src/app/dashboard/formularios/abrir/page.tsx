import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getFormDefinitions } from '../actions'
import AbrirFormularioClient from './AbrirFormularioClient'

export default async function AbrirFormularioPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('fill_formularios')) {
        redirect('/dashboard')
    }

    const res = await getFormDefinitions()
    
    return (
        <div className="space-y-6">
            <AbrirFormularioClient 
                initialForms={res.forms || []} 
                canManage={session.user.role.permissions.includes('create_formularios')}
            />
        </div>
    )
}
