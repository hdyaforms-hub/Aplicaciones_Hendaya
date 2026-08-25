import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { rawPrisma } from '@/lib/prisma'
import { encryptMessage, decryptMessage } from '@/lib/crypto'
import { DriveItem, DriveItemVersion } from '@/types/documentos'

const DOC_ENCRYPTION_KEY = process.env.DOC_ENCRYPTION_KEY || 'hendaya-doc-super-secret-key-2026-safe'

// Interfaz para configuración interna ya descifrada
export interface ConfiguracionDecrypted {
    id: string
    authType: 'certificate' | 'secret'
    tenantId: string
    clientId: string
    clientSecret?: string
    certThumbprint?: string
    certKeyPath?: string
    certPrivateKeyPem?: string
    onedriveUserEmail: string
    rootFolderId?: string | null
    rootFolderName?: string | null
    activo: boolean
}

// Caché en memoria para el token de Graph API
interface TokenCache {
    token: string
    expiresAt: number
    tenantId: string
    clientId: string
}

let cachedToken: TokenCache | null = null

/**
 * Convierte buffer o string a formato Base64URL
 */
function base64UrlEncode(input: Buffer | string): string {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Genera una aserción JWT firmada con la llave privada del certificado X.509 (RFC 7523)
 */
function createJwtClientAssertion(
    tenantId: string,
    clientId: string,
    thumbprintHex: string,
    privateKeyPem: string
): string {
    const thumbprintBuf = Buffer.from(thumbprintHex.replace(/\s+/g, ''), 'hex')
    const x5t = base64UrlEncode(thumbprintBuf)
    const now = Math.floor(Date.now() / 1000)
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

    const header = {
        alg: 'RS256',
        typ: 'JWT',
        x5t: x5t
    }

    const payload = {
        aud: tokenEndpoint,
        iss: clientId,
        sub: clientId,
        jti: crypto.randomUUID(),
        nbf: now,
        exp: now + 300 // 5 minutos de validez
    }

    const headerEncoded = base64UrlEncode(JSON.stringify(header))
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
    const signInput = `${headerEncoded}.${payloadEncoded}`

    const signer = crypto.createSign('RSA-SHA256')
    signer.update(signInput)
    const signature = signer.sign(privateKeyPem)
    const signatureEncoded = base64UrlEncode(signature)

    return `${signInput}.${signatureEncoded}`
}

/**
 * Solicita token a Azure AD usando Certificado X.509 (JWT Client Assertion)
 */
async function fetchTokenWithCertificate(
    tenantId: string,
    clientId: string,
    thumbprintHex: string,
    privateKeyPem: string
) {
    try {
        const assertion = createJwtClientAssertion(tenantId, clientId, thumbprintHex, privateKeyPem)
        const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

        const bodyParams = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: assertion,
            scope: 'https://graph.microsoft.com/.default'
        })

        const res = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString()
        })

        const data = await res.json()
        if (!res.ok) {
            return {
                ok: false,
                error: data.error_description || data.error || 'Fallo de autenticación con certificado en Azure'
            }
        }

        return {
            ok: true,
            accessToken: data.access_token as string,
            expiresIn: (data.expires_in as number) || 3600
        }
    } catch (error: any) {
        return { ok: false, error: error?.message || 'Error de conexión con Microsoft Online.' }
    }
}

/**
 * Obtiene la configuración documental activa (prioriza variables de entorno .env.local y fallback a base de datos).
 */
