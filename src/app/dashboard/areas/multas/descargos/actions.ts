'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

async function checkPermission() {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado')
    }
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const hasPerm = session.user.role?.permissions.includes('manage_descargos')
    if (!isAdmin && !hasPerm) {
        throw new Error('Permisos insuficientes para gestionar descargos')
    }
    return session
}

async function logAudit(action: string, detalle: string) {
    try {
        const session = await getSession()
        if (!session?.user) return
        await prisma.auditLog.create({
            data: {
                username: session.user.username,
                userId: session.user.id,
                action,
                modulo: 'Áreas -> Multas',
                detalle
            }
        })
    } catch (e) {
        console.error('Error al registrar auditoría:', e)
    }
}

export async function getDescargosFilters() {
    await checkPermission()

    const sucursalesDb = await prisma.colegiosMatriz.findMany({
        select: { sucursal: true },
        distinct: ['sucursal'],
        where: { sucursal: { not: '' } },
        orderBy: { sucursal: 'asc' }
    })
    const sucursales = sucursalesDb.map(s => s.sucursal).filter(Boolean) as string[]

    const cabs = await prisma.elementosEsenciales_Cab.findMany({
        where: { anulado: { not: true } },
        select: { licitacion: true, fechaSupervision: true }
    })

    const licitaciones = Array.from(new Set(cabs.map(c => c.licitacion).filter(Boolean))) as string[]
    const anos = Array.from(new Set(cabs.map(c => c.fechaSupervision ? new Date(c.fechaSupervision).getFullYear() : null).filter(Boolean))) as number[]

    return {
        sucursales: sucursales.sort(),
        licitaciones: licitaciones.sort(),
        anos: anos.sort((a, b) => b - a)
    }
}

export async function searchColegiosDescargos(query: string, sucursal?: string) {
    await checkPermission()
    if (!query || query.trim().length < 1) return []

    const q = query.trim().toLowerCase()
    const num = parseInt(q)
    const isNumber = !isNaN(num)

    const whereClause: any = {}
    if (sucursal) {
        whereClause.sucursal = { equals: sucursal, mode: 'insensitive' }
    }

    if (isNumber) {
        whereClause.OR = [
            { colRBD: num },
            { nombreEstablecimiento: { contains: q, mode: 'insensitive' } }
        ]
    } else {
        whereClause.nombreEstablecimiento = { contains: q, mode: 'insensitive' }
    }

    const colegios = await prisma.colegiosMatriz.findMany({
        where: whereClause,
        select: {
            colRBD: true,
            nombreEstablecimiento: true,
            sucursal: true
        },
        take: 20,
        orderBy: { nombreEstablecimiento: 'asc' }
    })

    return colegios
}

