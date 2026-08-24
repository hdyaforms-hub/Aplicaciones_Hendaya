'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { encryptMessage, decryptMessage } from '@/lib/crypto'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { registerMentions } from './mentionUtils'
import { logProjectActivity } from './activityLogger'
import { syncGanttSchedule } from './taskSyncService'

// Helper de sesión
async function getAuthUser() {
    const session = await getSession()
    if (!session?.user?.username) return null
    return {
        id: session.user.id,
        username: session.user.username,
        name: session.user.name || session.user.username,
        role: session.user.role?.name || 'Usuario'
    }
}

// ==========================================
// 1. CHAT & CONVERSACIONES (CIFRADAS)
// ==========================================

export async function getConversationsAndUsers() {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        // Obtener todos los usuarios activos habilitados para recibir información en Conversación
        const allUsers = await rawPrisma.user.findMany({
            where: {
                isDeleted: false,
                isActive: true,
                OR: [
                    { canReceiveCollab: true },
                    { username: user.username } // El usuario actual siempre está disponible
                ]
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: { select: { name: true } },
                sucursales: { select: { nombre: true } }
            },
            orderBy: { name: 'asc' }
        })

        // Obtener todas las conversaciones
        const allConversations = await rawPrisma.collabConversation.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        // Filtrar conversaciones donde participa el usuario actual y calcular mensajes no leídos
        const myConversations = await Promise.all(
            allConversations
                .filter(c => {
                    try {
                        const parts: string[] = JSON.parse(c.participants)
                        return parts.includes(user.username)
                    } catch {
                        return false
                    }
                })
                .map(async c => {
                    let lastMessageDecrypted = ''
                    if (c.lastMessage) {
                        lastMessageDecrypted = decryptMessage(c.lastMessage)
                    }
                    let participantsList: string[] = []
                    try {
                        participantsList = JSON.parse(c.participants)
                    } catch {}

                    // Contar mensajes no leídos por este usuario
                    let unreadCount = 0
                    try {
                        unreadCount = await rawPrisma.collabMessage.count({
                            where: {
                                conversationId: c.id,
                                senderUsername: { not: user.username },
                                NOT: {
                                    readBy: { contains: `"${user.username}"` }
                                }
                            }
                        })
                    } catch {}

                    return {
                        id: c.id,
                        type: c.type,
                        title: c.title,
                        projectId: c.projectId,
                        participants: participantsList,
                        lastMessage: lastMessageDecrypted,
                        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : c.createdAt.toISOString(),
                        isEncrypted: c.isEncrypted,
                        unreadCount,
                        createdAt: c.createdAt.toISOString(),
                        updatedAt: c.updatedAt.toISOString()
                    }
                })
        )

        return {
            currentUser: user,
            users: allUsers.map(u => ({
                id: u.id,
                username: u.username,
                name: u.name || u.username,
                email: u.email,
                role: u.role?.name || 'Usuario',
                sucursales: u.sucursales.map(s => s.nombre)
            })),
            conversations: myConversations
        }
    } catch (e: any) {
        console.error('Error al cargar conversaciones y usuarios:', e)
        return { error: 'Error al obtener datos de conversaciones.' }
    }
}

