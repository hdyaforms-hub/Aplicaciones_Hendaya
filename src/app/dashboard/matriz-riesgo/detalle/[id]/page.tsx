import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getRespuestaCompleta } from '../actions'
import RespuestaEditorClient from './RespuestaEditorClient'

export default async function RespuestaDetallePage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const session = await getSession()
    if (!session?.user) {
        redirect('/login')
    }

    const { id } = await params
    const resolvedSearchParams = await searchParams
    const { respuesta, colegioNombre, error } = await getRespuestaCompleta(id)

    if (error || !respuesta) {
        return <div className="p-8 text-red-500 font-bold">Error: {error || 'Respuesta no encontrada'}</div>
    }

    const isAdmin = session.user.role.name === 'Administrador' || session.user.role.name === 'admin'
    const requestedMode = resolvedSearchParams.mode === 'edit' ? 'edit' : 'view'
    
    // If user requests edit but is not admin, force to view mode
    const mode = (requestedMode === 'edit' && isAdmin) ? 'edit' : 'view'

    return (
        <RespuestaEditorClient
            respuestaCabecera={respuesta}
            colegioNombre={colegioNombre || ''}
            mode={mode}
        />
    )
}
