'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
    getConversationsAndUsers,
    getConversationMessages,
    sendChatMessage,
    createOrGetDirectConversation,
    createGroupConversation,
    getTasksData,
    createCollabTask,
    updateCollabTaskStatus,
    updateCollabTask,
    deleteCollabTask,
    getAppointmentsData,
    createCollabAppointment,
    deleteCollabAppointment,
    getProjectsData,
    createCollabProject,
    updateCollabProject,
    deleteCollabProject,
    createKanbanColumn,
    deleteKanbanColumn,
    toggleMessageReactionAction,
    toggleMessageDecisionAction,
    createChatPollAction
} from './actions'
import NotesView, { NoteItem } from './NotesView'
import GanttView, { GanttChartItem } from './GanttView'
import TimelineView from './TimelineView'
import WhiteboardView from './WhiteboardView'
import MyDayView from './MyDayView'
import DecisionsDrawer from './DecisionsDrawer'
import KudosView from './KudosView'
import MentionsNotificationCenter from './MentionsNotificationCenter'
import MentionInput from './MentionInput'
import StackedPresenceAvatars from './StackedPresenceAvatars'
import PollCard from './PollCard'

interface UserItem {
    id: string
    username: string
    name: string
    email?: string | null
    role: string
    sucursales: string[]
}

interface ConversationItem {
    id: string
    type: string
    title?: string | null
    projectId?: string | null
    participants: string[]
    lastMessage: string
    lastMessageAt: string
    isEncrypted?: boolean
    unreadCount?: number
    createdAt?: string
    updatedAt?: string
}

interface MessageItem {
    id: string
    conversationId: string
    senderUsername: string
    senderName?: string | null
    content: string
    isEncrypted?: boolean
    isDecision?: boolean
    decisionSummary?: string | null
    attachments?: string[]
    reactions?: Array<{ id: string; username: string; fullName?: string; emoji: string }>
    polls?: any[]
    createdAt: string
    isMine: boolean
}

interface TaskItem {
    id: string
    projectId?: string | null
    projectTitle?: string | null
    projectColor?: string
    sourceMessageId?: string | null
    title: string
    description?: string | null
    status: string // Permite columnas estándar y columnas dinámicas personalizadas
    priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
    columnOrder: number
    dueDate?: string | null
    assignedTo?: string | null
    tags: string[]
    checklists: { id: string; text: string; done: boolean }[]
    createdBy: string
    createdAt: string
}

interface AppointmentItem {
    id: string
    projectId?: string | null
    projectTitle?: string | null
    projectColor?: string
    sourceNoteId?: string | null
    title: string
    description?: string | null
    startDate: string
    endDate: string
    location?: string | null
    meetLink?: string | null
    participants: string[]
    status: string
    createdBy: string
    isMine: boolean
}

interface ProjectItem {
    id: string
    title: string
    description?: string | null
    status: string
    priority: string
    startDate?: string | null
    endDate?: string | null
    createdBy: string
    members: string[]
    color?: string
    totalTasks: number
    completedTasks: number
    progressPct: number
    totalAppointments: number
    createdAt: string
    isMember: boolean
}

export interface KanbanColumnItem {
    id: string
    name: string
    statusKey: string
    color?: string | null
    order: number
    projectId?: string | null
    createdBy?: string
}

interface Props {
    initialUser: any
    initialConversations: ConversationItem[]
    initialUsers: UserItem[]
    initialTasks: TaskItem[]
    initialAppointments: AppointmentItem[]
    initialProjects: ProjectItem[]
    initialKanbanColumns?: KanbanColumnItem[]
    initialNotes?: NoteItem[]
    initialGanttCharts?: GanttChartItem[]
}

const DEFAULT_KANBAN_COLUMNS = [
    { id: 'PENDIENTE', name: 'Pendiente', statusKey: 'PENDIENTE', color: 'slate', icon: '📌', isDefault: true },
    { id: 'EN_PROGRESO', name: 'En Progreso', statusKey: 'EN_PROGRESO', color: 'cyan', icon: '⚡', isDefault: true },
    { id: 'REVISION', name: 'En Revisión', statusKey: 'REVISION', color: 'amber', icon: '🔍', isDefault: true },
    { id: 'COMPLETADA', name: 'Completada', statusKey: 'COMPLETADA', color: 'emerald', icon: '✅', isDefault: true }
]