export async function getConversationMessages(conversationId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const conversation = await rawPrisma.collabConversation.findUnique({
            where: { id: conversationId }
        })
        if (!conversation) return { error: 'Conversación no encontrada' }

        const participants: string[] = JSON.parse(conversation.participants || '[]')
        if (!participants.includes(user.username)) {
            return { error: 'No perteneces a esta conversación' }
        }

        // Marcar mensajes no leídos de esta conversación como leídos por el usuario actual
        try {
            const unreadMsgs = await rawPrisma.collabMessage.findMany({
                where: {
                    conversationId,
                    senderUsername: { not: user.username },
                    NOT: { readBy: { contains: `"${user.username}"` } }
                },
                select: { id: true, readBy: true }
            })

            for (const msg of unreadMsgs) {
                let readers: string[] = []
                try { readers = JSON.parse(msg.readBy || '[]') } catch {}
                if (!readers.includes(user.username)) {
                    readers.push(user.username)
                    await rawPrisma.collabMessage.update({
                        where: { id: msg.id },
                        data: { readBy: JSON.stringify(readers) }
                    })
                }
            }
        } catch (readErr) {
            console.error('Error al marcar leídos:', readErr)
        }

        const messages = await (rawPrisma as any).collabMessage.findMany({
            where: { conversationId },
            include: {
                reactions: true,
                polls: {
                    include: { votes: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        })

        // Descifrar contenido para la vista del cliente
        const decryptedMessages = messages.map((m: any) => {
            let parsedAttachments: string[] = []
            if (m.attachments) {
                try {
                    parsedAttachments = JSON.parse(m.attachments)
                } catch {
                    parsedAttachments = [m.attachments]
                }
            }

            return {
                id: m.id,
                conversationId: m.conversationId,
                senderUsername: m.senderUsername,
                senderName: m.senderName,
                content: decryptMessage(m.content),
                isEncrypted: m.isEncrypted,
                isDecision: m.isDecision || false,
                decisionSummary: m.decisionSummary || null,
                attachments: parsedAttachments,
                reactions: m.reactions || [],
                polls: m.polls?.map((p: any) => ({
                    id: p.id,
                    question: p.question,
                    options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
                    allowMultiple: p.allowMultiple,
                    isAnonymous: p.isAnonymous,
                    expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
                    createdBy: p.createdBy,
                    votes: p.votes || []
                })) || [],
                createdAt: m.createdAt.toISOString(),
                isMine: m.senderUsername === user.username
            }
        })

        return { messages: decryptedMessages }
    } catch (e: any) {
        console.error('Error al obtener mensajes:', e)
        return { error: 'Error al obtener mensajes.' }
    }
}

export async function sendChatMessage(data: {
    conversationId: string
    content: string
    attachments?: string[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.content.trim() && (!data.attachments || data.attachments.length === 0)) {
        return { error: 'El mensaje no puede estar vacío.' }
    }

    try {
        const conversation = await rawPrisma.collabConversation.findUnique({
            where: { id: data.conversationId }
        })
        if (!conversation) return { error: 'Conversación no encontrada' }

        const encryptedContent = encryptMessage(data.content.trim())
        const encryptedSnippet = encryptMessage(data.content.trim().slice(0, 80))

        const message = await rawPrisma.collabMessage.create({
            data: {
                conversationId: data.conversationId,
                senderUsername: user.username,
                senderName: user.name,
                content: encryptedContent,
                isEncrypted: true,
                attachments: data.attachments && data.attachments.length > 0 ? JSON.stringify(data.attachments) : null,
                readBy: JSON.stringify([user.username])
            }
        })

        await rawPrisma.collabConversation.update({
            where: { id: data.conversationId },
            data: {
                lastMessage: encryptedSnippet,
                lastMessageAt: new Date()
            }
        })

        // Registrar menciones @usuario
        await registerMentions({
            sourceType: 'chat',
            sourceId: message.id,
            projectId: conversation.projectId,
            text: data.content.trim(),
            authorUsername: user.username,
            authorName: user.name
        })

        // Registrar actividad en el Timeline si está enlazado a un proyecto
        if (conversation.projectId) {
            await logProjectActivity({
                projectId: conversation.projectId,
                type: 'CHAT',
                title: `Mensaje de @${user.username}`,
                description: data.content.trim().slice(0, 120),
                username: user.username,
                userFullName: user.name
            })
        }

        return {
            success: true,
            message: {
                id: message.id,
                conversationId: message.conversationId,
                senderUsername: message.senderUsername,
                senderName: message.senderName,
                content: data.content.trim(),
                isEncrypted: true,
                isDecision: false,
                decisionSummary: null,
                attachments: data.attachments || [],
                reactions: [],
                polls: [],
                createdAt: message.createdAt.toISOString(),
                isMine: true
            }
        }
    } catch (e: any) {
        console.error('Error al enviar mensaje:', e)
        return { error: 'Error al enviar mensaje.' }
    }
}

export async function createOrGetDirectConversation(targetUsername: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (user.username === targetUsername) {
        return { error: 'No puedes crear un chat contigo mismo.' }
    }

    try {
        // Buscar conversación directa existente
        const conversations = await rawPrisma.collabConversation.findMany({
            where: { type: 'direct' }
        })

        const existing = conversations.find(c => {
            try {
                const parts: string[] = JSON.parse(c.participants)
                return parts.length === 2 && parts.includes(user.username) && parts.includes(targetUsername)
            } catch {
                return false
            }
        })

        if (existing) {
            return {
                conversation: {
                    id: existing.id,
                    type: existing.type,
                    title: existing.title,
                    participants: JSON.parse(existing.participants),
                    lastMessage: existing.lastMessage ? decryptMessage(existing.lastMessage) : '',
                    lastMessageAt: existing.lastMessageAt ? existing.lastMessageAt.toISOString() : existing.createdAt.toISOString()
                }
            }
        }

        // Crear nueva conversación directa
        const newConv = await rawPrisma.collabConversation.create({
            data: {
                type: 'direct',
                participants: JSON.stringify([user.username, targetUsername]),
                isEncrypted: true
            }
        })

        return {
            conversation: {
                id: newConv.id,
                type: newConv.type,
                title: newConv.title,
                participants: [user.username, targetUsername],
                lastMessage: '',
                lastMessageAt: newConv.createdAt.toISOString()
            }
        }
    } catch (e: any) {
        console.error('Error al obtener o crear chat directo:', e)
        return { error: 'Error al iniciar chat directo.' }
    }
}

export async function createGroupConversation(data: {
    title: string
    participants: string[]
    projectId?: string
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    const members = Array.from(new Set([user.username, ...data.participants]))

    try {
        const newConv = await rawPrisma.collabConversation.create({
            data: {
                type: data.projectId ? 'project' : 'group',
                title: data.title.trim(),
                projectId: data.projectId || null,
                participants: JSON.stringify(members),
                isEncrypted: true
            }
        })

        return {
            success: true,
            conversation: {
                id: newConv.id,
                type: newConv.type,
                title: newConv.title,
                projectId: newConv.projectId,
                participants: members,
                lastMessage: '',
                lastMessageAt: newConv.createdAt.toISOString()
            }
        }
    } catch (e: any) {
        console.error('Error al crear grupo de conversación:', e)
        return { error: 'Error al crear grupo.' }
    }
}

export async function updateGroupConversation(data: {
    conversationId: string
    title: string
    participants: string[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El nombre del grupo es requerido.' }

    const members = Array.from(new Set([user.username, ...data.participants]))

    try {
        const existing = await rawPrisma.collabConversation.findUnique({
            where: { id: data.conversationId }
        })
        if (!existing) return { error: 'Conversación no encontrada.' }

        const updated = await rawPrisma.collabConversation.update({
            where: { id: data.conversationId },
            data: {
                title: data.title.trim(),
                participants: JSON.stringify(members)
            }
        })

        // Mensaje de sistema informativo
        try {
            await rawPrisma.collabMessage.create({
                data: {
                    conversationId: data.conversationId,
                    senderUsername: 'sistema',
                    senderName: 'Sistema Hendaya',
                    content: encryptMessage(`ℹ️ @${user.username} actualizó el grupo: "${data.title.trim()}" (${members.length} integrantes).`),
                    isEncrypted: true
                }
            })
        } catch {}

        return {
            success: true,
            conversation: {
                id: updated.id,
                type: updated.type,
                title: updated.title,
                projectId: updated.projectId,
                participants: members,
                updatedAt: updated.updatedAt.toISOString()
            }
        }
    } catch (e: any) {
        console.error('Error al actualizar grupo de conversación:', e)
        return { error: 'Error al actualizar grupo.' }
    }
}

export async function deleteGroupConversation(conversationId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabConversation.delete({
            where: { id: conversationId }
        })
        return { success: true }
    } catch (e: any) {
        console.error('Error al eliminar conversación grupal:', e)
        return { error: 'Error al eliminar la conversación.' }
    }
}

// ==========================================
// 2. GESTIÓN DE TAREAS ESTILO TRELLO (KANBAN)
// ==========================================

export async function getTasksData(projectId?: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const where: any = {}
        if (projectId) where.projectId = projectId

        const tasksDb = await rawPrisma.collabTask.findMany({
            where,
            include: {
                project: { select: { id: true, title: true, color: true } }
            },
            orderBy: [{ columnOrder: 'asc' }, { createdAt: 'desc' }]
        })

        const parsedTasks = tasksDb.map(t => {
            let tags: string[] = []
            let checklists: any[] = []
            try { if (t.tags) tags = JSON.parse(t.tags) } catch {}
            try { if (t.checklists) checklists = JSON.parse(t.checklists) } catch {}

            return {
                id: t.id,
                projectId: t.projectId,
                projectTitle: t.project?.title || null,
                projectColor: t.project?.color || 'cyan',
                sourceMessageId: (t as any).sourceMessageId || null,
                title: t.title,
                description: t.description,
                status: t.status as 'PENDIENTE' | 'EN_PROGRESO' | 'REVISION' | 'COMPLETADA',
                priority: t.priority as 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE',
                columnOrder: t.columnOrder,
                dueDate: t.dueDate ? t.dueDate.toISOString() : null,
                assignedTo: t.assignedTo,
                tags,
                checklists,
                createdBy: t.createdBy,
                createdAt: t.createdAt.toISOString(),
                updatedAt: t.updatedAt.toISOString()
            }
        })

        return { tasks: parsedTasks }
    } catch (e: any) {
        console.error('Error al obtener tareas:', e)
        return { error: 'Error al obtener tareas.' }
    }
}

export async function createCollabTask(data: {
    title: string
    description?: string
    status?: string
    priority?: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
    dueDate?: string | null
    assignedTo?: string | null
    projectId?: string | null
    sourceMessageId?: string | null
    tags?: string[]
    checklists?: { id: string; text: string; done: boolean }[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El título de la tarea es obligatorio.' }

    try {
        const task = await rawPrisma.collabTask.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                sourceMessageId: data.sourceMessageId || null,
                status: data.status || 'PENDIENTE',
                priority: data.priority || 'MEDIA',
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
                assignedTo: data.assignedTo || null,
                projectId: data.projectId || null,
                tags: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : null,
                checklists: data.checklists && data.checklists.length > 0 ? JSON.stringify(data.checklists) : null,
                createdBy: user.username
            },
            include: {
                project: { select: { id: true, title: true, color: true } }
            }
        })

        await logAuditAction({
            username: user.username,
            userId: user.id,
            modulo: 'Ayuda - Conversación',
            action: 'CREATE_TASK',
            detalle: `Creó la tarea "${data.title}" asignada a ${data.assignedTo || 'nadie'}.`
        })

        return { success: true, task }
    } catch (e: any) {
        console.error('Error al crear tarea:', e)
        return { error: 'Error al guardar la tarea.' }
    }
}

export async function updateCollabTaskStatus(taskId: string, newStatus: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const task = await rawPrisma.collabTask.update({
            where: { id: taskId },
            data: { status: newStatus }
        })
        return { success: true, task }
    } catch (e: any) {
        return { error: 'Error al cambiar estado de la tarea.' }
    }
}

export async function updateCollabTask(taskId: string, data: any) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const updatePayload: any = {
            title: data.title?.trim(),
            description: data.description?.trim() || null,
            status: data.status,
            priority: data.priority,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            assignedTo: data.assignedTo || null,
            projectId: data.projectId || null,
            tags: data.tags ? JSON.stringify(data.tags) : null,
            checklists: data.checklists ? JSON.stringify(data.checklists) : null
        }

        const task = await rawPrisma.collabTask.update({
            where: { id: taskId },
            data: updatePayload
        })

        return { success: true, task }
    } catch (e: any) {
        return { error: 'Error al actualizar la tarea.' }
    }
}

