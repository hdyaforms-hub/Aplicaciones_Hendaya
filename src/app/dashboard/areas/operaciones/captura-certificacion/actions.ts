'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Polyfill para serialización de BigInt en JSON (Prisma/Next.js)
if (typeof BigInt !== 'undefined') {
    (BigInt.prototype as any).toJSON = function () {
        return this.toString()
    }
}

// Obtiene los servicios y programas disponibles para un RBD en un mes/año específicos
export async function getOpcionesCaptura(rbd: number, fecha: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_captura_certificacion') && session?.user?.role?.name !== 'admin') {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const [year, month, day] = fecha.split('-')
        const mes = parseInt(month, 10)
        const anio = parseInt(year, 10)

        const raciones = await prisma.raciones.findMany({
            where: {
                rbd: rbd,
                mes: mes,
                anio: anio
            },
            select: {
                servicio: true,
                programa: true,
                numeroArea: true,
                numeroCocina: true,
                licitacion: true,
                cantidad: true
            },
            distinct: ['servicio', 'programa', 'numeroArea']
        })

        if (raciones.length === 0) {
            return { error: 'No se encontraron raciones asignadas para este RBD en el mes seleccionado.' }
        }

        // Devolver opciones únicas
        const servicios = Array.from(new Set(raciones.map(r => r.servicio)))
        const programas = Array.from(new Set(raciones.map(r => r.programa)))
        
        // Obtener nombres de áreas desde Preparaciones
        const areasRaw = Array.from(new Set(raciones.map(r => r.numeroArea)))
        const areasInfo = await prisma.preparaciones.findMany({
            where: {
                numeroArea: { in: areasRaw }
            },
            select: { numeroArea: true, area: true },
            distinct: ['numeroArea']
        })

        const areas = areasInfo.map(a => ({
            id: a.numeroArea,
            nombre: a.area
        }))

        return { success: true, servicios, programas, areas, racionesData: raciones }
    } catch (error) {
        console.error('Error fetching opciones captura:', error)
        return { error: 'Error al obtener opciones.' }
    }
}

// Obtiene el nombre del colegio
export async function getColegioName(rbd: number) {
    try {
        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: rbd }
        })
        return colegio ? colegio.nombreEstablecimiento : 'Colegio no encontrado'
    } catch (error) {
        return 'Colegio no encontrado'
    }
}

// Busca colegios por RBD o nombre
export async function searchColegios(query: string) {
    if (!query || query.length < 2) return []

    try {
        const isNum = !isNaN(Number(query))
        
        const colegios = await prisma.colegios.findMany({
            where: isNum 
                ? { colRBD: Number(query) }
                : { nombreEstablecimiento: { contains: query, mode: 'insensitive' } },
            take: 10,
            select: { colRBD: true, nombreEstablecimiento: true }
        })
        
        return colegios
    } catch (error) {
        console.error('Error searching colegios:', error)
        return []
    }
}

// Obtiene los productos, gramos y calcula totales
export async function getDetalleCertificacion(rbd: number, fecha: string, servicio: string, programa: string, area: string, racionesPreparar: number) {
    try {
        const [year, month, day] = fecha.split('-')
        const dia = parseInt(day, 10)
        const mes = parseInt(month, 10)
        const anio = parseInt(year, 10)

        // 1. Raciones base
        const racion = await prisma.raciones.findFirst({
            where: {
                rbd: Number(rbd),
                mes: Number(mes),
                anio: Number(anio),
                servicio: String(servicio),
                programa: String(programa),
                numeroArea: String(area)
            }
        })

        if (!racion) return { error: 'No se encontró ración base.' }

        // 2. Minutas
        const minutas = await prisma.minutas.findMany({
            where: {
                licitacion: String(racion.licitacion),
                numeroPrograma: String(racion.numeroPrograma),
                codigoServicio: String(racion.numeroServicio),
                dia: dia, mes: mes, anio: anio,
                numeroCocina: Number(racion.numeroCocina),
                codigoEnlace: Number(racion.numeroEnlace),
                numeroMinuta: { contains: String(racion.numeroLocacion || '').trim() }
            },
            distinct: ['numeroPreparacion']
        })

        if (minutas.length === 0) return { error: 'No hay minutas para este día.' }

        // 3. Preparaciones (Mapeo directo para evitar proxies de Prisma)
        const preparaciones = []
        for (let i = 0; i < minutas.length; i++) {
            const m = minutas[i];
            const currentMinuta = String(m.numeroMinuta);
            const currentPrepId = Number(m.numeroPreparacion);
            
            const prods = await prisma.preparaciones.findMany({
                where: {
                    licitacion: String(racion.licitacion),
                    numeroPreparacion: currentPrepId,
                    numeroArea: String(area)
                }
            })
            
            for (let j = 0; j < prods.length; j++) {
                const p = prods[j];
                const grs = parseFloat(p.cantPreparacion.toString()) || 0;
                preparaciones.push({
                    numeroMinuta: currentMinuta,
                    nombrePreparacion: String(p.nombrePreparacion),
                    nombreProducto: String(p.nombreProducto || '').trim(),
                    grsRac: Number(grs),
                    grsTotal: Number(grs * racionesPreparar)
                })
            }
        }

        if (preparaciones.length === 0) return { error: 'No hay productos en la preparación.' }

        return { success: true, detalle: preparaciones }
    } catch (error: any) {
        console.error('Error calculo:', error.message)
        return { error: 'Error interno al calcular.' }
    }
}

