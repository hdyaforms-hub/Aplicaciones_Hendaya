import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { testConnection, listOneDriveRootFolders } from '@/lib/graph-client'

export async function POST() {
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

        const testResult = await testConnection()

        if (!testResult.connected) {
            return NextResponse.json({
                connected: false,
                message: testResult.error || 'Error al conectar con OneDrive'
            }, { status: 400 })
        }

        // Obtener carpetas disponibles en OneDrive para selector
        let rootFolders: any[] = []
        try {
            rootFolders = await listOneDriveRootFolders()
        } catch {}

        return NextResponse.json({
            connected: true,
            userDisplayName: testResult.userDisplayName,
            userPrincipalName: testResult.userPrincipalName,
            storageUsedGB: testResult.storageUsedGB,
            storageQuotaGB: testResult.storageQuotaGB,
            rootFolderName: testResult.rootFolderName,
            availableRootFolders: rootFolders.map((f: any) => ({
                id: f.id,
                name: f.name
            }))
        })
    } catch (error: any) {
        console.error('Error al probar conexión con OneDrive:', error?.message)
        return NextResponse.json({
            connected: false,
            message: error?.message || 'Error de conexión'
        }, { status: 500 })
    }
}
