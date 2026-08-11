'use server'

import { prisma } from '@/lib/prisma'

export async function getSucursalesList() {
    try {
        return await prisma.sucursal.findMany({
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function getOrganigramaData() {
    try {
        const [zonales, jefesOperacion, supervisores, colegios, distancias] = await Promise.all([
            // 1. Fetch Jefes Zonales (Active Only)
            prisma.jefeZonal.findMany({
                where: { vigente: true },
                include: {
                    sucursales: {
                        include: { sucursal: true }
                    },
                    licitaciones: {
                        include: { licitacion: true }
                    }
                },
                orderBy: { nombre: 'asc' }
            }),

            // 2. Fetch Jefes de Operación (Active Only)
            prisma.jefeOperacion.findMany({
                where: { vigente: true },
                orderBy: { nombre: 'asc' }
            }),

            // 3. Fetch Supervisores (Active Only, with Camionetas and RBDs)
            prisma.supervisor.findMany({
                where: { vigente: true },
                include: {
                    camionetas: {
                        include: {
                            vehiculo: {
                                include: { tipoVehiculo: true }
                            }
                        }
                    },
                    rbdsAuditar: true
                },
                orderBy: { nombre: 'asc' }
            }),

            // 4. Fetch Colegios to map RBD to Name, Institution and Sucursal
            prisma.colegios.findMany({
                select: {
                    colRBD: true,
                    nombreEstablecimiento: true,
                    institucion: true,
                    sucursal: true
                },
                distinct: ['colRBD']
            }),

            // 5. Fetch distancias cache (bodega → RBD)
            prisma.distanciaCache.findMany({
                select: {
                    sucursal: true,
                    rbd: true,
                    distanciaKm: true
                }
            })
        ])

        return {
            zonales,
            jefesOperacion,
            supervisores,
            colegios,
            distancias
        }
    } catch (e) {
        console.error(e)
        return {
            zonales: [],
            jefesOperacion: [],
            supervisores: [],
            colegios: [],
            distancias: []
        }
    }
}