const COLUMN_COLOR_STYLES: Record<string, { bg: string; border: string; text: string; badgeBg: string; badgeText: string; dot: string; addBorder: string; addHover: string; addText: string }> = {
    slate: { bg: 'bg-slate-100/80', border: 'border-slate-200/90', text: 'text-slate-700', badgeBg: 'bg-slate-200', badgeText: 'text-slate-700', dot: 'bg-slate-400', addBorder: 'border-slate-300', addHover: 'hover:border-slate-400 hover:bg-slate-100/60', addText: 'text-slate-500' },
    cyan: { bg: 'bg-cyan-50/70', border: 'border-cyan-200/90', text: 'text-cyan-800', badgeBg: 'bg-cyan-200', badgeText: 'text-cyan-800', dot: 'bg-cyan-500', addBorder: 'border-cyan-300', addHover: 'hover:border-cyan-500 hover:bg-cyan-100/50', addText: 'text-cyan-700' },
    amber: { bg: 'bg-amber-50/70', border: 'border-amber-200/90', text: 'text-amber-800', badgeBg: 'bg-amber-200', badgeText: 'text-amber-800', dot: 'bg-amber-500', addBorder: 'border-amber-300', addHover: 'hover:border-amber-500 hover:bg-amber-100/50', addText: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50/70', border: 'border-emerald-200/90', text: 'text-emerald-800', badgeBg: 'bg-emerald-200', badgeText: 'text-emerald-800', dot: 'bg-emerald-500', addBorder: 'border-emerald-300', addHover: 'hover:border-emerald-500 hover:bg-emerald-100/50', addText: 'text-emerald-700' },
    purple: { bg: 'bg-purple-50/70', border: 'border-purple-200/90', text: 'text-purple-800', badgeBg: 'bg-purple-200', badgeText: 'text-purple-800', dot: 'bg-purple-500', addBorder: 'border-purple-300', addHover: 'hover:border-purple-500 hover:bg-purple-100/50', addText: 'text-purple-700' },
    rose: { bg: 'bg-rose-50/70', border: 'border-rose-200/90', text: 'text-rose-800', badgeBg: 'bg-rose-200', badgeText: 'text-rose-800', dot: 'bg-rose-500', addBorder: 'border-rose-300', addHover: 'hover:border-rose-500 hover:bg-rose-100/50', addText: 'text-rose-700' },
    indigo: { bg: 'bg-indigo-50/70', border: 'border-indigo-200/90', text: 'text-indigo-800', badgeBg: 'bg-indigo-200', badgeText: 'text-indigo-800', dot: 'bg-indigo-500', addBorder: 'border-indigo-300', addHover: 'hover:border-indigo-500 hover:bg-indigo-100/50', addText: 'text-indigo-700' },
}

export default function ConversacionClient({
    initialUser,
    initialConversations,
    initialUsers,
    initialTasks,
    initialAppointments,
    initialProjects,
    initialKanbanColumns = [],
    initialNotes = [],
    initialGanttCharts = []
}: Props) {
    // Tab principal
    const [activeTab, setActiveTab] = useState<'myday' | 'chat' | 'kanban' | 'notes' | 'gantt' | 'timeline' | 'whiteboard' | 'calendar' | 'projects' | 'kudos'>('myday')

    // Drawer Decisiones
    const [showDecisionsDrawer, setShowDecisionsDrawer] = useState(false)
    const [decisionModalMessage, setDecisionModalMessage] = useState<MessageItem | null>(null)
    const [decisionSummaryInput, setDecisionSummaryInput] = useState('')

    // Modal Crear Encuesta
    const [showPollModal, setShowPollModal] = useState(false)
    const [pollQuestion, setPollQuestion] = useState('')
    const [pollOption1, setPollOption1] = useState('')
    const [pollOption2, setPollOption2] = useState('')
    const [pollOption3, setPollOption3] = useState('')
    const [pollIsAnonymous, setPollIsAnonymous] = useState(false)
    const [pollAllowMultiple, setPollAllowMultiple] = useState(false)
    const [creatingPoll, setCreatingPoll] = useState(false)

    // Estado de Usuarios y Conversaciones
    const [users, setUsers] = useState<UserItem[]>(initialUsers)
    const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations)
    const [activeConvId, setActiveConvId] = useState<string | null>(initialConversations.length > 0 ? initialConversations[0].id : null)
    const [messages, setMessages] = useState<MessageItem[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [messageInput, setMessageInput] = useState('')
    const [sendingMsg, setSendingMsg] = useState(false)
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [showNewChatModal, setShowNewChatModal] = useState(false)
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([])
    const [groupTitle, setGroupTitle] = useState('')
    const [creatingGroup, setCreatingGroup] = useState(false)

    // Estado Tareas (Trello Kanban) & Columnas Personalizadas
    const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
    const [customColumns, setCustomColumns] = useState<KanbanColumnItem[]>(initialKanbanColumns)
    const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL')
    const [showTaskModal, setShowTaskModal] = useState(false)
    const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
    const [taskTitle, setTaskTitle] = useState('')
    const [taskDesc, setTaskDesc] = useState('')
    const [taskPriority, setTaskPriority] = useState<'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('MEDIA')
    const [taskStatus, setTaskStatus] = useState<string>('PENDIENTE')
    const [taskDueDate, setTaskDueDate] = useState('')
    const [taskAssignedTo, setTaskAssignedTo] = useState('')
    const [taskProjectId, setTaskProjectId] = useState('')
    const [taskTagInput, setTaskTagInput] = useState('')
    const [taskTags, setTaskTags] = useState<string[]>([])
    const [taskChecklists, setTaskChecklists] = useState<{ id: string; text: string; done: boolean }[]>([])
    const [newChecklistText, setNewChecklistText] = useState('')
    const [savingTask, setSavingTask] = useState(false)
    const [taskSourceMessageId, setTaskSourceMessageId] = useState<string | null>(null)
    const [sourceSenderInfo, setSourceSenderInfo] = useState<{ senderName: string; senderUsername: string; date: string } | null>(null)

    // Modal Crear Columna Kanban
    const [showNewColumnModal, setShowNewColumnModal] = useState(false)
    const [newColumnName, setNewColumnName] = useState('')
    const [newColumnColor, setNewColumnColor] = useState('purple')
    const [savingColumn, setSavingColumn] = useState(false)

    // Estado Citas & Calendario
    const [appointments, setAppointments] = useState<AppointmentItem[]>(initialAppointments)
    const [calendarDate, setCalendarDate] = useState<Date>(new Date())
    const [showAppointmentModal, setShowAppointmentModal] = useState(false)
    const [appTitle, setAppTitle] = useState('')
    const [appDesc, setAppDesc] = useState('')
    const [appStartDate, setAppStartDate] = useState('')
    const [appEndDate, setAppEndDate] = useState('')
    const [appLocation, setAppLocation] = useState('')
    const [appMeetLink, setAppMeetLink] = useState('')
    const [appParticipants, setAppParticipants] = useState<string[]>([])
    const [appProjectId, setAppProjectId] = useState('')
    const [savingApp, setSavingApp] = useState(false)
    const [appSourceNoteId, setAppSourceNoteId] = useState<string | null>(null)
    const [sourceNoteInfo, setSourceNoteInfo] = useState<{ createdBy: string; date: string } | null>(null)

    // Toast de Notificación Rápida
    const [toastInfo, setToastInfo] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null)

    // Estado Proyectos
    const [projects, setProjects] = useState<ProjectItem[]>(initialProjects)
    const [editingProject, setEditingProject] = useState<ProjectItem | null>(null)
    const [showProjectModal, setShowProjectModal] = useState(false)
    const [projTitle, setProjTitle] = useState('')
    const [projDesc, setProjDesc] = useState('')
    const [projPriority, setProjPriority] = useState<'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('MEDIA')
    const [projStartDate, setProjStartDate] = useState('')
    const [projEndDate, setProjEndDate] = useState('')
    const [projMembers, setProjMembers] = useState<string[]>([initialUser.username])
    const [projColor, setProjColor] = useState('cyan')
    const [savingProject, setSavingProject] = useState(false)

    // Progreso dinámico y en tiempo real de cada proyecto sincronizado con el tablero Trello
    const liveProjects = useMemo(() => {
        return projects.map(p => {
            const pTasks = tasks.filter(t => t.projectId === p.id)
            const totalTasks = pTasks.length
            const completedTasks = pTasks.filter(t => t.status === 'COMPLETADA').length
            const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
            return {
                ...p,
                totalTasks,
                completedTasks,
                progressPct
            }
        })
    }, [projects, tasks])

    // Auto-scroll en Chat
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Cargar mensajes al cambiar de conversación o sincronizar en tiempo real
    const loadMessages = useCallback(async (convId: string, isSilent = false) => {
        if (!isSilent) setLoadingMessages(true)
        try {
            const res = await getConversationMessages(convId)
            if (res.messages) {
                setMessages(prev => {
                    // Evitar re-renders si no hay cambios
                    if (prev.length === res.messages!.length && JSON.stringify(prev) === JSON.stringify(res.messages)) {
                        return prev
                    }
                    setTimeout(scrollToBottom, 50)
                    return res.messages!
                })
            }
        } catch (err) {
            console.error('Error al sincronizar mensajes:', err)
        } finally {
            if (!isSilent) setLoadingMessages(false)
        }
    }, [])

    // Sincronización en tiempo real de mensajes (Polling cada 2.5s mientras el chat esté activo)
    useEffect(() => {
        if (!activeConvId) return

        // Carga inicial visible
        loadMessages(activeConvId, false)

        // Intervalo silencioso de actualización continua
        const interval = setInterval(() => {
            if (activeTab === 'chat' && activeConvId) {
                loadMessages(activeConvId, true)
            }
        }, 2500)

        return () => clearInterval(interval)
    }, [activeConvId, activeTab, loadMessages])

    // Sincronización periódica de la lista de conversaciones (cada 5s)
    useEffect(() => {
        if (activeTab !== 'chat') return

        const convInterval = setInterval(async () => {
            try {
                const res = await getConversationsAndUsers()
                if (res.conversations) {
                    setConversations(res.conversations)
                }
            } catch (err) {}
        }, 5000)

        return () => clearInterval(convInterval)
    }, [activeTab])

    // Conversación activa
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConvId) || null
    }, [conversations, activeConvId])

    // Lista de todas las columnas (4 por defecto + personalizadas)
    const allColumns = useMemo(() => {
        const custom = customColumns.map(c => ({
            id: c.id,
            name: c.name,
            statusKey: c.statusKey,
            color: c.color || 'purple',
            icon: '🏷️',
            isDefault: false
        }))
        return [...DEFAULT_KANBAN_COLUMNS, ...custom]
    }, [customColumns])

    // Filtrar tareas según proyecto seleccionado
    const filteredTasks = useMemo(() => {
        if (selectedProjectFilter === 'ALL') return tasks
        return tasks.filter(t => t.projectId === selectedProjectFilter)
    }, [tasks, selectedProjectFilter])

    // Agrupar tareas en columnas Trello dinámicas
    const tasksByColumn = useMemo(() => {
        const map: Record<string, TaskItem[]> = {}
        allColumns.forEach(col => {
            map[col.statusKey] = filteredTasks.filter(t => t.status === col.statusKey)
        })
        // Asignar tareas con status no reconocido a PENDIENTE
        const allKnownKeys = allColumns.map(c => c.statusKey)
        const orphans = filteredTasks.filter(t => !allKnownKeys.includes(t.status))
        if (orphans.length > 0 && map['PENDIENTE']) {
            map['PENDIENTE'] = [...map['PENDIENTE'], ...orphans]
        }
        return map
    }, [filteredTasks, allColumns])

    // Enviar mensaje de chat con actualización optimista instantánea
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!messageInput.trim() || !activeConvId || sendingMsg) return

        const tempContent = messageInput.trim()
        setMessageInput('')
        setSendingMsg(true)

        // Inserción optimista para respuesta visual inmediata
        const tempId = 'temp_' + Date.now()
        const optimisticMsg: MessageItem = {
            id: tempId,
            conversationId: activeConvId,
            senderUsername: initialUser.username,
            senderName: initialUser.name,
            content: tempContent,
            isEncrypted: true,
            isDecision: false,
            decisionSummary: null,
            attachments: [],
            reactions: [],
            polls: [],
            createdAt: new Date().toISOString(),
            isMine: true
        }

        setMessages(prev => [...prev, optimisticMsg])
        setTimeout(scrollToBottom, 50)

        try {
            const res = await sendChatMessage({
                conversationId: activeConvId,
                content: tempContent
            })
            if (res.success && res.message) {
                setMessages(prev => prev.map(m => m.id === tempId ? res.message! : m))
                setConversations(prev => prev.map(c => c.id === activeConvId ? {
                    ...c,
                    lastMessage: tempContent,
                    lastMessageAt: new Date().toISOString()
                } : c))
                setTimeout(scrollToBottom, 50)
            }
        } catch (err) {
            console.error('Error al enviar mensaje:', err)
        } finally {
            setSendingMsg(false)
        }
    }

    // Gestionar reacción emoji a un mensaje
    const handleToggleReaction = async (messageId: string, emoji: string) => {
        const res = await toggleMessageReactionAction(messageId, emoji)
        if (res.success && res.reactions) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: res.reactions } : m))
        }
    }

    // Abrir modal de acuerdo/decisión
    const handleOpenDecisionModal = (msg: MessageItem) => {
        setDecisionModalMessage(msg)
        setDecisionSummaryInput(msg.decisionSummary || msg.content.slice(0, 100))
    }

    // Confirmar cambio de estado de decisión
    const handleConfirmDecision = async () => {
        if (!decisionModalMessage) return
        const isCurrentlyDecision = decisionModalMessage.isDecision || false
        const nextState = !isCurrentlyDecision
        const res = await toggleMessageDecisionAction(decisionModalMessage.id, nextState, decisionSummaryInput)
        if (res.success) {
            setMessages(prev => prev.map(m => m.id === decisionModalMessage.id ? { ...m, isDecision: nextState, decisionSummary: decisionSummaryInput } : m))
            setDecisionModalMessage(null)
            setDecisionSummaryInput('')
        }
    }

    // Crear encuesta interactiva en el chat
    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeConvId || !pollQuestion.trim() || creatingPoll) return
        const rawOpts = [pollOption1, pollOption2, pollOption3].filter(o => o.trim().length > 0)
        if (rawOpts.length < 2) return

        setCreatingPoll(true)
        const res = await createChatPollAction({
            conversationId: activeConvId,
            question: pollQuestion.trim(),
            options: rawOpts,
            allowMultiple: pollAllowMultiple,
            isAnonymous: pollIsAnonymous
        })

        if (res.success) {
            setShowPollModal(false)
            setPollQuestion('')
            setPollOption1('')
            setPollOption2('')
            setPollOption3('')
            // Refrescar mensajes
            loadMessages(activeConvId)
        }
        setCreatingPoll(false)
    }

    // Iniciar o seleccionar chat directo con usuario
    const handleStartDirectChat = async (targetUsername: string) => {
        setShowNewChatModal(false)
        const res = await createOrGetDirectConversation(targetUsername)
        if (res.conversation) {
            const exists = conversations.find(c => c.id === res.conversation!.id)
            if (!exists) {
                setConversations(prev => [res.conversation!, ...prev])
            }
            setActiveConvId(res.conversation.id)
            setActiveTab('chat')
        }
    }

    // Crear grupo
    const handleCreateGroup = async () => {
        if (!groupTitle.trim() || selectedGroupMembers.length === 0 || creatingGroup) return
        setCreatingGroup(true)
        const res = await createGroupConversation({
            title: groupTitle,
            participants: selectedGroupMembers
        })
        if (res.success && res.conversation) {
            setConversations(prev => [res.conversation!, ...prev])
            setActiveConvId(res.conversation.id)
            setShowNewChatModal(false)
            setGroupTitle('')
            setSelectedGroupMembers([])
        }
        setCreatingGroup(false)
    }

    // Conversión rápida de Mensaje de Chat a Tarea Trello
    const handleConvertMessageToTask = (m: MessageItem) => {
        setEditingTask(null)
        const previewTitle = m.content.length > 65 ? m.content.slice(0, 65).trim() + '...' : m.content
        setTaskTitle(previewTitle)
        const sender = m.senderName || m.senderUsername
        const dateFormatted = new Date(m.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        setTaskDesc(`${m.content}\n\n────────────────────\n💬 **Origen Chat**: Mensaje de @${sender} (${dateFormatted})`)
        setTaskPriority('MEDIA')
        setTaskStatus('PENDIENTE')
        setTaskDueDate('')
        setTaskAssignedTo(initialUser.username)
        setTaskProjectId(selectedProjectFilter !== 'ALL' ? selectedProjectFilter : '')
        setTaskTags(['Chat'])
        setTaskChecklists([])
        setTaskSourceMessageId(m.id)
        setSourceSenderInfo({
            senderName: sender,
            senderUsername: m.senderUsername,
            date: dateFormatted
        })
        setShowTaskModal(true)
    }

    // Conversión rápida de Nota Post-it a Evento de Calendario
    const handleConvertNoteToAppointment = (note: NoteItem) => {
        const previewTitle = note.title || (note.content.length > 50 ? note.content.slice(0, 50).trim() + '...' : note.content)
        const dateFormatted = new Date(note.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        setAppTitle(previewTitle)
        const tagsSuffix = note.tags && note.tags.length > 0 ? `\n🏷️ **Etiquetas**: ${note.tags.map(t => '#' + t).join(' ')}` : ''
        setAppDesc(`${note.content}\n\n────────────────────\n📌 **Origen**: Nota Post-it de @${note.createdBy} (${dateFormatted})${tagsSuffix}`)
        
        // Calcular fecha por defecto: Próxima hora redonda
        const now = new Date()
        now.setHours(now.getHours() + 1, 0, 0, 0)
        const startStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        now.setHours(now.getHours() + 1)
        const endStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        
        setAppStartDate(startStr)
        setAppEndDate(endStr)
        setAppLocation('')
        setAppMeetLink('')
        const pList = Array.from(new Set([initialUser.username, ...(note.createdBy && note.createdBy !== initialUser.username ? [note.createdBy] : [])]))
        setAppParticipants(pList)
        setAppProjectId('')
        setAppSourceNoteId(note.id)
        setSourceNoteInfo({
            createdBy: note.createdBy,
            date: dateFormatted
        })
        setShowAppointmentModal(true)
    }

    // Guardar o Actualizar Tarea
    const handleSaveTask = async () => {
        if (!taskTitle.trim() || savingTask) return
        setSavingTask(true)

        if (editingTask) {
            const res = await updateCollabTask(editingTask.id, {
                title: taskTitle,
                description: taskDesc,
                priority: taskPriority,
                status: taskStatus,
                dueDate: taskDueDate || null,
                assignedTo: taskAssignedTo || null,
                projectId: taskProjectId || null,
                tags: taskTags,
                checklists: taskChecklists
            })
            if (res.success) {
                const refreshed = await getTasksData(selectedProjectFilter === 'ALL' ? undefined : selectedProjectFilter)
                if (refreshed.tasks) setTasks(refreshed.tasks)
                setShowTaskModal(false)
                setEditingTask(null)
                setTaskSourceMessageId(null)
                setSourceSenderInfo(null)
            }
        } else {
            const res = await createCollabTask({
                title: taskTitle,
                description: taskDesc,
                priority: taskPriority,
                status: taskStatus,
                dueDate: taskDueDate || null,
                assignedTo: taskAssignedTo || null,
                projectId: taskProjectId || null,
                sourceMessageId: taskSourceMessageId,
                tags: taskTags,
                checklists: taskChecklists
            })
            if (res.success) {
                const refreshed = await getTasksData(selectedProjectFilter === 'ALL' ? undefined : selectedProjectFilter)
                if (refreshed.tasks) setTasks(refreshed.tasks)
                setShowTaskModal(false)
                const isFromChat = !!taskSourceMessageId
                setTaskSourceMessageId(null)
                setSourceSenderInfo(null)
                
                // Mostrar notificación Toast
                setToastInfo({
                    message: isFromChat ? '⚡ Tarea creada desde el chat exitosamente' : '✓ Tarea guardada en el Tablero Trello',
                    actionLabel: 'Ver Tablero ➔',
                    onAction: () => setActiveTab('kanban')
                })
                setTimeout(() => setToastInfo(null), 5000)
            }
        }
        setSavingTask(false)
    }

    // Mover tarea entre columnas en Trello
    const handleMoveTaskStatus = async (taskId: string, newStatus: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
        await updateCollabTaskStatus(taskId, newStatus)
        const refreshedProj = await getProjectsData()
        if (refreshedProj.projects) setProjects(refreshedProj.projects)
    }

    const openTaskModalForNew = (defaultStatus: string = 'PENDIENTE') => {
        setEditingTask(null)
        setTaskTitle('')
        setTaskDesc('')
        setTaskPriority('MEDIA')
        setTaskStatus(defaultStatus)
        setTaskDueDate('')
        setTaskAssignedTo(initialUser.username)
        setTaskProjectId(selectedProjectFilter !== 'ALL' ? selectedProjectFilter : '')
        setTaskTags([])
        setTaskChecklists([])
        setTaskSourceMessageId(null)
        setSourceSenderInfo(null)
        setShowTaskModal(true)
    }

    const openTaskModalForEdit = (t: TaskItem) => {
        setEditingTask(t)
        setTaskTitle(t.title)
        setTaskDesc(t.description || '')
        setTaskPriority(t.priority)
        setTaskStatus(t.status)
        setTaskDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '')
        setTaskAssignedTo(t.assignedTo || '')
        setTaskProjectId(t.projectId || '')
        setTaskTags(t.tags || [])
        setTaskChecklists(t.checklists || [])
        setTaskSourceMessageId(t.sourceMessageId || null)
        setSourceSenderInfo(null)
        setShowTaskModal(true)
    }

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('¿Deseas eliminar esta tarea?')) return
        await deleteCollabTask(taskId)
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setShowTaskModal(false)
    }

    // Crear Columna Kanban personalizada
    const handleCreateColumnSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newColumnName.trim() || savingColumn) return
        setSavingColumn(true)
        const res = await createKanbanColumn({
            name: newColumnName,
            color: newColumnColor,
            projectId: selectedProjectFilter !== 'ALL' ? selectedProjectFilter : null
        })
        if (res.success && res.column) {
            setCustomColumns(prev => [...prev, {
                id: res.column!.id,
                name: res.column!.name,
                statusKey: res.column!.statusKey,
                color: res.column!.color,
                order: res.column!.order,
                projectId: res.column!.projectId,
                createdBy: res.column!.createdBy
            }])
            setShowNewColumnModal(false)
            setNewColumnName('')
        }
        setSavingColumn(false)
    }

    const handleDeleteColumnClick = async (columnId: string) => {
        if (!confirm('¿Deseas eliminar esta columna personalizada? Las tareas en ella se conservarán.')) return
        const res = await deleteKanbanColumn(columnId)
        if (res.success) {
            setCustomColumns(prev => prev.filter(c => c.id !== columnId))
        }
    }

    // Guardar Cita / Reunión
    const handleSaveAppointment = async () => {
        if (!appTitle.trim() || !appStartDate || !appEndDate || savingApp) return
        setSavingApp(true)
        const res = await createCollabAppointment({
            title: appTitle,
            description: appDesc,
            startDate: appStartDate,
            endDate: appEndDate,
            location: appLocation,
            meetLink: appMeetLink,
            participants: appParticipants,
            projectId: appProjectId || null,
            sourceNoteId: appSourceNoteId
        })
        if (res.success) {
            const refreshed = await getAppointmentsData()
            if (refreshed.appointments) setAppointments(refreshed.appointments)
            setShowAppointmentModal(false)
            const isFromNote = !!appSourceNoteId
            setAppTitle('')
            setAppDesc('')
            setAppStartDate('')
            setAppEndDate('')
            setAppLocation('')
            setAppMeetLink('')
            setAppParticipants([])
            setAppSourceNoteId(null)
            setSourceNoteInfo(null)

            // Mostrar notificación Toast
            setToastInfo({
                message: isFromNote ? '📅 Evento agendado a partir del Post-it' : '✓ Cita guardada en el Calendario',
                actionLabel: 'Ver Calendario ➔',
                onAction: () => setActiveTab('calendar')
            })
            setTimeout(() => setToastInfo(null), 5000)
        }
        setSavingApp(false)
    }

    const handleDeleteAppointment = async (id: string) => {
        if (!confirm('¿Deseas eliminar esta cita/reunión?')) return
        await deleteCollabAppointment(id)
        setAppointments(prev => prev.filter(a => a.id !== id))
    }

    // Helpers de Proyecto
    const openNewProjectModal = () => {
        setEditingProject(null)
        setProjTitle('')
        setProjDesc('')
        setProjPriority('MEDIA')
        setProjStartDate('')
        setProjEndDate('')
        setProjMembers([initialUser.username])
        setProjColor('cyan')
        setShowProjectModal(true)
    }

    const openEditProjectModal = (p: ProjectItem) => {
        setEditingProject(p)
        setProjTitle(p.title)
        setProjDesc(p.description || '')
        setProjPriority((p.priority as any) || 'MEDIA')
        setProjStartDate(p.startDate ? p.startDate.slice(0, 10) : '')
        setProjEndDate(p.endDate ? p.endDate.slice(0, 10) : '')
        setProjMembers(p.members && p.members.length > 0 ? p.members : [initialUser.username])
        setProjColor(p.color || 'cyan')
        setShowProjectModal(true)
    }

    const handleDeleteProject = async (projId: string) => {
        if (!confirm('¿Estás seguro de eliminar este proyecto? Las tareas asociadas también se desvincularán.')) return
        const res = await deleteCollabProject(projId)
        if (res.success) {
            setProjects(prev => prev.filter(p => p.id !== projId))
            setTasks(prev => prev.filter(t => t.projectId !== projId))
            if (selectedProjectFilter === projId) {
                setSelectedProjectFilter('ALL')
            }
        }
    }

    // Guardar o Actualizar Proyecto
    const handleSaveProject = async () => {
        if (!projTitle.trim() || savingProject) return
        setSavingProject(true)

        if (editingProject) {
            const res = await updateCollabProject(editingProject.id, {
                title: projTitle,
                description: projDesc,
                priority: projPriority,
                startDate: projStartDate || null,
                endDate: projEndDate || null,
                members: projMembers,
                color: projColor
            })
            if (res.success) {
                const refreshed = await getProjectsData()
                if (refreshed.projects) setProjects(refreshed.projects)
                setShowProjectModal(false)
                setEditingProject(null)
            }
        } else {
            const res = await createCollabProject({
                title: projTitle,
                description: projDesc,
                priority: projPriority,
                startDate: projStartDate || null,
                endDate: projEndDate || null,
                members: projMembers,
                color: projColor,
                createChat: true
            })
            if (res.success) {
                const refreshed = await getProjectsData()
                if (refreshed.projects) setProjects(refreshed.projects)
                const refreshedConv = await getConversationsAndUsers()
                if (refreshedConv.conversations) setConversations(refreshedConv.conversations)
                setShowProjectModal(false)
                setProjTitle('')
                setProjDesc('')
                setProjStartDate('')
                setProjEndDate('')
                setProjMembers([initialUser.username])
            }
        }
        setSavingProject(false)
    }

    // Generador de días para vista de Calendario
    const calendarDays = useMemo(() => {
        const year = calendarDate.getFullYear()
        const month = calendarDate.getMonth()
        const firstDayOfMonth = new Date(year, month, 1)
        const lastDayOfMonth = new Date(year, month + 1, 0)
        
        const days = []
        let startingDay = firstDayOfMonth.getDay() - 1
        if (startingDay === -1) startingDay = 6
        
        for (let i = 0; i < startingDay; i++) {
            days.push({ day: 0, isCurrentMonth: false, date: null })
        }
        
        for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
            const fullDate = new Date(year, month, d)
            const dayAppointments = appointments.filter(a => {
                const appDate = new Date(a.startDate)
                return appDate.getFullYear() === year && appDate.getMonth() === month && appDate.getDate() === d
            })
            days.push({ day: d, isCurrentMonth: true, date: fullDate, appointments: dayAppointments })
        }
        return days
    }, [calendarDate, appointments])

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    return (
        <div className="space-y-6 pb-12">
            {/* Header del Espacio Colaborativo */}
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative z-20 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border border-slate-800">
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl sm:text-4xl p-2.5 bg-slate-800/80 rounded-2xl border border-cyan-500/30">💬</span>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                    HENDAYA <span className="text-cyan-400 font-medium text-xl">| Colaboración Compartida</span>
                                </h1>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                                    🔒 E2E Encrypted
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                Suite unificada: Mi Día, Chat, Trello Kanban, Notas Post-it, Gantt, Timeline, Pizarra, Calendario, Proyectos y Kudos.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones Rápidas de Cabecera (Menciones, Decisiones, Presencia) */}
                <div className="flex items-center gap-3 z-10 flex-wrap self-stretch lg:self-auto justify-end">
                    <StackedPresenceAvatars roomId="collab_main_hub" className="px-3 py-1 bg-slate-800/80 rounded-2xl border border-slate-700/60" />

                    <button
                        onClick={() => setShowDecisionsDrawer(true)}
                        className="px-3.5 py-2.5 rounded-2xl bg-purple-900/50 hover:bg-purple-900 text-purple-200 border border-purple-700/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Abrir Acta y Registro de Decisiones del Proyecto"
                    >
                        <span>⚖️</span>
                        <span className="hidden sm:inline">Actas & Decisiones</span>
                    </button>

                    <MentionsNotificationCenter />
                </div>
            </div>

            {/* Barra de Tabs de Navegación */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shadow-sm overflow-x-auto">
                <button
                    onClick={() => setActiveTab('myday')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'myday'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>☀️</span> Mi Día
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'chat'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>💬</span> Chats ({conversations.length})
                </button>
                <button
                    onClick={() => setActiveTab('kanban')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'kanban'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>📋</span> Trello ({tasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'notes'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>📌</span> Notas ({initialNotes.length})
                </button>
                <button
                    onClick={() => setActiveTab('gantt')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'gantt'
                            ? 'bg-gradient-to-r from-indigo-500 to-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>📊</span> Gantt ({initialGanttCharts.length})
                </button>
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'timeline'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>⏱️</span> Timeline
                </button>
                <button
                    onClick={() => setActiveTab('whiteboard')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'whiteboard'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>🎨</span> Pizarra
                </button>
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'calendar'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>📅</span> Calendario ({appointments.length})
                </button>
                <button
                    onClick={() => setActiveTab('projects')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'projects'
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>🚀</span> Proyectos ({projects.length})
                </button>
                <button
                    onClick={() => setActiveTab('kudos')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'kudos'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <span>🏆</span> Kudos
                </button>
            </div>

            {/* ========================================================================= */}
            {/* 0. SECCIÓN MI DÍA (DASHBOARD PERSONAL AGREGADO)                           */}
            {/* ========================================================================= */}
            {activeTab === 'myday' && (
                <MyDayView onNavigateTab={(t: any) => setActiveTab(t)} />
            )}

            {/* ========================================================================= */}
            {/* 1. SECCIÓN CHAT & MENSAJERÍA CIFRADA                                      */}
            {/* ========================================================================= */}
            {activeTab === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px] h-[calc(100vh-280px)]">
                    {/* Lista Lateral de Conversaciones y Contactos */}
                    <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between overflow-hidden">
                        <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center">
                                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                                    <span>📨</span> Conversaciones
                                </h3>
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="p-2 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                                    title="Nuevo chat directo o grupal"
                                >
                                    <span>+</span> Nuevo Chat
                                </button>
                            </div>

                            {/* Buscador */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar contacto o grupo..."
                                    value={userSearchTerm}
                                    onChange={e => setUserSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                                <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                            </div>

                            {/* Lista Scrollable */}
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                                {conversations.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-xs">
                                        <p className="text-3xl mb-2">💬</p>
                                        <p>No tienes chats activos aún.</p>
                                        <button
                                            onClick={() => setShowNewChatModal(true)}
                                            className="mt-3 px-3 py-1.5 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-700 transition-colors"
                                        >
                                            Iniciar conversación
                                        </button>
                                    </div>
                                ) : (
                                    conversations.map(conv => {
                                        const otherUser = conv.participants.find(p => p !== initialUser.username) || conv.participants[0]
                                        const isSelected = activeConvId === conv.id
                                        const userObj = users.find(u => u.username === otherUser)
                                        const displayName = conv.type === 'direct'
                                            ? (userObj?.name || otherUser)
                                            : (conv.title || 'Grupo')

                                        return (
                                            <div
                                                key={conv.id}
                                                onClick={() => {
                                                    setActiveConvId(conv.id)
                                                    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c))
                                                }}
                                                className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 select-none ${
                                                    isSelected
                                                        ? 'bg-cyan-50/80 border border-cyan-200 ring-2 ring-cyan-400/20 shadow-xs'
                                                        : 'hover:bg-slate-50 border border-transparent'
                                                }`}
                                            >
                                                <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${
                                                    conv.type === 'project'
                                                        ? 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                                                        : (conv.type === 'group'
                                                            ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                                                            : 'bg-gradient-to-tr from-cyan-600 to-sky-600')
                                                }`}>
                                                    {conv.type === 'project' ? '🚀' : (conv.type === 'group' ? '👥' : displayName.charAt(0).toUpperCase())}
                                                    {conv.unreadCount && conv.unreadCount > 0 ? (
                                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white shadow-md shadow-rose-500/40 animate-pulse">
                                                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <h4 className={`text-xs truncate max-w-[130px] ${conv.unreadCount && conv.unreadCount > 0 ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>
                                                            {displayName}
                                                        </h4>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            {conv.lastMessageAt && (
                                                                <span className={`text-[10px] ${conv.unreadCount && conv.unreadCount > 0 ? 'text-cyan-600 font-bold' : 'text-slate-400'}`}>
                                                                    {new Date(conv.lastMessageAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className={`text-[11px] truncate ${conv.unreadCount && conv.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                                        {conv.lastMessage || 'Conversación iniciada'}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Ventana de Mensajes */}
                    <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between overflow-hidden">
                        {activeConversation ? (
                            <>
                                {/* Cabecera de Conversación */}
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold text-sm">
                                            {activeConversation.type === 'project' ? '🚀' : (activeConversation.type === 'group' ? '👥' : '👤')}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-sm">
                                                {activeConversation.type === 'direct'
                                                    ? (users.find(u => u.username === activeConversation.participants.find(p => p !== initialUser.username))?.name || 'Colega')
                                                    : (activeConversation.title || 'Grupo')}
                                            </h3>
                                            <p className="text-[10px] text-slate-400">
                                                {activeConversation.participants.length} participante(s) • Cifrado AES-256
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mensajes con Auto-scroll */}
                                <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/30">
                                    {loadingMessages ? (
                                        <div className="text-center py-10 text-slate-400 text-xs">Descifrando historial...</div>
                                    ) : messages.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 text-xs">
                                            🔒 No hay mensajes en este chat. Sé el primero en escribir.
                                        </div>
                                    ) : (
                                        messages.map(m => {
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`flex flex-col group relative ${m.isMine ? 'items-end' : 'items-start'}`}
                                                >
                                                    <div className={`relative max-w-[85%] sm:max-w-[75%] rounded-3xl p-3.5 shadow-xs text-xs space-y-1.5 group/bubble transition-all ${
                                                        m.isDecision
                                                            ? 'bg-purple-50 text-purple-950 border-2 border-purple-400 shadow-md'
                                                            : (m.isMine
                                                                ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white rounded-br-none'
                                                                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none')
                                                    }`}>
                                                        {/* Cabecera del mensaje con nombre y botones de acción rápida */}
                                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {!m.isMine ? (
                                                                    <span className="font-extrabold text-[10px] text-cyan-600">
                                                                        {m.senderName || m.senderUsername}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-cyan-200 opacity-80">Tú</span>
                                                                )}

                                                                {m.isDecision && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-purple-200 text-purple-900 border border-purple-300">
                                                                        ⚖️ Acuerdo Oficial
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Botones Contextuales de Acción */}
                                                            <div className="opacity-0 group-hover/bubble:opacity-100 group-hover:opacity-100 transition-all flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleConvertMessageToTask(m)}
                                                                    className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer ${
                                                                        m.isMine
                                                                            ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                                                                            : 'bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 border border-slate-200'
                                                                    }`}
                                                                    title="Convertir este mensaje en una Tarea Trello"
                                                                >
                                                                    <span>⚡ Tarea</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => handleOpenDecisionModal(m)}
                                                                    className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer ${
                                                                        m.isDecision
                                                                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                                            : (m.isMine
                                                                                ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                                                                                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200')
                                                                    }`}
                                                                    title="Fijar o retirar este mensaje del Acta de Decisiones del Proyecto"
                                                                >
                                                                    <span>⚖️ Decisión</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Resumen de decisión si existe */}
                                                        {m.isDecision && m.decisionSummary && (
                                                            <div className="p-2 rounded-xl bg-purple-100/70 border border-purple-200 text-purple-900 font-bold text-[11px]">
                                                                📌 Resumen: {m.decisionSummary}
                                                            </div>
                                                        )}

                                                        {/* Contenido del Mensaje */}
                                                        <div className="whitespace-pre-wrap leading-relaxed font-normal select-text">
                                                            {m.content}
                                                        </div>

                                                        {/* Renderizado de Encuesta si existe */}
                                                        {m.polls && m.polls.length > 0 && (
                                                            <div className="mt-2">
                                                                {m.polls.map((p: any) => (
                                                                    <PollCard key={p.id} poll={p} currentUsername={initialUser.username} />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Reacciones Emoji existentes */}
                                                        {m.reactions && m.reactions.length > 0 && (
                                                            <div className="flex items-center gap-1 flex-wrap pt-1">
                                                                {Array.from(new Set(m.reactions.map(r => r.emoji))).map(emoji => {
                                                                    const count = m.reactions!.filter(r => r.emoji === emoji).length
                                                                    const hasMyReaction = m.reactions!.some(r => r.emoji === emoji && r.username === initialUser.username)
                                                                    return (
                                                                        <button
                                                                            key={emoji}
                                                                            onClick={() => handleToggleReaction(m.id, emoji)}
                                                                            className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                                                                                hasMyReaction
                                                                                    ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                                                                                    : 'bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                                                            }`}
                                                                        >
                                                                            <span>{emoji}</span>
                                                                            <span>{count}</span>
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Hora y Selector Rápido de Emojis */}
                                                        <div className="flex items-center justify-between gap-2 pt-1">
                                                            {/* Selector rápido de reacciones */}
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                                                                {['👍', '❤️', '🚀', '🎉', '👀', '✅'].map(em => (
                                                                    <button
                                                                        key={em}
                                                                        type="button"
                                                                        onClick={() => handleToggleReaction(m.id, em)}
                                                                        className="text-xs hover:scale-125 transition-transform p-0.5"
                                                                        title={`Reaccionar con ${em}`}
                                                                    >
                                                                        {em}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className={`text-[9px] text-right font-medium flex items-center justify-end gap-1 ${
                                                                m.isMine ? 'text-cyan-100' : 'text-slate-400'
                                                            }`}>
                                                                <span>{new Date(m.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                {m.isMine && <span>✓✓</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Entrada de Mensaje Enriquecida con Menciones (@) y Encuestas */}
                                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white flex flex-col gap-2">
                                    <MentionInput
                                        value={messageInput}
                                        onChange={setMessageInput}
                                        users={users}
                                        placeholder="Escribe un mensaje... (Usa @ para autocompletar y mencionar colegas)"
                                        rows={2}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendMessage(e as any)
                                            }
                                        }}
                                    />

                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setShowPollModal(true)}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                title="Crear Encuesta Rápida en el Chat"
                                            >
                                                <span>📊</span>
                                                <span className="hidden sm:inline">Encuesta</span>
                                            </button>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={!messageInput.trim() || sendingMsg}
                                            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                                        >
                                            <span>Enviar</span>
                                            <span>🚀</span>
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
                                <p className="text-5xl mb-3">💬</p>
                                <h3 className="text-base font-extrabold text-slate-700">Espacio de Conversación</h3>
                                <p className="text-xs max-w-sm mt-1">Selecciona una conversación del panel izquierdo o inicia una nueva con cualquier usuario registrado.</p>
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-cyan-700 transition-colors"
                                >
                                    + Nuevo Chat
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 2. SECCIÓN TABLERO KANBAN ESTILO TRELLO (CON COLUMNAS DINÁMICAS)          */}
            {/* ========================================================================= */}
            {activeTab === 'kanban' && (
                <div className="space-y-4">
                    {/* Barra de Filtros y Acción Rápida */}
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Filtrar por Proyecto:</span>
                            <select
                                value={selectedProjectFilter}
                                onChange={e => setSelectedProjectFilter(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-cyan-200 outline-none"
                            >
                                <option value="ALL">🌐 Todos los Proyectos ({tasks.length} tareas)</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>🚀 {p.title}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowNewColumnModal(true)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all border border-slate-200"
                            >
                                <span>➕</span> Añadir Columna
                            </button>
                            <button
                                onClick={() => openTaskModalForNew('PENDIENTE')}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs shadow-md shadow-cyan-600/20 flex items-center gap-1.5 transition-all"
                            >
                                <span>➕</span> Nueva Tarea
                            </button>
                        </div>
                    </div>

                    {/* Columnas Kanban Dinámicas con Scroll Horizontal */}
                    <div className="flex gap-5 overflow-x-auto pb-4 items-start">
                        {allColumns.map(col => {
                            const colTasks = tasksByColumn[col.statusKey] || []
                            const styles = COLUMN_COLOR_STYLES[col.color || 'slate'] || COLUMN_COLOR_STYLES.slate

                            return (
                                <div
                                    key={col.id}
                                    className={`w-80 flex-shrink-0 ${styles.bg} p-4 rounded-3xl border ${styles.border} flex flex-col min-h-[520px] shadow-sm`}
                                >
                                    <div className="flex justify-between items-center mb-3 px-1">
                                        <h4 className={`font-black ${styles.text} text-xs uppercase tracking-wider flex items-center gap-1.5`}>
                                            <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`}></span>
                                            {col.icon} {col.name}
                                        </h4>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`${styles.badgeBg} ${styles.badgeText} px-2 py-0.5 rounded-lg text-xs font-black`}>
                                                {colTasks.length}
                                            </span>
                                            {!col.isDefault && (
                                                <button
                                                    onClick={() => handleDeleteColumnClick(col.id)}
                                                    className="text-slate-400 hover:text-rose-600 p-1 text-xs transition-colors"
                                                    title="Eliminar columna personalizada"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto pr-1 max-h-[600px]">
                                        {colTasks.map(task => renderTaskCard(task))}
                                        {colTasks.length === 0 && (
                                            <div className="py-8 text-center text-slate-400 text-xs italic">
                                                Sin tareas en esta etapa
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => openTaskModalForNew(col.statusKey)}
                                        className={`mt-3 w-full py-2 border-2 border-dashed ${styles.addBorder} ${styles.addHover} ${styles.addText} rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1`}
                                    >
                                        <span>+</span> Añadir tarjeta
                                    </button>
                                </div>
                            )
                        })}

                        {/* Tarjeta Rápida "+ Añadir Columna" */}
                        <div
                            onClick={() => setShowNewColumnModal(true)}
                            className="w-72 flex-shrink-0 min-h-[140px] border-2 border-dashed border-slate-300 hover:border-cyan-400 hover:bg-cyan-50/30 rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all text-slate-400 hover:text-cyan-700"
                        >
                            <span className="text-2xl mb-1">➕</span>
                            <span className="text-xs font-bold">Añadir otra columna</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Personaliza tu flujo Kanban</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 3. SECCIÓN NOTAS ADHESIVAS ESTILO POST-IT                                 */}
            {/* ========================================================================= */}
            {activeTab === 'notes' && (
                <NotesView
                    initialNotes={initialNotes}
                    currentUsername={initialUser.username}
                    users={users}
                    onConvertToAppointment={handleConvertNoteToAppointment}
                />
            )}

            {/* ========================================================================= */}
            {/* 4. SECCIÓN CRONOGRAMAS GANTT (COMPARTIDAS EN MODO LECTURA)                */}
            {/* ========================================================================= */}
            {activeTab === 'gantt' && (
                <GanttView
                    initialCharts={initialGanttCharts}
                    currentUsername={initialUser.username}
                    users={users}
                    projects={projects}
                />
            )}

            {/* ========================================================================= */}
            {/* 5. SECCIÓN CITAS & CALENDARIO                                             */}
            {/* ========================================================================= */}
            {activeTab === 'calendar' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Calendario Mensual */}
                    <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        {/* Cabecera del Calendario */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black text-slate-900">
                                    {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                                </h3>
                                <button
                                    onClick={() => setCalendarDate(new Date())}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                                >
                                    Hoy
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-sm"
                                >
                                    ◀
                                </button>
                                <button
                                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-sm"
                                >
                                    ▶
                                </button>
                            </div>
                        </div>

                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-black text-slate-400 uppercase tracking-wider">
                            <div>Lun</div>
                            <div>Mar</div>
                            <div>Mié</div>
                            <div>Jue</div>
                            <div>Vie</div>
                            <div>Sáb</div>
                            <div>Dom</div>
                        </div>

                        {/* Rejilla de Días */}
                        <div className="grid grid-cols-7 gap-2">
                            {calendarDays.map((item, idx) => {
                                if (!item.isCurrentMonth) {
                                    return <div key={idx} className="h-24 bg-slate-50/40 rounded-2xl"></div>
                                }
                                const isToday = item.date && new Date().toDateString() === item.date.toDateString()
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            if (item.date) {
                                                const dt = item.date.toISOString().slice(0, 10)
                                                setAppStartDate(`${dt}T09:00`)
                                                setAppEndDate(`${dt}T10:00`)
                                                setShowAppointmentModal(true)
                                            }
                                        }}
                                        className={`h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                                            isToday
                                                ? 'bg-cyan-50/80 border-cyan-300 ring-2 ring-cyan-200'
                                                : 'bg-white hover:bg-cyan-50/30 border-slate-100'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`text-xs font-bold rounded-lg px-1.5 py-0.5 ${
                                                isToday ? 'bg-cyan-600 text-white font-black' : 'text-slate-700 group-hover:text-cyan-700'
                                            }`}>
                                                {item.day}
                                            </span>
                                            {item.appointments && item.appointments.length > 0 && (
                                                <span className="text-[10px] font-black text-cyan-600 bg-cyan-100 px-1.5 rounded-full">
                                                    {item.appointments.length}
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1 overflow-hidden">
                                            {item.appointments?.slice(0, 2).map(app => (
                                                <div key={app.id} className="text-[10px] bg-slate-900 text-white font-medium px-1.5 py-0.5 rounded truncate" title={app.title}>
                                                    {app.title}
                                                </div>
                                            ))}
                                            {item.appointments && item.appointments.length > 2 && (
                                                <span className="text-[9px] text-slate-400 font-bold block">+ {item.appointments.length - 2} más</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Próximas Citas y Agendar */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                                    <span>📅</span> Próximas Citas
                                </h3>
                                <button
                                    onClick={() => setShowAppointmentModal(true)}
                                    className="px-3 py-1.5 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700"
                                >
                                    + Agendar
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[480px] overflow-y-auto">
                                {appointments.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-xs">
                                        No hay reuniones ni citas programadas.
                                    </div>
                                ) : (
                                    appointments.map(app => (
                                        <div key={app.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-colors space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="font-bold text-slate-800 text-xs">{app.title}</h4>
                                                    {app.sourceNoteId && (
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5" title="Evento originado desde una Nota Post-it">
                                                            📌 De Post-it
                                                        </span>
                                                    )}
                                                </div>
                                                {app.isMine && (
                                                    <button
                                                        onClick={() => handleDeleteAppointment(app.id)}
                                                        className="text-slate-400 hover:text-rose-500 text-xs"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                            {app.description && <p className="text-[11px] text-slate-500 line-clamp-3">{app.description}</p>}
                                            <div className="text-[10px] text-slate-400 flex items-center gap-3">
                                                <span>🕒 {new Date(app.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            {app.meetLink && (
                                                <a
                                                    href={app.meetLink.startsWith('http') ? app.meetLink : `https://${app.meetLink}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] text-cyan-600 font-bold hover:underline"
                                                >
                                                    🔗 Unirse a Reunión (Meet/Teams)
                                                </a>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. SECCIÓN PROYECTOS                                                      */}
            {/* ========================================================================= */}
            {activeTab === 'projects' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-slate-800 text-sm">Proyectos del Equipo</h3>
                            <p className="text-xs text-slate-400">Coordina iniciativas multifuncionales con tu equipo.</p>
                        </div>
                        <button
                            onClick={openNewProjectModal}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                        >
                            + Nuevo Proyecto
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {liveProjects.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-slate-400">
                                <p className="text-4xl mb-2">🚀</p>
                                <p className="font-bold text-slate-700">No hay proyectos activos</p>
                                <button
                                    onClick={openNewProjectModal}
                                    className="mt-3 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                                >
                                    Crear el Primer Proyecto
                                </button>
                            </div>
                        ) : (
                            liveProjects.map(proj => (
                                <div key={proj.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                {proj.priority}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400 mr-1">@{proj.createdBy}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openEditProjectModal(proj)
                                                    }}
                                                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors text-xs cursor-pointer"
                                                    title="Editar proyecto"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteProject(proj.id)
                                                    }}
                                                    className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors text-xs cursor-pointer"
                                                    title="Eliminar proyecto"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        <h4 className="font-black text-slate-900 text-sm">{proj.title}</h4>
                                        {proj.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2">{proj.description}</p>
                                        )}
                                    </div>

                                    {/* Barra de Progreso Dinámica y Tareas */}
                                    <div>
                                        <div className="flex justify-between items-center text-xs font-bold mb-1">
                                            <span className="text-slate-600">
                                                Progreso ({proj.completedTasks}/{proj.totalTasks} tareas)
                                            </span>
                                            <span className="text-cyan-600 font-black">{proj.progressPct}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-500 to-sky-600 rounded-full transition-all duration-500"
                                                style={{ width: `${proj.progressPct}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Acciones del Proyecto */}
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                        <div className="flex -space-x-2">
                                            {proj.members.slice(0, 4).map(m => (
                                                <div
                                                    key={m}
                                                    className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center border-2 border-white"
                                                    title={`@${m}`}
                                                >
                                                    {m.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {proj.members.length > 4 && (
                                                <span className="text-[10px] text-slate-400 font-bold pl-3">
                                                    +{proj.members.length - 4}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                setSelectedProjectFilter(proj.id)
                                                setActiveTab('kanban')
                                            }}
                                            className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            Ver Tablero ➔
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 7. SECCIÓN TIMELINE UNIFICADO DE ACTIVIDAD                                */}
            {/* ========================================================================= */}
            {activeTab === 'timeline' && (
                <TimelineView
                    projectId={selectedProjectFilter !== 'ALL' ? selectedProjectFilter : (projects[0]?.id || 'workspace_general')}
                    projectTitle={projects.find(p => p.id === selectedProjectFilter)?.title || (projects[0]?.title || 'Espacio General Hendaya')}
                    members={users.map(u => u.username)}
                    currentUsername={initialUser.username}
                />
            )}

            {/* ========================================================================= */}
            {/* 8. SECCIÓN PIZARRA / WHITEBOARD INTERACTIVO                               */}
            {/* ========================================================================= */}
            {activeTab === 'whiteboard' && (
                <WhiteboardView
                    projectId={selectedProjectFilter !== 'ALL' ? selectedProjectFilter : (projects[0]?.id || 'workspace_general')}
                    projectTitle={projects.find(p => p.id === selectedProjectFilter)?.title || (projects[0]?.title || 'Pizarra Principal Hendaya')}
                    currentUsername={initialUser.username}
                />
            )}

            {/* ========================================================================= */}
            {/* 9. SECCIÓN MURO DE RECONOCIMIENTOS (KUDOS)                                */}
            {/* ========================================================================= */}
            {activeTab === 'kudos' && (
                <KudosView
                    currentUsername={initialUser.username}
                    currentName={initialUser.name}
                    users={users}
                    projectId={selectedProjectFilter !== 'ALL' ? selectedProjectFilter : undefined}
                />
            )}

            {/* Panel Lateral: Acta Rápida y Decisiones del Proyecto */}
            <DecisionsDrawer
                projectId={selectedProjectFilter !== 'ALL' ? selectedProjectFilter : (projects[0]?.id || '')}
                projectTitle={projects.find(p => p.id === selectedProjectFilter)?.title || (projects[0]?.title || 'General')}
                isOpen={showDecisionsDrawer}
                onClose={() => setShowDecisionsDrawer(false)}
            />

            {/* Modal: Confirmar / Editar Decisión Formal */}
            {decisionModalMessage && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 bg-purple-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">⚖️</span>
                                <h3 className="font-black text-slate-900 text-sm">
                                    {decisionModalMessage.isDecision ? 'Retirar del Acta de Decisiones' : 'Marcar como Acuerdo / Decisión Oficial'}
                                </h3>
                            </div>
                            <button onClick={() => setDecisionModalMessage(null)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-600">
                                {decisionModalMessage.isDecision
                                    ? '¿Deseas desmarcar este mensaje? Ya no aparecerá en el acta rápida de decisiones ni en los reportes PDF.'
                                    : 'Este mensaje se registrará en el Acta Rápida del Proyecto y se podrá exportar en el informe PDF oficial.'}
                            </p>

                            {!decisionModalMessage.isDecision && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Título o Resumen Ejecutivo del Acuerdo *</label>
                                    <input
                                        type="text"
                                        value={decisionSummaryInput}
                                        onChange={e => setDecisionSummaryInput(e.target.value)}
                                        placeholder="Ej: Aprobación de nuevo menú PAE para marzo..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-400 outline-none"
                                    />
                                </div>
                            )}

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 select-text">
                                "{decisionModalMessage.content}"
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setDecisionModalMessage(null)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmDecision}
                                    className={`px-5 py-2 rounded-xl text-xs font-black shadow-md transition-all text-white cursor-pointer ${
                                        decisionModalMessage.isDecision ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
                                    }`}
                                >
                                    {decisionModalMessage.isDecision ? 'Retirar Decisión' : 'Confirmar y Fijar Decisión ⚖️'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Crear Encuesta en el Chat */}
            {showPollModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 bg-cyan-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">📊</span>
                                <h3 className="font-black text-slate-900 text-sm">Crear Encuesta Rápida</h3>
                            </div>
                            <button onClick={() => setShowPollModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
                        </div>

                        <form onSubmit={handleCreatePoll} className="p-6 space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Pregunta de la Encuesta *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: ¿Qué fecha definimos para la auditoría PAE?"
                                    value={pollQuestion}
                                    onChange={e => setPollQuestion(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Opción 1 *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Lunes 9:00 AM"
                                    value={pollOption1}
                                    onChange={e => setPollOption1(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Opción 2 *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Miércoles 14:00 PM"
                                    value={pollOption2}
                                    onChange={e => setPollOption2(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Opción 3 (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Viernes 11:00 AM"
                                    value={pollOption3}
                                    onChange={e => setPollOption3(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-4 pt-1 text-xs text-slate-700 font-bold">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={pollAllowMultiple}
                                        onChange={e => setPollAllowMultiple(e.target.checked)}
                                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span>Opción múltiple</span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={pollIsAnonymous}
                                        onChange={e => setPollIsAnonymous(e.target.checked)}
                                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span>Voto anónimo</span>
                                </label>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPollModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!pollQuestion.trim() || !pollOption1.trim() || !pollOption2.trim() || creatingPoll}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-md shadow-cyan-600/20 cursor-pointer"
                                >
                                    {creatingPoll ? 'Publicando...' : 'Publicar Encuesta 📊'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODALES                                                                   */}
            {/* ========================================================================= */}

            {/* Modal: Crear Columna Kanban */}
            {showNewColumnModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Añadir Columna al Tablero</h3>
                                <p className="text-xs text-slate-500">Crea una nueva etapa personalizada para tu flujo de trabajo.</p>
                            </div>
                            <button onClick={() => setShowNewColumnModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                        </div>

                        <form onSubmit={handleCreateColumnSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Columna *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Bloqueado, Control Calidad, En Despliegue..."
                                    value={newColumnName}
                                    onChange={e => setNewColumnName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Color de la Columna</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.entries(COLUMN_COLOR_STYLES).map(([key, style]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setNewColumnColor(key)}
                                            className={`p-2.5 rounded-xl border-2 text-xs font-bold capitalize transition-all ${newColumnColor === key ? 'ring-2 ring-slate-800 scale-105 shadow-sm' : 'opacity-80 hover:opacity-100'} ${style.bg} ${style.border} ${style.text}`}
                                        >
                                            {key}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowNewColumnModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newColumnName.trim() || savingColumn}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
                                >
                                    {savingColumn ? 'Guardando...' : 'Crear Columna'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Nuevo Chat Directo / Grupal */}
            {showNewChatModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Iniciar Conversación</h3>
                                <p className="text-xs text-slate-500">Selecciona un colega o crea un grupo de trabajo.</p>
                            </div>
                            <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[450px] overflow-y-auto">
                            {/* Opción Crear Grupo */}
                            <div className="p-4 bg-cyan-50/50 rounded-2xl border border-cyan-100 space-y-3">
                                <p className="text-xs font-black text-cyan-900 uppercase">Crear Chat Grupal</p>
                                <input
                                    type="text"
                                    placeholder="Nombre del grupo (ej: Equipo Supervisores Zonal)"
                                    value={groupTitle}
                                    onChange={e => setGroupTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-white rounded-xl border border-cyan-200 text-xs outline-none"
                                />

                                {/* Selector Rápido de Miembros por Rol */}
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[10px] font-black text-cyan-900 uppercase tracking-wider block">Añadir miembros por Rol:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Array.from(new Set(users.map(u => u.role).filter(Boolean))).map(role => {
                                            const roleUsers = users.filter(u => u.username !== initialUser.username && (u.role === role || u.role?.toLowerCase() === role.toLowerCase()))
                                            if (roleUsers.length === 0) return null
                                            const allSelected = roleUsers.every(u => selectedGroupMembers.includes(u.username))
                                            return (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onClick={() => {
                                                        const usernames = roleUsers.map(u => u.username)
                                                        if (allSelected) {
                                                            setSelectedGroupMembers(prev => prev.filter(u => !usernames.includes(u)))
                                                        } else {
                                                            setSelectedGroupMembers(prev => Array.from(new Set([...prev, ...usernames])))
                                                            if (!groupTitle.trim()) {
                                                                setGroupTitle(`Grupo ${role}`)
                                                            }
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                                        allSelected
                                                            ? 'bg-cyan-700 text-white border-cyan-700 shadow-xs'
                                                            : 'bg-white text-cyan-800 border-cyan-200 hover:bg-cyan-100/70'
                                                    }`}
                                                >
                                                    <span>{allSelected ? '✓' : '➕'}</span>
                                                    <span className="capitalize">{role} ({roleUsers.length})</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {selectedGroupMembers.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {selectedGroupMembers.map(m => (
                                            <span key={m} className="px-2 py-0.5 bg-cyan-200 text-cyan-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                                @{m}
                                                <button onClick={() => setSelectedGroupMembers(prev => prev.filter(x => x !== m))}>✕</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!groupTitle.trim() || selectedGroupMembers.length === 0 || creatingGroup}
                                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                                >
                                    Crear Grupo ({selectedGroupMembers.length} miembros seleccionados)
                                </button>
                            </div>

                            {/* Lista de Usuarios Disponibles */}
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">O selecciona un usuario para chat 1 a 1:</p>
                            <div className="space-y-2">
                                {users.filter(u => u.username !== initialUser.username).map(user => {
                                    const isSelectedForGroup = selectedGroupMembers.includes(user.username)
                                    return (
                                        <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{user.name}</p>
                                                    <p className="text-[10px] text-slate-400">@{user.username} • {user.role}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (isSelectedForGroup) {
                                                            setSelectedGroupMembers(prev => prev.filter(x => x !== user.username))
                                                        } else {
                                                            setSelectedGroupMembers(prev => [...prev, user.username])
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                                        isSelectedForGroup
                                                            ? 'bg-cyan-600 text-white border-cyan-600'
                                                            : 'bg-white text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    {isSelectedForGroup ? '✓ Agregado' : '+ Grupo'}
                                                </button>
                                                <button
                                                    onClick={() => handleStartDirectChat(user.username)}
                                                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold"
                                                >
                                                    Chatear
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Crear / Editar Tarea Trello */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <span>📋</span> {editingTask ? 'Editar Tarjeta de Tarea' : 'Nueva Tarjeta (Trello)'}
                            </h3>
                            <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                            {/* Banner de Origen Chat si proviene de conversión rápida */}
                            {taskSourceMessageId && (
                                <div className="p-3.5 bg-gradient-to-r from-cyan-50 to-sky-50 rounded-2xl border border-cyan-200 flex items-center justify-between text-xs text-cyan-950 shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xl">💬</span>
                                        <div>
                                            <p className="font-black text-cyan-900">Convertida desde Mensaje de Chat</p>
                                            {sourceSenderInfo && (
                                                <p className="text-[11px] text-cyan-700">
                                                    Autor: <strong>@{sourceSenderInfo.senderUsername}</strong> • {sourceSenderInfo.date}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-cyan-200/80 rounded-lg text-cyan-900">
                                        Ref: {taskSourceMessageId.slice(0, 8)}
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Título de la Tarea *</label>
                                <input
                                    type="text"
                                    value={taskTitle}
                                    onChange={e => setTaskTitle(e.target.value)}
                                    placeholder="Ej: Revisar documentación de auditoría"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Notas</label>
                                <textarea
                                    rows={3}
                                    value={taskDesc}
                                    onChange={e => setTaskDesc(e.target.value)}
                                    placeholder="Detalles de la tarea..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Columna / Estado</label>
                                    <select
                                        value={taskStatus}
                                        onChange={e => setTaskStatus(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    >
                                        {allColumns.map(c => (
                                            <option key={c.statusKey} value={c.statusKey}>
                                                {c.icon} {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Prioridad</label>
                                    <select
                                        value={taskPriority}
                                        onChange={e => setTaskPriority(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    >
                                        <option value="BAJA">🟢 Baja</option>
                                        <option value="MEDIA">🟡 Media</option>
                                        <option value="ALTA">🟠 Alta</option>
                                        <option value="URGENTE">🔴 Urgente</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Asignar a</label>
                                    <select
                                        value={taskAssignedTo}
                                        onChange={e => setTaskAssignedTo(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    >
                                        <option value="">(Sin asignar)</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.username}>{u.name} (@{u.username})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Límite</label>
                                    <input
                                        type="date"
                                        value={taskDueDate}
                                        onChange={e => setTaskDueDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            {/* Sub-tareas Checklist */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Checklist de Sub-tareas</label>
                                <div className="space-y-2 mb-2">
                                    {taskChecklists.map((item, idx) => (
                                        <div key={item.id} className="flex items-center gap-2 text-xs">
                                            <input
                                                type="checkbox"
                                                checked={item.done}
                                                onChange={e => {
                                                    const updated = [...taskChecklists]
                                                    updated[idx].done = e.target.checked
                                                    setTaskChecklists(updated)
                                                }}
                                                className="w-4 h-4 rounded text-cyan-600"
                                            />
                                            <span className={`flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                {item.text}
                                            </span>
                                            <button
                                                onClick={() => setTaskChecklists(prev => prev.filter(x => x.id !== item.id))}
                                                className="text-slate-400 hover:text-rose-500"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Añadir ítem a la lista..."
                                        value={newChecklistText}
                                        onChange={e => setNewChecklistText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newChecklistText.trim()) {
                                                e.preventDefault()
                                                setTaskChecklists(prev => [...prev, { id: Math.random().toString(), text: newChecklistText.trim(), done: false }])
                                                setNewChecklistText('')
                                            }
                                        }}
                                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (newChecklistText.trim()) {
                                                setTaskChecklists(prev => [...prev, { id: Math.random().toString(), text: newChecklistText.trim(), done: false }])
                                                setNewChecklistText('')
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            {editingTask ? (
                                <button
                                    onClick={() => handleDeleteTask(editingTask.id)}
                                    className="text-rose-600 hover:text-rose-700 font-bold text-xs"
                                >
                                    Eliminar Tarea
                                </button>
                            ) : <div></div>}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowTaskModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveTask}
                                    disabled={!taskTitle.trim() || savingTask}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
                                >
                                    {savingTask ? 'Guardando...' : (editingTask ? 'Actualizar' : 'Crear Tarjeta')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Crear Cita / Calendario */}
            {showAppointmentModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-black text-slate-900">Agendar Cita / Reunión</h3>
                            <button onClick={() => setShowAppointmentModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                            {/* Banner de Origen Post-it si proviene de conversión rápida */}
                            {appSourceNoteId && (
                                <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 flex items-center justify-between text-xs text-amber-950 shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xl">📌</span>
                                        <div>
                                            <p className="font-black text-amber-900">Agendada desde Nota Post-it</p>
                                            {sourceNoteInfo && (
                                                <p className="text-[11px] text-amber-700">
                                                    Nota de: <strong>@{sourceNoteInfo.createdBy}</strong> • {sourceNoteInfo.date}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-200/80 rounded-lg text-amber-900">
                                        Ref: {appSourceNoteId.slice(0, 8)}
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Título de la Reunión / Evento *</label>
                                <input
                                    type="text"
                                    value={appTitle}
                                    onChange={e => setAppTitle(e.target.value)}
                                    placeholder="Ej: Reunión de Coordinación Zonal"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Notas</label>
                                <textarea
                                    rows={3}
                                    value={appDesc}
                                    onChange={e => setAppDesc(e.target.value)}
                                    placeholder="Detalles de la reunión o evento..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha y Hora Inicio *</label>
                                    <input
                                        type="datetime-local"
                                        value={appStartDate}
                                        onChange={e => setAppStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha y Hora Término *</label>
                                    <input
                                        type="datetime-local"
                                        value={appEndDate}
                                        onChange={e => setAppEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Enlace de Videollamada (Meet / Teams)</label>
                                <input
                                    type="text"
                                    value={appMeetLink}
                                    onChange={e => setAppMeetLink(e.target.value)}
                                    placeholder="https://meet.google.com/xyz-abc"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Ubicación / Sala</label>
                                <input
                                    type="text"
                                    value={appLocation}
                                    onChange={e => setAppLocation(e.target.value)}
                                    placeholder="Ej: Sala de Juntas Casa Matriz o Virtual"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Participantes Invitados</label>
                                <div className="max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                                    {users.map(u => {
                                        const isChecked = appParticipants.includes(u.username)
                                        return (
                                            <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={e => {
                                                        if (e.target.checked) setAppParticipants(prev => [...prev, u.username])
                                                        else setAppParticipants(prev => prev.filter(x => x !== u.username))
                                                    }}
                                                    className="w-4 h-4 rounded text-cyan-600"
                                                />
                                                <span className="font-medium text-slate-800">{u.name} (@{u.username})</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAppointmentModal(false)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveAppointment}
                                disabled={!appTitle.trim() || !appStartDate || !appEndDate || savingApp}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
                            >
                                {savingApp ? 'Agendando...' : 'Agendar Cita'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Crear / Editar Proyecto */}
            {showProjectModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    {editingProject ? 'Editar Proyecto Colaborativo' : 'Nuevo Proyecto Colaborativo'}
                                </h3>
                                <p className="text-xs text-slate-500">Planifica entregables, fechas y equipo asignado.</p>
                            </div>
                            <button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Proyecto *</label>
                                <input
                                    type="text"
                                    value={projTitle}
                                    onChange={e => setProjTitle(e.target.value)}
                                    placeholder="Ej: Implementación Plan PAE 2026"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
                                <textarea
                                    rows={2}
                                    value={projDesc}
                                    onChange={e => setProjDesc(e.target.value)}
                                    placeholder="Objetivos del proyecto..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-200 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Prioridad</label>
                                    <select
                                        value={projPriority}
                                        onChange={e => setProjPriority(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none bg-white"
                                    >
                                        <option value="BAJA">Baja</option>
                                        <option value="MEDIA">Media</option>
                                        <option value="ALTA">Alta</option>
                                        <option value="URGENTE">Urgente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Color del Tema</label>
                                    <select
                                        value={projColor}
                                        onChange={e => setProjColor(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none bg-white"
                                    >
                                        <option value="cyan">Cyan / Azul Hendaya</option>
                                        <option value="emerald">Verde Esmeralda</option>
                                        <option value="indigo">Índigo / Púrpura</option>
                                        <option value="amber">Ámbar / Naranja</option>
                                        <option value="rose">Rosa / Coral</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={projStartDate}
                                        onChange={e => setProjStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Término</label>
                                    <input
                                        type="date"
                                        value={projEndDate}
                                        onChange={e => setProjEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Miembros del Equipo</label>
                                <div className="max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                                    {users.map(u => {
                                        const isChecked = projMembers.includes(u.username)
                                        return (
                                            <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={e => {
                                                        if (e.target.checked) setProjMembers(prev => [...prev, u.username])
                                                        else setProjMembers(prev => prev.filter(x => x !== u.username))
                                                    }}
                                                    className="w-4 h-4 rounded text-cyan-600 cursor-pointer"
                                                />
                                                <span className="font-medium text-slate-800">{u.name} (@{u.username})</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowProjectModal(false)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveProject}
                                disabled={!projTitle.trim() || savingProject}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                            >
                                {savingProject ? 'Guardando...' : (editingProject ? 'Guardar Cambios' : 'Crear Proyecto')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Toast Notification */}
            {toastInfo && (
                <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-cyan-500/40 flex items-center gap-4">
                        <span className="text-xs font-bold">{toastInfo.message}</span>
                        {toastInfo.actionLabel && toastInfo.onAction && (
                            <button
                                onClick={() => {
                                    toastInfo.onAction!()
                                    setToastInfo(null)
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
                            >
                                {toastInfo.actionLabel}
                            </button>
                        )}
                        <button
                            onClick={() => setToastInfo(null)}
                            className="text-slate-400 hover:text-white text-xs font-bold p-1"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    )

    // Renderizado de tarjeta de Tarea Trello
    function renderTaskCard(task: TaskItem) {
        const priorityColors: Record<string, string> = {
            BAJA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            MEDIA: 'bg-amber-50 text-amber-700 border-amber-200',
            ALTA: 'bg-orange-50 text-orange-700 border-orange-200',
            URGENTE: 'bg-rose-50 text-rose-700 border-rose-200'
        }

        const totalChecks = task.checklists?.length || 0
        const doneChecks = task.checklists?.filter(c => c.done).length || 0

        const curColIdx = allColumns.findIndex(c => c.statusKey === task.status)

        return (
            <div
                key={task.id}
                onClick={() => openTaskModalForEdit(task)}
                className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 hover:shadow-md hover:border-cyan-300 transition-all cursor-pointer space-y-2 group"
            >
                {/* Badges superiores: Proyecto, Origen Chat y Prioridad */}
                <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                        {task.projectTitle && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 truncate max-w-[120px]">
                                🚀 {task.projectTitle}
                            </span>
                        )}
                        {task.sourceMessageId && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-300 flex items-center gap-0.5 shadow-xs" title="Tarea creada a partir de un mensaje en el Chat">
                                <span>💬</span> De Chat
                            </span>
                        )}
                    </div>

                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${priorityColors[task.priority] || 'bg-slate-100 text-slate-700'}`}>
                        {task.priority}
                    </span>
                </div>

                {/* Título de la tarea */}
                <h5 className="font-bold text-slate-900 text-xs group-hover:text-cyan-700 transition-colors leading-snug">
                    {task.title}
                </h5>

                {/* Sub-tareas progress */}
                {totalChecks > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                        <span>☑️ {doneChecks}/{totalChecks}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cyan-600 rounded-full"
                                style={{ width: `${Math.round((doneChecks / totalChecks) * 100)}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Pie de la tarjeta: Asignado, Fecha y Botones de cambio rápido */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                        {task.assignedTo ? (
                            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                @{task.assignedTo}
                            </span>
                        ) : (
                            <span className="italic text-slate-400">Sin asignar</span>
                        )}
                        {task.dueDate && (
                            <span className="font-medium text-slate-500">
                                📅 {new Date(task.dueDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                            </span>
                        )}
                    </div>

                    {/* Mover rápido de columna */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {curColIdx > 0 && (
                            <button
                                onClick={() => handleMoveTaskStatus(task.id, allColumns[curColIdx - 1].statusKey)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 font-black text-xs"
                                title={`Mover a "${allColumns[curColIdx - 1].name}"`}
                            >
                                ◀
                            </button>
                        )}
                        {curColIdx >= 0 && curColIdx < allColumns.length - 1 && (
                            <button
                                onClick={() => handleMoveTaskStatus(task.id, allColumns[curColIdx + 1].statusKey)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 font-black text-xs"
                                title={`Avanzar a "${allColumns[curColIdx + 1].name}"`}
                            >
                                ▶
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }
}
