import { NextResponse } from 'next/server'
import { searchColegiosMatriz } from '@/app/dashboard/matriz-riesgo/actions'
import { prisma } from '@/lib/prisma'

export async function GET() {
    // Para depurar, buscaremos un RBD que exista en CD COPIAPO: '438' o '383'
    const dbUser = await prisma.user.findFirst({
        where: { username: { contains: 'operaciones' } },
        include: { sucursales: true }
    })
    const userSucursalNames = dbUser?.sucursales?.map((s: any) => s.nombre) || []
    const uts = await prisma.uT.findMany({
        where: { sucursal: { nombre: { in: userSucursalNames } } },
        select: { codUT: true }
    })
    const allowedUTs = uts.map(ut => ut.codUT)

    const baseWhere: any = {
        isActive: true,
        OR: [
            { colRBD: 438 },
            { nombreEstablecimiento: { contains: '438', mode: 'insensitive' } }
        ]
    }
    const orConditions = []
    if (allowedUTs.length > 0) orConditions.push({ colut: { in: allowedUTs } })
    if (dbUser?.rbds && dbUser.rbds.length > 0) orConditions.push({ colRBD: { in: dbUser.rbds } })

    let finalWhere: any = baseWhere
    if (orConditions.length > 0) {
        finalWhere = {
            ...baseWhere,
            AND: [{ OR: orConditions }]
        }
    }

    const colegios = await prisma.colegiosMatriz.findMany({
        where: finalWhere,
        take: 10
    })

    return NextResponse.json({ colegios, finalWhere, orConditions, allowedUTs, userSucursalNames, dbUser })
}
