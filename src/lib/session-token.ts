import { SignJWT, jwtVerify } from 'jose'

const secretKey = process.env.SESSION_SECRET || 'super-secret-key-change-me'
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
    console.log(`Encrypting payload...`)
    const res = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1 day from now')
        .sign(key)
    console.log(`Payload encrypted.`)
    return res
}

export async function decrypt(input: string): Promise<any> {
    console.log(`Decrypting token...`)
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        })
        console.log(`Token decrypted.`)
        return payload
    } catch (error) {
        console.log(`Token decryption failed.`)
        return null
    }
}