export async function getDecryptedConfig(): Promise<ConfiguracionDecrypted | null> {
    try {
        // 1. Verificar si existen variables de entorno (.env.local) con Certificado
        const envTenantId = process.env.AZURE_TENANT_ID
        const envClientId = process.env.AZURE_CLIENT_ID
        const envThumbprint = process.env.AZURE_CERT_THUMBPRINT
        const envKeyPath = process.env.AZURE_CERT_KEY_PATH || 'certs/private-key.pem'
        const envUserEmail = process.env.ONEDRIVE_USER_EMAIL

        if (envTenantId && envClientId && envThumbprint && envUserEmail) {
            let privateKeyPem = ''
            const resolvedPath = path.isAbsolute(envKeyPath)
                ? envKeyPath
                : path.join(process.cwd(), envKeyPath)

            if (fs.existsSync(resolvedPath)) {
                privateKeyPem = fs.readFileSync(resolvedPath, 'utf8')
            }

            // Consultar datos opcionales de carpeta raíz en BD
            let rootFolderId: string | null = null
            let rootFolderName: string | null = null
            try {
                const dbConfig = await rawPrisma.configuracionDocumental.findFirst({
                    where: { activo: true },
                    orderBy: { creadoEn: 'desc' }
                })
                if (dbConfig) {
                    rootFolderId = dbConfig.rootFolderId
                    rootFolderName = dbConfig.rootFolderName
                }
            } catch {}

            return {
                id: 'env-certificate-config',
                authType: 'certificate',
                tenantId: envTenantId,
                clientId: envClientId,
                certThumbprint: envThumbprint,
                certKeyPath: envKeyPath,
                certPrivateKeyPem: privateKeyPem,
                onedriveUserEmail: envUserEmail,
                rootFolderId,
                rootFolderName,
                activo: true
            }
        }

        // 2. Si no hay variables de entorno con certificado, consultar base de datos
        const config = await rawPrisma.configuracionDocumental.findFirst({
            where: { activo: true },
            orderBy: { creadoEn: 'desc' }
        })

        if (!config) return null

        return {
            id: config.id,
            authType: 'secret',
            tenantId: decryptMessage(config.tenantId, DOC_ENCRYPTION_KEY),
            clientId: decryptMessage(config.clientId, DOC_ENCRYPTION_KEY),
            clientSecret: decryptMessage(config.clientSecret, DOC_ENCRYPTION_KEY),
            onedriveUserEmail: config.onedriveUserEmail,
            rootFolderId: config.rootFolderId,
            rootFolderName: config.rootFolderName,
            activo: config.activo
        }
    } catch (error) {
        console.error('Error al recuperar configuración documental descifrada:', error)
        return null
    }
}

/**
 * Guarda o actualiza la configuración documental cifrando los secretos antes de persistir.
 */
export async function saveEncryptedConfig(data: {
    tenantId: string
    clientId: string
    clientSecret?: string
    onedriveUserEmail: string
    rootFolderId?: string | null
    rootFolderName?: string | null
}): Promise<{ success: boolean; error?: string }> {
    try {
        // Obtener configuración existente para preservar secret si no fue reenviado
        const existing = await rawPrisma.configuracionDocumental.findFirst({
            orderBy: { creadoEn: 'desc' }
        })

        const secretToSave = data.clientSecret && data.clientSecret.trim() !== '' && !data.clientSecret.includes('••••')
            ? data.clientSecret.trim()
            : (existing ? decryptMessage(existing.clientSecret, DOC_ENCRYPTION_KEY) : '')

        if (!secretToSave) {
            return { success: false, error: 'El Client Secret de Azure es requerido.' }
        }

        // Validar credenciales antes de guardar solicitando un token en vivo
        const testTokenRes = await fetchTokenDirect(data.tenantId.trim(), data.clientId.trim(), secretToSave)
        if (!testTokenRes.ok) {
            return {
                success: false,
                error: `Error de autenticación con Azure: ${testTokenRes.error || 'Credenciales inválidas'}`
            }
        }

        const encryptedTenant = encryptMessage(data.tenantId.trim(), DOC_ENCRYPTION_KEY)
        const encryptedClient = encryptMessage(data.clientId.trim(), DOC_ENCRYPTION_KEY)
        const encryptedSecret = encryptMessage(secretToSave, DOC_ENCRYPTION_KEY)

        if (existing) {
            await rawPrisma.configuracionDocumental.update({
                where: { id: existing.id },
                data: {
                    tenantId: encryptedTenant,
                    clientId: encryptedClient,
                    clientSecret: encryptedSecret,
                    onedriveUserEmail: data.onedriveUserEmail.trim(),
                    rootFolderId: data.rootFolderId || null,
                    rootFolderName: data.rootFolderName || null,
                    activo: true
                }
            })
        } else {
            await rawPrisma.configuracionDocumental.create({
                data: {
                    tenantId: encryptedTenant,
                    clientId: encryptedClient,
                    clientSecret: encryptedSecret,
                    onedriveUserEmail: data.onedriveUserEmail.trim(),
                    rootFolderId: data.rootFolderId || null,
                    rootFolderName: data.rootFolderName || null,
                    activo: true
                }
            })
        }

        // Invalidar caché de token
        cachedToken = null

        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar configuración documental:', error)
        return { success: false, error: error?.message || 'Error al persistir configuración.' }
    }
}

