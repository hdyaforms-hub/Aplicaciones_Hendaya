import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getActasPlantillas, getLicitacionesList, getRolesList } from '../actions'
import CrearActaClient from './CrearActaClient'

export default async function CrearActaNuevaPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
        redirect('/dashboard')
    }

    const [licitaciones, plantillas, rolesList] = await Promise.all([
        getLicitacionesList(),
        getActasPlantillas(),
        getRolesList()
    ])

    return (
        <CrearActaClient licitaciones={licitaciones} initialPlantillas={plantillas} rolesList={rolesList} />
    )
}
