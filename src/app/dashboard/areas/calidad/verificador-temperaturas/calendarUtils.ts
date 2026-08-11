export interface CalendarWeek {
    semanaNum: number
    startDay: number
    endDay: number
    label: string
}

export function getCalendarWeeksForMonth(year: number, month: number): CalendarWeek[] {
    const safeYear = isNaN(year) || year < 2000 ? new Date().getFullYear() : year
    const safeMonth = isNaN(month) || month < 1 || month > 12 ? 1 : month

    const daysInMonth = new Date(safeYear, safeMonth, 0).getDate()
    const weeks: CalendarWeek[] = []

    let currentStart = 1
    let weekIndex = 1

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(safeYear, safeMonth - 1, d)
        const dow = date.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

        // If Sunday (end of week in Chile) or last day of month
        if (dow === 0 || d === daysInMonth) {
            weeks.push({
                semanaNum: weekIndex,
                startDay: currentStart,
                endDay: d,
                label: currentStart === d
                    ? `Semana ${weekIndex} (Día ${d})`
                    : `Semana ${weekIndex} (Días ${currentStart} al ${d})`
            })
            weekIndex++
            currentStart = d + 1
        }
    }

    return weeks
}