export async function deleteCollabTask(taskId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabTask.delete({
            where: { id: taskId }
        })
        return { success: true }
    } catch (e: any) {
        return { error: 'Error al eliminar tarea.' }
    }
}

// ==========================================
// 3. CITAS & CALENDARIO
// ==========================================

export async function getAppointmentsData(projectId?: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const where: any = {}
        if (projectId) where.projectId = projectId

        const listDb = await rawPrisma.collabAppointment.findMany({
            where,
            include: {
                project: { select: { id: true, title: true, color: true } }
            },
            orderBy: { startDate: 'asc' }
        })

        const appointments = listDb.map(a => {
            let participants: string[] = []
            try { if (a.participants) participants = JSON.parse(a.participants) } catch {}

            return {
                id: a.id,
                projectId: a.projectId,
                projectTitle: a.project?.title || null,
                projectColor: a.project?.color || 'cyan',
                sourceNoteId: (a as any).sourceNoteId || null,
                title: a.title,
                description: a.description,
                startDate: a.startDate.toISOString(),
                endDate: a.endDate.toISOString(),
                location: a.location,
                meetLink: a.meetLink,
                participants,
                status: a.status,
                createdBy: a.createdBy,
                isMine: a.createdBy === user.username || participants.includes(user.username)
            }
        })

        return { appointments }
    } catch (e: any) {
        console.error('Error al obtener citas:', e)
        return { error: 'Error al cargar eventos del calendario.' }
    }
}

export async function createCollabAppointment(data: {
    title: string
    description?: string
    startDate: string
    endDate: string
    location?: string
    meetLink?: string
    participants: string[]
    projectId?: string | null
    sourceNoteId?: string | null
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El título de la cita es obligatorio.' }
    if (!data.startDate || !data.endDate) return { error: 'Las fechas de inicio y término son requeridas.' }

    const participants = Array.from(new Set([user.username, ...data.participants]))

    try {
        const app = await rawPrisma.collabAppointment.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                sourceNoteId: data.sourceNoteId || null,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                location: data.location?.trim() || null,
                meetLink: data.meetLink?.trim() || null,
                participants: JSON.stringify(participants),
                projectId: data.projectId || null,
                status: 'PROGRAMADA',
                createdBy: user.username
            }
        })

        await logAuditAction({
            username: user.username,
            userId: user.id,
            modulo: 'Ayuda - Conversación',
            action: 'CREATE_APPOINTMENT',
            detalle: `Agendó la cita/reunión "${data.title}" con ${participants.length} participantes.`
        })

        return { success: true, appointment: app }
    } catch (e: any) {
        console.error('Error al agendar cita:', e)
        return { error: 'Error al guardar cita en el calendario.' }
    }
}

export async function updateCollabAppointmentStatus(appointmentId: string, status: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const app = await rawPrisma.collabAppointment.update({
            where: { id: appointmentId },
            data: { status }
        })
        return { success: true, appointment: app }
    } catch (e: any) {
        return { error: 'Error al actualizar estado de la cita.' }
    }
}

export async function deleteCollabAppointment(appointmentId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabAppointment.delete({
            where: { id: appointmentId }
        })
        return { success: true }
    } catch (e: any) {
        return { error: 'Error al eliminar cita.' }
    }
}

// ==========================================
// 4. PROYECTOS COLABORATIVOS
// ==========================================

export async function getProjectsData() {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const projectsDb = await rawPrisma.collabProject.findMany({
            include: {
                tasks: true,
                appointments: true
            },
            orderBy: { updatedAt: 'desc' }
        })

        const projects = projectsDb.map(p => {
            let members: string[] = []
            try { if (p.members) members = JSON.parse(p.members) } catch {}

            const totalTasks = p.tasks.length
            const completedTasks = p.tasks.filter(t => t.status === 'COMPLETADA').length
            const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

            return {
                id: p.id,
                title: p.title,
                description: p.description,
                status: p.status,
                priority: p.priority,
                startDate: p.startDate ? p.startDate.toISOString() : null,
                endDate: p.endDate ? p.endDate.toISOString() : null,
                createdBy: p.createdBy,
                members,
                color: p.color || 'cyan',
                totalTasks,
                completedTasks,
                progressPct,
                totalAppointments: p.appointments.length,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
                isMember: members.includes(user.username) || p.createdBy === user.username
            }
        })

        return { projects }
    } catch (e: any) {
        console.error('Error al obtener proyectos:', e)
        return { error: 'Error al cargar proyectos.' }
    }
}

export async function createCollabProject(data: {
    title: string
    description?: string
    priority?: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
    startDate?: string | null
    endDate?: string | null
    members: string[]
    color?: string
    createChat?: boolean
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El nombre del proyecto es obligatorio.' }

    const members = Array.from(new Set([user.username, ...data.members]))

    try {
        const project = await rawPrisma.collabProject.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                priority: data.priority || 'MEDIA',
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                members: JSON.stringify(members),
                color: data.color || 'cyan',
                status: 'EN_PROGRESO',
                createdBy: user.username
            }
        })

        // Crear automáticamente chat del proyecto si se solicita
        if (data.createChat !== false) {
            await rawPrisma.collabConversation.create({
                data: {
                    type: 'project',
                    title: `Proyecto: ${project.title}`,
                    projectId: project.id,
                    participants: JSON.stringify(members),
                    isEncrypted: true
                }
            })
        }

        await logAuditAction({
            username: user.username,
            userId: user.id,
            modulo: 'Ayuda - Conversación',
            action: 'CREATE_PROJECT',
            detalle: `Creó el proyecto "${project.title}" con ${members.length} miembros.`
        })

        return { success: true, project }
    } catch (e: any) {
        console.error('Error al crear proyecto:', e)
        return { error: 'Error al guardar proyecto.' }
    }
}

export async function updateCollabProject(projectId: string, data: {
    title: string
    description?: string
    priority?: string
    startDate?: string | null
    endDate?: string | null
    members?: string[]
    color?: string
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El título del proyecto es obligatorio.' }

    try {
        const project = await rawPrisma.collabProject.update({
            where: { id: projectId },
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                priority: data.priority || 'MEDIA',
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                members: JSON.stringify(data.members || []),
                color: data.color || 'cyan'
            }
        })
        return { success: true, project }
    } catch (e: any) {
        console.error('Error al actualizar proyecto:', e)
        return { error: 'Error al actualizar el proyecto.' }
    }
}

