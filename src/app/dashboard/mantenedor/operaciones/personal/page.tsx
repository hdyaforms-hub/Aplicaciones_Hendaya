import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { 
    getZonales, 
    getJefesOperacion, 
    getSupervisores, 
    getLicitaciones, 
    getSucursales, 
    getVehiculos, 
    getColegios 
} from './actions'
import PersonalClient from './PersonalClient'

export default async function PersonalPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    const hasAnyPermission = 
        permissions.includes('manage_zonales') || 
        permissions.includes('manage_jefe_operacion') || 
        permissions.includes('manage_supervisor')

    if (!hasAnyPermission) {
        redirect('/dashboard')
    }

    const [
        zonales,
        jefesOperacion,
        supervisores,
        licitaciones,
        sucursales,
        vehiculos,
        colegios
    ] = await Promise.all([
        getZonales(),
        getJefesOperacion(),
        getSupervisores(),
        getLicitaciones(),
        getSucursales(),
        getVehiculos(),
        getColegios()
    ])

    return (
        <PersonalClient
            initialZonales={zonales}
            initialJefesOperacion={jefesOperacion}
            initialSupervisores={supervisores}
            licitaciones={licitaciones}
            sucursales={sucursales}
            vehiculos={vehiculos}
            colegios={colegios}
            userPermissions={permissions}
        />
    )
}
