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

    const roleName = session.user.role?.name?.toLowerCase() || ''
    
    // Roles con acceso global irrestricto
    if (roleName.includes('admin') || roleName.includes('gerencia')) {
        return null
    }

    const rbdsSet = new Set<number>()

    // Consultar usuario en BD para obtener datos actualizados
    let dbUser: any = null
    if (session.user.id) {
        try {
            dbUser = await rawPrisma.user.findUnique({
                where: { id: session.user.id },
                include: { sucursales: true }
            })
        } catch (e) {
            console.error('Error al consultar usuario en getUserEffectiveRbds:', e)
        }
    }

    // 1. RBDs directos asignados en User.rbds
    if (dbUser?.rbds && Array.isArray(dbUser.rbds)) {
        for (const rbd of dbUser.rbds) {
            const num = Number(rbd)
            if (!isNaN(num) && num > 0) rbdsSet.add(num)
        }
    } else if (Array.isArray(session.user.rbds)) {
        for (const rbd of session.user.rbds) {
            const num = Number(rbd)
            if (!isNaN(num) && num > 0) rbdsSet.add(num)
        }
    }

    // 2. RBDs asignados como Supervisor (SupervisorRbd por email, username o nombre)
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
            for (const s of sups) {
                if (s.rbdsAuditar && Array.isArray(s.rbdsAuditar)) {
                    for (const r of s.rbdsAuditar) {
                        const num = Number(r.rbd)
                        if (!isNaN(num) && num > 0) rbdsSet.add(num)
                    }
                }
            }
        } catch (e) {
            console.error('Error al consultar supervisor rbds en getUserEffectiveRbds:', e)
        }
    }

    // 3. RBDs por sucursales asignadas (Jefe Zonal, Jefe de Operaciones, Supervisores zonales, etc.)
    const sucursalesFromDb = (dbUser?.sucursales || []).map((s: any) => s.nombre)
    const sucursalesFromSession = session.user.sucursales || []
    const allSucursales = Array.from(new Set([...sucursalesFromDb, ...sucursalesFromSession])).filter(Boolean)

    if (allSucursales.length > 0) {
        try {
            const colegios = await rawPrisma.colegios.findMany({
                where: { sucursal: { in: allSucursales } },
                select: { colRBD: true }
            })
            for (const c of colegios) {
                const num = Number(c.colRBD)
                if (!isNaN(num) && num > 0) rbdsSet.add(num)
            }
        } catch (e) {
            console.error('Error al consultar colegios por sucursales en getUserEffectiveRbds:', e)
        }
    }

    return Array.from(rbdsSet)
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
