import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getVehiculos, getTipoVehiculos, getUTs, getLicitaciones, getSucursales } from './actions'
import VehiculosClient from './VehiculosClient'

export default async function VehiculosPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_vehiculos')) {
        redirect('/dashboard')
    }

    const [vehiculos, tipoVehiculos, uts, licitaciones, sucursales] = await Promise.all([
        getVehiculos(),
        getTipoVehiculos(),
        getUTs(),
        getLicitaciones(),
        getSucursales()
    ])

    return (
        <VehiculosClient 
            initialVehiculos={vehiculos} 
            initialTipoVehiculos={tipoVehiculos} 
            uts={uts} 
            licitaciones={licitaciones}
            sucursales={sucursales}
        />
    )
}
