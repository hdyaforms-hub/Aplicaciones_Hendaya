'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureResolucionSanitariaTable } from '@/lib/calidad/resolucion-sanitaria'

export type TableroFiltros = {
    sucursal?: string
    institucion?: string
    licitacion?: string
    ut?: number
    search?: string
    comportamiento?: string // 'ALL' | 'ALERTA' | 'MEJORA' | 'SOSTENIDO' | 'SIN_RESOLUCION' | 'NO_APLICA'
    anioRef?: number
}

export type RbdYearStatus = {
    anio: number
    estadoResolucion: string
    numeroResolucion: string | null
    fechaResolucion: Date | string | null
    documentoUrl: string | null
    documentoNombre: string | null
    documentoSubidoPor: string | null
    observaciones: string | null
    updatedBy: string | null
}

export type RbdMatrizItem = {
    rbd: number
    rbdDv: string | null
    nombreEstablecimiento: string
    comuna: string
    sucursal: string | null
    institucion: string
    ut: number
    licitacion: string | null
    comportamiento: 'MEJORA' | 'ALERTA' | 'SOSTENIDO' | 'SIN_RESOLUCION' | 'NO_APLICA' | 'VARIABLE'
    aniosData: Record<number, RbdYearStatus>
    ultimoEstado: string
    ultimoNumero: string | null
    ultimaFecha: Date | string | null
    ultimoDocUrl: string | null
    ultimoDocNombre: string | null
    ultimoDocSubidoPor: string | null
}

export type YearEvolution = {
    anio: number
    total: number
    conResolucion: number
    sinResolucion: number
    noAplica: number
    porcentajeCumplimiento: number
    conDocumento: number
    sinDocumento: number
    porcentajeDocumental: number
}

export type SucursalBreakdown = {
    sucursal: string
    total: number
    conResolucion: number
    sinResolucion: number
    noAplica: number
    porcentajeCumplimiento: number
    conDocumento: number
}

export type EstablecimientoAutocompleteItem = {
    rbd: number
    nombreEstablecimiento: string
    comuna: string
    sucursal: string | null
    institucion: string
}

export type InstitucionBreakdown = {
    institucion: string
    total: number
    conResolucion: number
    sinResolucion: number
    porcentajeCumplimiento: number
}

/**
 * Consulta y consolida las métricas multianuales y comportamiento histórico de RBDs
 * para el Tablero de Resolución Sanitaria.
 */
