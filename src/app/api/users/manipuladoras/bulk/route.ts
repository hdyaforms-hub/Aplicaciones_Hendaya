import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        
        if (!permissions.includes('manage_manipuladoras_masiva')) {
            return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
        }

        const body = await request.json()
        const { rows } = body // Expected: Array of objects from Excel

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ message: 'No hay datos para procesar' }, { status: 400 })
        }

        const rolManipuladora = await prisma.role.findFirst({
            where: { name: { equals: 'Manipuladoras', mode: 'insensitive' } }
        })
        const areaManipuladora = await prisma.area.findFirst({
            where: { nombre: { equals: 'MANIPULADORAS', mode: 'insensitive' } }
        })

        if (!rolManipuladora || !areaManipuladora) {
            return NextResponse.json({ message: 'Error de configuración: Faltan rol o área de Manipuladoras' }, { status: 500 })
        }

        // Cache sucursales to avoid multiple queries
        const dbSucursales = await prisma.sucursal.findMany()
        const sucursalesMap = new Map()
        dbSucursales.forEach(s => sucursalesMap.set(s.nombre.trim().toUpperCase(), s.id))

        let agregados = 0
        let omitidos = 0
        const usuariosOmitidos: string[] = []

        const passwordHash = await bcrypt.hash('Henda.2026$', 10)

        for (const row of rows) {
            const nombreCompleto = row['NombreCompleto']
            const nombreUsuario = row['NombreUsuario']
            const correo = row['CorreoElectronico']
            const nombreSucursalesStr = row['SucursalesPermitidas']
            const rbdStr = row['EstablecimientoTrabajo'] // could be multiple? assumed comma-separated or single

            if (!nombreUsuario || !nombreCompleto || !nombreSucursalesStr) {
                omitidos++
                usuariosOmitidos.push(`${nombreUsuario || 'Desconocido'} (Faltan campos)`)
                continue
            }

            const existing = await prisma.user.findUnique({
                where: { username: nombreUsuario }
            })

            if (existing) {
                omitidos++
                usuariosOmitidos.push(`${nombreUsuario} (Ya existe)`)
                continue
            }

            const sucNombres = String(nombreSucursalesStr).split(',').map(s => s.trim().toUpperCase())
            const sucursalIds = sucNombres.map(sn => sucursalesMap.get(sn)).filter(Boolean)

            if (sucursalIds.length === 0) {
                omitidos++
                usuariosOmitidos.push(`${nombreUsuario} (Sucursal no válida)`)
                continue
            }

            const rbds = String(rbdStr || '').split(',').map(r => parseInt(r.trim(), 10)).filter(r => !isNaN(r))

            await prisma.user.create({
                data: {
                    username: nombreUsuario,
                    name: nombreCompleto,
                    email: correo || null,
                    passwordHash,
                    roleId: rolManipuladora.id,
                    isActive: true, // "EstadoUsuario --> Vigente"
                    mustChangePassword: true, // "Contraseña --> debe asumir el check del reseteo"
                    rbds: rbds,
                    sucursales: {
                        connect: sucursalIds.map(id => ({ id }))
                    },
                    areas: {
                        connect: { id: areaManipuladora.id }
                    }
                }
            })
            agregados++
        }

        return NextResponse.json({
            message: `Proceso completado: ${agregados} creados, ${omitidos} omitidos.`,
            agregados,
            omitidos,
            usuariosOmitidos
        }, { status: 200 })

    } catch (error: any) {
        console.error('Error en bulk load manipuladoras:', error)
        return NextResponse.json(
            { message: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