export async function getDescargosList(params: {
    sucursal?: string
    rbdSearch?: string
    licitacion?: string
    ano?: string
    mes?: string
    folio?: string
    resolucion?: string
    criterioAspecto?: string
    estado?: string
}) {
    await checkPermission()

    const whereCab: any = { anulado: { not: true } }

    if (params.licitacion) whereCab.licitacion = params.licitacion
    if (params.folio) whereCab.folio = { contains: params.folio, mode: 'insensitive' }

    if (params.ano) {
        const y = parseInt(params.ano)
        if (params.mes) {
            const m = parseInt(params.mes)
            whereCab.fechaSupervision = {
                gte: new Date(Date.UTC(y, m - 1, 1)),
                lt: new Date(Date.UTC(y, m, 1))
            }
        } else {
            whereCab.fechaSupervision = {
                gte: new Date(Date.UTC(y, 0, 1)),
                lt: new Date(Date.UTC(y + 1, 0, 1))
            }
        }
    }

    const cabs = await prisma.elementosEsenciales_Cab.findMany({
        where: whereCab,
        select: {
            folio: true,
            licitacion: true,
            rbd: true,
            fechaSupervision: true,
            detalles: {
                select: { id: true, nc: true, aspecto: true, observacionesOMedioDeVerificacion: true }
            }
        },
        orderBy: { fechaSupervision: 'desc' }
    })

    // Filter to only folios that actually have NCs (hallazgos)
    const cabsWithNC = cabs.filter(c => c.folio && c.detalles.some(d => Boolean(d.nc)))
    const foliosList = cabsWithNC.map(c => c.folio!).filter(Boolean)

    // Fetch master aspect descriptions
    const aspectosEEList = await prisma.aspectoEE.findMany({
        select: { letra: true, descripcion: true }
    })
    const aspectMasterMap = new Map<string, string>()
    aspectosEEList.forEach(a => {
        if (a.letra && a.descripcion) aspectMasterMap.set(a.letra.trim().toLowerCase(), a.descripcion)
    })

    // Fetch existing Descargos_Cab records with details
    const descargosCabs = await prisma.descargos_Cab.findMany({
        where: { folio: { in: foliosList } },
        select: {
            folio: true,
            resolucion: true,
            estado: true,
            updatedAt: true,
            detalles: true
        }
    })
    const descargoMap = new Map<string, { resolucion: number; estado: string; detalles: any[] }>()
    descargosCabs.forEach(d => {
        descargoMap.set(d.folio, {
            resolucion: d.resolucion,
            estado: d.estado,
            detalles: d.detalles
        })
    })

    // Fetch calculated multas for these folios
    const multasCabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
        where: { folioOriginal: { in: foliosList } },
        select: {
            folioOriginal: true,
            montoTotalCalculado: true,
            detalles: {
                select: {
                    letraAspecto: true,
                    montoMulta: true
                }
            }
        }
    })

    const multasMap = new Map<string, { montoTotalCalculado: number; detallesMap: Map<string, number> }>()
    multasCabs.forEach(m => {
        const detMap = new Map<string, number>()
        m.detalles.forEach(d => {
            if (d.letraAspecto) {
                let cleanLetra = d.letraAspecto.trim()
                if (cleanLetra.toUpperCase().startsWith('ASPECTO')) {
                    cleanLetra = cleanLetra.replace(/^aspecto\s+/i, '').trim()
                }
                detMap.set(cleanLetra.toLowerCase(), d.montoMulta || 0)
            }
        })
        multasMap.set(m.folioOriginal, {
            montoTotalCalculado: m.montoTotalCalculado || 0,
            detallesMap: detMap
        })
    })

    // Fetch ColegiosMatriz for RBD -> NombreEstablecimiento & Sucursal
    const rbdsList = Array.from(new Set(cabsWithNC.map(c => c.rbd).filter((r): r is number => Boolean(r))))
    const colegios = await prisma.colegiosMatriz.findMany({
        where: { colRBD: { in: rbdsList } },
        select: { colRBD: true, nombreEstablecimiento: true, sucursal: true }
    })
    const colegioMap = new Map<number, { nombre: string; sucursal: string }>()
    colegios.forEach(col => {
        colegioMap.set(col.colRBD, { nombre: col.nombreEstablecimiento, sucursal: col.sucursal || '' })
    })

    let items = cabsWithNC.map(c => {
        const col = c.rbd ? colegioMap.get(c.rbd) : null
        const descargo = c.folio ? descargoMap.get(c.folio) : null
        const ncDetallesOrig = c.detalles.filter(d => Boolean(d.nc))
        const multaInfo = c.folio ? multasMap.get(c.folio) : null

        const descDetMap = new Map<string, any>()
        if (descargo?.detalles) {
            descargo.detalles.forEach(d => {
                descDetMap.set(d.letraAspecto.trim().toLowerCase(), d)
            })
        }

        const aspectosFormatted = ncDetallesOrig.map(d => {
            const rawAspecto = (d.aspecto || '').trim()
            let letra = rawAspecto.match(/^([A-Za-z0-9]+)/)?.[1] || rawAspecto
            if (letra.toUpperCase().startsWith('ASPECTO')) {
                letra = letra.replace(/^aspecto\s+/i, '').trim()
            }
            const masterDesc = aspectMasterMap.get(letra.toLowerCase()) || rawAspecto
            const existingDet = descDetMap.get(letra.toLowerCase()) || descDetMap.get(rawAspecto.toLowerCase())
            const montoAspecto = multaInfo?.detallesMap.get(letra.toLowerCase()) ?? multaInfo?.detallesMap.get(rawAspecto.toLowerCase()) ?? 0

            return {
                letraAspecto: letra,
                aspectoTexto: rawAspecto,
                descripcionMaster: masterDesc,
                observacionOriginalNC: d.observacionesOMedioDeVerificacion || '',
                estadoAspecto: existingDet?.estadoAspecto || 'Sin antecedente',
                fechaNoSolucionado: existingDet?.fechaNoSolucionado ? new Date(existingDet.fechaNoSolucionado).toISOString().split('T')[0] : '',
                observacionNoSolucionado: existingDet?.observacionNoSolucionado || '',
                montoAspecto
            }
        })

        const totalMontoAspectos = aspectosFormatted.reduce((acc, curr) => acc + (curr.montoAspecto || 0), 0)
        const montoTotalFolio = multaInfo?.montoTotalCalculado ?? totalMontoAspectos

        const isAllEvaluated = aspectosFormatted.length > 0 && aspectosFormatted.every(a => a.estadoAspecto === 'Solucionado' || a.estadoAspecto === 'No Solucionado')
        const finalEstado = isAllEvaluated ? 'Cerrado' : (descargo ? descargo.estado : 'Abierto')

        return {
            folio: c.folio || '',
            licitacion: c.licitacion || '',
            rbd: c.rbd || 0,
            establecimiento: col?.nombre || 'Establecimiento Desconocido',
            sucursal: col?.sucursal || '',
            fechaSupervision: c.fechaSupervision ? new Date(c.fechaSupervision).toISOString() : '',
            resolucion: descargo ? descargo.resolucion : 0,
            estado: finalEstado,
            aspectosDetalles: aspectosFormatted,
            montoTotalFolio
        }
    })

    // Apply client-requested filtering: sucursal, rbdSearch, resolucion, criterioAspecto, estado
    if (params.sucursal) {
        items = items.filter(i => i.sucursal.toLowerCase() === params.sucursal!.toLowerCase())
    }

    if (params.rbdSearch) {
        const s = params.rbdSearch.toLowerCase().trim()
        items = items.filter(i => 
            i.rbd.toString().includes(s) || 
            i.establecimiento.toLowerCase().includes(s)
        )
    }

    if (params.resolucion) {
        const rStr = params.resolucion.trim()
        items = items.filter(i => i.resolucion.toString().includes(rStr))
    }

    if (params.criterioAspecto && params.criterioAspecto !== 'Todos') {
        const crit = params.criterioAspecto
        if (crit === 'No Solucionado') {
            items = items.filter(i => i.aspectosDetalles.some(a => a.estadoAspecto === 'No Solucionado'))
        } else if (crit === 'Solucionado') {
            items = items.filter(i => i.aspectosDetalles.some(a => a.estadoAspecto === 'Solucionado'))
        } else if (crit === 'Sin antecedente') {
            items = items.filter(i => i.aspectosDetalles.some(a => a.estadoAspecto === 'Sin antecedente'))
        }
    }

    if (params.estado && params.estado !== 'Todos') {
        items = items.filter(i => i.estado.toLowerCase() === params.estado!.toLowerCase())
    }

    return items
}

