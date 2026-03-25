import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import GestionFormulariosClient from './GestionFormulariosClient'

export default async function GestionPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_formularios')) {
        redirect('/dashboard')
    }

    const forms = await prisma.formDefinition.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-6">
            <GestionFormulariosClient forms={forms} />
        </div>
    )
}
