import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getFormById } from '../../actions'
import FillFormClient from '../FillFormClient'

export default async function FillFormPage({ params }: { params: { id: string } }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('fill_formularios')) {
        redirect('/dashboard')
    }

    const { form, error } = await getFormById(params.id)
    if (error || !form) {
        redirect('/dashboard/formularios/abrir')
    }

    return (
        <div className="space-y-6">
            <FillFormClient form={form} />
        </div>
    )
}
