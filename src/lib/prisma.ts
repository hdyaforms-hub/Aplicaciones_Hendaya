import { PrismaClient } from '../generated/client'
import { getSession } from './session'


declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
    var rawPrismaGlobal: undefined | PrismaClient
}

export const rawPrisma = globalThis.rawPrismaGlobal ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.rawPrismaGlobal = rawPrisma

async function getRoleBasedRbdFilter(): Promise<number[] | null> {
    try {
        const session = await getSession()
        if (!session || !session.user) return []

        let userRbds: number[] = session.user.rbds || []
        
        // Fetch fresh RBDs from DB to avoid stale session data
        if (session.user.id) {
            const dbUser = await rawPrisma.user.findUnique({
                where: { id: session.user.id },
                select: { rbds: true, email: true, username: true, name: true }
            })
            if (dbUser && dbUser.rbds.length > 0) {
                userRbds = dbUser.rbds
            } else if (dbUser) {
                const sups = await rawPrisma.supervisor.findMany({
                    where: {
                        OR: [
                            ...(dbUser.email ? [{ correo: { equals: dbUser.email, mode: 'insensitive' as const } }] : []),
                            ...(dbUser.username ? [{ correo: { contains: dbUser.username, mode: 'insensitive' as const } }] : []),
                            ...(dbUser.name ? [{ nombre: { equals: dbUser.name, mode: 'insensitive' as const } }] : [])
                        ]
                    },
                    include: { rbdsAuditar: true }
                })
                const collected: number[] = []
                for (const s of sups) {
                    for (const r of s.rbdsAuditar) {
                        collected.push(r.rbd)
                    }
                }
                if (collected.length > 0) {
                    userRbds = collected
                }
            }
        }

        const roleName = session.user.role?.name?.toLowerCase() || ''

        if (roleName.includes('admin') || roleName.includes('multas') || roleName.includes('gerencia')) return null
        if (roleName.includes('supervisor') || userRbds.length > 0) return userRbds
        
        if (roleName.includes('jefe zonal') || roleName.includes('jefe de operacion') || roleName.includes('operaciones')) {
            const sucursales = session.user.sucursales || []
            if (sucursales.length === 0) return []

            const colegios = await rawPrisma.colegios.findMany({
                where: { sucursal: { in: sucursales } },
                select: { colRBD: true }
            })
            return colegios.map(c => c.colRBD)
        }
        return []
    } catch (e) {
        return null // fallback if outside request context
    }
}

function applyRbdFilter(where: any, rbdField: string, allowed: number[]) {
    if (!where) {
        return { [rbdField]: { in: allowed } }
    }

    const currentVal = where[rbdField]

    if (currentVal === undefined) {
        return { ...where, [rbdField]: { in: allowed } }
    }

    if (typeof currentVal === 'number' || typeof currentVal === 'string') {
        const num = Number(currentVal)
        if (allowed.includes(num)) {
            return where
        } else {
            return { ...where, [rbdField]: { in: [] } }
        }
    }

    if (typeof currentVal === 'object' && currentVal !== null) {
        if (Array.isArray(currentVal.in)) {
            const intersected = currentVal.in.filter((x: any) => allowed.includes(Number(x)))
            return { ...where, [rbdField]: { ...currentVal, in: intersected } }
        }
        if (currentVal.equals !== undefined) {
            const num = Number(currentVal.equals)
            if (allowed.includes(num)) {
                return where
            } else {
                return { ...where, [rbdField]: { in: [] } }
            }
        }
    }

    return {
        AND: [
            where,
            { [rbdField]: { in: allowed } }
        ]
    }
}

function withRbdFilter(rbdField: string) {
    return {
        async findMany({ args, query }: any) {
            const allowed = await getRoleBasedRbdFilter()
            if (allowed !== null) {
                args = args || {}
                args.where = applyRbdFilter(args.where, rbdField, allowed)
            }
            return query(args)
        },
        async findFirst({ args, query }: any) {
            const allowed = await getRoleBasedRbdFilter()
            if (allowed !== null) {
                args = args || {}
                args.where = applyRbdFilter(args.where, rbdField, allowed)
            }
            return query(args)
        },
        async findFirstOrThrow({ args, query }: any) {
            const allowed = await getRoleBasedRbdFilter()
            if (allowed !== null) {
                args = args || {}
                args.where = applyRbdFilter(args.where, rbdField, allowed)
            }
            return query(args)
        },
        async count({ args, query }: any) {
            const allowed = await getRoleBasedRbdFilter()
            if (allowed !== null) {
                args = args || {}
                args.where = applyRbdFilter(args.where, rbdField, allowed)
            }
            return query(args)
        },
        async groupBy({ args, query }: any) {
            const allowed = await getRoleBasedRbdFilter()
            if (allowed !== null) {
                args = args || {}
                args.where = applyRbdFilter(args.where, rbdField, allowed)
            }
            return query(args)
        },
        async aggregate({ args, query }: any) {
            const allowed = await getRoleBasedRbdFilter()
            if (allowed !== null) {
                args = args || {}
                args.where = applyRbdFilter(args.where, rbdField, allowed)
            }
            return query(args)
        }
    }
}

const prismaClientSingleton = () => {
    return rawPrisma.$extends({
        query: {
            colegios: withRbdFilter('colRBD'),
            pMPA: withRbdFilter('rbd'),
            ingRacion: withRbdFilter('rbd'),
            solicitudPan: withRbdFilter('rbd'),
            solicitudGas: withRbdFilter('rbd'),
            colegiosMatriz: withRbdFilter('rbd')
        }
    })
}

export const prisma = prismaClientSingleton()
