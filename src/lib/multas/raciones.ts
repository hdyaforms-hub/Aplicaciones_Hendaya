import { prisma } from '@/lib/prisma'

export interface RacionesFolioResult {
    racionesTotal: number
    racionesExcluidas: number
    estratosExcluidosAplicados: string[]
    niveles: { label: string; value: number }[]
    recordsValidos: any[]
}

/**
 * Obtiene y centraliza el cálculo de raciones PMPA de un establecimiento, mes y servicio.
 * Si excluirEstratos es true (módulo C2 activo para la licitación), filtra los estratos activos configurados.
 * Si es false (por defecto), incluye todas las raciones sin alteración de montos históricos.
 */
export async function getRacionesFolio(params: {
    rbd: number
    anho: number
    mes: number
    licId: number
    servicioCodigo?: string | null
    excluirEstratos?: boolean
}): Promise<RacionesFolioResult> {
    const { rbd, anho, mes, licId, servicioCodigo, excluirEstratos = false } = params

    if (!rbd || !anho || !mes) {
        return {
            racionesTotal: 0,
            racionesExcluidas: 0,
            estratosExcluidosAplicados: [],
            niveles: [],
            recordsValidos: []
        }
    }

    const whereClause: any = {
        rbd,
        ano: anho,
        mes
    }

    if (licId && !isNaN(Number(licId)) && Number(licId) > 0) {
        whereClause.licitacion = Number(licId)
    }

    if (servicioCodigo) {
        whereClause.servicio = servicioCodigo
    }

    const allPmpas = await prisma.pMPA.findMany({
        where: whereClause
    })

    if (!allPmpas || allPmpas.length === 0) {
        return {
            racionesTotal: 0,
            racionesExcluidas: 0,
            estratosExcluidosAplicados: [],
            niveles: [],
            recordsValidos: []
        }
    }

    // Si la exclusión de estratos está activa, buscar estratos excluidos de la licitación
    let estratosExcluidosList: string[] = []
    if (excluirEstratos && licId) {
        try {
            const excluidos = await prisma.multas_Estrato_Excluido.findMany({
                where: { licId, activo: true },
                select: { estrato: true }
            })
            estratosExcluidosList = excluidos.map(e => String(e.estrato).trim())
        } catch {
            estratosExcluidosList = []
        }
    }

    let racionesTotal = 0
    let racionesExcluidas = 0
    const estratosAplicadosSet = new Set<string>()
    const recordsValidos: any[] = []
    const nivelesMap: Record<string, number> = {}

    for (const p of allPmpas) {
        const estStr = String(p.estrato || '').trim()
        if (estratosExcluidosList.length > 0 && estratosExcluidosList.includes(estStr)) {
            racionesExcluidas += p.raceqJunaeb || 0
            estratosAplicadosSet.add(estStr)
        } else {
            const raciones = p.raceqJunaeb || 0
            racionesTotal += raciones
            recordsValidos.push(p)

            const niv = p.nivel || 'General'
            nivelesMap[niv] = (nivelesMap[niv] || 0) + raciones
        }
    }

    const niveles = Object.entries(nivelesMap).map(([label, value]) => ({
        label,
        value
    }))

    return {
        racionesTotal,
        racionesExcluidas,
        estratosExcluidosAplicados: Array.from(estratosAplicadosSet),
        niveles,
        recordsValidos
    }
}
