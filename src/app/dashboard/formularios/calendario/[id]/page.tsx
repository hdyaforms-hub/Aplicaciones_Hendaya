import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { getFormWithRelations } from '../../actions'
import FormScheduleClient from '../FormScheduleClient'

export default async function CalendarioPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        redirect('/dashboard')
    }

    const form = await getFormWithRelations(id)
    if (!form) notFound()

    return (
        <div className="space-y-6">
            <FormScheduleClient form={form} />
        </div>
    )
}