export async function getTableroResolucionSanitariaData(filtros?: TableroFiltros) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    const hasAccess = isAdmin || 
        hasCalidadArea || 
        permissions.includes('view_tablero_resolucion_sanitaria') || 
        permissions.includes('view_tablero') ||
        permissions.includes('view_calidad_resolucion_sanitaria')

    if (!hasAccess) {
        throw new Error('Acceso denegado: Se requiere permiso para ver el Tablero de Resolución Sanitaria')
    }

    await ensureResolucionSanitariaTable()

    // Manejo de seguridad por sucursales asignadas
    let userSucursales: string[] = []
    let isFilteredBySucursal = false
    let allowedRbds: number[] = []

    if (!isAdmin) {
        isFilteredBySucursal = true
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        userSucursales = Array.from(new Set([
            ...(session.user.sucursales || []),
            ...(dbUser?.sucursales?.map(s => s.nombre.trim()) || [])
        ])).filter(Boolean)

        if (userSucursales.length > 0) {
            const colegiosEnSucursal = await prisma.colegios.findMany({
                where: {
                    sucursal: {
                        in: userSucursales,
                        mode: 'insensitive'
                    }
                },
                select: { colRBD: true }
            })
            allowedRbds = colegiosEnSucursal
                .map(c => c.colRBD)
                .filter(rbd => ![31, 32, 1101].includes(rbd))
        }
    }

    // Armar condiciones WHERE base
    const andConditions: any[] = [
        { rbd: { notIn: [31, 32, 1101] } },
        { NOT: { nombreEstablecimiento: { contains: 'sucursal', mode: 'insensitive' } } }
    ]

    if (isFilteredBySucursal) {
        if (userSucursales.length === 0 || allowedRbds.length === 0) {
            andConditions.push({ rbd: -999999 })
        } else {
            andConditions.push({ rbd: { in: allowedRbds } })
        }
    }

    if (filtros?.sucursal && filtros.sucursal !== 'ALL') {
        andConditions.push({ sucursal: { equals: filtros.sucursal, mode: 'insensitive' } })
    }

    if (filtros?.institucion && filtros.institucion !== 'ALL') {
        andConditions.push({ institucion: filtros.institucion })
    }

    if (filtros?.licitacion && filtros.licitacion !== 'ALL') {
        andConditions.push({ licitacion: filtros.licitacion })
    }

    if (filtros?.ut && !isNaN(Number(filtros.ut))) {
        andConditions.push({ ut: Number(filtros.ut) })
    }

    if (filtros?.search && filtros.search.trim() !== '') {
        const q = filtros.search.trim()
        const isNum = !isNaN(Number(q))
        andConditions.push({
            OR: [
                { nombreEstablecimiento: { contains: q, mode: 'insensitive' } },
                { comuna: { contains: q, mode: 'insensitive' } },
                { institucion: { contains: q, mode: 'insensitive' } },
                ...(isNum ? [{ rbd: Number(q) }, { ut: Number(q) }] : [])
            ]
        })
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {}

    // Traer todos los registros que cumplen con los filtros
    const records = await prisma.cal_ResSan_Registro.findMany({
        where,
        orderBy: [
            { anio: 'asc' },
            { rbd: 'asc' }
        ]
    })

    // Lista de años disponibles en la base de datos
    const allYearsInDb = Array.from(new Set(records.map(r => r.anio))).sort((a, b) => a - b)
    if (allYearsInDb.length === 0) {
        allYearsInDb.push(new Date().getFullYear())
    }

    // 1. Evolución multianual por año
    const yearsMap = new Map<number, typeof records>()
    for (const r of records) {
        if (!yearsMap.has(r.anio)) {
            yearsMap.set(r.anio, [])
        }
        yearsMap.get(r.anio)!.push(r)
    }

    const evolution: YearEvolution[] = allYearsInDb.map(anio => {
        const yearRecords = yearsMap.get(anio) || []
        const total = yearRecords.length
        const conResolucion = yearRecords.filter(r => r.estadoResolucion === 'Si').length
        const sinResolucion = yearRecords.filter(r => r.estadoResolucion === 'No').length
        const noAplica = yearRecords.filter(r => r.estadoResolucion === 'No Aplica').length
        const conDocumento = yearRecords.filter(r => r.estadoResolucion === 'Si' && !!r.documentoUrl).length
        const sinDocumento = conResolucion - conDocumento
        const porcentajeCumplimiento = total > 0 ? Number(((conResolucion / total) * 100).toFixed(1)) : 0
        const porcentajeDocumental = conResolucion > 0 ? Number(((conDocumento / conResolucion) * 100).toFixed(1)) : 0

        return {
            anio,
            total,
            conResolucion,
            sinResolucion,
            noAplica,
            porcentajeCumplimiento,
            conDocumento,
            sinDocumento,
            porcentajeDocumental
        }
    })

    // 2. Agrupación por Sucursal (para el año más reciente o de referencia)
    const latestYear = allYearsInDb[allYearsInDb.length - 1]
    const yearToInspect = filtros?.anioRef && allYearsInDb.includes(filtros.anioRef)
        ? filtros.anioRef
        : latestYear

    const recordsForYear = records.filter(r => r.anio === yearToInspect)

    const sucursalMap = new Map<string, typeof records>()
    for (const r of recordsForYear) {
        const suc = r.sucursal?.trim() || 'Sin Sucursal'
        if (!sucursalMap.has(suc)) {
            sucursalMap.set(suc, [])
        }
        sucursalMap.get(suc)!.push(r)
    }

    const sucursalBreakdown: SucursalBreakdown[] = Array.from(sucursalMap.entries()).map(([sucursal, recs]) => {
        const total = recs.length
        const conResolucion = recs.filter(r => r.estadoResolucion === 'Si').length
        const sinResolucion = recs.filter(r => r.estadoResolucion === 'No').length
        const noAplica = recs.filter(r => r.estadoResolucion === 'No Aplica').length
        const conDocumento = recs.filter(r => r.estadoResolucion === 'Si' && !!r.documentoUrl).length
        const porcentajeCumplimiento = total > 0 ? Number(((conResolucion / total) * 100).toFixed(1)) : 0

        return {
            sucursal,
            total,
            conResolucion,
            sinResolucion,
            noAplica,
            porcentajeCumplimiento,
            conDocumento
        }
    }).sort((a, b) => b.porcentajeCumplimiento - a.porcentajeCumplimiento)

    // 3. Agrupación por Institución (para el año de referencia)
    const institucionMap = new Map<string, typeof records>()
    for (const r of recordsForYear) {
        const inst = r.institucion?.trim() || 'Sin Institución'
        if (!institucionMap.has(inst)) {
            institucionMap.set(inst, [])
        }
        institucionMap.get(inst)!.push(r)
    }

    const institucionBreakdown: InstitucionBreakdown[] = Array.from(institucionMap.entries()).map(([institucion, recs]) => {
        const total = recs.length
        const conResolucion = recs.filter(r => r.estadoResolucion === 'Si').length
        const sinResolucion = recs.filter(r => r.estadoResolucion === 'No').length
        const porcentajeCumplimiento = total > 0 ? Number(((conResolucion / total) * 100).toFixed(1)) : 0

        return {
            institucion,
            total,
            conResolucion,
            sinResolucion,
            porcentajeCumplimiento
        }
    }).sort((a, b) => b.total - a.total)

    // 4. Matriz multianual y comportamiento de RBDs
    const rbdMap = new Map<number, typeof records>()
    for (const r of records) {
        if (!rbdMap.has(r.rbd)) {
            rbdMap.set(r.rbd, [])
        }
        rbdMap.get(r.rbd)!.push(r)
    }

    const rbdMatrix: RbdMatrizItem[] = []

    for (const [rbd, rbdRecs] of rbdMap.entries()) {
        const sortedRecs = rbdRecs.sort((a, b) => a.anio - b.anio)
        const latestRec = sortedRecs[sortedRecs.length - 1]

        const aniosData: Record<number, RbdYearStatus> = {}
        for (const rec of sortedRecs) {
            aniosData[rec.anio] = {
                anio: rec.anio,
                estadoResolucion: rec.estadoResolucion,
                numeroResolucion: rec.numeroResolucion,
                fechaResolucion: rec.fechaResolucion,
                documentoUrl: rec.documentoUrl,
                documentoNombre: rec.documentoNombre,
                documentoSubidoPor: rec.documentoSubidoPor,
                observaciones: rec.observaciones,
                updatedBy: rec.updatedBy
            }
        }

        // Clasificación de comportamiento dinámico:
        const states = sortedRecs.map(r => r.estadoResolucion)
        const firstState = states[0]
        const lastState = states[states.length - 1]

        let comportamiento: RbdMatrizItem['comportamiento'] = 'VARIABLE'

        if (states.every(s => s === 'Si')) {
            comportamiento = 'SOSTENIDO'
        } else if (states.every(s => s === 'No')) {
            comportamiento = 'SIN_RESOLUCION'
        } else if (states.every(s => s === 'No Aplica')) {
            comportamiento = 'NO_APLICA'
        } else if (lastState === 'Si' && states.slice(0, -1).some(s => s === 'No' || s === 'No Aplica')) {
            comportamiento = 'MEJORA'
        } else if ((lastState === 'No' || lastState === 'No Aplica') && states.slice(0, -1).some(s => s === 'Si')) {
            comportamiento = 'ALERTA'
        }

        rbdMatrix.push({
            rbd,
            rbdDv: latestRec.rbdDv,
            nombreEstablecimiento: latestRec.nombreEstablecimiento,
            comuna: latestRec.comuna,
            sucursal: latestRec.sucursal,
            institucion: latestRec.institucion,
            ut: latestRec.ut,
            licitacion: latestRec.licitacion,
            comportamiento,
            aniosData,
            ultimoEstado: latestRec.estadoResolucion,
            ultimoNumero: latestRec.numeroResolucion,
            ultimaFecha: latestRec.fechaResolucion,
            ultimoDocUrl: latestRec.documentoUrl,
            ultimoDocNombre: latestRec.documentoNombre,
            ultimoDocSubidoPor: latestRec.documentoSubidoPor
        })
    }

    // Filtrar por comportamiento si se especificó
    let filteredMatrix = rbdMatrix
    if (filtros?.comportamiento && filtros.comportamiento !== 'ALL') {
        filteredMatrix = rbdMatrix.filter(item => item.comportamiento === filtros.comportamiento)
    }

    // Resumen de tendencias para badges
    const resumenComportamientos = {
        total: rbdMatrix.length,
        sostenido: rbdMatrix.filter(i => i.comportamiento === 'SOSTENIDO').length,
        mejora: rbdMatrix.filter(i => i.comportamiento === 'MEJORA').length,
        alerta: rbdMatrix.filter(i => i.comportamiento === 'ALERTA').length,
        sinResolucion: rbdMatrix.filter(i => i.comportamiento === 'SIN_RESOLUCION').length,
        noAplica: rbdMatrix.filter(i => i.comportamiento === 'NO_APLICA').length
    }

    // Listas para desplegables de filtros
    const distinctSucursales = Array.from(new Set(records.map(r => r.sucursal).filter(Boolean) as string[])).sort()
    const distinctInstituciones = Array.from(new Set(records.map(r => r.institucion).filter(Boolean) as string[])).sort()
    const distinctLicitaciones = Array.from(new Set(records.map(r => r.licitacion).filter(Boolean) as string[])).sort()
    const distinctUts = Array.from(new Set(records.map(r => r.ut).filter(Boolean) as number[])).sort((a, b) => a - b)
    // Establecimientos para autocompletado inteligente (consultando universo permitido según seguridad)
    const baseWhereEstablecimientos: any = {
        rbd: isFilteredBySucursal
            ? { in: allowedRbds.length > 0 ? allowedRbds : [-999999], notIn: [31, 32, 1101] }
            : { notIn: [31, 32, 1101] },
        NOT: { nombreEstablecimiento: { contains: 'sucursal', mode: 'insensitive' } }
    }

    const establecimientosList = await prisma.cal_ResSan_Registro.findMany({
        where: baseWhereEstablecimientos,
        select: {
            rbd: true,
            nombreEstablecimiento: true,
            comuna: true,
            sucursal: true,
            institucion: true
        },
        distinct: ['rbd'],
        orderBy: { rbd: 'asc' }
    })

    return {
        years: allYearsInDb,
        yearToInspect,
        evolution,
        sucursalBreakdown,
        institucionBreakdown,
        matrix: filteredMatrix,
        resumenComportamientos,
        filterOptions: {
            sucursales: distinctSucursales,
            instituciones: distinctInstituciones,
            licitaciones: distinctLicitaciones,
            uts: distinctUts,
            establecimientos: establecimientosList
        },
        userSucursales,
        isFilteredBySucursal,
        isAdmin
    }
}

/**
 * Consulta la cronología completa de un RBD a través de todos los años disponibles
 */
export async function getRbdHistoricalTimeline(rbd: number) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const records = await prisma.cal_ResSan_Registro.findMany({
        where: { rbd },
        orderBy: { anio: 'desc' }
    })

    return records
}

/**
 * Auditoría al exportar datos del tablero a Excel
 */
export async function auditExportExcel(detalle: string) {
    const session = await getSession()
    if (!session?.user) return

    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'EXPORTAR_EXCEL_TABLERO_RESOLUCION_SANITARIA',
        modulo: 'Tableros y Avances',
        detalle
    })
}
