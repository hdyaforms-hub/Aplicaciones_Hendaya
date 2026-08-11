import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import { getRegistroById, getCamarasCatalog, getProductosCatalog, getSucursalesConLicitaciones } from '../../actions'
import VerificadorFormClient from '../../VerificadorFormClient'
import { prisma } from '@/lib/prisma'

interface Props {
    params: Promise<{ id: string }>
}

export default async function EditarVerificadorPage({ params }: Props) {
    const { id } = await params
    const idRegistro = parseInt(id, 10)

    if (isNaN(idRegistro)) {
        notFound()
    }

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

    const userSucursalIds = dbUser.sucursales.map(s => s.id)
    const [registro, camaras, productos, sucursales] = await Promise.all([
        getRegistroById(idRegistro),
        getCamarasCatalog(),
        getProductosCatalog(),
        getSucursalesConLicitaciones(userSucursalIds, isUserAdmin)
    ])

    if (!registro) {
        notFound()
    }

    return (
        <VerificadorFormClient
            initialData={registro}
            camarasCatalog={camaras}
            productosCatalog={productos}
            sucursalesList={sucursales}
            canManage={canManage}
            canConfig={canConfig}
            currentUser={dbUser.name || dbUser.username}
        />
    )
}
