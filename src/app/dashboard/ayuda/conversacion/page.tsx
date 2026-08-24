import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ConversacionClient from './ConversacionClient'
import {
    getConversationsAndUsers,
    getTasksData,
    getAppointmentsData,
    getProjectsData,
    getKanbanColumnsData,
    getNotesData,
    getGanttChartsData
} from './actions'

export const metadata: Metadata = {
    title: 'Conversación y Colaboración | Hendaya',
    description: 'Espacio colaborativo con mensajería cifrada, tablero Trello expandible, notas adhesivas estilo Post-it, citas y cartas Gantt compartidas.'
}

export default async function ConversacionPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    // Carga paralela de datos iniciales
    const [convData, tasksData, appData, projectsData, kanbanColsData, notesData, ganttData] = await Promise.all([
        getConversationsAndUsers(),
        getTasksData(),
        getAppointmentsData(),
        getProjectsData(),
        getKanbanColumnsData(),
        getNotesData(),
        getGanttChartsData()
    ])

    return (
        <ConversacionClient 
            initialUser={session.user}
            initialConversations={convData.conversations || []}
            initialUsers={convData.users || []}
            initialTasks={tasksData.tasks || []}
            initialAppointments={appData.appointments || []}
            initialProjects={projectsData.projects || []}
            initialKanbanColumns={kanbanColsData.columns || []}
            initialNotes={notesData.notes || []}
            initialGanttCharts={ganttData.charts || []}
        />
    )
}
