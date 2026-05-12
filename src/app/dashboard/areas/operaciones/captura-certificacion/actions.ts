'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

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

        // 1. Obtener la Licitacion, numPrograma y numCocina desde Raciones
        const racion = await prisma.raciones.findFirst({
            where: {
                rbd: rbd,
                mes: mes,
                anio: anio,
                servicio: servicio,
                programa: programa,
                numeroArea: area
            }
        })

        if (!racion) {
            return { error: 'No se encontró información de la ración base para estos filtros.' }
        }

        // 2. Buscar las minutas correspondientes
        const minutas = await prisma.minutas.findMany({
            where: {
                licitacion: racion.licitacion,
                numeroPrograma: racion.numeroPrograma,
                codigoServicio: racion.numeroServicio,
                dia: dia,
                mes: mes,
                anio: anio,
                numeroCocina: racion.numeroCocina,
                codigoEnlace: racion.numeroEnlace,
                numeroMinuta: { contains: racion.numeroLocacion.trim() }
            },
            distinct: ['numeroPreparacion']
        })

        if (minutas.length === 0) {
            return { error: 'No se encontraron minutas para el día, servicio y programa seleccionados.' }
        }

        const preparacionIds = Array.from(new Set(minutas.map(m => m.numeroPreparacion)))

        // 3. Buscar los productos y gramajes en Preparaciones
        const preparaciones = []
        for (const minuta of minutas) {
             const productos = await prisma.preparaciones.findMany({
                 where: {
                     licitacion: racion.licitacion,
                     numeroPreparacion: Number(minuta.numeroPreparacion),
                     numeroArea: area
                 }
             })
             
             for (const prod of productos) {
                 preparaciones.push({
                     numeroMinuta: minuta.numeroMinuta,
                     nombrePreparacion: prod.nombrePreparacion,
                     nombreProducto: prod.nombreProducto.trim(),
                     grsRac: Number(prod.cantPreparacion),
                     grsTotal: Number(prod.cantPreparacion) * racionesPreparar
                 })
             }
        }

        if (preparaciones.length === 0) {
            return { error: 'No se encontraron productos en la preparación de la minuta seleccionada.' }
        }

        return { success: true, detalle: preparaciones }
    } catch (error) {
        console.error('Error fetching detalle certificación:', error)
        return { error: 'Ocurrió un error al calcular los insumos.' }
    }
}

export async function saveCapturaCertificacion(headerData: any, detailData: any[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_captura_certificacion') && session?.user?.role?.name !== 'admin') {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.capCertificacionHeader.create({
            data: {
                rbd: headerData.rbd,
                fecha: new Date(headerData.fecha),
                servicio: headerData.servicio,
                programa: headerData.programa,
                area: headerData.area,
                racionesPreparar: headerData.racionesPreparar,
                usuario: session.user.username,
                detalles: {
                    create: detailData.map(d => ({
                        numeroMinuta: d.numeroMinuta,
                        nombrePreparacion: d.nombrePreparacion,
                        nombreProducto: d.nombreProducto,
                        grsRac: d.grsRac,
                        grsTotal: d.grsTotal
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