/**
 * Función interna directa para solicitar token OAuth2 (client_credentials con secret).
 */
async function fetchTokenDirect(tenantId: string, clientId: string, clientSecret: string) {
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default'
    })

    try {
        const res = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString()
        })

        const data = await res.json()
        if (!res.ok) {
            return {
                ok: false,
                error: data.error_description || data.error || 'Fallo de autenticación en Azure'
            }
        }

        return {
            ok: true,
            accessToken: data.access_token as string,
            expiresIn: (data.expires_in as number) || 3600
        }
    } catch (error: any) {
        return { ok: false, error: error?.message || 'Error de conexión con Microsoft Online.' }
    }
}

/**
 * Obtiene o renueva el token de acceso para Microsoft Graph API.
 */
export async function getAccessToken(forceRefresh = false): Promise<{ token: string; config: ConfiguracionDecrypted }> {
    const config = await getDecryptedConfig()
    if (!config) {
        throw new Error('El Gestor Documental no está configurado o activo.')
    }

    const now = Date.now()
    if (
        !forceRefresh &&
        cachedToken &&
        cachedToken.tenantId === config.tenantId &&
        cachedToken.clientId === config.clientId &&
        cachedToken.expiresAt > now + 60000 // 60 segundos de margen
    ) {
        return { token: cachedToken.token, config }
    }

    let tokenRes: { ok: boolean; accessToken?: string; expiresIn?: number; error?: string }

    if (config.authType === 'certificate') {
        if (!config.certThumbprint || !config.certPrivateKeyPem) {
            throw new Error('Falta el certificado o la llave privada para autenticación con Azure.')
        }
        tokenRes = await fetchTokenWithCertificate(
            config.tenantId,
            config.clientId,
            config.certThumbprint,
            config.certPrivateKeyPem
        )
    } else {
        if (!config.clientSecret) {
            throw new Error('El Client Secret de Azure no está configurado.')
        }
        tokenRes = await fetchTokenDirect(config.tenantId, config.clientId, config.clientSecret)
    }

    if (!tokenRes.ok || !tokenRes.accessToken) {
        throw new Error(`Fallo al obtener token de Microsoft Graph: ${tokenRes.error}`)
    }

    cachedToken = {
        token: tokenRes.accessToken,
        expiresAt: now + ((tokenRes.expiresIn || 3600) * 1000),
        tenantId: config.tenantId,
        clientId: config.clientId
    }

    return { token: tokenRes.accessToken, config }
}

/**
 * Helper para construir headers de Graph API.
 */
async function graphFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const { token } = await getAccessToken()
    const url = endpoint.startsWith('http') ? endpoint : `https://graph.microsoft.com/v1.0${endpoint}`

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        ...(options.headers as Record<string, string> || {})
    }

    return fetch(url, {
        ...options,
        headers
    })
}

/**
 * Prueba la conexión con Microsoft OneDrive y consulta datos del usuario y cuota.
 */
