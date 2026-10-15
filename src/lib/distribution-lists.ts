import { prisma, rawPrisma } from '@/lib/prisma'
import { ensureNotificationConditionalColumns } from './notifications-db-init'

export interface SucursalDestinatarios {
    para: string[]
    cc: string[]
}

export type PorSucursalMap = Record<string, SucursalDestinatarios>

export interface ResolucionDestinatarios {
    to: string[]
    cc: string[]
    matchedSucursal: boolean
}

const clean = (s: string) => 
    s.normalize('NFD')
     .replace(/[\u0300-\u036f]/g, '')
     .replace(/[_\s]+/g, ' ')
     .trim()
     .toUpperCase()

/**
 * Resuelve a qué Sucursal pertenece un RBD dado.
 * Revisa en cascada Colegios, ColegiosMatriz y PMPA/UT.
 */
export async function resolveSucursalFromRbd(rbdInput: number | string | null | undefined): Promise<{ id?: string, nombre: string } | null> {
    if (!rbdInput) return null
    const rbd = Number(rbdInput)
    if (isNaN(rbd) || rbd <= 0) return null

    try {
        // 1. Colegios
        const col = await prisma.colegios.findFirst({
            where: { colRBD: rbd },
            select: { sucursal: true }
        })
        if (col?.sucursal) {
            const suc = await prisma.sucursal.findFirst({
                where: { nombre: { equals: col.sucursal, mode: 'insensitive' } },
                select: { id: true, nombre: true }
            })
            return suc || { nombre: col.sucursal }
        }

        // 2. ColegiosMatriz
        const colMatriz = await prisma.colegiosMatriz.findFirst({
            where: { colRBD: rbd },
            select: { sucursal: true }
        })
        if (colMatriz?.sucursal) {
            const suc = await prisma.sucursal.findFirst({
                where: { nombre: { equals: colMatriz.sucursal, mode: 'insensitive' } },
                select: { id: true, nombre: true }
            })
            return suc || { nombre: colMatriz.sucursal }
        }

        // 3. PMPA -> UT -> Sucursal
        const pmpa = await (prisma.pMPA as any).findFirst({
            where: { rbd },
            include: { ut: { include: { sucursal: true } } }
        })
        if (pmpa?.ut?.sucursal) {
            return {
                id: pmpa.ut.sucursal.id,
                nombre: pmpa.ut.sucursal.nombre
            }
        }
    } catch (e) {
        console.error(`[resolveSucursalFromRbd] Error resolviendo RBD ${rbd}:`, e)
    }

    return null
}

/**
 * Resuelve los destinatarios finales (to, cc) de una lista dada una Sucursal objetivo.
 *
 * Soporta de manera 100% transparente:
 * 1. Listas clásicas globales (sin sucursal).
 * 2. Listas clásicas con sucursal única fija (sucursalId).
 * 3. Listas dinámicas multi-sucursal (porSucursal).
 */
export function resolveListaDestinatarios(
    lista: {
        id?: string
        nombre?: string
        para?: string | null
        cc?: string | null
        sucursalId?: string | null
        sucursal?: { id: string, nombre: string } | null
        porSucursal?: string | PorSucursalMap | null
    },
    targetSucursal?: { id?: string | null, nombre?: string | null } | null
): ResolucionDestinatarios {
    let to: string[] = []
    let cc: string[] = []

    // Parsear destinatarios base / globales
    let basePara: string[] = []
    let baseCc: string[] = []
    try {
        if (lista.para) {
            const parsed = typeof lista.para === 'string' ? JSON.parse(lista.para) : lista.para
            if (Array.isArray(parsed)) basePara = parsed.filter(Boolean)
        }
    } catch { }

    try {
        if (lista.cc) {
            const parsed = typeof lista.cc === 'string' ? JSON.parse(lista.cc) : lista.cc
            if (Array.isArray(parsed)) baseCc = parsed.filter(Boolean)
        }
    } catch { }

    // Parsear mapa porSucursal
    let porSucursalMap: PorSucursalMap = {}
    if (lista.porSucursal) {
        if (typeof lista.porSucursal === 'object') {
            porSucursalMap = lista.porSucursal as PorSucursalMap
        } else if (typeof lista.porSucursal === 'string') {
            try {
                porSucursalMap = JSON.parse(lista.porSucursal)
            } catch { }
        }
    }

    const hasSucursalesConfiguradas = Object.keys(porSucursalMap).length > 0
    const isSingleSucursalList = Boolean(lista.sucursalId)

    let matchedSucursal = false

    if (targetSucursal && (targetSucursal.id || targetSucursal.nombre)) {
        const targetId = targetSucursal.id || ''
        const targetNombreClean = targetSucursal.nombre ? clean(targetSucursal.nombre) : ''

        // 1. Revisar en el mapa dinámico porSucursal
        if (hasSucursalesConfiguradas) {
            let sucursalEntry: SucursalDestinatarios | undefined = undefined

            if (targetId && porSucursalMap[targetId]) {
                sucursalEntry = porSucursalMap[targetId]
                matchedSucursal = true
            } else if (targetNombreClean) {
                for (const [key, val] of Object.entries(porSucursalMap)) {
                    if (clean(key) === targetNombreClean) {
                        sucursalEntry = val
                        matchedSucursal = true
                        break
                    }
                }
            }

            if (sucursalEntry) {
                if (Array.isArray(sucursalEntry.para)) to.push(...sucursalEntry.para)
                if (Array.isArray(sucursalEntry.cc)) cc.push(...sucursalEntry.cc)
            }
        }

        // 2. Lista tradicional con una sola sucursal fija
        if (isSingleSucursalList) {
            const matchesId = targetId && lista.sucursalId === targetId
            const matchesName = targetNombreClean && lista.sucursal?.nombre && clean(lista.sucursal.nombre) === targetNombreClean
            if (matchesId || matchesName) {
                matchedSucursal = true
                to.push(...basePara)
                cc.push(...baseCc)
            }
        } else {
            // Lista sin sucursal fija: si tiene correos base globales (ej. auditoría o gerencia), siempre se suman
            // EXCEPTO si es una lista configurada exclusivamente por sucursal y la sucursal actual no coincidió
            if (!hasSucursalesConfiguradas || matchedSucursal) {
                to.push(...basePara)
                cc.push(...baseCc)
            }
        }
    } else {
        // Evento global sin sucursal
        if (!isSingleSucursalList) {
            to.push(...basePara)
            cc.push(...baseCc)
        }
    }

    const cleanEmails = (list: string[]) => 
        Array.from(new Set(
            list.map(e => (typeof e === 'string' ? e.trim() : '')).filter(e => e && e.includes('@'))
        ))

    return {
        to: cleanEmails(to),
        cc: cleanEmails(cc),
        matchedSucursal
    }
}
