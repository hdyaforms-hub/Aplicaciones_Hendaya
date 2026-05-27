'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const PATH = '/dashboard/mantenedor/operaciones/personal'

async function hasPermission(permission: string) {
    const session = await getSession()
    return session?.user?.role?.permissions.includes(permission)
}

// ------ DROPDOWNS & INITIAL DATA ------
export async function getLicitaciones() {
    try {
        return await prisma.licitacion.findMany({
            where: { estado: 1 },
            orderBy: { licId: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function getSucursales() {
    try {
        return await prisma.sucursal.findMany({
            include: {
                uts: true
            },
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function getVehiculos() {
    try {
        return await prisma.vehiculo.findMany({
            where: { vigente: true },
            include: { tipoVehiculo: true },
            orderBy: { patente: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function getColegios() {
    try {
        return await prisma.colegios.findMany({
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                sucursal: true,
                colut: true,
                direccionEstablecimiento: true,
                comuna: true,
                institucion: true
            },
            distinct: ['colRBD'],
            orderBy: { nombreEstablecimiento: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

// ------ JEFES ZONALES (Zonales) ------
export async function getZonales() {
    try {
        return await prisma.jefeZonal.findMany({
            include: {
                licitaciones: {
                    include: { licitacion: true }
                },
                sucursales: {
                    include: { sucursal: true }
                },
                vehiculos: {
                    include: { vehiculo: { include: { tipoVehiculo: true } } }
                }
            },
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function createJefeZonal(data: {
    nombre: string
    apellido: string
    correo: string
    licitaciones: number[]
    sucursales: string[]
    vehiculoIds: string[]
    vigente: boolean
}) {
    if (!await hasPermission('manage_zonales')) return { error: 'No tienes permisos.' }

    try {
        await prisma.jefeZonal.create({
            data: {
                nombre: data.nombre.trim(),
                apellido: data.apellido.trim(),
                correo: data.correo.trim().toLowerCase(),
                vigente: data.vigente,
                licitaciones: {
                    create: data.licitaciones.map(id => ({ licitacionId: id }))
                },
                sucursales: {
                    create: data.sucursales.map(id => ({ sucursalId: id }))
                },
                vehiculos: {
                    create: data.vehiculoIds.map(id => ({ vehiculoId: id }))
                }
            }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al registrar el Jefe Zonal.' }
    }
}

export async function updateJefeZonal(id: string, data: {
    nombre: string
    apellido: string
    correo: string
    licitaciones: number[]
    sucursales: string[]
    vehiculoIds: string[]
    vigente: boolean
}) {
    if (!await hasPermission('manage_zonales')) return { error: 'No tienes permisos.' }

    try {
        await prisma.$transaction([
            prisma.jefeZonalLicitacion.deleteMany({ where: { jefeZonalId: id } }),
            prisma.jefeZonalSucursal.deleteMany({ where: { jefeZonalId: id } }),
            (prisma as any).jefeZonalVehiculo.deleteMany({ where: { jefeZonalId: id } }),
            prisma.jefeZonal.update({
                where: { id },
                data: {
                    nombre: data.nombre.trim(),
                    apellido: data.apellido.trim(),
                    correo: data.correo.trim().toLowerCase(),
                    vigente: data.vigente,
                    licitaciones: {
                        create: data.licitaciones.map(licId => ({ licitacionId: licId }))
                    },
                    sucursales: {
                        create: data.sucursales.map(sucId => ({ sucursalId: sucId }))
                    },
                    vehiculos: {
                        create: data.vehiculoIds.map(vId => ({ vehiculoId: vId }))
                    }
                }
            })
        ])

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al actualizar el Jefe Zonal.' }
    }
}

export async function deleteJefeZonal(id: string) {
    if (!await hasPermission('manage_zonales')) return { error: 'No tienes permisos.' }

    try {
        // Validar si tiene Jefes de Operación o Supervisores asociados
        const opsCount = await prisma.jefeOperacion.count({ where: { jefeZonalId: id } })
        const supsCount = await prisma.supervisor.count({ where: { jefeZonalId: id } })

        if (opsCount > 0 || supsCount > 0) {
            return { error: 'No se puede eliminar porque tiene personal (Jefes de Operación o Supervisores) bajo su dependencia.' }
        }

        await prisma.$transaction([
            prisma.jefeZonalLicitacion.deleteMany({ where: { jefeZonalId: id } }),
            prisma.jefeZonalSucursal.deleteMany({ where: { jefeZonalId: id } }),
            (prisma as any).jefeZonalVehiculo.deleteMany({ where: { jefeZonalId: id } }),
            prisma.jefeZonal.delete({ where: { id } })
        ])

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al eliminar el Jefe Zonal.' }
    }
}

// ------ JEFES DE OPERACIÓN ------
export async function getJefesOperacion() {
    try {
        return await prisma.jefeOperacion.findMany({
            include: {
                jefeZonal: {
                    include: {
                        sucursales: {
                            include: { sucursal: true }
                        }
                    }
                },
                vehiculos: {
                    include: { vehiculo: { include: { tipoVehiculo: true } } }
                }
            },
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function createJefeOperacion(data: {
    nombre: string
    apellido: string
    correo: string
    jefeZonalId: string
    vehiculoIds: string[]
    vigente: boolean
}) {
    if (!await hasPermission('manage_jefe_operacion')) return { error: 'No tienes permisos.' }

    try {
        await prisma.jefeOperacion.create({
            data: {
                nombre: data.nombre.trim(),
                apellido: data.apellido.trim(),
                correo: data.correo.trim().toLowerCase(),
                jefeZonalId: data.jefeZonalId,
                vigente: data.vigente,
                vehiculos: {
                    create: data.vehiculoIds.map(id => ({ vehiculoId: id }))
                }
            }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al registrar el Jefe de Operación.' }
    }
}

export async function updateJefeOperacion(id: string, data: {
    nombre: string
    apellido: string
    correo: string
    jefeZonalId: string
    vehiculoIds: string[]
    vigente: boolean
}) {
    if (!await hasPermission('manage_jefe_operacion')) return { error: 'No tienes permisos.' }

    try {
        await prisma.$transaction([
            (prisma as any).jefeOperacionVehiculo.deleteMany({ where: { jefeOperacionId: id } }),
            prisma.jefeOperacion.update({
                where: { id },
                data: {
                    nombre: data.nombre.trim(),
                    apellido: data.apellido.trim(),
                    correo: data.correo.trim().toLowerCase(),
                    jefeZonalId: data.jefeZonalId,
                    vigente: data.vigente,
                    vehiculos: {
                        create: data.vehiculoIds.map(vId => ({ vehiculoId: vId }))
                    }
                }
            })
        ])

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al actualizar el Jefe de Operación.' }
    }
}

export async function deleteJefeOperacion(id: string) {
    if (!await hasPermission('manage_jefe_operacion')) return { error: 'No tienes permisos.' }

    try {
        // Validar si tiene Supervisores asociados
        const supsCount = await prisma.supervisor.count({ where: { jefeOperacionId: id } })
        if (supsCount > 0) {
            return { error: 'No se puede eliminar porque tiene supervisores asociados.' }
        }

        await prisma.$transaction([
            (prisma as any).jefeOperacionVehiculo.deleteMany({ where: { jefeOperacionId: id } }),
            prisma.jefeOperacion.delete({ where: { id } })
        ])
        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al eliminar el Jefe de Operación.' }
    }
}

// ------ SUPERVISORES ------
export async function getSupervisores() {
    try {
        return await prisma.supervisor.findMany({
            include: {
                jefeOperacion: {
                    include: {
                        jefeZonal: {
                            include: {
                                sucursales: {
                                    include: { sucursal: true }
                                }
                            }
                        }
                    }
                },
                jefeZonal: {
                    include: {
                        sucursales: {
                            include: { sucursal: true }
                        }
                    }
                },
                camionetas: {
                    include: { vehiculo: true }
                },
                rbdsAuditar: true
            },
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function createSupervisor(data: {
    nombre: string
    apellido: string
    correo: string
    jefeOperacionId: string | null // Can be null
    jefeZonalId: string | null     // Can be null
    camionetaIds: string[]
    rbdIds: number[]
    vigente: boolean
}) {
    if (!await hasPermission('manage_supervisor')) return { error: 'No tienes permisos.' }

    try {
        await prisma.supervisor.create({
            data: {
                nombre: data.nombre.trim(),
                apellido: data.apellido.trim(),
                correo: data.correo.trim().toLowerCase(),
                jefeOperacionId: data.jefeOperacionId || null,
                jefeZonalId: data.jefeZonalId || null,
                vigente: data.vigente,
                camionetas: {
                    create: data.camionetaIds.map(vId => ({ vehiculoId: vId }))
                },
                rbdsAuditar: {
                    create: data.rbdIds.map(rbd => ({ rbd }))
                }
            }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al registrar el Supervisor.' }
    }
}

export async function updateSupervisor(id: string, data: {
    nombre: string
    apellido: string
    correo: string
    jefeOperacionId: string | null
    jefeZonalId: string | null
    camionetaIds: string[]
    rbdIds: number[]
    vigente: boolean
}) {
    if (!await hasPermission('manage_supervisor')) return { error: 'No tienes permisos.' }

    try {
        await prisma.$transaction([
            prisma.supervisorVehiculo.deleteMany({ where: { supervisorId: id } }),
            prisma.supervisorRbd.deleteMany({ where: { supervisorId: id } }),
            prisma.supervisor.update({
                where: { id },
                data: {
                    nombre: data.nombre.trim(),
                    apellido: data.apellido.trim(),
                    correo: data.correo.trim().toLowerCase(),
                    jefeOperacionId: data.jefeOperacionId || null,
                    jefeZonalId: data.jefeZonalId || null,
                    vigente: data.vigente,
                    camionetas: {
                        create: data.camionetaIds.map(vId => ({ vehiculoId: vId }))
                    },
                    rbdsAuditar: {
                        create: data.rbdIds.map(rbd => ({ rbd }))
                    }
                }
            })
        ])

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al actualizar el Supervisor.' }
    }
}

export async function deleteSupervisor(id: string) {
    if (!await hasPermission('manage_supervisor')) return { error: 'No tienes permisos.' }

    try {
        await prisma.$transaction([
            prisma.supervisorVehiculo.deleteMany({ where: { supervisorId: id } }),
            prisma.supervisorRbd.deleteMany({ where: { supervisorId: id } }),
            prisma.supervisor.delete({ where: { id } })
        ])

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error(e)
        return { error: 'Error al eliminar el Supervisor.' }
    }
}
