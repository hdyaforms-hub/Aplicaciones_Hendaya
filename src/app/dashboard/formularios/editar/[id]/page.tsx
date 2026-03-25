import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { getFormWithRelations, getFormEditability } from '../../actions'
import CrearFormularioClient from '../../crear/CrearFormularioClient'

export default async function EditarFormularioPage({ params }: { params: { id: string } }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        redirect('/dashboard')
    }

    const form = await getFormWithRelations(params.id)
    if (!form) notFound()

    const { isEditable, submissionCount } = await getFormEditability(params.id)

    return (
        <div className="space-y-6">
            <CrearFormularioClient initialForm={form} isEditable={isEditable} submissionCount={submissionCount} />
        </div>
    )
}