export async function saveCapturaCertificacion(headerData: any, detailData: any[], adminOverrideReason?: string) {
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'
    if (!session?.user?.role?.permissions.includes('view_captura_certificacion') && !isAdmin) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        // Buscar si ya existe un registro para los mismos filtros
        const existing = await prisma.capCertificacionHeader.findFirst({
            where: {
                rbd: Number(headerData.rbd),
                fecha: new Date(headerData.fecha),
                servicio: String(headerData.servicio),
                programa: String(headerData.programa),
                area: String(headerData.area)
            }
        })

        if (existing) {
            if (!isAdmin) {
                return { error: 'El cálculo ya se realizó para este día. Si cometió un error debe informar a su supervisor.' }
            }

            // Eliminar el registro anterior (cascada sobre los detalles)
            await prisma.capCertificacionHeader.delete({
                where: { id: existing.id }
            })
        }

        await prisma.capCertificacionHeader.create({
            data: {
                rbd: Number(headerData.rbd),
                fecha: new Date(headerData.fecha),
                servicio: String(headerData.servicio),
                programa: String(headerData.programa),
                area: String(headerData.area),
                racionesBase: Number(headerData.racionesBase || 0),
                racionesDigitadas: Number(headerData.racionesDigitadas || 0),
                racionesPreparar: Number(headerData.racionesDigitadas || 0),
                usuario: session.user.username,
                motivoCambioAdmin: isAdmin && existing ? adminOverrideReason : null,
                detalles: {
                    create: detailData.map(d => ({
                        numeroMinuta: String(d.numeroMinuta),
                        nombrePreparacion: String(d.nombrePreparacion),
                        nombreProducto: String(d.nombreProducto),
                        grsRac: Number(d.grsRac),
                        grsTotal: Number(d.grsTotal)
                    }))
                }
            }
        })
        return { success: true }
    } catch (error) {
        console.error('Error saving captura certificación:', error)
        return { error: 'No se pudo guardar la información.' }
    }
}

// Verifica si ya existe un registro para los parámetros dados
export async function checkIfAlreadyCaptured(rbd: number, fecha: string, servicio: string, programa: string, area: string) {
    try {
        const header = await prisma.capCertificacionHeader.findFirst({
            where: {
                rbd: Number(rbd),
                fecha: new Date(fecha),
                servicio: String(servicio),
                programa: String(programa),
                area: String(area)
            },
            include: {
                detalles: true
            }
        })

        if (header) {
            return {
                exists: true,
                header: {
                    racionesBase: header.racionesBase,
                    racionesDigitadas: header.racionesDigitadas,
                    usuario: header.usuario,
                    createdAt: header.createdAt
                },
                detalle: header.detalles.map(d => ({
                    numeroMinuta: d.numeroMinuta,
                    nombrePreparacion: d.nombrePreparacion,
                    nombreProducto: d.nombreProducto,
                    grsRac: Number(d.grsRac),
                    grsTotal: Number(d.grsTotal)
                }))
            }
        }

        return { exists: false }
    } catch (error) {
        console.error('Error checking if already captured:', error)
        return { exists: false, error: 'Error al verificar registro existente.' }
    }
}
