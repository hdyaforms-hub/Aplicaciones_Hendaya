import { getSession } from './session'
import { rawPrisma } from './prisma'

/**
 * Obtiene los RBDs efectivos a los que tiene acceso el usuario actual.
 * - Si es Administrador o Gerencia: retorna null (acceso irrestricto a todos los RBDs).
 * - Si es cualquier otro rol: retorna un array de números (RBDs asignados explícitamente vía usuario,
 *   auditoría de supervisor, o sucursales del usuario).
 *   Si el usuario no tiene colegios asignados, retorna [] (acceso restringido a 0 colegios).
 */
export async function getUserEffectiveRbds(): Promise<number[] | null> {
    const session = await getSession()
    if (!session || !session.user) {
        return [] // Sin sesión = 0 acceso
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    
    // Roles con acceso global irrestricto (solo administradores explícitos o gerencia)
    const isAdmin = roleName === 'admin' || 
                    roleName === 'administrador' || 
                    roleName === 'super admin' || 
                    roleName === 'superadministrador' || 
                    roleName.includes('gerencia')

    if (isAdmin) {
        return null
    }

    // Consultar usuario en BD para obtener datos actualizados en tiempo real
    let dbUser: any = null
    if (session.user.id) {
        try {
            dbUser = await rawPrisma.user.findUnique({
                where: { id: session.user.id },
                select: { rbds: true, email: true, username: true, name: true, sucursales: true }
            })
        } catch (e) {
            console.error('Error al consultar usuario en getUserEffectiveRbds:', e)
        }
    }

    // 1. RBDs directos asignados en User.rbds (Módulo "Asociar RBD a usuarios")
    // Si el usuario tiene RBDs asignados explícitamente, este es su conjunto exclusivo y estricto.
    const directRbds = (dbUser?.rbds || session.user.rbds || [])
        .map(Number)
        .filter((n: number) => !isNaN(n) && n > 0)

    if (directRbds.length > 0) {
        return Array.from(new Set(directRbds))
    }

    // 2. Si no tiene RBDs asignados en User.rbds, buscar si es Supervisor con colegios asignados a auditar
    const email = dbUser?.email || session.user.email
    const username = dbUser?.username || session.user.username
    const name = dbUser?.name || session.user.name

    if (email || username || name) {
        try {
            const sups = await rawPrisma.supervisor.findMany({
                where: {
                    OR: [
                        ...(email ? [{ correo: { equals: email, mode: 'insensitive' as const } }] : []),
                        ...(username ? [{ correo: { contains: username, mode: 'insensitive' as const } }] : []),
                        ...(name ? [{ nombre: { equals: name, mode: 'insensitive' as const } }] : [])
                    ]
                },
                include: { rbdsAuditar: true }
            })
            const supervisorRbds: number[] = []
            for (const s of sups) {
                if (s.rbdsAuditar && Array.isArray(s.rbdsAuditar)) {
                    for (const r of s.rbdsAuditar) {
                        const num = Number(r.rbd)
                        if (!isNaN(num) && num > 0) supervisorRbds.push(num)
                    }
                }
            }
            if (supervisorRbds.length > 0) {
                return Array.from(new Set(supervisorRbds))
            }
        } catch (e) {
            console.error('Error al consultar supervisor rbds en getUserEffectiveRbds:', e)
        }
    }

    // 3. Solo para jefaturas territoriales (Jefe Zonal, Jefe de Operaciones) que no tengan asignación directa de RBDs:
    const isZonalOrOperaciones = roleName.includes('jefe zonal') || 
                                 roleName.includes('jefe de operacion') || 
                                 roleName.includes('operaciones')

    if (isZonalOrOperaciones) {
        const sucursalesFromDb = (dbUser?.sucursales || []).map((s: any) => s.nombre)
        const sucursalesFromSession = session.user.sucursales || []
        const allSucursales = Array.from(new Set([...sucursalesFromDb, ...sucursalesFromSession])).filter(Boolean)

        if (allSucursales.length > 0) {
            try {
                const colegios = await rawPrisma.colegios.findMany({
                    where: { sucursal: { in: allSucursales } },
                    select: { colRBD: true }
                })
                const zonalRbds: number[] = []
                for (const c of colegios) {
                    const num = Number(c.colRBD)
                    if (!isNaN(num) && num > 0) zonalRbds.push(num)
                }
                return Array.from(new Set(zonalRbds))
            } catch (e) {
                console.error('Error al consultar colegios por sucursales en getUserEffectiveRbds:', e)
            }
        }
    }

    // Si no es admin y no tiene ningún RBD asociado en "Asociar RBD a usuarios", retorna array vacío (0 acceso)
    return []
}

export async function getRoleBasedRbdFilter(): Promise<number[] | null> {
    const session = await getSession()
    if (!session || !session.user) {
        return []
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    if (roleName.includes('multas')) {
        return null // Multas tiene acceso global en sus reportes
    }

    return getUserEffectiveRbds()
}
