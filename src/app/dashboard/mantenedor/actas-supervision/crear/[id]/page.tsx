import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { getActaPlantillaById, getLicitacionesList, getRolesList } from '../../actions'
import CrearActaClient from '../CrearActaClient'

export default async function EditarActaPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_actas_supervision')) {
        redirect('/dashboard')
    }

    const [plantilla, licitaciones, rolesList] = await Promise.all([
        getActaPlantillaById(id),
        getLicitacionesList(),
        getRolesList()
    ])

    if (!plantilla) {
        notFound()
    }

    return (
        <CrearActaClient initialPlantilla={plantilla} licitaciones={licitaciones} rolesList={rolesList} />
    )
}
