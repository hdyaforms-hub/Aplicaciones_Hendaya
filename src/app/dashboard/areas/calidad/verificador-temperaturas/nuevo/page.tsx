import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getCamarasCatalog, getProductosCatalog, getSucursalesConLicitaciones } from '../actions'
import VerificadorFormClient from '../VerificadorFormClient'
import { prisma } from '@/lib/prisma'

export default async function NuevoVerificadorPage() {
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

    const canManage = isUserAdmin || permissions.includes('manage_verificador_temperaturas')
    const canConfig = isUserAdmin || permissions.includes('config_verificador_temperaturas')

    if (!canManage) {
        redirect('/dashboard/areas/calidad/verificador-temperaturas')
    }

    const userSucursalIds = dbUser.sucursales.map(s => s.id)
    const [camaras, productos, sucursales] = await Promise.all([
        getCamarasCatalog(),
        getProductosCatalog(),
        getSucursalesConLicitaciones(userSucursalIds, isUserAdmin)
    ])

    return (
        <VerificadorFormClient
            camarasCatalog={camaras}
            productosCatalog={productos}
            sucursalesList={sucursales}
            canManage={canManage}
            canConfig={canConfig}
            currentUser={dbUser.name || dbUser.username}
        />
    )
}
