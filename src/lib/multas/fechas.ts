/**
 * Utilidades de cálculo de plazos y días hábiles administrativos en Chile.
 * Considera fines de semana (sábados y domingos) y feriados nacionales oficiales de Chile.
 */

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
 * Retorna la lista de feriados nacionales en Chile para un año determinado en formato 'YYYY-MM-DD'.
 */
export function getFeriadosChile(year: number): Set<string> {
    const feriados = new Set<string>()

    const pad = (n: number) => n.toString().padStart(2, '0')
    const addFeriado = (m: number, d: number) => feriados.add(`${year}-${pad(m)}-${pad(d)}`)

    // Feriados fijos
    addFeriado(1, 1)   // Año Nuevo
    addFeriado(5, 1)   // Día del Trabajador
    addFeriado(5, 21)  // Glorias Navales
    addFeriado(6, 20)  // Día Nacional de los Pueblos Indígenas (o solsticio aprox 20-21)
    addFeriado(7, 16)  // Virgen del Carmen
    addFeriado(8, 15)  // Asunción de la Virgen
    addFeriado(9, 18)  // Independencia Nacional
    addFeriado(9, 19)  // Glorias del Ejército
    addFeriado(11, 1)  // Día de Todos los Santos
    addFeriado(12, 8)  // Inmaculada Concepción
    addFeriado(12, 25) // Navidad

    // Fiestas Patrias adicionales según día de la semana (Ley 20.215 / 20.983)
    const dia18 = new Date(year, 8, 18).getDay() // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
    if (dia18 === 2) { // Martes 18 y Miércoles 19 -> Lunes 17 feriado
        addFeriado(9, 17)
    } else if (dia18 === 3) { // Miércoles 18 y Jueves 19 -> Viernes 20 feriado
        addFeriado(9, 20)
    } else if (dia18 === 5) { // Viernes 18 y Sábado 19 -> Jueves 17 feriado
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
 * Comprueba si una fecha es fin de semana o feriado en Chile.
 */
export function esDiaHabilChile(fecha: Date): boolean {
    const diaSemana = fecha.getDay()
    if (diaSemana === 0 || diaSemana === 6) return false

    const year = fecha.getFullYear()
    const feriados = getFeriadosChile(year)

    const pad = (n: number) => n.toString().padStart(2, '0')
    const key = `${year}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`

    return !feriados.has(key)
}

/**
 * Calcula la fecha de término sumando días hábiles administrativos (Lunes a Viernes excluyendo feriados).
 */
export function calcularFechaPlazoHabil(fechaInicio: Date | string, diasHabiles: number): Date {
    const res = new Date(fechaInicio)
    let agregados = 0

    while (agregados < diasHabiles) {
        res.setDate(res.getDate() + 1)
        if (esDiaHabilChile(res)) {
            agregados++
        }
    }

    return res
}

/**
 * Evalúa si una fecha límite ya ha vencido respecto a la fecha actual (medianoche local).
 */
export function estaPlazoVencido(fechaPlazo: Date | string | null | undefined): boolean {
    if (!fechaPlazo) return false
    const limite = new Date(fechaPlazo)
    if (isNaN(limite.getTime())) return false

    const hoy = new Date()
    // Fin del día de la fecha límite (23:59:59.999)
    limite.setHours(23, 59, 59, 999)
    return hoy > limite
}
