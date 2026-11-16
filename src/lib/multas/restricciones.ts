/**
 * Motor centralizado y configurable para evaluación de restricciones de Aspectos EE (Multas).
 * Compara por día calendario oficial en zona horaria America/Santiago.
 */

export interface RestriccionAspectoEE {
    id: string
    licId: number
    letra: string
    tipo: 'ANHO' | 'RANGO_FECHAS' | string
    anho?: number | null
    fechaDesde?: Date | string | null
    fechaHasta?: Date | string | null
    accion: 'VALOR_CERO' | 'MONTO_FIJO' | string
    valorFijo?: number | null
    descripcion?: string | null
    activo: boolean
}

export interface ResultadoRestriccionAspecto {
    aplica: boolean
    restriccion: RestriccionAspectoEE | null
    montoMulta: number
    glosa: string
}

/**
 * Convierte cualquier fecha/timestamp a formato 'YYYY-MM-DD' en la zona horaria de Chile (America/Santiago).
 */
export function fechaToChileCalendarStr(fecha: Date | string | number | null | undefined): string | null {
    if (!fecha) return null
    try {
        const d = new Date(fecha)
        if (isNaN(d.getTime())) return null
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d)
    } catch {
        return null
    }
}

/**
 * Evalúa si una restricción específica aplica para una fecha de supervisión dada.
 */
export function cumpleRestriccionFecha(
    restriccion: RestriccionAspectoEE,
    fechaSupervision: Date | string | null | undefined
): boolean {
    if (!restriccion.activo) return false
    const fechaChileStr = fechaToChileCalendarStr(fechaSupervision)
    if (!fechaChileStr) return false

    if (restriccion.tipo === 'ANHO') {
        if (!restriccion.anho) return false
        const anhoFecha = parseInt(fechaChileStr.slice(0, 4), 10)
        return restriccion.anho === anhoFecha
    }

    if (restriccion.tipo === 'RANGO_FECHAS') {
        const desdeStr = fechaToChileCalendarStr(restriccion.fechaDesde)
        const hastaStr = fechaToChileCalendarStr(restriccion.fechaHasta)

        // Si no tiene ninguna fecha configurada, la restricción es inválida
        if (!desdeStr && !hastaStr) return false

        let cumpleDesde = true
        let cumpleHasta = true

        if (desdeStr) {
            cumpleDesde = fechaChileStr >= desdeStr
        }
        if (hastaStr) {
            cumpleHasta = fechaChileStr <= hastaStr
        }

        return cumpleDesde && cumpleHasta
    }

    return false
}

/**
 * Busca y evalúa la restricción activa aplicable a una letra de aspecto y fecha determinada.
 * Retorna el resultado con su monto calculado y glosa descriptiva.
 */
export function evaluarRestriccionAspecto(
    restricciones: RestriccionAspectoEE[],
    letra: string | null | undefined,
    fechaSupervision: Date | string | null | undefined,
    licId?: number | null
): ResultadoRestriccionAspecto {
    if (!letra) {
        return { aplica: false, restriccion: null, montoMulta: 0, glosa: '' }
    }

    const upperLetra = letra.toUpperCase().trim()

    // Filtrar restricciones para esta licitación (si aplica) y aspecto
    const candidatas = restricciones.filter(r => {
        if (!r.activo) return false
        if (r.letra.toUpperCase().trim() !== upperLetra) return false
        if (licId !== undefined && licId !== null && r.licId !== licId) return false
        return true
    })

    const restriccionMatch = candidatas.find(r => cumpleRestriccionFecha(r, fechaSupervision))

    if (!restriccionMatch) {
        return { aplica: false, restriccion: null, montoMulta: 0, glosa: '' }
    }

    const montoMulta = restriccionMatch.accion === 'VALOR_CERO'
        ? 0
        : (Number(restriccionMatch.valorFijo) || 0)

    const glosa = restriccionMatch.accion === 'VALOR_CERO'
        ? `RESTRICCIÓN APLICADA: ${restriccionMatch.descripcion || `Aspecto ${upperLetra} exento`} -> $0 (Exento)`
        : `RESTRICCIÓN APLICADA: ${restriccionMatch.descripcion || `Aspecto ${upperLetra} monto fijo`} -> $${montoMulta}`

    return {
        aplica: true,
        restriccion: restriccionMatch,
        montoMulta,
        glosa
    }
}