export async function deleteCollabProject(projectId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabProject.delete({
            where: { id: projectId }
        })
        return { success: true }
    } catch (e: any) {
        return { error: 'Error al eliminar proyecto.' }
    }
}

// ==========================================
// 5. COLUMNAS KANBAN PERSONALIZADAS (TRELLO)
// ==========================================

export async function getKanbanColumnsData(projectId?: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const where: any = {}
        if (projectId) where.projectId = projectId

        const customCols = await rawPrisma.collabKanbanColumn.findMany({
            where,
            orderBy: { order: 'asc' }
        })

        return { columns: customCols }
    } catch (e) {
        return { columns: [] }
    }
}

export async function createKanbanColumn(data: {
    name: string
    color?: string
    projectId?: string | null
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.name.trim()) return { error: 'El nombre de la columna es obligatorio.' }

    const statusKey = data.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')

    try {
        const count = await rawPrisma.collabKanbanColumn.count()
        const col = await rawPrisma.collabKanbanColumn.create({
            data: {
                name: data.name.trim(),
                statusKey,
                color: data.color || 'slate',
                order: count + 5,
                projectId: data.projectId || null,
                createdBy: user.username
            }
        })
        return { success: true, column: col }
    } catch (e: any) {
        console.error('Error al crear columna Kanban:', e)
        return { error: 'Error al guardar columna.' }
    }
}

export async function deleteKanbanColumn(columnId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabKanbanColumn.delete({
            where: { id: columnId }
        })
        return { success: true }
    } catch (e: any) {
        return { error: 'Error al eliminar columna.' }
    }
}

// ==========================================
// 6. NOTAS ESTILO POST-IT
// ==========================================

export async function getNotesData() {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const allNotesDb = await rawPrisma.collabNote.findMany({
            orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }]
        })

        const currentLower = user.username.toLowerCase()
        const userRole = user.role ? user.role.toLowerCase() : ''

        const notes = allNotesDb.filter(n => {
            if (n.createdBy && n.createdBy.toLowerCase() === currentLower) return true
            if (n.isPublic) return true
            if (n.sharedWith) {
                try {
                    const list: string[] = JSON.parse(n.sharedWith)
                    if (Array.isArray(list)) {
                        if (list.some(u => {
                            const val = u.toLowerCase()
                            if (val === currentLower) return true
                            if (userRole && (val === `role:${userRole}` || val === userRole)) return true
                            return false
                        })) {
                            return true
                        }
                    }
                } catch {
                    if (n.sharedWith.toLowerCase().includes(currentLower)) {
                        return true
                    }
                    if (userRole && n.sharedWith.toLowerCase().includes(userRole)) {
                        return true
                    }
                }
            }
            return false
        }).map(n => {
            let tags: string[] = []
            try { if (n.tags) tags = JSON.parse(n.tags) } catch {}
            let sharedWith: string[] = []
            try { if ((n as any).sharedWith) sharedWith = JSON.parse((n as any).sharedWith) } catch {}

            return {
                id: n.id,
                title: n.title,
                content: n.content,
                color: n.color,
                isPinned: n.isPinned,
                rotation: n.rotation,
                tags,
                isPublic: n.isPublic,
                sharedWith,
                createdBy: n.createdBy,
                isMine: n.createdBy ? n.createdBy.toLowerCase() === currentLower : false,
                createdAt: n.createdAt.toISOString(),
                updatedAt: n.updatedAt.toISOString()
            }
        })

        return { notes }
    } catch (e: any) {
        console.error('Error al obtener notas:', e)
        return { error: 'Error al cargar notas.' }
    }
}

export async function createCollabNote(data: {
    title?: string
    content: string
    color?: string
    isPinned?: boolean
    tags?: string[]
    isPublic?: boolean
    sharedWith?: string[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.content.trim()) return { error: 'El contenido de la nota es requerido.' }

    // Pequeña rotación aleatoria para aspecto post-it real (-2, -1, 0, 1, 2)
    const rotations = [-2, -1, 0, 1, 2]
    const rotation = rotations[Math.floor(Math.random() * rotations.length)]

    try {
        const note = await rawPrisma.collabNote.create({
            data: {
                title: data.title?.trim() || null,
                content: data.content.trim(),
                color: data.color || 'yellow',
                isPinned: data.isPinned || false,
                rotation,
                tags: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : null,
                isPublic: data.isPublic || false,
                sharedWith: data.sharedWith && data.sharedWith.length > 0 ? JSON.stringify(data.sharedWith) : null,
                createdBy: user.username
            }
        })

        // Notificar a usuarios o roles compartidos
        if (data.sharedWith && data.sharedWith.length > 0) {
            for (const target of data.sharedWith) {
                if (target.toUpperCase().startsWith('ROLE:')) {
                    const roleName = target.slice(5).trim()
                    try {
                        const roleUsers = await rawPrisma.user.findMany({
                            where: {
                                isDeleted: false,
                                isActive: true,
                                role: { name: { equals: roleName, mode: 'insensitive' } }
                            },
                            select: { username: true }
                        })
                        for (const ru of roleUsers) {
                            if (ru.username !== user.username) {
                                await (rawPrisma as any).collabMention.create({
                                    data: {
                                        sourceType: 'note',
                                        sourceId: note.id,
                                        mentionedUsername: ru.username,
                                        authorUsername: user.username,
                                        authorName: user.name,
                                        previewText: `Nota compartida con tu rol (${roleName}): ${data.title || data.content.slice(0, 50)}`
                                    }
                                }).catch(() => {})
                            }
                        }
                    } catch {}
                } else if (target !== user.username) {
                    try {
                        await (rawPrisma as any).collabMention.create({
                            data: {
                                sourceType: 'note',
                                sourceId: note.id,
                                mentionedUsername: target,
                                authorUsername: user.username,
                                authorName: user.name,
                                previewText: `Te compartió una nota: ${data.title || data.content.slice(0, 50)}`
                            }
                        }).catch(() => {})
                    } catch {}
                }
            }
        }

        return { success: true, note }
    } catch (e: any) {
        console.error('Error al crear nota:', e)
        return { error: 'Error al guardar la nota.' }
    }
}

export async function updateCollabNote(noteId: string, data: any) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const note = await rawPrisma.collabNote.update({
            where: { id: noteId },
            data: {
                title: data.title?.trim() || null,
                content: data.content?.trim(),
                color: data.color,
                isPinned: data.isPinned,
                isPublic: data.isPublic,
                sharedWith: data.sharedWith ? JSON.stringify(data.sharedWith) : null,
                tags: data.tags ? JSON.stringify(data.tags) : null
            }
        })
        return { success: true, note }
    } catch (e) {
        return { error: 'Error al actualizar nota.' }
    }
}

