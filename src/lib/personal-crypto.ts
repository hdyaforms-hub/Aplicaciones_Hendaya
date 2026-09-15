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
 * Descifra el valor del nombre almacenado en la base de datos para mostrarlo en pantalla o reporte.
 */
export function decryptNombre(cipherText: string): string {
    if (!cipherText || !cipherText.trim()) return ''
    const trimmed = cipherText.trim()

    // Si no tiene el prefijo de cifrado, es un nombre no cifrado (retrocompatibilidad)
    if (!trimmed.startsWith('ENC_NOM::')) {
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
        console.error('Error al descifrar nombre:', error)
        return '*** ERROR DESCIFRADO ***'
    }
}
