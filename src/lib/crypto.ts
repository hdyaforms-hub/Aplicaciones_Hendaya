import crypto from 'crypto'

// Clave base para cifrado de mensajes (puede configurarse en env o usar fallback seguro)
const APP_SECRET = process.env.CHAT_ENCRYPTION_KEY || 'hendaya-e2e-super-secret-chat-key-2026-safe'
const ALGORITHM = 'aes-256-gcm'

function getKey(customKey?: string): Buffer {
    const key = customKey || APP_SECRET
    return crypto.createHash('sha256').update(key).digest()
}

/**
 * Cifra un mensaje de texto plano con AES-256-GCM.
 * Retorna el string formateado como: ENC::<iv_hex>::<authTag_hex>::<encrypted_hex>
 */
export function encryptMessage(plainText: string, customKey?: string): string {
    if (!plainText) return ''
    try {
        const key = getKey(customKey)
        const iv = crypto.randomBytes(12) // 96 bits recomendado para GCM
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
        
        let encrypted = cipher.update(plainText, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const authTag = cipher.getAuthTag().toString('hex')
        
        return `ENC::${iv.toString('hex')}::${authTag}::${encrypted}`
    } catch (e) {
        console.error('Error al cifrar mensaje:', e)
        return plainText
    }
}

/**
 * Descifra un mensaje cifrado con AES-256-GCM.
 * Si no está cifrado o falla, retorna el texto original o un fallback seguro.
 */
export function decryptMessage(cipherPayload: string, customKey?: string): string {
    if (!cipherPayload) return ''
    if (!cipherPayload.startsWith('ENC::')) {
        // Mensaje no cifrado histórico o legacy
        return cipherPayload
    }

    try {
        const parts = cipherPayload.split('::')
        if (parts.length !== 4) return cipherPayload

        const [_, ivHex, authTagHex, encryptedHex] = parts
        const key = getKey(customKey)
        const iv = Buffer.from(ivHex, 'hex')
        const authTag = Buffer.from(authTagHex, 'hex')

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
    } catch (e) {
        console.error('Error al descifrar mensaje:', e)
        return '🔒 [Mensaje cifrado no disponible]'
    }
}
