import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { getDecryptedConfig, saveEncryptedConfig } from '@/lib/graph-client'
import { logAuditAction } from '@/lib/audit'
import { ConfiguracionDocumentalUI } from '@/types/documentos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_configuracion')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const hasCertFile = (() => {
            try {
                const p = process.env.AZURE_CERT_KEY_PATH || 'certs/private-key.pem'
                const resolved = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
                return fs.existsSync(resolved)
            } catch {
                return false
            }
        })()

        const envDiagnostics = {
            hasTenantId: !!process.env.AZURE_TENANT_ID,
            hasClientId: !!process.env.AZURE_CLIENT_ID,
            hasThumbprint: !!process.env.AZURE_CERT_THUMBPRINT,
            hasPrivateKey: !!(process.env.AZURE_CERT_PRIVATE_KEY || process.env.AZURE_CERT_PRIVATE_KEY_BASE64 || hasCertFile),
            hasUserEmail: !!process.env.ONEDRIVE_USER_EMAIL
        }

        const config = await getDecryptedConfig()

        if (!config) {
            const emptyUI: ConfiguracionDocumentalUI = {
                configurado: false,
                conectado: false,
                authType: 'certificate',
                tieneSecret: false,
                onedriveUserEmail: process.env.ONEDRIVE_USER_EMAIL,
                envDiagnostics
            }
            return NextResponse.json({ config: emptyUI })
        }

        const uiConfig: ConfiguracionDocumentalUI = {
            configurado: true,
            conectado: false,
            authType: config.authType,
            clientIdPreview: config.clientId ? `${config.clientId.slice(0, 8)}••••••••` : undefined,
            tenantIdPreview: config.tenantId ? `${config.tenantId.slice(0, 8)}••••••••` : undefined,
            certThumbprintPreview: config.certThumbprint ? `${config.certThumbprint.slice(0, 8)}••••••••${config.certThumbprint.slice(-6)}` : undefined,
            certKeyPath: config.certKeyPath,
            tieneCertificado: !!(config.certThumbprint && config.certPrivateKeyPem),
            tieneSecret: !!config.clientSecret,
            onedriveUserEmail: config.onedriveUserEmail,
            rootFolderId: config.rootFolderId,
            rootFolderName: config.rootFolderName,
            activo: config.activo,
            envDiagnostics
        }

        return NextResponse.json({ config: uiConfig })
    } catch (error: any) {
        console.error('Error al obtener configuración documental:', error?.message)
        return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_configuracion')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const body = await request.json()
        const { tenantId, clientId, clientSecret, onedriveUserEmail, rootFolderId, rootFolderName } = body

        if (!tenantId || !clientId || !onedriveUserEmail) {
            return NextResponse.json({ message: 'Todos los campos obligatorios deben ser completados' }, { status: 400 })
        }

        const saveRes = await saveEncryptedConfig({
            tenantId,
            clientId,
            clientSecret,
            onedriveUserEmail,
            rootFolderId,
            rootFolderName
        })

        if (!saveRes.success) {
            return NextResponse.json({ message: saveRes.error || 'Error al validar credenciales de Azure' }, { status: 400 })
        }

        // Registrar auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'CONFIGURACION_ONEDRIVE_ACTUALIZADA',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Actualizó la configuración de Microsoft OneDrive para el correo ${onedriveUserEmail}`
        })

        return NextResponse.json({ success: true, message: 'Configuración guardada y validada exitosamente' })
    } catch (error: any) {
        console.error('Error al guardar configuración documental:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al guardar configuración' }, { status: 500 })
    }
}