export async function deleteCollabNote(noteId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabNote.delete({
            where: { id: noteId }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar nota.' }
    }
}

// ==========================================
// 7. CARTAS GANTT (CON MODO COMPARTIDO LECTURA)
// ==========================================

import {
    parseDependencies,
    stringifyDependencies,
    syncGanttScheduleAndRecalculate,
    DependencyRule
} from './ganttEngine'

export async function getGanttChartsData() {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const chartsDb = await (rawPrisma as any).collabGanttChart.findMany({
            include: {
                items: {
                    orderBy: { order: 'asc' }
                },
                baselines: {
                    include: { items: true },
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        })

        const currentLower = user.username.toLowerCase()
        const userRole = user.role ? user.role.toLowerCase() : ''

        const charts = chartsDb.filter((c: any) => {
            if (c.createdBy && c.createdBy.toLowerCase() === currentLower) return true
            if (c.isShared) return true
            try {
                const shared: string[] = JSON.parse(c.sharedWith || '[]')
                if (Array.isArray(shared)) {
                    if (shared.some(u => {
                        const val = u.toLowerCase()
                        if (val === currentLower) return true
                        if (userRole && (val === `role:${userRole}` || val === userRole)) return true
                        return false
                    })) return true
                }
            } catch {
                if (c.sharedWith && c.sharedWith.toLowerCase().includes(currentLower)) return true
                if (userRole && c.sharedWith && c.sharedWith.toLowerCase().includes(userRole)) return true
            }
            return false
        }).map((c: any) => {
            return {
                id: c.id,
                title: c.title,
                description: c.description,
                projectId: c.projectId,
                createdBy: c.createdBy,
                isShared: c.isShared,
                isMine: c.createdBy === user.username,
                createdAt: c.createdAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
                baselines: (c.baselines || []).map((b: any) => ({
                    id: b.id,
                    name: b.name,
                    createdBy: b.createdBy,
                    createdAt: b.createdAt.toISOString(),
                    items: (b.items || []).map((bi: any) => ({
                        id: bi.id,
                        itemId: bi.itemId,
                        title: bi.title,
                        startDate: bi.startDate.toISOString(),
                        endDate: bi.endDate.toISOString(),
                        durationDays: bi.durationDays,
                        progress: bi.progress
                    }))
                })),
                items: (c.items || []).map((it: any) => {
                    let collaboratorsList: string[] = []
                    try { if (it.collaborators) collaboratorsList = JSON.parse(it.collaborators) } catch {}

                    return {
                        id: it.id,
                        ganttId: it.ganttId,
                        taskId: it.taskId,
                        parentId: it.parentId,
                        isMilestone: it.isMilestone || false,
                        title: it.title,
                        startDate: it.startDate.toISOString(),
                        endDate: it.endDate.toISOString(),
                        progress: it.progress,
                        color: it.color || 'cyan',
                        assignedTo: it.assignedTo,
                        collaborators: collaboratorsList,
                        dependencies: parseDependencies(it.dependencies),
                        earlyStart: it.earlyStart ? it.earlyStart.toISOString() : null,
                        earlyFinish: it.earlyFinish ? it.earlyFinish.toISOString() : null,
                        lateStart: it.lateStart ? it.lateStart.toISOString() : null,
                        lateFinish: it.lateFinish ? it.lateFinish.toISOString() : null,
                        totalFloat: it.totalFloat !== null && it.totalFloat !== undefined ? it.totalFloat : 0,
                        isCritical: it.isCritical || false,
                        order: it.order
                    }
                })
            }
        })

        return { charts }
    } catch (e: any) {
        console.error('Error al obtener cartas Gantt:', e)
        return { error: 'Error al cargar cartas Gantt.' }
    }
}

export async function createGanttChart(data: {
    title: string
    description?: string
    projectId?: string | null
    isShared?: boolean
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El título de la carta Gantt es obligatorio.' }

    try {
        const chart = await (rawPrisma as any).collabGanttChart.create({
            data: {
                title: data.title.trim(),
                description: data.description?.trim() || null,
                projectId: data.projectId || null,
                isShared: data.isShared !== false,
                createdBy: user.username
            }
        })

        try {
            await logAuditAction({
                username: user.username,
                userId: user.id,
                modulo: 'Ayuda - Conversación',
                action: 'CREATE_GANTT',
                detalle: `Creó la carta Gantt "${chart.title}".`
            })
        } catch {}

        return {
            success: true,
            chart: {
                id: chart.id,
                title: chart.title,
                description: chart.description,
                projectId: chart.projectId,
                createdBy: chart.createdBy,
                isShared: chart.isShared,
                createdAt: chart.createdAt instanceof Date ? chart.createdAt.toISOString() : new Date(chart.createdAt).toISOString(),
                updatedAt: chart.updatedAt instanceof Date ? chart.updatedAt.toISOString() : new Date(chart.updatedAt).toISOString()
            }
        }
    } catch (e: any) {
        console.error('Error al crear carta Gantt:', e)
        return { error: 'Error al guardar carta Gantt.' }
    }
}

export async function deleteGanttChart(chartId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await rawPrisma.collabGanttChart.delete({
            where: { id: chartId }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar carta Gantt.' }
    }
}

export async function createGanttItem(data: {
    ganttId: string
    title: string
    startDate: string
    endDate: string
    progress?: number
    color?: string
    assignedTo?: string | null
    collaborators?: string[]
    parentId?: string | null
    isMilestone?: boolean
    dependencies?: DependencyRule[] | string[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.title.trim()) return { error: 'El nombre de la actividad es requerido.' }
    if (!data.startDate || !data.endDate) return { error: 'Las fechas son obligatorias.' }

    try {
        // 1. Crear item base
        const count = await (rawPrisma as any).collabGanttItem.count({
            where: { ganttId: data.ganttId }
        })

        const item = await (rawPrisma as any).collabGanttItem.create({
            data: {
                ganttId: data.ganttId,
                title: data.title.trim(),
                startDate: new Date(data.startDate),
                endDate: data.isMilestone ? new Date(data.startDate) : new Date(data.endDate),
                progress: data.progress || 0,
                color: data.color || 'cyan',
                assignedTo: data.assignedTo || null,
                collaborators: data.collaborators && data.collaborators.length > 0 ? JSON.stringify(data.collaborators) : null,
                parentId: data.parentId || null,
                isMilestone: data.isMilestone || false,
                dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
                order: count
            }
        })

        // 2. Recalcular automáticamente en cascada dependencias y CPM
        await syncGanttScheduleAndRecalculate(data.ganttId)

        return { success: true, item }
    } catch (e: any) {
        console.error('Error al crear actividad en Gantt:', e)
        return { error: 'Error al guardar actividad en el cronograma Gantt.' }
    }
}

export async function deleteGanttItem(itemId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const item = await (rawPrisma as any).collabGanttItem.findUnique({
            where: { id: itemId }
        })
        if (!item) return { error: 'Actividad no encontrada' }

        await (rawPrisma as any).collabGanttItem.delete({
            where: { id: itemId }
        })

        // Recalcular el cronograma restante
        await syncGanttScheduleAndRecalculate(item.ganttId)

        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar actividad de Gantt.' }
    }
}

export async function updateGanttItem(itemId: string, data: {
    title?: string
    startDate?: string
    endDate?: string
    progress?: number
    color?: string
    assignedTo?: string | null
    collaborators?: string[]
    parentId?: string | null
    isMilestone?: boolean
    dependencies?: DependencyRule[] | string[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const item = await (rawPrisma as any).collabGanttItem.findUnique({
            where: { id: itemId }
        })
        if (!item) return { error: 'Actividad no encontrada' }

        const result = await syncGanttScheduleAndRecalculate(item.ganttId, {
            itemId,
            title: data.title,
            startDate: data.startDate,
            endDate: data.endDate,
            progress: data.progress,
            color: data.color,
            assignedTo: data.assignedTo,
            collaborators: data.collaborators,
            parentId: data.parentId,
            isMilestone: data.isMilestone,
            dependencies: data.dependencies
        })

        const updated = result.items.find(it => it.id === itemId)
        return { success: true, item: updated || item, allItems: result.items }
    } catch (e: any) {
        console.error('Error al actualizar actividad de Gantt:', e)
        return { error: 'Error al actualizar actividad de Gantt.' }
    }
}

export async function recalculateGanttAction(ganttId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const result = await syncGanttScheduleAndRecalculate(ganttId)
        return { success: true, items: result.items }
    } catch (e: any) {
        return { error: 'Error al recalcular cronograma.' }
    }
}

// ==========================================
// 8. LÍNEAS BASE (BASELINES) DEL GANTT
// ==========================================

export async function createGanttBaselineAction(ganttId: string, name?: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const items = await (rawPrisma as any).collabGanttItem.findMany({
            where: { ganttId }
        })

        if (items.length === 0) {
            return { error: 'No hay actividades en el cronograma para capturar una línea base.' }
        }

        const baseline = await (rawPrisma as any).collabGanttBaseline.create({
            data: {
                ganttId,
                name: name?.trim() || `Línea Base (${new Date().toLocaleDateString('es-CL')})`,
                createdBy: user.username,
                items: {
                    create: items.map((it: any) => {
                        const durationDays = Math.max(1, Math.ceil((it.endDate.getTime() - it.startDate.getTime()) / (1000 * 60 * 60 * 24)))
                        return {
                            itemId: it.id,
                            title: it.title,
                            startDate: it.startDate,
                            endDate: it.endDate,
                            durationDays,
                            progress: it.progress
                        }
                    })
                }
            },
            include: { items: true }
        })

        return { success: true, baseline }
    } catch (e: any) {
        console.error('Error al crear línea base:', e)
        return { error: 'Error al guardar la línea base del cronograma.' }
    }
}

export async function deleteGanttBaselineAction(baselineId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await (rawPrisma as any).collabGanttBaseline.delete({
            where: { id: baselineId }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar línea base.' }
    }
}

// ==========================================
// 6. TIMELINE UNIFICADO POR PROYECTO
// ==========================================

export async function getProjectTimelineAction(projectId: string, options?: {
    type?: string
    username?: string
    page?: number
    limit?: number
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    const page = options?.page || 1
    const limit = options?.limit || 20
    const skip = (page - 1) * limit

    try {
        const project = await (rawPrisma as any).collabProject.findUnique({
            where: { id: projectId }
        })
        if (!project) return { error: 'Proyecto no encontrado' }

        // RBAC: Validar que sea miembro del proyecto o admin
        const members: string[] = JSON.parse(project.members || '[]')
        if (!members.includes(user.username) && project.createdBy !== user.username) {
            return { error: 'No tienes acceso al timeline de este proyecto.' }
        }

        const whereClause: any = { projectId }
        if (options?.type && options.type !== 'ALL') {
            whereClause.type = options.type
        }
        if (options?.username && options.username !== 'ALL') {
            whereClause.username = options.username
        }

        const [activities, total] = await Promise.all([
            (rawPrisma as any).collabProjectActivityLog.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            (rawPrisma as any).collabProjectActivityLog.count({ where: whereClause })
        ])

        return {
            success: true,
            activities: activities.map((a: any) => ({
                id: a.id,
                projectId: a.projectId,
                type: a.type,
                title: a.title,
                description: a.description,
                metadata: a.metadata ? JSON.parse(a.metadata) : null,
                username: a.username,
                userFullName: a.userFullName,
                createdAt: a.createdAt.toISOString()
            })),
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + activities.length < total
            }
        }
    } catch (e: any) {
        console.error('Error al obtener timeline:', e)
        return { error: 'Error al cargar el timeline de actividades.' }
    }
}

// ==========================================
// 7. MENCIONES (@USUARIO) Y NOTIFICACIONES
// ==========================================

export async function getMentionsAction(options?: { unreadOnly?: boolean; page?: number; limit?: number }) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    const page = options?.page || 1
    const limit = options?.limit || 30
    const skip = (page - 1) * limit

    try {
        const whereClause: any = { mentionedUsername: user.username }
        if (options?.unreadOnly) {
            whereClause.readAt = null
        }

        const [mentions, unreadCount, total] = await Promise.all([
            (rawPrisma as any).collabMention.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            (rawPrisma as any).collabMention.count({
                where: { mentionedUsername: user.username, readAt: null }
            }),
            (rawPrisma as any).collabMention.count({ where: whereClause })
        ])

        return {
            success: true,
            unreadCount,
            total,
            mentions: mentions.map((m: any) => ({
                id: m.id,
                sourceType: m.sourceType,
                sourceId: m.sourceId,
                projectId: m.projectId,
                mentionedUsername: m.mentionedUsername,
                authorUsername: m.authorUsername,
                authorName: m.authorName,
                previewText: m.previewText,
                readAt: m.readAt ? m.readAt.toISOString() : null,
                createdAt: m.createdAt.toISOString()
            }))
        }
    } catch (e: any) {
        console.error('Error al obtener menciones:', e)
        return { error: 'Error al cargar menciones.' }
    }
}

export async function markMentionAsReadAction(mentionId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await (rawPrisma as any).collabMention.updateMany({
            where: { id: mentionId, mentionedUsername: user.username },
            data: { readAt: new Date() }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al actualizar mención.' }
    }
}

export async function markAllMentionsAsReadAction() {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await (rawPrisma as any).collabMention.updateMany({
            where: { mentionedUsername: user.username, readAt: null },
            data: { readAt: new Date() }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al marcar menciones como leídas.' }
    }
}

// ==========================================
// 8. PIZARRA / WHITEBOARD COLABORATIVO
// ==========================================

export async function getProjectWhiteboards(projectId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        let boards = await (rawPrisma as any).collabWhiteboard.findMany({
            where: { projectId },
            include: { elements: true },
            orderBy: { createdAt: 'asc' }
        })

        if (boards.length === 0) {
            // Crear una pizarra principal por defecto si no existe
            const defaultBoard = await (rawPrisma as any).collabWhiteboard.create({
                data: {
                    projectId,
                    title: 'Pizarra Principal de Ideación',
                    createdBy: user.username
                },
                include: { elements: true }
            })
            boards = [defaultBoard]
        }

        return {
            success: true,
            boards: boards.map((b: any) => ({
                id: b.id,
                projectId: b.projectId,
                title: b.title,
                createdBy: b.createdBy,
                elements: b.elements.map((el: any) => ({
                    id: el.id,
                    boardId: el.boardId,
                    type: el.type,
                    data: typeof el.data === 'string' ? JSON.parse(el.data) : el.data,
                    updatedBy: el.updatedBy,
                    updatedAt: el.updatedAt.toISOString()
                })),
                createdAt: b.createdAt.toISOString(),
                updatedAt: b.updatedAt.toISOString()
            }))
        }
    } catch (e: any) {
        console.error('Error al obtener pizarras:', e)
        return { error: 'Error al cargar pizarras del proyecto.' }
    }
}

export async function saveWhiteboardElements(boardId: string, elements: Array<{
    id: string
    type: string
    data: any
}>) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await (rawPrisma as any).$transaction(async (tx: any) => {
            for (const el of elements) {
                await tx.collabWhiteboardElement.upsert({
                    where: { id: el.id },
                    create: {
                        id: el.id,
                        boardId,
                        type: el.type,
                        data: JSON.stringify(el.data),
                        updatedBy: user.username,
                        updatedAt: new Date()
                    },
                    update: {
                        type: el.type,
                        data: JSON.stringify(el.data),
                        updatedBy: user.username,
                        updatedAt: new Date()
                    }
                })
            }
            await tx.collabWhiteboard.update({
                where: { id: boardId },
                data: { updatedAt: new Date() }
            })
        })

        return { success: true }
    } catch (e: any) {
        console.error('Error al guardar elementos de pizarra:', e)
        return { error: 'Error al sincronizar pizarra.' }
    }
}

export async function deleteWhiteboardElement(elementId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await (rawPrisma as any).collabWhiteboardElement.delete({
            where: { id: elementId }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar elemento de la pizarra.' }
    }
}

export async function clearAllWhiteboardElements(boardId: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        await (rawPrisma as any).collabWhiteboardElement.deleteMany({
            where: { boardId }
        })
        await (rawPrisma as any).collabWhiteboard.update({
            where: { id: boardId },
            data: { updatedAt: new Date() }
        })
        return { success: true }
    } catch (e: any) {
        console.error('Error al limpiar pizarra:', e)
        return { error: 'Error al limpiar la pizarra.' }
    }
}

// ==========================================
// 9. PRESENCIA EN VIVO (LIVE PRESENCE)
// ==========================================

export async function updatePresenceHeartbeat(room: string, color?: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const presence = await (rawPrisma as any).collabPresence.upsert({
            where: {
                room_username: {
                    room,
                    username: user.username
                }
            },
            create: {
                room,
                username: user.username,
                fullName: user.name,
                color: color || '#06b6d4',
                lastSeen: new Date()
            },
            update: {
                fullName: user.name,
                color: color || '#06b6d4',
                lastSeen: new Date()
            }
        })

        // Limpiar presencias inactivas (> 45 segundos)
        const threshold = new Date(Date.now() - 45 * 1000)
        await (rawPrisma as any).collabPresence.deleteMany({
            where: {
                room,
                lastSeen: { lt: threshold }
            }
        })

        return { success: true, presence }
    } catch (e) {
        return { error: 'Error de presencia' }
    }
}

export async function getRoomPresence(room: string) {
    try {
        const threshold = new Date(Date.now() - 45 * 1000)
        const activeUsers = await (rawPrisma as any).collabPresence.findMany({
            where: {
                room,
                lastSeen: { gte: threshold }
            },
            orderBy: { lastSeen: 'desc' }
        })

        return {
            success: true,
            activeUsers: activeUsers.map((u: any) => ({
                username: u.username,
                fullName: u.fullName || u.username,
                color: u.color,
                lastSeen: u.lastSeen.toISOString()
            }))
        }
    } catch (e) {
        return { error: 'Error al consultar presencia.' }
    }
}

// ==========================================
// 10. VISTA 'MI DÍA' (DASHBOARD PERSONAL)
// ==========================================

export async function getMyDayData() {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        const recentLimit = new Date(Date.now() - 48 * 60 * 60 * 1000)

        // Consultas paralelas desacopladas
        const [myTasks, todayAppointments, unreadMentions, myKudos] = await Promise.all([
            // Tareas asignadas
            rawPrisma.collabTask.findMany({
                where: {
                    assignedTo: user.username,
                    status: { not: 'COMPLETADA' }
                },
                include: { project: { select: { id: true, title: true, color: true } } },
                orderBy: { dueDate: 'asc' }
            }),
            // Citas del día
            rawPrisma.collabAppointment.findMany({
                where: {
                    OR: [
                        { createdBy: user.username },
                        { participants: { contains: user.username } }
                    ],
                    startDate: { lte: todayEnd },
                    endDate: { gte: todayStart }
                },
                include: { project: { select: { id: true, title: true, color: true } } },
                orderBy: { startDate: 'asc' }
            }),
            // Menciones recientes no leídas
            (rawPrisma as any).collabMention.findMany({
                where: {
                    mentionedUsername: user.username,
                    readAt: null,
                    createdAt: { gte: recentLimit }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),
            // Total de kudos recibidos
            (rawPrisma as any).collabKudo.count({
                where: { toUsername: user.username }
            })
        ])

        return {
            success: true,
            currentUser: user,
            totalKudos: myKudos,
            tasks: myTasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate ? t.dueDate.toISOString() : null,
                projectTitle: t.project?.title || null,
                projectColor: t.project?.color || 'cyan',
                isOverdue: t.dueDate ? new Date(t.dueDate) < todayStart : false
            })),
            appointments: todayAppointments.map(a => ({
                id: a.id,
                title: a.title,
                description: a.description,
                startDate: a.startDate.toISOString(),
                endDate: a.endDate.toISOString(),
                location: a.location,
                meetLink: a.meetLink,
                projectTitle: a.project?.title || null
            })),
            mentions: unreadMentions.map((m: any) => ({
                id: m.id,
                sourceType: m.sourceType,
                sourceId: m.sourceId,
                authorUsername: m.authorUsername,
                authorName: m.authorName,
                previewText: m.previewText,
                createdAt: m.createdAt.toISOString()
            }))
        }
    } catch (e: any) {
        console.error('Error en getMyDayData:', e)
        return { error: 'Error al cargar los datos de Mi Día.' }
    }
}

