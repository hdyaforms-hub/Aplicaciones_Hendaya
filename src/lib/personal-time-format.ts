/**
 * Utilidades de conversión y formateo de tiempos para Horas Extras y Asistencia de Personal.
 * Convierte fracciones de tiempo de planillas Excel o valores decimales a formato legible de horas y minutos.
 */

export function parseMinutosHhee(val: number | null | undefined): number {
    if (!val || isNaN(val) || val <= 0) return 0
    // Si val <= 1, proviene del número serie fraccionario de Excel (1 día = 24h = 1440 min)
    if (val <= 1) {
        return Math.round(val * 1440)
    }
    // Si val > 1, representa horas directas en decimal (ej. 1.5 = 90 min)
    return Math.round(val * 60)
}

/**
 * Devuelve el tiempo en formato estándar 'HH:mm hrs' (ej. '00:43 hrs', '01:23 hrs')
 */
export function formatHorasMinutos(val: number | null | undefined): string {
    const totalMinutos = parseMinutosHhee(val)
    if (totalMinutos === 0) return '00:00 hrs'

    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    const hh = String(horas).padStart(2, '0')
    const mm = String(minutos).padStart(2, '0')
    return `${hh}:${mm} hrs`
}

/**
 * Devuelve el tiempo en formato compacto amigable (ej. '43 min', '1h 23m')
 */
export function formatHorasMinutosTexto(val: number | null | undefined): string {
    const totalMinutos = parseMinutosHhee(val)
    if (totalMinutos === 0) return '0 min'

    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    if (horas > 0 && minutos > 0) {
        return `${horas}h ${minutos}m`
    }
    if (horas > 0) {
        return `${horas}h`
    }
    return `${minutos} min`
}
