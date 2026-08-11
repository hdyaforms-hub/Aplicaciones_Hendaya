import { getSession } from './session'
import { rawPrisma } from './prisma'

export async function getRoleBasedRbdFilter(): Promise<number[] | null> {
    const session = await getSession()
    if (!session || !session.user) {
        return [] // No session = no access
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    
    // Roles with full access
    if (roleName.includes('admin') || 
        roleName.includes('multas') || 
        roleName.includes('gerencia')) {
        return null // null means "no filter, allow all"
    }

    // Supervisor / user direct RBDs
    if (session.user.id) {
        const dbUser = await rawPrisma.user.findUnique({
            where: { id: session.user.id },
            select: { rbds: true }
        })
        if (dbUser && dbUser.rbds.length > 0) {
            return dbUser.rbds
        }
    }

    if (roleName.includes('supervisor')) {
        return session.user.rbds || []
    }

    // Jefe Zonal / Jefe Operacion: all RBDs from their Sucursales
    if (roleName.includes('jefe zonal') || 
        roleName.includes('jefe de operacion') || 
        roleName.includes('operaciones')) {
        
        const sucursales = session.user.sucursales || []
        
        if (sucursales.length === 0) {
            return [] // Assigned to no sucursal = sees nothing
        }

        const colegios = await rawPrisma.colegios.findMany({
            where: { sucursal: { in: sucursales } },
            select: { colRBD: true }
        })

        return colegios.map(c => c.colRBD)
    }

    // Default for any other unknown role: no access
    return []
}