// ==========================================
// 11. SINCRONIZACIÓN Y DEPENDENCIAS GANTT
// ==========================================

export async function updateTaskScheduleAction(ganttId: string, updates: {
    itemId: string
    startDate: string
    endDate: string
    progress?: number
    dependencies?: string[]
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    return await syncGanttSchedule(ganttId, updates)
}

// ==========================================
// 12. HISTORIAL DE DECISIONES DEL PROYECTO
// ==========================================

export async function toggleMessageDecisionAction(messageId: string, isDecision: boolean, decisionSummary?: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const msg = await (rawPrisma as any).collabMessage.update({
            where: { id: messageId },
            data: {
                isDecision,
                decisionSummary: decisionSummary?.trim() || null
            },
            include: { conversation: true }
        })

        if (isDecision && msg.conversation?.projectId) {
            await logProjectActivity({
                projectId: msg.conversation.projectId,
                type: 'DECISION',
                title: `Decisión registrada por @${user.username}`,
                description: decisionSummary?.trim() || decryptMessage(msg.content).slice(0, 100),
                username: user.username,
                userFullName: user.name
            })
        }

        return { success: true, message: msg }
    } catch (e) {
        return { error: 'Error al actualizar estado de decisión.' }
    }
}

export async function getProjectDecisions(projectId?: string) {
    try {
        const user = await getAuthUser()
        if (!user) return { decisions: [] }

        let whereConv: any = {}
        if (projectId && projectId !== 'ALL' && projectId !== 'general') {
            whereConv.projectId = projectId
        }

        const conversations = await rawPrisma.collabConversation.findMany({
            where: whereConv,
            select: { id: true, title: true, participants: true }
        })

        const myConvIds = conversations
            .filter(c => {
                try {
                    const parts = JSON.parse(c.participants || '[]')
                    return parts.includes(user.username)
                } catch {
                    return true
                }
            })
            .map(c => c.id)

        if (myConvIds.length === 0) return { decisions: [] }

        const decisions = await (rawPrisma as any).collabMessage.findMany({
            where: {
                conversationId: { in: myConvIds },
                isDecision: true
            },
            orderBy: { createdAt: 'desc' }
        })

        return {
            decisions: decisions.map((d: any) => {
                let decrypted = d.content || ''
                try {
                    decrypted = decryptMessage(d.content)
                } catch {}

                return {
                    id: d.id,
                    conversationId: d.conversationId,
                    senderUsername: d.senderUsername,
                    senderName: d.senderName,
                    content: decrypted,
                    decisionSummary: d.decisionSummary,
                    createdAt: d.createdAt.toISOString()
                }
            })
        }
    } catch (e) {
        console.error('Error al obtener decisiones:', e)
        return { decisions: [] }
    }
}

