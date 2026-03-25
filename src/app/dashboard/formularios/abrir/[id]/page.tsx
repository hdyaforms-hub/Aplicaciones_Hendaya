import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getFormById } from '../../actions'
import FillFormClient from '../FillFormClient'

export default async function FillFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('fill_formularios')) {
        redirect('/dashboard')
    }

    const { form, error } = await getFormById(id)
    if (error || !form) {
        redirect('/dashboard/formularios/abrir')
    }

    return (
        <div className="space-y-6">
            <FillFormClient form={form} />
        </div>
    )
}
