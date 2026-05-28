import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { 
    getSupervisores, 
    getSucursales, 
    getColegios 
} from '../../mantenedor/operaciones/personal/actions'
import { getDistanciasCache, getConsumoActual } from '../../mantenedor/operaciones/personal/googleMapsAction'
import KilometrajeTableroClient from './KilometrajeTableroClient'

export default async function KilometrajeTableroPage() {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    let permissions = session?.user?.role?.permissions || []
    
    // Auto-inject permission for admin roles
    if (isAdmin && !permissions.includes('view_tablero_distancias')) {
        permissions = [...permissions, 'view_tablero_distancias']
    }

    if (!permissions.includes('view_tablero_distancias')) {
        redirect('/dashboard')
    }

    const [
        supervisores,
        sucursales,
        colegios,
        distanciasCache,
        consumoActual
    ] = await Promise.all([
        getSupervisores(),
        getSucursales(),
        getColegios(),
        getDistanciasCache(),
        getConsumoActual()
    ])

    return (
        <KilometrajeTableroClient
            supervisores={supervisores}
            sucursales={sucursales}
            colegios={colegios}
            distanciasCache={distanciasCache}
            consumoActual={consumoActual}
            userPermissions={permissions}
        />
    )
}