// ==========================================
// 13. REACCIONES Y ENCUESTAS RÁPIDAS
// ==========================================

export async function toggleMessageReactionAction(messageId: string, emoji: string) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const existing = await (rawPrisma as any).collabMessageReaction.findUnique({
            where: {
                messageId_username_emoji: {
                    messageId,
                    username: user.username,
                    emoji
                }
            }
        })

        if (existing) {
            await (rawPrisma as any).collabMessageReaction.delete({
                where: { id: existing.id }
            })
        } else {
            await (rawPrisma as any).collabMessageReaction.create({
                data: {
                    messageId,
                    username: user.username,
                    fullName: user.name,
                    emoji
                }
            })
        }

        const reactions = await (rawPrisma as any).collabMessageReaction.findMany({
            where: { messageId }
        })

        return { success: true, reactions }
    } catch (e: any) {
        return { error: 'Error al gestionar reacción.' }
    }
}

export async function createChatPollAction(data: {
    conversationId: string
    question: string
    options: string[]
    allowMultiple?: boolean
    isAnonymous?: boolean
    expiresAt?: string
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (!data.question.trim()) return { error: 'La pregunta es obligatoria.' }
    const validOptions = data.options.filter(o => o.trim().length > 0)
    if (validOptions.length < 2) return { error: 'Debe ingresar al menos 2 opciones.' }

    try {
        const formattedOptions = validOptions.map((text, idx) => ({ id: idx, text: text.trim() }))

        const poll = await (rawPrisma as any).collabPoll.create({
            data: {
                conversationId: data.conversationId,
                question: data.question.trim(),
                options: JSON.stringify(formattedOptions),
                allowMultiple: data.allowMultiple || false,
                isAnonymous: data.isAnonymous || false,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
                createdBy: user.username
            },
            include: { votes: true }
        })

        // Enviar mensaje en el chat informando de la encuesta
        await sendChatMessage({
            conversationId: data.conversationId,
            content: `📊 Encuesta creada: "${data.question.trim()}"`
        })

        return {
            success: true,
            poll: {
                id: poll.id,
                conversationId: poll.conversationId,
                question: poll.question,
                options: formattedOptions,
                allowMultiple: poll.allowMultiple,
                isAnonymous: poll.isAnonymous,
                expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
                createdBy: poll.createdBy,
                votes: []
            }
        }
    } catch (e: any) {
        console.error('Error al crear encuesta:', e)
        return { error: 'Error al crear la encuesta.' }
    }
}

export async function voteChatPollAction(pollId: string, optionIndex: number) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    try {
        const poll = await (rawPrisma as any).collabPoll.findUnique({
            where: { id: pollId }
        })
        if (!poll) return { error: 'Encuesta no encontrada' }

        if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
            return { error: 'Esta encuesta ha finalizado.' }
        }

        const existingVote = await (rawPrisma as any).collabPollVote.findUnique({
            where: {
                pollId_username_optionIndex: {
                    pollId,
                    username: user.username,
                    optionIndex
                }
            }
        })

        if (existingVote) {
            // Retirar voto
            await (rawPrisma as any).collabPollVote.delete({
                where: { id: existingVote.id }
            })
        } else {
            // Si no permite múltiples, borrar votos previos del usuario en esta encuesta
            if (!poll.allowMultiple) {
                await (rawPrisma as any).collabPollVote.deleteMany({
                    where: { pollId, username: user.username }
                })
            }

            await (rawPrisma as any).collabPollVote.create({
                data: {
                    pollId,
                    username: user.username,
                    fullName: user.name,
                    optionIndex
                }
            })
        }

        const updatedVotes = await (rawPrisma as any).collabPollVote.findMany({
            where: { pollId }
        })

        return { success: true, votes: updatedVotes }
    } catch (e: any) {
        console.error('Error al votar:', e)
        return { error: 'Error al registrar voto.' }
    }
}

