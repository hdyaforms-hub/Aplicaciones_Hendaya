'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

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

// ------ CUENTA DE USUARIO AUTOMÁTICA ------
export async function createUserFromHierarchy(data: {
    nombre: string
    apellido: string
    correo: string
    rolAsignado: string // "Jefe Zonal", "Jefe de Operación", "Supervisor"
    sucursalIds: string[]
    rbdIds?: number[]
}) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_zonales') && 
        !permissions.includes('manage_jefe_operacion') &&
        !permissions.includes('manage_supervisor')) {
        return { error: 'No tienes permisos para crear cuentas de personal.' }
    }

    try {
        // 1. Encontrar el Rol (búsqueda parcial insensible a mayúsculas si es posible, pero usaremos contains)
        // Ya que Prisma `contains` en string normal puede ser case-sensitive dependiendo de la BD,
        // Pero intentaremos buscar los roles comunes.
        const roles = await prisma.role.findMany()
        const role = roles.find(r => r.name.toLowerCase().includes(data.rolAsignado.toLowerCase()))
        
        if (!role) {
            return { error: `No se encontró el rol "${data.rolAsignado}" en el sistema.` }
        }

        // 2. Encontrar el Área (OPERACIONES)
        const areas = await prisma.area.findMany()
        const area = areas.find(a => a.nombre.toLowerCase().includes('operaciones'))
        
        if (!area) {
            return { error: 'No se encontró el área "OPERACIONES" en el sistema.' }
        }

        // 3. Generar Username
        const nombreStr = data.nombre.trim().toLowerCase()
        const apellidoParts = data.apellido.trim().toLowerCase().split(/\s+/)
        const apellidoPaterno = apellidoParts[0] || ''
        const apellidoMaterno = apellidoParts.length > 1 ? apellidoParts[1] : ''

        let baseUsername = ''
        if (nombreStr.length > 0) {
            baseUsername = nombreStr[0] + apellidoPaterno
        } else {
            baseUsername = apellidoPaterno
        }

        // Resolver colisiones
        let finalUsername = baseUsername
        let existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })

        if (existingUser) {
            if (apellidoMaterno.length > 0) {
                finalUsername = baseUsername + apellidoMaterno[0]
            } else {
                finalUsername = baseUsername + '1'
            }

            existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })
            let counter = 2
            while (existingUser) {
                finalUsername = baseUsername + (apellidoMaterno.length > 0 ? apellidoMaterno[0] : '') + counter
                existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })
                counter++
            }
        }

        // 4. Verificar correo
        const email = data.correo.trim().toLowerCase()
        if (email) {
            const existingEmail = await prisma.user.findUnique({ where: { email } })
            if (existingEmail) {
                return { error: `El correo ${email} ya está registrado a nombre de otro usuario.` }
            }
        }

        // 5. Hash de contraseña
        const passwordHash = await bcrypt.hash('Henda.2026$', 10)

        // 6. Crear usuario
        await prisma.user.create({
            data: {
                username: finalUsername,
                name: `${data.nombre.trim()} ${data.apellido.trim()}`,
                email: email || null,
                passwordHash,
                roleId: role.id,
                isActive: true,
                mustChangePassword: true,
                rbds: data.rbdIds || [],
                areas: {
                    connect: [{ id: area.id }]
                },
                sucursales: {
                    connect: data.sucursalIds.map(id => ({ id }))
                }
            }
        })

        return { success: true, username: finalUsername }

    } catch (error: any) {
        console.error('Error creating user from hierarchy:', error)
        return { error: 'Error al intentar crear la cuenta de usuario.' }
    }
}

