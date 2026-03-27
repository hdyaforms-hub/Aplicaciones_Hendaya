import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { getFormWithRelations, getFormEditability } from '../../actions'
import CrearFormularioClient from '../../crear/CrearFormularioClient'

export default async function EditarFormularioPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        redirect('/dashboard')
    }

    const [form, areas] = await Promise.all([
        getFormWithRelations(id),
        prisma.area.findMany({ where: { isActive: true }, orderBy: { nombre: 'asc' } })
    ])

    if (!form) notFound()

    const { isEditable, submissionCount } = await getFormEditability(id)

    return (
        <div className="space-y-6">
            <CrearFormularioClient 
                initialForm={form} 
                isEditable={isEditable} 
                submissionCount={submissionCount} 
                areas={areas}
            />
        </div>
    )
}