export async function getDetalleDescargoFolio(folio: string) {
    await checkPermission()

    const cabOrig = await prisma.elementosEsenciales_Cab.findFirst({
        where: { folio, anulado: { not: true } },
        include: { detalles: true }
    })

    if (!cabOrig) {
        throw new Error('Folio de supervisión no encontrado')
    }

    // Get school info
    let establecimiento = 'Establecimiento Desconocido'
    let sucursal = ''
    if (cabOrig.rbd) {
        const col = await prisma.colegiosMatriz.findUnique({
            where: { colRBD: cabOrig.rbd },
            select: { nombreEstablecimiento: true, sucursal: true }
        })
        if (col) {
            establecimiento = col.nombreEstablecimiento
            sucursal = col.sucursal || ''
        }
    }

    // Upsert Descargos_Cab
    let descargoCab = await prisma.descargos_Cab.findUnique({
        where: { folio },
        include: { detalles: true }
    })

    if (!descargoCab) {
        descargoCab = await prisma.descargos_Cab.create({
            data: {
                folio,
                licitacion: cabOrig.licitacion,
                rbd: cabOrig.rbd || 0,
                fechaSupervision: cabOrig.fechaSupervision,
                resolucion: 0,
                estado: 'Abierto'
            },
            include: { detalles: true }
        })
    }

    // Filter NC aspect details from supervision
    const ncDetalles = cabOrig.detalles.filter(d => Boolean(d.nc))

    // Fetch master aspect descriptions
    const aspectosList = await prisma.aspectoEE.findMany({
        select: { letra: true, descripcion: true }
    })
    const aspectDescMap = new Map<string, string>()
    aspectosList.forEach(a => {
        if (a.letra && a.descripcion) {
            aspectDescMap.set(a.letra.trim().toLowerCase(), a.descripcion)
        }
    })

    const descDetMap = new Map<string, any>()
    descargoCab.detalles.forEach(d => {
        descDetMap.set(d.letraAspecto.trim().toLowerCase(), d)
    })

    // Fetch calculated multas for this folio
    const multaCab = await prisma.multas_Elementos_Esenciales_Cab.findUnique({
        where: { folioOriginal: folio },
        select: {
            montoTotalCalculado: true,
            detalles: {
                select: {
                    letraAspecto: true,
                    montoMulta: true
                }
            }
        }
    })

    const multasDetMap = new Map<string, number>()
    if (multaCab) {
        multaCab.detalles.forEach(d => {
            if (d.letraAspecto) {
                let cleanLetra = d.letraAspecto.trim()
                if (cleanLetra.toUpperCase().startsWith('ASPECTO')) {
                    cleanLetra = cleanLetra.replace(/^aspecto\s+/i, '').trim()
                }
                multasDetMap.set(cleanLetra.toLowerCase(), d.montoMulta || 0)
            }
        })
    }

    const aspectosFormatted = ncDetalles.map(d => {
        const rawAspecto = (d.aspecto || '').trim()
        let letra = rawAspecto.match(/^([A-Za-z0-9]+)/)?.[1] || rawAspecto
        if (letra.toUpperCase().startsWith('ASPECTO')) {
            letra = letra.replace(/^aspecto\s+/i, '').trim()
        }

        const masterDesc = aspectDescMap.get(letra.toLowerCase()) || rawAspecto
        const existingDet = descDetMap.get(letra.toLowerCase()) || descDetMap.get(rawAspecto.toLowerCase())
        const montoAspecto = multasDetMap.get(letra.toLowerCase()) ?? multasDetMap.get(rawAspecto.toLowerCase()) ?? 0

        return {
            id: existingDet?.id || null,
            letraAspecto: letra,
            aspectoTexto: rawAspecto,
            descripcionMaster: masterDesc,
            observacionOriginalNC: d.observacionesOMedioDeVerificacion || '',
            estadoAspecto: existingDet?.estadoAspecto || 'Sin antecedente',
            fechaNoSolucionado: existingDet?.fechaNoSolucionado ? new Date(existingDet.fechaNoSolucionado).toISOString().split('T')[0] : '',
            observacionNoSolucionado: existingDet?.observacionNoSolucionado || '',
            montoAspecto
        }
    })

    const totalMontoAspectos = aspectosFormatted.reduce((acc, curr) => acc + (curr.montoAspecto || 0), 0)
    const montoTotalFolio = multaCab?.montoTotalCalculado ?? totalMontoAspectos

    const isAllEvaluated = aspectosFormatted.length > 0 && aspectosFormatted.every(a => a.estadoAspecto === 'Solucionado' || a.estadoAspecto === 'No Solucionado')
    const finalEstado = isAllEvaluated ? 'Cerrado' : descargoCab.estado

    return {
        folio: descargoCab.folio,
        licitacion: descargoCab.licitacion || cabOrig.licitacion || '',
        rbd: descargoCab.rbd || cabOrig.rbd || 0,
        establecimiento,
        sucursal,
        fechaSupervision: descargoCab.fechaSupervision ? new Date(descargoCab.fechaSupervision).toISOString() : '',
        resolucion: descargoCab.resolucion,
        estado: finalEstado,
        aspectos: aspectosFormatted,
        montoTotalFolio
    }
}

