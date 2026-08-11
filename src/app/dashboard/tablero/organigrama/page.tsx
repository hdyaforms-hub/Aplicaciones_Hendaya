import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSucursalesList, getOrganigramaData } from './actions'
import OrganigramaClient from './OrganigramaClient'

export default async function OrganigramaPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_tablero_organigrama')) {
        redirect('/dashboard')
    }

    const [sucursales, data] = await Promise.all([
        getSucursalesList(),
        getOrganigramaData()
    ])

    return (
        <OrganigramaClient
            sucursales={sucursales}
            initialZonales={data.zonales}
            initialJefesOperacion={data.jefesOperacion}
            initialSupervisores={data.supervisores}
            colegios={data.colegios}
            distancias={data.distancias}
        />
    )
}
