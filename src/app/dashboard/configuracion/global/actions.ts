'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export async function updateGlobalConfigAction(formData: FormData) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado' }
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('manage_global_config')) {
        return { error: 'No tienes permisos para modificar la configuración global' }
    }

    const sessionTimeoutMinRaw = formData.get('sessionTimeoutMin')
    const sessionTimeoutMin = parseInt(String(sessionTimeoutMinRaw), 10)

    if (isNaN(sessionTimeoutMin) || sessionTimeoutMin < 1 || sessionTimeoutMin > 1440) {
        return { error: 'El tiempo de duración de la sesión debe ser un número entero entre 1 y 1440 minutos (hasta 24 horas).' }
    }

    try {
        const client = (rawPrisma as any).configuracionGlobal
        if (!client) {
            return { error: 'El modelo de configuración no está inicializado. Por favor recarga el servidor.' }
        }

        const updated = await client.upsert({
            where: { id: 'global' },
            create: {
                id: 'global',
                sessionTimeoutMin,
                updatedBy: session.user.username || session.user.name || 'Admin',
            },
            update: {
                sessionTimeoutMin,
                updatedBy: session.user.username || session.user.name || 'Admin',
            }
        })

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ACTUALIZAR_CONFIG_GLOBAL',
            modulo: 'Configuración',
            detalle: `Actualizó el tiempo de duración de la sesión a ${sessionTimeoutMin} minutos`,
        })

        revalidatePath('/dashboard/configuracion/global')
        revalidatePath('/dashboard', 'layout')

        return { success: true, config: updated }
    } catch (error: any) {
        console.error('Error al guardar configuración global:', error)
        return { error: 'Error interno al guardar la configuración en la base de datos' }
    }
}
