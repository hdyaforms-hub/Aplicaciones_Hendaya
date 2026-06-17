import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getMatrix, getLicitaciones } from '../actions'
import NuevaMatrizEditorClient from './NuevaMatrizEditorClient'

export default async function NuevaMatrizDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        redirect('/dashboard')
    }

    const { id } = await params
    const { matrix, error } = await getMatrix(id)
    const { licitaciones } = await getLicitaciones()

    if (error || !matrix) {
        return <div className="p-8 text-red-500 font-bold">Error: {error || 'Matriz no encontrada'}</div>
    }

    return (
        <NuevaMatrizEditorClient
            matrix={matrix}
            licitaciones={licitaciones || []}
        />
    )
}