export async function guardarAspectoDescargo(params: {
    folio: string
    letraAspecto: string
    descripcion?: string
    estadoAspecto: 'Sin antecedente' | 'Solucionado' | 'No Solucionado'
    fechaNoSolucionado?: string
    observacionNoSolucionado?: string
    resolucion?: number
}) {
    const session = await checkPermission()

    // Ensure Descargos_Cab exists
    let descargoCab = await prisma.descargos_Cab.findUnique({
        where: { folio: params.folio }
    })

    if (!descargoCab) {
        const orig = await prisma.elementosEsenciales_Cab.findFirst({
            where: { folio: params.folio }
        })
        descargoCab = await prisma.descargos_Cab.create({
            data: {
                folio: params.folio,
                licitacion: orig?.licitacion,
                rbd: orig?.rbd || 0,
                fechaSupervision: orig?.fechaSupervision,
                resolucion: params.resolucion !== undefined ? params.resolucion : 0,
                estado: 'Abierto',
                usuarioModif: session.user.username
            }
        })
    } else if (params.resolucion !== undefined) {
        descargoCab = await prisma.descargos_Cab.update({
            where: { folio: params.folio },
            data: {
                resolucion: params.resolucion,
                usuarioModif: session.user.username
            }
        })
    }

    // Upsert Descargos_Det for this aspect
    const existingDet = await prisma.descargos_Det.findFirst({
        where: {
            cabId: descargoCab.id,
            letraAspecto: { equals: params.letraAspecto, mode: 'insensitive' }
        }
    })

    const dateVal = params.fechaNoSolucionado ? new Date(params.fechaNoSolucionado) : (params.estadoAspecto === 'No Solucionado' ? new Date() : null)

    if (existingDet) {
        await prisma.descargos_Det.update({
            where: { id: existingDet.id },
            data: {
                estadoAspecto: params.estadoAspecto,
                fechaNoSolucionado: params.estadoAspecto === 'No Solucionado' ? dateVal : null,
                observacionNoSolucionado: params.estadoAspecto === 'No Solucionado' ? (params.observacionNoSolucionado || '') : null
            }
        })
    } else {
        await prisma.descargos_Det.create({
            data: {
                cabId: descargoCab.id,
                letraAspecto: params.letraAspecto,
                descripcion: params.descripcion || '',
                estadoAspecto: params.estadoAspecto,
                fechaNoSolucionado: params.estadoAspecto === 'No Solucionado' ? dateVal : null,
                observacionNoSolucionado: params.estadoAspecto === 'No Solucionado' ? (params.observacionNoSolucionado || '') : null
            }
        })
    }

    // AUTO-CALCULATE FOLIO ESTADO:
    // Fetch all NC aspects for this supervision folio
    const cabOrig = await prisma.elementosEsenciales_Cab.findFirst({
        where: { folio: params.folio },
        include: { detalles: true }
    })
    const ncDetallesOrig = cabOrig?.detalles.filter(d => Boolean(d.nc) && (typeof d.nc === 'string' ? d.nc.trim() !== '' : true)) || []
    const totalNcAspectsCount = ncDetallesOrig.length

    const currentDetalles = await prisma.descargos_Det.findMany({
        where: { cabId: descargoCab.id }
    })

    const solvedOrNotSolvedCount = currentDetalles.filter(d => 
        d.estadoAspecto === 'Solucionado' || d.estadoAspecto === 'No Solucionado'
    ).length

    // If all NC aspects of the folio are Solucionado or No Solucionado (and >= total NC aspects), state is Cerrado
    const isCompleted = totalNcAspectsCount > 0 && solvedOrNotSolvedCount >= totalNcAspectsCount && !currentDetalles.some(d => d.estadoAspecto === 'Sin antecedente')
    const nuevoEstado = isCompleted ? 'Cerrado' : 'Abierto'

    await prisma.descargos_Cab.update({
        where: { id: descargoCab.id },
        data: {
            estado: nuevoEstado,
            usuarioModif: session.user.username
        }
    })

    await logAudit('GESTION_DESCARGO', `Actualizó aspecto ${params.letraAspecto} a "${params.estadoAspecto}" en Folio #${params.folio}. Estado Folio: ${nuevoEstado}`)

    revalidatePath('/dashboard/areas/multas/descargos')

    return { success: true, estadoFolio: nuevoEstado }
}

