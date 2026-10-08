import crypto from 'crypto'

// Clave base para cifrado de nombres en base de datos
const SECRET_KEY_RAW = process.env.PERSONAL_SECRET_KEY || process.env.PATENTE_SECRET_KEY || process.env.SESSION_SECRET || 'hendaya-personal-crypto-key-2026-secure'
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
    return crypto.createHash('sha256').update(SECRET_KEY_RAW).digest()
}

/**
 * Cifra el nombre de la persona para almacenarlo en la base de datos de manera segura.
 * Formato resultante: ENC_NOM::<iv_hex>::<authTag_hex>::<encrypted_hex>
 */
export function encryptNombre(rawNombre: string): string {
    if (!rawNombre || !rawNombre.trim()) return ''
    const cleanNombre = rawNombre.trim()

    try {
        const key = getKey()
        const iv = crypto.randomBytes(12) // 96 bits para AES-GCM
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(cleanNombre, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const authTag = cipher.getAuthTag().toString('hex')

        return `ENC_NOM::${iv.toString('hex')}::${authTag}::${encrypted}`
    } catch (error) {
        console.error('Error al cifrar nombre:', error)
        return cleanNombre
    }
}

/**
 * Cifra un dato personal sensible (Rut, Nombre, Apellido) con AES-256-GCM.
 * Formato resultante: ENC_PERS::<iv_hex>::<authTag_hex>::<encrypted_hex>
 */
export function encryptPersonalText(rawText: string): string {
    if (!rawText || !rawText.trim()) return ''
    const clean = rawText.trim()

    try {
        const key = getKey()
        const iv = crypto.randomBytes(12) // 96 bits para AES-GCM
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(clean, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const authTag = cipher.getAuthTag().toString('hex')

        return `ENC_PERS::${iv.toString('hex')}::${authTag}::${encrypted}`
    } catch (error) {
        console.error('Error al cifrar dato personal:', error)
        return clean
    }
}

/**
 * Descifra un dato personal previamente cifrado con AES-256-GCM.
 */
export function decryptPersonalText(cipherText: string): string {
    if (!cipherText || !cipherText.trim()) return ''
    const trimmed = cipherText.trim()

    // Si no tiene prefijo, devolver texto plano (retrocompatibilidad)
    if (!trimmed.startsWith('ENC_PERS::') && !trimmed.startsWith('ENC_NOM::')) {
        return trimmed
    }

    try {
        const parts = trimmed.split('::')
        if (parts.length !== 4) return trimmed

        const iv = Buffer.from(parts[1], 'hex')
        const authTag = Buffer.from(parts[2], 'hex')
        const encryptedHex = parts[3]

        const key = getKey()
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        console.error('Error al descifrar dato personal:', error)
        return '*** ERROR DESCIFRADO ***'
    }
}

/**
 * Alias de compatibilidad para código existente que utiliza decryptNombre
 */
export const decryptNombre = decryptPersonalText


/**
 * Normaliza un RUT chileno eliminando puntos, espacios y pasando el dígito verificador a mayúscula.
 * Ejemplo: "16.410.779-5" -> "16410779-5"
 */
export function cleanRut(rut: string): string {
    if (!rut) return ''
    return rut.replace(/\./g, '').replace(/\s+/g, '').toUpperCase().trim()
}

/**
 * Genera un Hash SHA-256 no reversible del RUT limpio para permitir comparaciones de unicidad y búsquedas seguras en BD.
 */
export function hashRut(rut: string): string {
    const cleaned = cleanRut(rut)
    if (!cleaned) return ''
    return crypto.createHash('sha256').update(cleaned).digest('hex')
}