export async function testConnection(): Promise<{
    connected: boolean
    userDisplayName?: string
    userPrincipalName?: string
    storageUsedGB?: number
    storageQuotaGB?: number
    rootFolderName?: string
    error?: string
}> {
    try {
        const { config } = await getAccessToken(true)
        const userEmail = encodeURIComponent(config.onedriveUserEmail)

        // Consultar drive del usuario
        const driveRes = await graphFetch(`/users/${userEmail}/drive`)
        if (!driveRes.ok) {
            const errData = await driveRes.json().catch(() => ({}))
            let errorMsg = `No se pudo acceder al OneDrive del usuario ${config.onedriveUserEmail}: ${errData.error?.message || driveRes.statusText}`
            if (driveRes.status === 403 || driveRes.status === 401) {
                errorMsg += ' (Falta conceder "Consentimiento de Administrador" para los permisos de tipo Application "Files.ReadWrite.All" y "User.Read.All" en Azure Portal).'
            }
            return {
                connected: false,
                error: errorMsg
            }
        }

        const driveData = await driveRes.json()
        const ownerName = driveData.owner?.user?.displayName || config.onedriveUserEmail
        const quota = driveData.quota || {}

        const usedBytes = quota.used || 0
        const totalBytes = quota.total || 0

        const storageUsedGB = Number((usedBytes / (1024 * 1024 * 1024)).toFixed(2))
        const storageQuotaGB = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2))

        return {
            connected: true,
            userDisplayName: ownerName,
            userPrincipalName: config.onedriveUserEmail,
            storageUsedGB,
            storageQuotaGB,
            rootFolderName: config.rootFolderName || 'Raíz de OneDrive'
        }
    } catch (error: any) {
        return {
            connected: false,
            error: error?.message || 'Error al conectar con Microsoft Graph API'
        }
    }
}

/**
 * Lista las carpetas en la raíz del OneDrive del usuario (para selector de carpeta raíz).
 */
export async function listOneDriveRootFolders(): Promise<DriveItem[]> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    const res = await graphFetch(`/users/${userEmail}/drive/root/children?$filter=folder ne null&$top=100`)
    if (!res.ok) {
        throw new Error(`Error al listar carpetas raíz de OneDrive: ${res.statusText}`)
    }

    const data = await res.json()
    return data.value || []
}

/**
 * Lista el contenido de una carpeta en OneDrive por su folderId.
 */
export async function listFolderContents(onedriveFolderId?: string | null): Promise<DriveItem[]> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    let targetId = onedriveFolderId
    if (!targetId || targetId === 'root') {
        targetId = config.rootFolderId || 'root'
    }

    const endpoint = targetId === 'root'
        ? `/users/${userEmail}/drive/root/children?$top=200&$orderby=name asc`
        : `/users/${userEmail}/drive/items/${targetId}/children?$top=200&$orderby=name asc`

    const res = await graphFetch(endpoint)
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Error al listar contenido de carpeta: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()
    return data.value || []
}

/**
 * Obtiene metadatos de un archivo específico por su OneDrive ID.
 */
export async function getFileMetadata(onedriveFileId: string): Promise<DriveItem> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    const res = await graphFetch(`/users/${userEmail}/drive/items/${onedriveFileId}`)
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Error al obtener metadatos del archivo: ${err.error?.message || res.statusText}`)
    }

    return await res.json()
}

/**
 * Obtiene el stream o buffer de descarga de un archivo con soporte de Range headers.
 */
export async function getFileStream(onedriveFileId: string, rangeHeader?: string | null) {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    const headers: Record<string, string> = {}
    if (rangeHeader) {
        headers['Range'] = rangeHeader
    }

    const res = await graphFetch(`/users/${userEmail}/drive/items/${onedriveFileId}/content`, {
        headers
    })

    if (!res.ok && res.status !== 206) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Error al descargar archivo desde OneDrive: ${err.error?.message || res.statusText}`)
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const contentLength = res.headers.get('content-length') ? Number(res.headers.get('content-length')) : undefined
    const contentRange = res.headers.get('content-range') || undefined

    return {
        response: res,
        body: res.body,
        contentType,
        contentLength,
        contentRange,
        status: res.status
    }
}

/**
 * Crea una carpeta en OneDrive.
 */
