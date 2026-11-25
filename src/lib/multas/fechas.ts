import { rawPrisma } from '@/lib/prisma'
import { ensureFeriadosTables } from './feriados-db-init'

/**
 * Utilidades de cálculo de plazos y días hábiles administrativos en Chile.
 * Combina la tabla persistida Multas_Feriado (prioritaria y editable) con el motor
 * algorítmico oficial de feriados legales de Chile como respaldo.
 */

// Cache en memoria para feriados de BD (por año)
const feriadosDbCache = new Map<number, { set: Set<string>; loadedAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos

/**
 * Calcula el Domingo de Resurrección (Pascua) usando el algoritmo de Butcher / Meeus.
 */
function getPascua(year: number): { month: number; day: number } {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = Marzo, 4 = Abril
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return { month, day }
}

/**
 * Motor algorítmico oficial de feriados legales en Chile (Leyes 2.977, 19.668, 20.215, 20.983, 21.357).
 */
export function getFeriadosChileFallback(year: number): Set<string> {
    const feriados = new Set<string>()

    const pad = (n: number) => n.toString().padStart(2, '0')
    const addFeriado = (m: number, d: number) => feriados.add(`${year}-${pad(m)}-${pad(d)}`)

    // Feriados fijos
    addFeriado(1, 1)   // Año Nuevo
    addFeriado(5, 1)   // Día del Trabajador
    addFeriado(5, 21)  // Glorias Navales
    addFeriado(7, 16)  // Virgen del Carmen
    addFeriado(8, 15)  // Asunción de la Virgen
    addFeriado(9, 18)  // Independencia Nacional
    addFeriado(9, 19)  // Glorias del Ejército
    addFeriado(11, 1)  // Día de Todos los Santos
    addFeriado(12, 8)  // Inmaculada Concepción
    addFeriado(12, 25) // Navidad

    // Día Nacional de los Pueblos Indígenas (Ley 21.357: día del solsticio de invierno)
    // 2024: 20 de junio, 2025: 20 de junio, 2026: 21 de junio, 2027: 21 de junio, 2028: 20 de junio
    if (year === 2024 || year === 2025 || year === 2028) {
        addFeriado(6, 20)
    } else {
        addFeriado(6, 21)
    }

    // Fiestas Patrias adicionales según día de la semana:
    // Ley 20.215:
    // - Si 18 y 19 caen martes y miércoles -> lunes 17 feriado (dia18 === 2)
    // - Si 18 y 19 caen miércoles y jueves -> viernes 20 feriado (dia18 === 3)
    // Ley 20.983:
    // - Si 18 cae en día sábado (y 19 domingo) -> viernes 17 feriado (dia18 === 6)
    // (Nota: Si 18 cae viernes como en 2026, el jueves 17 NO es feriado)
    const dia18 = new Date(year, 8, 18).getDay() // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
    if (dia18 === 2) {
        addFeriado(9, 17)
    } else if (dia18 === 3) {
        addFeriado(9, 20)
    } else if (dia18 === 6) {
        addFeriado(9, 17)
    }

    // San Pedro y San Pablo (29 de junio o lunes más cercano según Ley 19.668)
    const spDate = new Date(year, 5, 29)
    const spDay = spDate.getDay()
    if (spDay >= 2 && spDay <= 4) { // Martes, Miércoles, Jueves -> lunes anterior
        const diff = spDay - 1
        addFeriado(6, 29 - diff)
    } else if (spDay === 5) { // Viernes -> lunes siguiente
        addFeriado(7, 2)
    } else {
        addFeriado(6, 29)
    }

    // Encuentro de Dos Mundos (12 de octubre trasladable a lunes según Ley 19.668)
    const e2mDate = new Date(year, 9, 12)
    const e2mDay = e2mDate.getDay()
    if (e2mDay >= 2 && e2mDay <= 4) {
        addFeriado(10, 12 - (e2mDay - 1))
    } else if (e2mDay === 5) {
        addFeriado(10, 15)
    } else {
        addFeriado(10, 12)
    }

    // Día de las Iglesias Evangélicas (31 de octubre o viernes según Ley 20.299)
    const evDate = new Date(year, 9, 31)
    const evDay = evDate.getDay()
    if (evDay === 3) { // Miércoles -> se traslada al viernes 2 de noviembre
        addFeriado(11, 2)
    } else if (evDay === 2) { // Martes -> se traslada al viernes 27 de octubre
        addFeriado(10, 27)
    } else {
        addFeriado(10, 31)
    }

    // Semana Santa (Viernes Santo y Sábado Santo)
    const pascua = getPascua(year)
    const pascuaDate = new Date(year, pascua.month - 1, pascua.day)
    const viernesSanto = new Date(pascuaDate)
    viernesSanto.setDate(pascuaDate.getDate() - 2)
    addFeriado(viernesSanto.getMonth() + 1, viernesSanto.getDate())

    const sabadoSanto = new Date(pascuaDate)
    sabadoSanto.setDate(pascuaDate.getDate() - 1)
    addFeriado(sabadoSanto.getMonth() + 1, sabadoSanto.getDate())

    return feriados
}

/**
 * Carga o refresca feriados desde la base de datos (tabla Multas_Feriado).
 */
export async function cargarFeriadosDb(year: number): Promise<Set<string>> {
    const cached = feriadosDbCache.get(year)
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.set
    }

    try {
        await ensureFeriadosTables()
        const rows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT fecha FROM "Multas_Feriado"
            WHERE anio = $1 AND activo = true;
        `, year)

        if (rows && rows.length > 0) {
            const set = new Set<string>(rows.map(r => r.fecha))
            feriadosDbCache.set(year, { set, loadedAt: Date.now() })
            return set
        }
    } catch (e) {
        console.error(`Error consultando feriados BD año ${year}, usando fallback:`, e)
    }

    const fallback = getFeriadosChileFallback(year)
    feriadosDbCache.set(year, { set: fallback, loadedAt: Date.now() })
    return fallback
}

/**
 * Invalida la memoria caché de feriados en memoria (forzando lectura fresca de la BD).
 */
export function invalidarCacheFeriados(year?: number): void {
    if (typeof year === 'number') {
        feriadosDbCache.delete(year)
    } else {
        feriadosDbCache.clear()
    }
}

/**
 * Retorna los feriados de un año (usa cache si está vigente según TTL, sino refresca asíncronamente o usa fallback).
 */
export function getFeriadosChile(year: number): Set<string> {
    const cached = feriadosDbCache.get(year)
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.set
    }
    cargarFeriadosDb(year).catch(() => {})
    if (cached) return cached.set
    return getFeriadosChileFallback(year)
}

/**
 * Obtiene el conjunto de feriados oficiales para el cálculo de un plazo administrativo,
 * cargando de forma asíncrona la tabla Multas_Feriado para el año inicial
 * y también para el año subsiguiente si el plazo puede cruzar al año siguiente.
 */
export async function getFeriadosParaPlazo(fechaInicio: Date | string, diasHabiles: number = 30): Promise<Set<string>> {
    const inicio = new Date(fechaInicio)
    const anioInicio = isNaN(inicio.getTime()) ? new Date().getFullYear() : inicio.getFullYear()

    // Cargar feriados de año inicio desde BD
    const feriadosInicio = await cargarFeriadosDb(anioInicio)
    const combinados = new Set<string>(feriadosInicio)

    // Si la fecha de inicio es hacia fin de año (octubre a diciembre) o el plazo en días hábiles puede alcanzar el nuevo año
    const mesInicio = !isNaN(inicio.getTime()) ? inicio.getMonth() : new Date().getMonth()
    if (mesInicio >= 9 || diasHabiles >= 15) {
        const feriadosSiguiente = await cargarFeriadosDb(anioInicio + 1)
        for (const f of feriadosSiguiente) {
            combinados.add(f)
        }
    }

    return combinados
}

/**
 * Comprueba si una fecha es fin de semana o feriado en Chile.
 */
export function esDiaHabilChile(fecha: Date, feriadosSet?: Set<string>): boolean {
    const diaSemana = fecha.getDay()
    if (diaSemana === 0 || diaSemana === 6) return false

    const year = fecha.getFullYear()
    const feriados = feriadosSet || getFeriadosChile(year)

    const pad = (n: number) => n.toString().padStart(2, '0')
    const key = `${year}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`

    return !feriados.has(key)
}

/**
 * Calcula la fecha de término sumando días hábiles administrativos (Lunes a Viernes excluyendo feriados).
 */
export function calcularFechaPlazoHabil(
    fechaInicio: Date | string,
    diasHabiles: number,
    feriadosSet?: Set<string>
): Date {
    const res = new Date(fechaInicio)
    let agregados = 0

    while (agregados < diasHabiles) {
        res.setDate(res.getDate() + 1)
        if (esDiaHabilChile(res, feriadosSet)) {
            agregados++
        }
    }

    return res
}

/**
 * Evalúa si una fecha límite ya ha vencido respecto a la fecha actual oficial en Chile (zona horaria America/Santiago).
 * Evita cualquier desfase por servidores alojados en UTC (Railway, Docker, etc.).
 */
export function estaPlazoVencido(fechaPlazo: Date | string | null | undefined): boolean {
    if (!fechaPlazo) return false

    let strLimite = ''
    if (typeof fechaPlazo === 'string') {
        strLimite = fechaPlazo.split('T')[0]
    } else if (fechaPlazo instanceof Date && !isNaN(fechaPlazo.getTime())) {
        strLimite = fechaPlazo.toISOString().split('T')[0]
    }
    if (!strLimite || !/^\d{4}-\d{2}-\d{2}$/.test(strLimite)) return false

    // Obtener fecha actual en Chile (zona horaria America/Santiago) en formato YYYY-MM-DD
    const hoyChile = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date())

    // El plazo vence al culminar el día hábil en Chile (hoyChile > strLimite)
    return hoyChile > strLimite
}