// ==========================================
// 14. RECONOCIMIENTOS Y MURO DE KUDOS
// ==========================================

export async function createKudoAction(data: {
    toUsername: string
    toName: string
    projectId?: string | null
    message: string
    category: 'EQUIPO' | 'INNOVACION' | 'CALIDAD' | 'LIDERAZGO' | 'AGILIDAD'
    badgeIcon?: string
}) {
    const user = await getAuthUser()
    if (!user) return { error: 'No autenticado' }

    if (user.username === data.toUsername) {
        return { error: 'No puedes enviarte un reconocimiento a ti mismo.' }
    }
    if (!data.message.trim()) return { error: 'El mensaje de felicitación es obligatorio.' }

    try {
        const kudo = await (rawPrisma as any).collabKudo.create({
            data: {
                fromUsername: user.username,
                fromName: user.name,
                toUsername: data.toUsername,
                toName: data.toName || data.toUsername,
                projectId: data.projectId || null,
                message: data.message.trim(),
                category: data.category || 'EQUIPO',
                badgeIcon: data.badgeIcon || '🏆'
            }
        })

        // Registrar mención para que el destinatario sea notificado
        await registerMentions({
            sourceType: 'kudo',
            sourceId: kudo.id,
            projectId: data.projectId,
            text: `¡Has recibido un Kudo de reconocimiento! "${data.message.trim()}"`,
            authorUsername: user.username,
            authorName: user.name
        })

        return { success: true, kudo }
    } catch (e: any) {
        console.error('Error al crear kudo:', e)
        return { error: 'Error al enviar reconocimiento.' }
    }
}

export async function getKudosAction(options?: {
    projectId?: string
    username?: string
    category?: string
}) {
    try {
        const whereClause: any = {}
        if (options?.projectId) whereClause.projectId = options.projectId
        if (options?.username) {
            whereClause.OR = [
                { toUsername: options.username },
                { fromUsername: options.username }
            ]
        }
        if (options?.category && options.category !== 'ALL') {
            whereClause.category = options.category
        }

        const kudos = await (rawPrisma as any).collabKudo.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 50
        })

        return {
            success: true,
            kudos: kudos.map((k: any) => ({
                id: k.id,
                fromUsername: k.fromUsername,
                fromName: k.fromName,
                toUsername: k.toUsername,
                toName: k.toName,
                projectId: k.projectId,
                message: k.message,
                category: k.category,
                badgeIcon: k.badgeIcon,
                createdAt: k.createdAt.toISOString()
            }))
        }
    } catch (e) {
        return { error: 'Error al cargar reconocimientos.' }
    }
}

export async function getUserKudosStats(username: string) {
    try {
        const kudos = await (rawPrisma as any).collabKudo.findMany({
            where: { toUsername: username }
        })

        const categoryCounts: Record<string, number> = {}
        kudos.forEach((k: any) => {
            categoryCounts[k.category] = (categoryCounts[k.category] || 0) + 1
        })

        return {
            total: kudos.length,
            categories: categoryCounts
        }
    } catch (e) {
        return { total: 0, categories: {} }
    }
}