export async function createFolder(parentOnedriveId: string | null | undefined, name: string): Promise<DriveItem> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    let targetParent = parentOnedriveId
    if (!targetParent || targetParent === 'root') {
        targetParent = config.rootFolderId || 'root'
    }

    const endpoint = targetParent === 'root'
        ? `/users/${userEmail}/drive/root/children`
        : `/users/${userEmail}/drive/items/${targetParent}/children`

    const res = await graphFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename'
        })
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Error al crear carpeta en OneDrive: ${err.error?.message || res.statusText}`)
    }

    return await res.json()
}

/**
 * Sube un archivo a OneDrive (soporta archivos de hasta 50MB mediante simple upload o upload session).
 */
export async function uploadFile(
    parentOnedriveId: string | null | undefined,
    filename: string,
    buffer: Buffer,
    mimeType: string
): Promise<DriveItem> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    let targetParent = parentOnedriveId
    if (!targetParent || targetParent === 'root') {
        targetParent = config.rootFolderId || 'root'
    }

    // Para archivos <= 4MB: simple upload PUT
    if (buffer.length <= 4 * 1024 * 1024) {
        const endpoint = targetParent === 'root'
            ? `/users/${userEmail}/drive/root:/${encodeURIComponent(filename)}:/content`
            : `/users/${userEmail}/drive/items/${targetParent}:/${encodeURIComponent(filename)}:/content`

        const res = await graphFetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': mimeType || 'application/octet-stream'
            },
            body: new Uint8Array(buffer) as any
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(`Error al subir archivo a OneDrive: ${err.error?.message || res.statusText}`)
        }

        return await res.json()
    } else {
        // Para archivos > 4MB: crear sesión de subida por fragmentos
        const createSessionEndpoint = targetParent === 'root'
            ? `/users/${userEmail}/drive/root:/${encodeURIComponent(filename)}:/createUploadSession`
            : `/users/${userEmail}/drive/items/${targetParent}:/${encodeURIComponent(filename)}:/createUploadSession`

        const sessionRes = await graphFetch(createSessionEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                item: {
                    '@microsoft.graph.conflictBehavior': 'rename'
                }
            })
        })

        if (!sessionRes.ok) {
            const err = await sessionRes.json().catch(() => ({}))
            throw new Error(`Error al iniciar sesión de carga en OneDrive: ${err.error?.message || sessionRes.statusText}`)
        }

        const sessionData = await sessionRes.json()
        const uploadUrl = sessionData.uploadUrl

        // Subir en chunks de 5MB
        const chunkSize = 5 * 1024 * 1024
        let start = 0
        let lastResult: any = null

        while (start < buffer.length) {
            const end = Math.min(start + chunkSize, buffer.length)
            const chunk = buffer.subarray(start, end)

            const chunkRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Range': `bytes ${start}-${end - 1}/${buffer.length}`,
                    'Content-Length': `${chunk.length}`
                },
                body: new Uint8Array(chunk) as any
            })

            if (!chunkRes.ok && chunkRes.status !== 201 && chunkRes.status !== 200) {
                const chunkErr = await chunkRes.json().catch(() => ({}))
                throw new Error(`Error subiendo fragmento de archivo: ${chunkErr.error?.message || chunkRes.statusText}`)
            }

            lastResult = await chunkRes.json()
            start = end
        }

        return lastResult
    }
}

/**
 * Busca archivos en OneDrive por término de búsqueda.
 */
export async function searchFiles(query: string, folderId?: string | null): Promise<DriveItem[]> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    let endpoint = `/users/${userEmail}/drive/root/search(q='${encodeURIComponent(query)}')`
    if (folderId && folderId !== 'root') {
        endpoint = `/users/${userEmail}/drive/items/${folderId}/search(q='${encodeURIComponent(query)}')`
    }

    const res = await graphFetch(endpoint)
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Error en búsqueda de OneDrive: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()
    return data.value || []
}

/**
 * Elimina un archivo o carpeta en OneDrive.
 */
export async function deleteItem(itemId: string): Promise<boolean> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    const res = await graphFetch(`/users/${userEmail}/drive/items/${itemId}`, {
        method: 'DELETE'
    })

    if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Error al eliminar elemento de OneDrive: ${err.error?.message || res.statusText}`)
    }

    return true
}

/**
 * Obtiene el historial de versiones de un archivo en OneDrive.
 */
export async function getVersionHistory(fileId: string): Promise<DriveItemVersion[]> {
    const { config } = await getAccessToken()
    const userEmail = encodeURIComponent(config.onedriveUserEmail)

    const res = await graphFetch(`/users/${userEmail}/drive/items/${fileId}/versions`)
    if (!res.ok) {
        return []
    }

    const data = await res.json()
    return (data.value || []).map((v: any) => ({
        id: v.id,
        lastModifiedDateTime: v.lastModifiedDateTime,
        size: v.size,
        lastModifiedBy: v.lastModifiedBy
    }))
}