async function validateFolioReadyForResolucion(folio: string): Promise<{ valid: boolean; error?: string }> {
    const cabOrig = await prisma.elementosEsenciales_Cab.findFirst({
        where: { folio },
        include: { detalles: true }
    })

    if (!cabOrig) {
        return { valid: false, error: `Folio #${folio} no encontrado.` }
    }

    // Filter only actual NC details (where nc is truthy and not empty)
    const ncDetallesOrig = cabOrig.detalles.filter(d => Boolean(d.nc) && (typeof d.nc === 'string' ? d.nc.trim() !== '' : true))
    const totalNcCount = ncDetallesOrig.length

    const descargoCab = await prisma.descargos_Cab.findUnique({
        where: { folio },
        include: { detalles: true }
    })

    if (descargoCab?.resolucion && descargoCab.resolucion > 0) {
        return {
            valid: false,
            error: `El Folio #${folio} ya tiene asignada la Resolución #${descargoCab.resolucion}. Para asociarlo a una nueva resolución, primero debe desasociar la resolución actual.`
        }
    }

    if (!descargoCab || !descargoCab.detalles || descargoCab.detalles.length === 0) {
        return { 
            valid: false, 
            error: `El Folio #${folio} aún tiene aspectos con "Sin antecedente". Todos los aspectos (${totalNcCount}) deben estar "Solucionado" o "No Solucionado" para poder asignar resolución.` 
        }
    }

    const solvedOrNotSolvedCount = descargoCab.detalles.filter(d => 
        d.estadoAspecto === 'Solucionado' || d.estadoAspecto === 'No Solucionado'
    ).length

    const hasSinAntecedente = descargoCab.detalles.some(d => d.estadoAspecto === 'Sin antecedente')

    if (totalNcCount === 0 || solvedOrNotSolvedCount < totalNcCount || hasSinAntecedente) {
        return {
            valid: false,
            error: `El Folio #${folio} no tiene todos sus aspectos evaluados (${solvedOrNotSolvedCount} de ${totalNcCount} evaluados). Todos sus aspectos deben estar "Solucionado" o "No Solucionado" para asignar resolución.`
        }
    }

    return { valid: true }
}