export async function getRegisteredEmails() {
    try {
        const users = await prisma.user.findMany({ select: { email: true } })
        return users.map((u: any) => u.email).filter(Boolean) as string[]
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function replaceWorkerInHierarchy(
    exWorkerId: string,
    rolAsignado: 'Jefe Zonal' | 'Jefe de Operación' | 'Supervisor',
    newWorker: { nombre: string; apellido: string; correo: string }
) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    let permissionRequired = ''
    if (rolAsignado === 'Jefe Zonal') permissionRequired = 'manage_zonales'
    else if (rolAsignado === 'Jefe de Operación') permissionRequired = 'manage_jefe_operacion'
    else if (rolAsignado === 'Supervisor') permissionRequired = 'manage_supervisor'

    if (!permissions.includes(permissionRequired)) {
        return { error: 'No tienes permisos para realizar esta sustitución.' }
    }

    const email = newWorker.correo.trim().toLowerCase()
    const nombre = newWorker.nombre.trim()
    const apellido = newWorker.apellido.trim()

    if (!nombre || !apellido || !email) {
        return { error: 'Todos los campos del nuevo trabajador son obligatorios.' }
    }

    try {
        const emailExistsUser = await prisma.user.findUnique({ where: { email } })
        if (emailExistsUser) {
            return { error: `El correo ${email} ya está registrado para otro usuario del sistema.` }
        }

        const emailExistsZonal = await prisma.jefeZonal.findFirst({ where: { correo: email, vigente: true } })
        const emailExistsOp = await prisma.jefeOperacion.findFirst({ where: { correo: email, vigente: true } })
        const emailExistsSuper = await prisma.supervisor.findFirst({ where: { correo: email, vigente: true } })
        if (emailExistsZonal || emailExistsOp || emailExistsSuper) {
            return { error: `El correo ${email} pertenece a otro trabajador activo en la jerarquía.` }
        }

        const roles = await prisma.role.findMany()
        const role = roles.find(r => r.name.toLowerCase().includes(rolAsignado.toLowerCase()))
        if (!role) {
            return { error: `No se encontró el rol "${rolAsignado}" en el sistema.` }
        }

        const areas = await prisma.area.findMany()
        const area = areas.find(a => a.nombre.toLowerCase().includes('operaciones'))
        if (!area) {
            return { error: 'No se encontró el área "OPERACIONES" en el sistema.' }
        }

        const nombreStr = nombre.toLowerCase()
        const apellidoParts = apellido.toLowerCase().split(/\s+/)
        const apellidoPaterno = apellidoParts[0] || ''
        const apellidoMaterno = apellidoParts.length > 1 ? apellidoParts[1] : ''

        let baseUsername = nombreStr.length > 0 ? nombreStr[0] + apellidoPaterno : apellidoPaterno
        let finalUsername = baseUsername
        let existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })

        if (existingUser) {
            if (apellidoMaterno.length > 0) {
                finalUsername = baseUsername + apellidoMaterno[0]
            } else {
                finalUsername = baseUsername + '1'
            }
            existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })
            let counter = 2
            while (existingUser) {
                finalUsername = baseUsername + (apellidoMaterno.length > 0 ? apellidoMaterno[0] : '') + counter
                existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })
                counter++
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            let sucursalNames: string[] = []
            let sucursalIds: string[] = []
            let rbdIds: number[] = []

            if (rolAsignado === 'Jefe Zonal') {
                const exZonal = await tx.jefeZonal.findUnique({
                    where: { id: exWorkerId },
                    include: {
                        licitaciones: true,
                        sucursales: { include: { sucursal: true } },
                        vehiculos: true
                    }
                })
                if (!exZonal) throw new Error('No se encontró el Jefe Zonal a reemplazar.')
                if (!exZonal.vigente) throw new Error('El Jefe Zonal ya no está vigente.')

                await tx.jefeZonal.update({
                    where: { id: exWorkerId },
                    data: { vigente: false }
                })

                const newZonal = await tx.jefeZonal.create({
                    data: {
                        nombre,
                        apellido,
                        correo: email,
                        vigente: true,
                        licitaciones: {
                            create: exZonal.licitaciones.map(l => ({ licitacionId: l.licitacionId }))
                        },
                        sucursales: {
                            create: exZonal.sucursales.map(s => ({ sucursalId: s.sucursalId }))
                        },
                        vehiculos: {
                            create: exZonal.vehiculos.map(v => ({ vehiculoId: v.vehiculoId }))
                        }
                    }
                })

                await tx.jefeOperacion.updateMany({
                    where: { jefeZonalId: exWorkerId },
                    data: { jefeZonalId: newZonal.id }
                })
                await tx.supervisor.updateMany({
                    where: { jefeZonalId: exWorkerId },
                    data: { jefeZonalId: newZonal.id }
                })

                sucursalNames = exZonal.sucursales.map(s => s.sucursal.nombre)
                sucursalIds = exZonal.sucursales.map(s => s.sucursalId)

            } else if (rolAsignado === 'Jefe de Operación') {
                const exOp = await tx.jefeOperacion.findUnique({
                    where: { id: exWorkerId },
                    include: {
                        vehiculos: true,
                        jefeZonal: {
                            include: { sucursales: true }
                        }
                    }
                })
                if (!exOp) throw new Error('No se encontró el Jefe de Operación a reemplazar.')
                if (!exOp.vigente) throw new Error('El Jefe de Operación ya no está vigente.')

                await tx.jefeOperacion.update({
                    where: { id: exWorkerId },
                    data: { vigente: false }
                })

                const newOp = await tx.jefeOperacion.create({
                    data: {
                        nombre,
                        apellido,
                        correo: email,
                        vigente: true,
                        jefeZonalId: exOp.jefeZonalId,
                        vehiculos: {
                            create: exOp.vehiculos.map(v => ({ vehiculoId: v.vehiculoId }))
                        }
                    }
                })

                await tx.supervisor.updateMany({
                    where: { jefeOperacionId: exWorkerId },
                    data: { jefeOperacionId: newOp.id }
                })

                const zonalSucursales = await tx.jefeZonalSucursal.findMany({
                    where: { jefeZonalId: exOp.jefeZonalId },
                    include: { sucursal: true }
                })
                sucursalNames = zonalSucursales.map(s => s.sucursal.nombre)
                sucursalIds = zonalSucursales.map(s => s.sucursalId)

            } else if (rolAsignado === 'Supervisor') {
                const exSup = await tx.supervisor.findUnique({
                    where: { id: exWorkerId },
                    include: {
                        camionetas: true,
                        rbdsAuditar: true,
                        jefeZonal: { include: { sucursales: true } },
                        jefeOperacion: { include: { jefeZonal: { include: { sucursales: true } } } }
                    }
                })
                if (!exSup) throw new Error('No se encontró el Supervisor a reemplazar.')
                if (!exSup.vigente) throw new Error('El Supervisor ya no está vigente.')

                await tx.supervisor.update({
                    where: { id: exWorkerId },
                    data: { vigente: false }
                })

                await tx.supervisor.create({
                    data: {
                        nombre,
                        apellido,
                        correo: email,
                        vigente: true,
                        jefeZonalId: exSup.jefeZonalId,
                        jefeOperacionId: exSup.jefeOperacionId,
                        camionetas: {
                            create: exSup.camionetas.map(v => ({ vehiculoId: v.vehiculoId }))
                        },
                        rbdsAuditar: {
                            create: exSup.rbdsAuditar.map(r => ({ rbd: r.rbd }))
                        }
                    }
                })

                rbdIds = exSup.rbdsAuditar.map(r => r.rbd)
                
                const parentZonal = exSup.jefeOperacion?.jefeZonal || exSup.jefeZonal
                if (parentZonal) {
                    const zonalSucursales = await tx.jefeZonalSucursal.findMany({
                        where: { jefeZonalId: parentZonal.id },
                        include: { sucursal: true }
                    })
                    sucursalNames = zonalSucursales.map(s => s.sucursal.nombre)
                    sucursalIds = zonalSucursales.map(s => s.sucursalId)
                }
            }

            let exUserRecord = null
            if (rolAsignado === 'Jefe Zonal') {
                const z = await tx.jefeZonal.findUnique({ where: { id: exWorkerId } })
                if (z) exUserRecord = await tx.user.findFirst({ where: { email: { equals: z.correo, mode: 'insensitive' } } })
            } else if (rolAsignado === 'Jefe de Operación') {
                const o = await tx.jefeOperacion.findUnique({ where: { id: exWorkerId } })
                if (o) exUserRecord = await tx.user.findFirst({ where: { email: { equals: o.correo, mode: 'insensitive' } } })
            } else if (rolAsignado === 'Supervisor') {
                const s = await tx.supervisor.findUnique({ where: { id: exWorkerId } })
                if (s) exUserRecord = await tx.user.findFirst({ where: { email: { equals: s.correo, mode: 'insensitive' } } })
            }

            let exUsername = ''
            if (exUserRecord) {
                exUsername = exUserRecord.username
                await tx.user.update({
                    where: { id: exUserRecord.id },
                    data: { isActive: false }
                })
            }

            const passwordHash = await bcrypt.hash('Henda.2026$', 10)
            const newUser = await tx.user.create({
                data: {
                    username: finalUsername,
                    name: `${nombre} ${apellido}`,
                    email: email,
                    passwordHash,
                    roleId: role.id,
                    isActive: true,
                    mustChangePassword: true,
                    rbds: rbdIds,
                    areas: {
                        connect: [{ id: area.id }]
                    },
                    sucursales: {
                        connect: sucursalIds.map(id => ({ id }))
                    }
                }
            })

            if (exUsername) {
                const matrices = await tx.matrizT_RespuestasCabecera.findMany({
                    where: { usuario: exUsername }
                })

                for (const m of matrices) {
                    await tx.matrizT_RespuestasCabecera.update({
                        where: { id: m.id },
                        data: {
                            usuario: finalUsername,
                            supervisorNombre: `${nombre} ${apellido}`,
                            supervisorCorreo: email,
                            usuarioOriginal: m.usuarioOriginal || exUsername,
                            supervisorNombreOriginal: m.supervisorNombreOriginal || m.supervisorNombre,
                            supervisorCorreoOriginal: m.supervisorCorreoOriginal || m.supervisorCorreo,
                            fechaReemplazo: new Date()
                        }
                    })
                }
            }

            return { username: finalUsername }
        })

        revalidatePath(PATH)
        revalidatePath('/dashboard/matriz-riesgo/detalle')
        return { success: true, username: result.username }

    } catch (e: any) {
        console.error('Error en replaceWorkerInHierarchy:', e)
        return { error: e.message || 'Error al intentar realizar la sustitución de personal.' }
    }
}
