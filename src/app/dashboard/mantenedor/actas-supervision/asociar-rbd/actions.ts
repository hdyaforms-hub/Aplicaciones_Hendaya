'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { logAuditAction } from '@/lib/audit'

export async function updateUserRbds(userId: string, rbds: number[]) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_user_rbds') && !permissions.includes('manage_actas_supervision')) {
            return { success: false, error: 'No tienes permisos para realizar esta acción' }
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, username: true }
        })

        if (!user) {
            return { success: false, error: 'Usuario no encontrado' }
        }

        await prisma.user.update({
            where: { id: userId },
            data: { rbds }
        })

        await logAuditAction({
            username: session?.user?.username || 'desconocido',
            userId: session?.user?.id || null,
            action: 'ASOCIAR_RBD_USUARIO',
            modulo: 'Actas de Supervisión',
            detalle: `Asociados RBDs (${rbds.join(', ')}) al usuario ${user.name || user.username}`
        })

        revalidatePath('/dashboard/mantenedor/actas-supervision/asociar-rbd')
        return { success: true }
    } catch (error: any) {
        console.error('Error al actualizar RBDs de usuario:', error)
        return { success: false, error: error.message || 'Error interno del servidor' }
    }
}

export async function copyRbdsFromSupervisores() {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_user_rbds') && !permissions.includes('manage_actas_supervision')) {
            return { success: false, error: 'No tienes permisos para realizar esta acción' }
        }

        // Obtener todos los supervisores con sus RBDs a auditar
        const supervisores = await prisma.supervisor.findMany({
            where: { vigente: true },
            include: { rbdsAuditar: true }
        })

        // Obtener todos los usuarios activos
        const users = await prisma.user.findMany({
            where: { isDeleted: false, isActive: true }
        })

        let matchedCount = 0

        for (const user of users) {
            // Intentar buscar coincidencia con supervisor por correo
            let supervisorMatch = supervisores.find(s => 
                s.correo && user.email && s.correo.trim().toLowerCase() === user.email.trim().toLowerCase()
            )

            // Si no coincide por correo, intentar por nombre
            if (!supervisorMatch && user.name) {
                supervisorMatch = supervisores.find(s => {
                    const supervisorFullName = `${s.nombre} ${s.apellido}`.trim().toLowerCase()
                    const userFullName = user.name!.trim().toLowerCase()
                    return supervisorFullName === userFullName
                })
            }

            if (supervisorMatch && supervisorMatch.rbdsAuditar.length > 0) {
                const supervisorRbds = supervisorMatch.rbdsAuditar.map(r => r.rbd)
                
                // Actualizar los RBDs del usuario
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        rbds: Array.from(new Set([...user.rbds, ...supervisorRbds]))
                    }
                })
                matchedCount++
            }
        }

        await logAuditAction({
            username: session?.user?.username || 'desconocido',
            userId: session?.user?.id || null,
            action: 'COPIAR_RBD_SUPERVISORES',
            modulo: 'Actas de Supervisión',
            detalle: `Sincronizados RBDs desde supervisores para ${matchedCount} usuarios`
        })

        revalidatePath('/dashboard/mantenedor/actas-supervision/asociar-rbd')
        return { success: true, matchedCount }
    } catch (error: any) {
        console.error('Error al copiar RBDs desde supervisores:', error)
        return { success: false, error: error.message || 'Error interno del servidor' }
    }
}
