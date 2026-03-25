export function validateChileanRut(rut: string): boolean {
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase()
    if (cleanRut.length < 2) return false

    const body = cleanRut.slice(0, -1)
    const dv = cleanRut.slice(-1)

    if (!/^\d+$/.test(body)) return false

    let sum = 0
    let multiplier = 2

    for (let i = body.length - 1; i >= 0; i--) {
        const digit = parseInt(body[i])
        if (isNaN(digit)) return false
        sum += digit * multiplier
        multiplier = multiplier === 7 ? 2 : multiplier + 1
    }

    const expectedDv = 11 - (sum % 11)
    let finalDv: string
    if (expectedDv === 11) finalDv = '0'
    else if (expectedDv === 10) finalDv = 'K'
    else finalDv = expectedDv.toString()

    return finalDv === dv
}
