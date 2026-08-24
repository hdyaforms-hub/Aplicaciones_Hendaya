'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { decryptMessage } from '@/lib/crypto'

export interface CollabNotificationItem {
    id: string
    type: 'MESSAGE' | 'TASK' | 'APPOINTMENT' | 'PROJECT'
    title: string
    summary: string
    detail?: string
    senderName?: string
    senderUsername?: string
    date: string
    url: string
    isRead?: boolean
    meta?: any
}

export async function getUserCollabNotifications(): Promise<{
    notifications: CollabNotificationItem[]
    unreadCount: number
}> {
    try {
        const session = await getSession()
        if (!session?.user?.username) {
            return { notifications: [], unreadCount: 0 }
        }

        const username = session.user.username
        const notifications: CollabNotificationItem[] = []

        // 1. Mensajes no leídos en conversaciones
        const allConversations = await rawPrisma.collabConversation.findMany({
            where: {
                participants: { contains: username }
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        })

        for (const conv of allConversations) {
            let participants: string[] = []
            try { participants = JSON.parse(conv.participants) } catch {}
            if (!participants.includes(username)) continue

            for (const msg of conv.messages) {
                if (msg.senderUsername === username) continue

                let readBy: string[] = []
                try {
                    if (msg.readBy) readBy = JSON.parse(msg.readBy)
                } catch {}

                const isUnread = !readBy.includes(username)
                if (isUnread) {
                    const decrypted = decryptMessage(msg.content)
                    notifications.push({
                        id: `msg-${msg.id}`,
                        type: 'MESSAGE',
                        title: conv.title ? `Mensaje en ${conv.title}` : `Mensaje de ${msg.senderName || msg.senderUsername}`,
                        summary: decrypted.slice(0, 100) + (decrypted.length > 100 ? '...' : ''),
                        detail: decrypted,
                        senderName: msg.senderName || msg.senderUsername,
                        senderUsername: msg.senderUsername,
                        date: msg.createdAt.toISOString(),
                        url: '/dashboard/ayuda/conversacion',
                        isRead: false,
                        meta: { conversationId: conv.id }
                    })
                }
            }
        }

        // 2. Tareas asignadas al usuario que no estén completadas
        const myTasks = await rawPrisma.collabTask.findMany({
            where: {
                assignedTo: username,
                status: { not: 'COMPLETADA' }
            },
            include: {
                project: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        })

        for (const task of myTasks) {
            notifications.push({
                id: `task-${task.id}`,
                type: 'TASK',
                title: `Tarea Asignada: ${task.title}`,
                summary: task.description ? task.description.slice(0, 90) : `Prioridad ${task.priority} • Estado ${task.status}`,
                detail: task.description || 'Sin descripción detallada.',
                senderUsername: task.createdBy,
                date: task.createdAt.toISOString(),
                url: '/dashboard/ayuda/conversacion',
                isRead: true, // Las tareas se listan como referencia
                meta: { taskId: task.id, priority: task.priority, dueDate: task.dueDate?.toISOString() }
            })
        }

        // 3. Citas programadas próximas
        const now = new Date()
        const myAppointments = await rawPrisma.collabAppointment.findMany({
            where: {
                participants: { contains: username },
                startDate: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // Desde hace 24h en adelante
            },
            orderBy: { startDate: 'asc' },
            take: 5
        })

        for (const app of myAppointments) {
            let participants: string[] = []
            try { participants = JSON.parse(app.participants) } catch {}
            if (!participants.includes(username)) continue

            notifications.push({
                id: `app-${app.id}`,
                type: 'APPOINTMENT',
                title: `Cita Programada: ${app.title}`,
                summary: `Fecha: ${new Date(app.startDate).toLocaleDateString('es-CL')} a las ${new Date(app.startDate).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
                detail: app.description || (app.location ? `Ubicación: ${app.location}` : 'Reunión colaborativa'),
                senderUsername: app.createdBy,
                date: app.startDate.toISOString(),
                url: '/dashboard/ayuda/conversacion',
                isRead: true,
                meta: { meetLink: app.meetLink, location: app.location }
            })
        }

        // Ordenar por fecha descendente
        notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        const unreadCount = notifications.filter(n => !n.isRead).length

        return {
            notifications,
            unreadCount
        }
    } catch (e: any) {
        console.error('Error al obtener notificaciones:', e)
        return { notifications: [], unreadCount: 0 }
    }
}

export async function markNotificationAsRead(messageIdWithPrefix: string) {
    try {
        const session = await getSession()
        if (!session?.user?.username) return { success: false }

        const username = session.user.username
        if (messageIdWithPrefix.startsWith('msg-')) {
            const rawId = messageIdWithPrefix.replace('msg-', '')
            const msg = await rawPrisma.collabMessage.findUnique({
                where: { id: rawId }
            })
            if (msg) {
                let readBy: string[] = []
                try { if (msg.readBy) readBy = JSON.parse(msg.readBy) } catch {}
                if (!readBy.includes(username)) {
                    readBy.push(username)
                    await rawPrisma.collabMessage.update({
                        where: { id: rawId },
                        data: { readBy: JSON.stringify(readBy) }
                    })
                }
            }
        }
        return { success: true }
    } catch (e) {
        return { success: false }
    }
}