export async function updateResolucionFolio(folio: string, resolucion: number) {
    const session = await checkPermission()

    const check = await validateFolioReadyForResolucion(folio)
    if (!check.valid) {
        return { error: check.error }
    }

    const descargo = await prisma.descargos_Cab.upsert({
        where: { folio },
        update: { resolucion, usuarioModif: session.user.username },
        create: {
            folio,
            resolucion,
            estado: 'Cerrado',
            rbd: 0,
            usuarioModif: session.user.username
        }
    })

    await logAudit('ACTUALIZAR_RESOLUCION', `Actualizó resolución a ${resolucion} en Folio #${folio}`)

    revalidatePath('/dashboard/areas/multas/descargos')
    return { success: true, resolucion: descargo.resolucion }
}

export async function updateResolucionMasiva(folios: string[], resolucion: number) {
    const session = await checkPermission()
    if (!folios || folios.length === 0) return { error: 'No se seleccionaron folios' }

    // Validate all folios before modifying any
    for (const folio of folios) {
        const check = await validateFolioReadyForResolucion(folio)
        if (!check.valid) {
            return { error: check.error }
        }
    }

    for (const folio of folios) {
        const orig = await prisma.elementosEsenciales_Cab.findFirst({
            where: { folio }
        })

        await prisma.descargos_Cab.upsert({
            where: { folio },
            update: { resolucion, usuarioModif: session.user.username },
            create: {
                folio,
                licitacion: orig?.licitacion,
                rbd: orig?.rbd || 0,
                fechaSupervision: orig?.fechaSupervision,
                resolucion,
                estado: 'Cerrado',
                usuarioModif: session.user.username
            }
        })
    }

    await logAudit('ACTUALIZAR_RESOLUCION_MASIVA', `Asignó número de resolución "${resolucion}" masivamente a ${folios.length} folio(s)`)

    revalidatePath('/dashboard/areas/multas/descargos')
    return { success: true }
}

export async function eliminarResolucionFolio(folio: string) {
    const session = await checkPermission()
    await prisma.descargos_Cab.updateMany({
        where: { folio },
        data: { resolucion: 0, usuarioModif: session.user.username }
    })
    await logAudit('ELIMINAR_RESOLUCION', `Desasoció/Eliminó resolución del Folio #${folio}`)
    revalidatePath('/dashboard/areas/multas/descargos')
    return { success: true }
}

export async function eliminarResolucionMasiva(folios: string[]) {
    const session = await checkPermission()
    if (!folios || folios.length === 0) return { error: 'No se seleccionaron folios' }

    await prisma.descargos_Cab.updateMany({
        where: { folio: { in: folios } },
        data: { resolucion: 0, usuarioModif: session.user.username }
    })
    await logAudit('ELIMINAR_RESOLUCION_MASIVA', `Desasoció/Eliminó resolución masivamente a ${folios.length} folio(s)`)
    revalidatePath('/dashboard/areas/multas/descargos')
    return { success: true }
}
