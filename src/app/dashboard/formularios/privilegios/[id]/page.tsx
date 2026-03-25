import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { getFormWithRelations, getAllUsers } from '../../actions'
import FormPrivilegesClient from '../FormPrivilegesClient'

export default async function PrivilegiosPage({ params }: { params: { id: string } }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        redirect('/dashboard')
    }

    const form = await getFormWithRelations(params.id)
    if (!form) notFound()

    const allUsers = await getAllUsers()

    return (
        <div className="space-y-6">
            <FormPrivilegesClient form={form} allUsers={allUsers} />
        </div>
    )
}
