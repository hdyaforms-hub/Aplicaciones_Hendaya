import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getRegistrosList, getCamarasCatalog } from './actions'
import VerificadorListClient from './VerificadorListClient'
import { prisma } from '@/lib/prisma'

export default async function VerificadorTemperaturasPage() {
    const session = await getSession()
    if (!session || !session?.user?.id) {
        redirect('/login')
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            role: true,
            areas: true,
            sucursales: true
        }
    })

    if (!dbUser) redirect('/login')

    const roleName = dbUser.role?.name || ''
    const isUserAdmin = roleName === 'admin' || roleName === 'Administrador'
    
    let permissions: string[] = []
    if (dbUser.role?.permissions) {
        try {
            permissions = typeof dbUser.role.permissions === 'string' 
                ? JSON.parse(dbUser.role.permissions) 
                : dbUser.role.permissions
        } catch {
            permissions = []
        }
    }

    const hasCalidad = dbUser.areas.some(a => a.nombre.toLowerCase().includes('calidad'))
    const canView = isUserAdmin || hasCalidad || permissions.includes('view_verificador_temperaturas') || permissions.includes('view_calidad')
    const canManage = isUserAdmin || permissions.includes('manage_verificador_temperaturas')
    const canConfig = isUserAdmin || permissions.includes('config_verificador_temperaturas')

    if (!canView) {
        redirect('/dashboard')
    }

    const lowerRole = roleName.toLowerCase()
    const canSignJefeBodega = isUserAdmin || lowerRole.includes('jefe de bodega') || lowerRole.includes('jefe bodega') || permissions.includes('sign_jefe_bodega')
    const canSignJefeZonal = isUserAdmin || lowerRole.includes('jefe zonal') || lowerRole.includes('jefezonal') || lowerRole.includes('zonal') || permissions.includes('sign_jefe_zonal')

    const userSucursalIds = dbUser.sucursales.map(s => s.id)
    const registros = await getRegistrosList(userSucursalIds, isUserAdmin)
    const camaras = await getCamarasCatalog()

    return (
        <VerificadorListClient
            initialRegistros={registros}
            camarasCatalog={camaras}
            canManage={canManage}
            canConfig={canConfig}
            canSignJefeBodega={canSignJefeBodega}
            canSignJefeZonal={canSignJefeZonal}
            currentUser={dbUser.name || dbUser.username}
        />
    )
}
