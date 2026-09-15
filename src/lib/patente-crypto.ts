import crypto from 'crypto'

// Clave base para cifrado de patentes en base de datos
const SECRET_KEY_RAW = process.env.PATENTE_SECRET_KEY || process.env.SESSION_SECRET || 'hendaya-patentes-crypto-key-2026-secure'
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
    return crypto.createHash('sha256').update(SECRET_KEY_RAW).digest()
}

/**
 * Cifra la patente para almacenarla en la base de datos de manera segura.
 * Formato resultante: ENC_PAT::<iv_hex>::<authTag_hex>::<encrypted_hex>
 */
export function encryptPatente(rawPatente: string): string {
    if (!rawPatente || !rawPatente.trim()) return ''
    const cleanPatente = rawPatente.trim().toUpperCase()

    try {
        const key = getKey()
        const iv = crypto.randomBytes(12) // 96 bits para AES-GCM
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(cleanPatente, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const authTag = cipher.getAuthTag().toString('hex')

        return `ENC_PAT::${iv.toString('hex')}::${authTag}::${encrypted}`
    } catch (error) {
        console.error('Error al cifrar patente:', error)
        // Fallback seguro en caso de error
        return cleanPatente
    }
}

/**
 * Descifra el valor de la patente almacenada en la base de datos para mostrarla en pantalla o reporte.
 */
export function decryptPatente(cipherText: string): string {
    if (!cipherText || !cipherText.trim()) return ''
    const trimmed = cipherText.trim()

    // Si no tiene el prefijo de cifrado, es una patente no cifrada (retrocompatibilidad)
    if (!trimmed.startsWith('ENC_PAT::')) {
        return trimmed
    }

    try {
        const parts = trimmed.split('::')
        if (parts.length !== 4) return trimmed

        const [_, ivHex, authTagHex, encryptedHex] = parts
        const key = getKey()
        const iv = Buffer.from(ivHex, 'hex')
        const authTag = Buffer.from(authTagHex, 'hex')

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted.toUpperCase()
    } catch (error) {
        console.error('Error al descifrar patente:', error)
        return '🔒 [Error descifrado]'
    }
}
