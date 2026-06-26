import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { 
    getZonales, 
    getJefesOperacion, 
    getSupervisores, 
    getLicitaciones, 
    getSucursales, 
    getVehiculos, 
    getColegios,
    getRegisteredEmails 
} from './actions'
import { getDistanciasCache, getConsumoActual } from './googleMapsAction'
import PersonalClient from './PersonalClient'

export default async function PersonalPage() {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    let permissions = session?.user?.role?.permissions || []
    if (isAdmin && !permissions.includes('view_tablero_distancias')) {
        permissions = [...permissions, 'view_tablero_distancias']
    }

    const hasAnyPermission = 
        permissions.includes('manage_zonales') || 
        permissions.includes('manage_jefe_operacion') || 
        permissions.includes('manage_supervisor') ||
        permissions.includes('view_tablero_distancias')

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
        colegios,
        distanciasCache,
        consumoActual,
        registeredEmails
    ] = await Promise.all([
        getZonales(),
        getJefesOperacion(),
        getSupervisores(),
        getLicitaciones(),
        getSucursales(),
        getVehiculos(),
        getColegios(),
        getDistanciasCache(),
        getConsumoActual(),
        getRegisteredEmails()
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
            initialDistanciasCache={distanciasCache}
            initialConsumoActual={consumoActual}
            registeredEmails={registeredEmails}
        />
    )
}
