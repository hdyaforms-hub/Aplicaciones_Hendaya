import crypto from 'crypto'

// Clave base para cifrado de datos de capacitación
const SECRET_KEY_RAW = process.env.CAPACITACION_SECRET_KEY || process.env.PERSONAL_SECRET_KEY || process.env.SESSION_SECRET || 'hendaya-reg-capacitacion-secret-2026-secure'
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
    return crypto.createHash('sha256').update(SECRET_KEY_RAW).digest()
}

/**
 * Cifra un dato de texto sensible (Relator, Nombre participante, RUT)
 * Formato resultante: ENC_CAP::<iv_hex>::<authTag_hex>::<encrypted_hex>
 */
export function encryptRegCap(plainText: string): string {
    if (!plainText || !plainText.trim()) return ''
    const cleanText = plainText.trim()

    try {
        const key = getKey()
        const iv = crypto.randomBytes(12) // 96 bits para AES-GCM
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(cleanText, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const authTag = cipher.getAuthTag().toString('hex')

        return `ENC_CAP::${iv.toString('hex')}::${authTag}::${encrypted}`
    } catch (error) {
        console.error('Error al cifrar dato de capacitación:', error)
        return cleanText
    }
}

/**
 * Descifra el dato de capacitación almacenado para mostrarlo en pantalla o en el PDF.
 */
export function decryptRegCap(cipherText: string): string {
    if (!cipherText || !cipherText.trim()) return ''
    const trimmed = cipherText.trim()

    // Si no tiene el prefijo de cifrado, retornamos el texto tal cual
    if (!trimmed.startsWith('ENC_CAP::')) {
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
        console.error('Error al descifrar dato de capacitación:', error)
        return '*** ERROR DESCIFRADO ***'
    }
}
