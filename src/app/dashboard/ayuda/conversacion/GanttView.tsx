'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
    createGanttChart,
    deleteGanttChart,
    createGanttItem,
    updateGanttItem,
    deleteGanttItem,
    recalculateGanttAction,
    createGanttBaselineAction,
    deleteGanttBaselineAction
} from './actions'
import StackedPresenceAvatars from './StackedPresenceAvatars'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface DependencyRule {
    predecessorId: string
    type: DependencyType
    lagDays: number
}

export interface GanttItem {
    id: string
    ganttId: string
    taskId?: string | null
    parentId?: string | null
    isMilestone: boolean
    title: string
    startDate: string
    endDate: string
    progress: number
    color: string
    assignedTo?: string | null
    collaborators?: string[]
    dependencies: DependencyRule[]
    earlyStart?: string | null
    earlyFinish?: string | null
    lateStart?: string | null
    lateFinish?: string | null
    totalFloat?: number
    isCritical?: boolean
    order: number
}

export interface GanttBaselineItem {
    id: string
    itemId: string
    title: string
    startDate: string
    endDate: string
    durationDays: number
    progress: number
}

export interface GanttBaseline {
    id: string
    name: string
    createdBy: string
    createdAt: string
    items: GanttBaselineItem[]
}

export interface GanttChartItem {
    id: string
    title: string
    description?: string | null
    projectId?: string | null
    createdBy: string
    isShared: boolean
    isMine: boolean
    createdAt: string
    updatedAt: string
    items: GanttItem[]
    baselines?: GanttBaseline[]
}

interface GanttViewProps {
    initialCharts: GanttChartItem[]
    currentUsername: string
    users: { username: string; name: string }[]
    projects: { id: string; title: string }[]
}

const GANTT_COLORS = [
    { id: 'cyan', label: 'Cyan Hendaya', bg: 'bg-cyan-500', bar: 'bg-cyan-500', hex: '#06b6d4' },
    { id: 'indigo', label: 'Índigo Corporativo', bg: 'bg-indigo-500', bar: 'bg-indigo-500', hex: '#6366f1' },
    { id: 'emerald', label: 'Verde Éxito', bg: 'bg-emerald-500', bar: 'bg-emerald-500', hex: '#10b981' },
    { id: 'amber', label: 'Ámbar Alerta', bg: 'bg-amber-500', bar: 'bg-amber-500', hex: '#f59e0b' },
    { id: 'rose', label: 'Rosa / Carmesí', bg: 'bg-rose-500', bar: 'bg-rose-500', hex: '#f43f5e' },
    { id: 'purple', label: 'Púrpura / Violeta', bg: 'bg-purple-500', bar: 'bg-purple-500', hex: '#a855f7' },
]

type TimeScale = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER'
type ViewTab = 'TIMELINE' | 'TRACKING' | 'WORKLOAD'

export default function GanttView({ initialCharts, currentUsername, users, projects }: GanttViewProps) {
    const [charts, setCharts] = useState<GanttChartItem[]>(initialCharts)
    const [selectedChartId, setSelectedChartId] = useState<string | null>(initialCharts[0]?.id || null)

    // View Options
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [currentView, setCurrentView] = useState<ViewTab>('TIMELINE')
    const [timeScale, setTimeScale] = useState<TimeScale>('DAY')
    const [showCriticalPath, setShowCriticalPath] = useState(false)
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())

    // Visible Columns
    const [visibleColumns, setVisibleColumns] = useState({
        wbs: true,
        assignee: true,
        dates: true,
        duration: true,
        progress: true,
        slack: true,
        deps: true
    })
    const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false)

    // Modal Create Chart
    const [isCreateChartOpen, setIsCreateChartOpen] = useState(false)
    const [newChartTitle, setNewChartTitle] = useState('')
    const [newChartDesc, setNewChartDesc] = useState('')
    const [newChartProject, setNewChartProject] = useState('')
    const [newChartShared, setNewChartShared] = useState(true)
    const [isSavingChart, setIsSavingChart] = useState(false)

    // Modal Create / Edit Item
    const [isItemModalOpen, setIsItemModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<GanttItem | null>(null)
    const [itemTitle, setItemTitle] = useState('')
    const [itemStart, setItemStart] = useState(new Date().toISOString().split('T')[0])
    const [itemEnd, setItemEnd] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
    const [itemProgress, setItemProgress] = useState(0)
    const [itemColor, setItemColor] = useState('cyan')
    const [itemAssignedTo, setItemAssignedTo] = useState('')
    const [itemCollaborators, setItemCollaborators] = useState<string[]>([])
    const [itemParentId, setItemParentId] = useState<string>('')
    const [itemIsMilestone, setItemIsMilestone] = useState(false)
    const [itemDependencies, setItemDependencies] = useState<DependencyRule[]>([])
    const [isSavingItem, setIsSavingItem] = useState(false)

    // Baseline Modal
    const [isSaveBaselineOpen, setIsSaveBaselineOpen] = useState(false)
    const [baselineName, setBaselineName] = useState('')
    const [isSavingBaseline, setIsSavingBaseline] = useState(false)
    const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null)

    // Drag and Drop State
    const [draggingItem, setDraggingItem] = useState<{
        id: string
        mode: 'MOVE' | 'RESIZE_RIGHT' | 'RESIZE_LEFT'
        startX: number
        initialStart: Date
        initialEnd: Date
    } | null>(null)

    const timelineContainerRef = useRef<HTMLDivElement>(null)
    const selectedChart = charts.find(c => c.id === selectedChartId) || null

    // Selected Baseline
    const activeBaseline = useMemo(() => {
        if (!selectedChart || !selectedChart.baselines || selectedChart.baselines.length === 0) return null
        if (selectedBaselineId) {
            return selectedChart.baselines.find(b => b.id === selectedBaselineId) || selectedChart.baselines[0]
        }
        return selectedChart.baselines[0]
    }, [selectedChart, selectedBaselineId])

    // Jerarquía de Tareas
    const hierarchicalItems = useMemo(() => {
        if (!selectedChart) return []
        const roots: GanttItem[] = []
        const childrenMap = new Map<string, GanttItem[]>()

        selectedChart.items.forEach(it => {
            if (it.parentId) {
                if (!childrenMap.has(it.parentId)) childrenMap.set(it.parentId, [])
                childrenMap.get(it.parentId)!.push(it)
            } else {
                roots.push(it)
            }
        })

        const result: { item: GanttItem; depth: number; isParent: boolean; isHidden: boolean }[] = []

        const traverse = (item: GanttItem, depth: number, hidden: boolean) => {
            const hasChildren = childrenMap.has(item.id) && (childrenMap.get(item.id)!.length > 0)
            result.push({
                item,
                depth,
                isParent: hasChildren,
                isHidden: hidden
            })

            const children = childrenMap.get(item.id) || []
            const isCollapsed = collapsedParents.has(item.id)
            children.forEach(child => traverse(child, depth + 1, hidden || isCollapsed))
        }

        roots.forEach(r => traverse(r, 0, false))
        return result
    }, [selectedChart, collapsedParents])

    const visibleItems = useMemo(() => {
        return hierarchicalItems.filter(h => !h.isHidden).map(h => h.item)
    }, [hierarchicalItems])

    // Calcular rango global de fechas
    const timelineMeta = useMemo(() => {
        if (!selectedChart || selectedChart.items.length === 0) {
            const today = new Date()
            const start = new Date(today.getFullYear(), today.getMonth(), 1)
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            return {
                startDate: start,
                endDate: end,
                totalDays: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
            }
        }

        const dates = selectedChart.items.flatMap(it => [new Date(it.startDate), new Date(it.endDate)])
        const minTime = Math.min(...dates.map(d => d.getTime()))
        const maxTime = Math.max(...dates.map(d => d.getTime()))

        const start = new Date(minTime - 3 * 86400000)
        const end = new Date(maxTime + 5 * 86400000)
        const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

        return {
            startDate: start,
            endDate: end,
            totalDays
        }
    }, [selectedChart])

    // Generar columnas de la línea de tiempo según la escala seleccionada
    const timelineColumns = useMemo(() => {
        const cols: {
            date: Date
            label: string
            subLabel: string
            isToday: boolean
            isWeekend: boolean
        }[] = []
        const todayStr = new Date().toDateString()
        const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

        if (timeScale === 'DAY') {
            const cur = new Date(timelineMeta.startDate)
            while (cur <= timelineMeta.endDate) {
                const dayNum = cur.getDay()
                cols.push({
                    date: new Date(cur),
                    label: `${cur.getDate()}`,
                    subLabel: DAY_NAMES[dayNum],
                    isToday: cur.toDateString() === todayStr,
                    isWeekend: dayNum === 0 || dayNum === 6
                })
                cur.setDate(cur.getDate() + 1)
            }
        } else if (timeScale === 'WEEK') {
            const cur = new Date(timelineMeta.startDate)
            let weekNum = 1
            while (cur <= timelineMeta.endDate) {
                cols.push({
                    date: new Date(cur),
                    label: `S${weekNum}`,
                    subLabel: cur.toLocaleDateString('es-CL', { month: 'short', day: 'numeric' }),
                    isToday: false,
                    isWeekend: false
                })
                cur.setDate(cur.getDate() + 7)
                weekNum++
            }
        } else if (timeScale === 'MONTH') {
            const cur = new Date(timelineMeta.startDate.getFullYear(), timelineMeta.startDate.getMonth(), 1)
            while (cur <= timelineMeta.endDate) {
                cols.push({
                    date: new Date(cur),
                    label: cur.toLocaleDateString('es-CL', { month: 'short' }).toUpperCase(),
                    subLabel: `${cur.getFullYear()}`,
                    isToday: false,
                    isWeekend: false
                })
                cur.setMonth(cur.getMonth() + 1)
            }
        } else if (timeScale === 'QUARTER') {
            const cur = new Date(timelineMeta.startDate.getFullYear(), Math.floor(timelineMeta.startDate.getMonth() / 3) * 3, 1)
            while (cur <= timelineMeta.endDate) {
                const qNum = Math.floor(cur.getMonth() / 3) + 1
                cols.push({
                    date: new Date(cur),
                    label: `Q${qNum}`,
                    subLabel: `${cur.getFullYear()}`,
                    isToday: false,
                    isWeekend: false
                })
                cur.setMonth(cur.getMonth() + 3)
            }
        }
        return cols
    }, [timelineMeta, timeScale])

    // Toggle expand/collapse fase padre
    const toggleCollapseParent = (parentId: string) => {
        setCollapsedParents(prev => {
            const next = new Set(prev)
            if (next.has(parentId)) next.delete(parentId)
            else next.add(parentId)
            return next
        })
    }

    // Calcula posición en porcentaje para una barra
    const getBarPosition = (startStr: string, endStr: string) => {
        const itemStart = new Date(startStr).getTime()
        const itemEnd = new Date(endStr).getTime()
        const globalStart = timelineMeta.startDate.getTime()
        const globalEnd = timelineMeta.endDate.getTime()
        const totalDuration = Math.max(1, globalEnd - globalStart)

        const leftPct = Math.max(0, Math.min(100, ((itemStart - globalStart) / totalDuration) * 100))
        const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((itemEnd - itemStart) / totalDuration) * 100))

        return { left: `${leftPct}%`, width: `${widthPct}%` }
    }

    // Manejo de Drag and Drop en barras
    const handleMouseDownBar = (e: React.MouseEvent, item: GanttItem, mode: 'MOVE' | 'RESIZE_RIGHT' | 'RESIZE_LEFT') => {
        if (!selectedChart?.isMine) return
        e.stopPropagation()
        e.preventDefault()

        setDraggingItem({
            id: item.id,
            mode,
            startX: e.clientX,
            initialStart: new Date(item.startDate),
            initialEnd: new Date(item.endDate)
        })
    }

    useEffect(() => {
        if (!draggingItem) return

        const handleMouseMove = (e: MouseEvent) => {
            if (!timelineContainerRef.current) return
            const containerWidth = timelineContainerRef.current.clientWidth || 800
            const deltaX = e.clientX - draggingItem.startX
            const globalDuration = timelineMeta.endDate.getTime() - timelineMeta.startDate.getTime()
            const deltaMs = (deltaX / containerWidth) * globalDuration
            const deltaDays = Math.round(deltaMs / 86400000)

            if (deltaDays === 0) return

            setCharts(prev => prev.map(c => {
                if (c.id !== selectedChartId) return c
                return {
                    ...c,
                    items: c.items.map(it => {
                        if (it.id !== draggingItem.id) return it
                        let newStart = new Date(draggingItem.initialStart)
                        let newEnd = new Date(draggingItem.initialEnd)

                        if (draggingItem.mode === 'MOVE') {
                            newStart = new Date(draggingItem.initialStart.getTime() + deltaDays * 86400000)
                            newEnd = new Date(draggingItem.initialEnd.getTime() + deltaDays * 86400000)
                        } else if (draggingItem.mode === 'RESIZE_RIGHT') {
                            newEnd = new Date(Math.max(newStart.getTime() + 86400000, draggingItem.initialEnd.getTime() + deltaDays * 86400000))
                        } else if (draggingItem.mode === 'RESIZE_LEFT') {
                            newStart = new Date(Math.min(newEnd.getTime() - 86400000, draggingItem.initialStart.getTime() + deltaDays * 86400000))
                        }

                        return {
                            ...it,
                            startDate: newStart.toISOString(),
                            endDate: newEnd.toISOString()
                        }
                    })
                }
            }))
        }

        const handleMouseUp = async () => {
            const currentItem = selectedChart?.items.find(it => it.id === draggingItem.id)
            if (currentItem) {
                const res = await updateGanttItem(currentItem.id, {
                    startDate: currentItem.startDate,
                    endDate: currentItem.endDate
                })
                if (res.success && res.allItems) {
                    setCharts(prev => prev.map(c => c.id === selectedChartId ? {
                        ...c,
                        items: res.allItems.map((it: any) => ({
                            ...it,
                            startDate: it.startDate.toISOString ? it.startDate.toISOString() : it.startDate,
                            endDate: it.endDate.toISOString ? it.endDate.toISOString() : it.endDate,
                            dependencies: Array.isArray(it.dependencies) ? it.dependencies : []
                        }))
                    } : c))
                }
            }
            setDraggingItem(null)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [draggingItem, selectedChartId, timelineMeta, selectedChart])

    // Modales de Creación y Edición
    const openCreateItemModal = (parentId?: string) => {
        setEditingItem(null)
        setItemTitle('')
        setItemStart(new Date().toISOString().split('T')[0])
        setItemEnd(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
        setItemProgress(0)
        setItemColor('cyan')
        setItemAssignedTo('')
        setItemCollaborators([])
        setItemParentId(parentId || '')
        setItemIsMilestone(false)
        setItemDependencies([])
        setIsItemModalOpen(true)
    }

    const openEditItemModal = (item: GanttItem) => {
        setEditingItem(item)
        setItemTitle(item.title)
        setItemStart(item.startDate.split('T')[0])
        setItemEnd(item.endDate.split('T')[0])
        setItemProgress(item.progress)
        setItemColor(item.color || 'cyan')
        setItemAssignedTo(item.assignedTo || '')
        setItemCollaborators(item.collaborators || [])
        setItemParentId(item.parentId || '')
        setItemIsMilestone(item.isMilestone || false)
        setItemDependencies(item.dependencies || [])
        setIsItemModalOpen(true)
    }

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedChartId || !itemTitle.trim()) return
        setIsSavingItem(true)

        if (editingItem) {
            const res = await updateGanttItem(editingItem.id, {
                title: itemTitle,
                startDate: itemStart,
                endDate: itemIsMilestone ? itemStart : itemEnd,
                progress: Number(itemProgress),
                color: itemColor,
                assignedTo: itemAssignedTo || null,
                collaborators: itemCollaborators,
                parentId: itemParentId || null,
                isMilestone: itemIsMilestone,
                dependencies: itemDependencies
            })

            if (res.success && res.allItems) {
                setCharts(prev => prev.map(c => c.id === selectedChartId ? {
                    ...c,
                    items: res.allItems.map((it: any) => ({
                        ...it,
                        startDate: it.startDate.toISOString ? it.startDate.toISOString() : it.startDate,
                        endDate: it.endDate.toISOString ? it.endDate.toISOString() : it.endDate,
                        dependencies: Array.isArray(it.dependencies) ? it.dependencies : []
                    }))
                } : c))
                setIsItemModalOpen(false)
            }
        } else {
            const res = await createGanttItem({
                ganttId: selectedChartId,
                title: itemTitle,
                startDate: itemStart,
                endDate: itemIsMilestone ? itemStart : itemEnd,
                progress: Number(itemProgress),
                color: itemColor,
                assignedTo: itemAssignedTo || null,
                collaborators: itemCollaborators,
                parentId: itemParentId || null,
                isMilestone: itemIsMilestone,
                dependencies: itemDependencies
            })

            if (res.success) {
                // Refrescar cronograma
                const ref = await recalculateGanttAction(selectedChartId)
                if (ref.success && ref.items) {
                    setCharts(prev => prev.map(c => c.id === selectedChartId ? {
                        ...c,
                        items: ref.items.map((it: any) => ({
                            ...it,
                            startDate: it.startDate.toISOString ? it.startDate.toISOString() : it.startDate,
                            endDate: it.endDate.toISOString ? it.endDate.toISOString() : it.endDate,
                            dependencies: Array.isArray(it.dependencies) ? it.dependencies : []
                        }))
                    } : c))
                }
                setIsItemModalOpen(false)
            }
        }
        setIsSavingItem(false)
    }

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('¿Deseas eliminar esta actividad y recalcular el cronograma?')) return
        const res = await deleteGanttItem(itemId)
        if (res.success && selectedChartId) {
            const ref = await recalculateGanttAction(selectedChartId)
            if (ref.success && ref.items) {
                setCharts(prev => prev.map(c => c.id === selectedChartId ? {
                    ...c,
                    items: ref.items.map((it: any) => ({
                        ...it,
                        startDate: it.startDate.toISOString ? it.startDate.toISOString() : it.startDate,
                        endDate: it.endDate.toISOString ? it.endDate.toISOString() : it.endDate,
                        dependencies: Array.isArray(it.dependencies) ? it.dependencies : []
                    }))
                } : c))
            }
        }
    }

    // Guardar Línea Base (Baseline)
    const handleSaveBaseline = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedChartId) return
        setIsSavingBaseline(true)

        const res = await createGanttBaselineAction(selectedChartId, baselineName)
        if (res.success && res.baseline) {
            setCharts(prev => prev.map(c => c.id === selectedChartId ? {
                ...c,
                baselines: [res.baseline, ...(c.baselines || [])]
            } : c))
            setSelectedBaselineId(res.baseline.id)
            setIsSaveBaselineOpen(false)
            setBaselineName('')
        }
        setIsSavingBaseline(false)
    }

    // Exportar a Excel (.xlsx)
    const handleExportExcel = () => {
        if (!selectedChart) return

        const dataRows = selectedChart.items.map((it, idx) => {
            const duration = it.isMilestone
                ? 0
                : Math.max(1, Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000))
            const baselineItem = activeBaseline?.items.find(b => b.itemId === it.id)
            const varianceDays = baselineItem
                ? Math.round((new Date(it.endDate).getTime() - new Date(baselineItem.endDate).getTime()) / 86400000)
                : 0

            return {
                '#': idx + 1,
                'Actividad': it.title,
                'Tipo': it.isMilestone ? 'Hito ◆' : (it.parentId ? 'Subtarea' : 'Fase Principal'),
                'Responsable': it.assignedTo ? `@${it.assignedTo}` : 'Sin asignar',
                'Inicio Plan': new Date(it.startDate).toLocaleDateString('es-CL'),
                'Fin Plan': new Date(it.endDate).toLocaleDateString('es-CL'),
                'Duración (Días)': duration,
                '% Avance': `${it.progress}%`,
                'Holgura (Slack)': `${it.totalFloat || 0} días`,
                'Ruta Crítica': it.isCritical ? 'SÍ (Crítica)' : 'No',
                'Varianza Baseline': baselineItem ? `${varianceDays > 0 ? '+' : ''}${varianceDays} días` : 'N/A'
            }
        })

        const ws = XLSX.utils.json_to_sheet(dataRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Carta Gantt')
        XLSX.writeFile(wb, `Hendaya_Gantt_${selectedChart.title.replace(/\s+/g, '_')}.xlsx`)
    }

    // Exportar a PDF Oficial Hendaya
    const handleExportPdf = () => {
        if (!selectedChart) return
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()

        // Encabezado Corporativo Oficial HENDAYA
        doc.setFillColor(15, 23, 42)
        doc.rect(0, 0, pageWidth, 30, 'F')

        doc.setTextColor(6, 182, 212)
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('HENDAYA', 14, 15)

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text('| Cronograma Maestro de Planificación (Carta Gantt)', 50, 15)

        doc.setFontSize(8)
        doc.setTextColor(203, 213, 225)
        doc.text(`Cronograma: ${selectedChart.title}`, 14, 24)
        doc.text(`Autor: @${selectedChart.createdBy} • Fecha: ${new Date().toLocaleDateString('es-CL')}`, 140, 24)

        let yPos = 38
        doc.setFillColor(241, 245, 249)
        doc.rect(14, yPos, pageWidth - 28, 8, 'F')
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(51, 65, 85)

        doc.text('#', 16, yPos + 5.5)
        doc.text('ACTIVIDAD / WBS', 24, yPos + 5.5)
        doc.text('RESPONSABLE', 105, yPos + 5.5)
        doc.text('INICIO', 145, yPos + 5.5)
        doc.text('TÉRMINO', 168, yPos + 5.5)
        doc.text('% AVANCE', 192, yPos + 5.5)
        doc.text('HOLGURA', 228, yPos + 5.5)
        doc.text('RUTA CRÍTICA', 254, yPos + 5.5)

        yPos += 9

        hierarchicalItems.forEach((h, idx) => {
            if (yPos > 185) {
                doc.addPage()
                yPos = 20
            }

            const it = h.item
            doc.setFillColor(idx % 2 === 0 ? 255 : 248, 250, 252)
            doc.rect(14, yPos - 1, pageWidth - 28, 8.5, 'F')

            doc.setFontSize(7.5)
            doc.setFont('helvetica', h.isParent ? 'bold' : 'normal')
            doc.setTextColor(it.isCritical ? 225 : 15, it.isCritical ? 29 : 23, it.isCritical ? 72 : 42)

            doc.text(`${idx + 1}`, 16, yPos + 5)
            const indent = h.depth * 4
            const prefix = it.isMilestone ? '◆ ' : (h.isParent ? '▼ ' : '• ')
            doc.text(`${prefix}${it.title}`.slice(0, 42), 24 + indent, yPos + 5)

            doc.setFont('helvetica', 'normal')
            doc.setTextColor(100, 116, 139)
            doc.text(it.assignedTo ? `@${it.assignedTo}` : 'Sin asignar', 105, yPos + 5)
            doc.text(new Date(it.startDate).toLocaleDateString('es-CL'), 145, yPos + 5)
            doc.text(new Date(it.endDate).toLocaleDateString('es-CL'), 168, yPos + 5)
            doc.text(`${it.progress}%`, 192, yPos + 5)
            doc.text(`${it.totalFloat || 0}d`, 228, yPos + 5)

            if (it.isCritical) {
                doc.setTextColor(225, 29, 72)
                doc.setFont('helvetica', 'bold')
                doc.text('CRÍTICA 🔥', 254, yPos + 5)
            } else {
                doc.setTextColor(100, 116, 139)
                doc.text('Normal', 254, yPos + 5)
            }

            yPos += 8.5
        })

        doc.save(`Hendaya_Gantt_${selectedChart.title.replace(/\s+/g, '_')}.pdf`)
    }

    return (
        <div className="flex flex-col h-full space-y-5">
            {/* Top Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📊</span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Carta Gantt & Planificación Profesional</h2>
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] font-black rounded-full uppercase">Enterprise</span>
                        </div>
                        <p className="text-xs text-slate-500">
                            Jerarquía WBS, Ruta Crítica (CPM), 4 tipos de dependencias con Lag, Líneas Base y Carga de Trabajo.
                        </p>
                    </div>
                </div>

                {/* View Switcher & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Switcher de Vistas */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600">
                        <button
                            onClick={() => setCurrentView('TIMELINE')}
                            className={`px-3 py-1.5 rounded-xl transition-all ${currentView === 'TIMELINE' ? 'bg-white text-slate-900 shadow-xs font-black' : 'hover:text-slate-900'}`}
                        >
                            📅 Cronograma
                        </button>
                        <button
                            onClick={() => setCurrentView('TRACKING')}
                            className={`px-3 py-1.5 rounded-xl transition-all ${currentView === 'TRACKING' ? 'bg-white text-slate-900 shadow-xs font-black' : 'hover:text-slate-900'}`}
                        >
                            📸 Seguimiento (Baseline)
                        </button>
                        <button
                            onClick={() => setCurrentView('WORKLOAD')}
                            className={`px-3 py-1.5 rounded-xl transition-all ${currentView === 'WORKLOAD' ? 'bg-white text-slate-900 shadow-xs font-black' : 'hover:text-slate-900'}`}
                        >
                            👥 Carga de Trabajo
                        </button>
                    </div>

                    {/* Escala Temporal (Zoom) */}
                    {currentView !== 'WORKLOAD' && (
                        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600">
                            {(['DAY', 'WEEK', 'MONTH', 'QUARTER'] as TimeScale[]).map(sc => (
                                <button
                                    key={sc}
                                    onClick={() => setTimeScale(sc)}
                                    className={`px-2.5 py-1 rounded-xl transition-all text-[11px] ${timeScale === sc ? 'bg-cyan-600 text-white shadow-xs font-black' : 'hover:text-slate-900'}`}
                                >
                                    {sc === 'DAY' ? 'Día' : sc === 'WEEK' ? 'Semana' : sc === 'MONTH' ? 'Mes' : 'Trim'}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Botón para Mostrar/Ocultar Panel Lateral de Cronogramas */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${isSidebarOpen ? 'bg-cyan-50 border-cyan-300 text-cyan-800 shadow-xs' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
                        title={isSidebarOpen ? 'Ocultar panel de cronogramas para ampliar la carta Gantt' : 'Ver lista de cronogramas'}
                    >
                        <span>{isSidebarOpen ? '◀ Ocultar Panel' : '📂 Mis Cronogramas'}</span>
                        <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full font-black">
                            {charts.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setIsCreateChartOpen(true)}
                        className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-2xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                    >
                        <span>➕</span> Nuevo Cronograma
                    </button>
                </div>
            </div>

            {/* Main Gantt Body (Sidebar Colapsable para Máximo Espacio de Trabajo) */}
            <div className={`grid grid-cols-1 ${isSidebarOpen ? 'lg:grid-cols-4' : 'lg:grid-cols-1'} gap-6 flex-1 transition-all`}>
                {/* Left Sidebar: Cronogramas Disponibles (Colapsable) */}
                {isSidebarOpen && (
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col space-y-4 animate-in fade-in slide-in-from-left duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-sm">Cronogramas ({charts.length})</h3>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xs p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                                title="Ocultar panel"
                            >
                                ◀
                            </button>
                        </div>

                        <div className="space-y-2 overflow-y-auto max-h-[500px]">
                            {charts.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-sm">
                                    No hay cartas Gantt creadas aún.
                                </div>
                            ) : (
                                charts.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => setSelectedChartId(c.id)}
                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${selectedChartId === c.id ? 'bg-cyan-50/80 border-cyan-300 ring-2 ring-cyan-500/20 shadow-sm' : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/60'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{c.title}</h4>
                                            {c.isMine ? (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-cyan-100 text-cyan-800 rounded">
                                                    Propietario
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                                                    👁️ Lectura
                                                </span>
                                            )}
                                        </div>

                                        {c.description && (
                                            <p className="text-xs text-slate-500 line-clamp-1 mt-1">{c.description}</p>
                                        )}

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5 text-[11px] text-slate-400">
                                            <span>✍️ @{c.createdBy}</span>
                                            <span>{c.items.length} actividades</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Right Area: Interactive Viewer (Expansión Completa si la Sidebar está oculta) */}
                <div className={`${isSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4 w-full'} bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col space-y-4 overflow-hidden`}>
                    {selectedChart ? (
                        <>
                            {/* Header del Cronograma Seleccionado */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    {!isSidebarOpen && charts.length > 1 && (
                                        <select
                                            value={selectedChartId || ''}
                                            onChange={e => setSelectedChartId(e.target.value)}
                                            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                                            title="Cambiar de Cronograma"
                                        >
                                            {charts.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.title} ({c.items.length} tareas)
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-black text-slate-900">{selectedChart.title}</h3>
                                            {selectedChart.isShared && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                                                    🌐 Compartido
                                                </span>
                                            )}
                                        </div>
                                        {selectedChart.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{selectedChart.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <StackedPresenceAvatars
                                        roomId={`gantt:${selectedChart.id}`}
                                        className="mr-1"
                                    />

                                    {/* Toggle Ruta Crítica */}
                                    <button
                                        onClick={() => setShowCriticalPath(!showCriticalPath)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${showCriticalPath ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>🔥</span>
                                        <span>Ruta Crítica</span>
                                    </button>

                                    {/* Guardar Baseline */}
                                    {selectedChart.isMine && (
                                        <button
                                            onClick={() => setIsSaveBaselineOpen(true)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                            title="Guardar instantánea de fechas planificadas"
                                        >
                                            <span>📸</span>
                                            <span>Guardar Baseline</span>
                                        </button>
                                    )}

                                    {/* Selector de Columnas */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>⚙️</span>
                                            <span>Columnas</span>
                                        </button>

                                        {isColumnPickerOpen && (
                                            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl p-3.5 shadow-2xl border border-slate-200 z-50 text-xs space-y-2.5">
                                                <div className="font-black text-slate-900 text-xs border-b border-slate-100 pb-2 flex items-center justify-between">
                                                    <span>Mostrar Columnas</span>
                                                    <span className="text-[10px] text-cyan-600 font-bold">Gantt</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {Object.entries(visibleColumns).map(([key, val]) => (
                                                        <label key={key} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={val}
                                                                onChange={e => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                                                                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-400 cursor-pointer"
                                                            />
                                                            <span className="text-xs font-bold text-slate-900 select-none">
                                                                {key === 'wbs' ? 'WBS / ID' : key === 'assignee' ? 'Responsable' : key === 'dates' ? 'Fechas' : key === 'duration' ? 'Duración' : key === 'progress' ? '% Avance' : key === 'slack' ? 'Holgura (Slack)' : 'Dependencias'}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Exportar Excel */}
                                    <button
                                        onClick={handleExportExcel}
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        title="Exportar a Excel (.xlsx)"
                                    >
                                        <span>📊</span>
                                        <span>Excel</span>
                                    </button>

                                    {/* Exportar PDF */}
                                    <button
                                        onClick={handleExportPdf}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        title="Exportar Carta Gantt a PDF"
                                    >
                                        <span>📄</span>
                                        <span>PDF</span>
                                    </button>

                                    {selectedChart.isMine && (
                                        <button
                                            onClick={() => openCreateItemModal()}
                                            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>➕</span> Añadir Actividad
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* VISTA 1: CRONOGRAMA & TRACKING BASELINE */}
                            {currentView !== 'WORKLOAD' ? (
                                <div className="flex-1 overflow-x-auto border border-slate-200 rounded-2xl">
                                    <div className="min-w-[1000px]">
                                        {/* Barra de Leyenda de Días y Estados */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-3 h-3 rounded bg-cyan-500"></span>
                                                    <span className="font-bold text-slate-800">Día de Hoy</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400"></span>
                                                    <span className="text-amber-950 font-black">Fines de Semana (Sáb / Dom)</span>
                                                </div>
                                                {showCriticalPath && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-3 h-3 rounded bg-rose-500 ring-2 ring-rose-300"></span>
                                                        <span className="text-rose-700 font-bold">Ruta Crítica (Slack = 0)</span>
                                                    </div>
                                                )}
                                                {currentView === 'TRACKING' && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-3 h-3 rounded bg-slate-400"></span>
                                                        <span className="text-slate-700 font-bold">Línea Base (Planificado)</span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                💡 Arrastra las barras para mover fechas o los bordes para redimensionar duración
                                            </span>
                                        </div>

                                        {/* Table Header Row */}
                                        <div className="flex items-center bg-slate-100/70 border-b border-slate-200 text-[10px] text-slate-500 font-semibold">
                                            <div className="w-64 border-r border-slate-200 flex-shrink-0 p-2 pl-3">Actividad / Tarea</div>
                                            {visibleColumns.assignee && <div className="w-28 border-r border-slate-200 flex-shrink-0 p-2">Responsable</div>}
                                            {visibleColumns.dates && <div className="w-24 border-r border-slate-200 flex-shrink-0 p-2 text-center">Fechas</div>}
                                            {visibleColumns.duration && <div className="w-16 border-r border-slate-200 flex-shrink-0 p-2 text-center">Duración</div>}
                                            {visibleColumns.progress && <div className="w-20 border-r border-slate-200 flex-shrink-0 p-2 text-center">% Avance</div>}
                                            {visibleColumns.slack && <div className="w-16 border-r border-slate-200 flex-shrink-0 p-2 text-center">Holgura</div>}

                                            {/* Header de la Línea de Tiempo */}
                                            <div className="flex-1 flex overflow-hidden">
                                                {timelineColumns.map((col, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex-1 text-center py-1 border-r truncate transition-colors flex flex-col justify-center ${
                                                            col.isToday
                                                                ? 'bg-cyan-500 text-white font-black'
                                                                : col.isWeekend
                                                                ? 'bg-amber-100/90 text-amber-950 font-black border-amber-300 ring-1 ring-amber-300/40'
                                                                : 'bg-slate-100/70 text-slate-600 border-slate-200/60'
                                                        }`}
                                                    >
                                                        <span className={`text-[8px] uppercase tracking-tight block ${col.isToday ? 'text-cyan-100' : (col.isWeekend ? 'text-amber-800' : 'text-slate-400')}`}>
                                                            {col.subLabel}
                                                        </span>
                                                        <span className="text-[10px] font-black block leading-none">
                                                            {col.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {selectedChart.isMine && <div className="w-16 flex-shrink-0 text-center p-2">Acción</div>}
                                        </div>

                                        {/* Activity Rows con Jerarquía */}
                                        <div className="divide-y divide-slate-100 text-xs">
                                            {hierarchicalItems.map(h => {
                                                if (h.isHidden) return null
                                                const it = h.item
                                                const barPos = getBarPosition(it.startDate, it.endDate)
                                                const colorObj = GANTT_COLORS.find(c => c.id === it.color) || GANTT_COLORS[0]
                                                const durationDays = it.isMilestone
                                                    ? 0
                                                    : Math.max(1, Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000))

                                                // Baseline data
                                                const baselineItem = activeBaseline?.items.find(b => b.itemId === it.id)
                                                const baselineBarPos = baselineItem ? getBarPosition(baselineItem.startDate, baselineItem.endDate) : null
                                                const varianceDays = baselineItem
                                                    ? Math.round((new Date(it.endDate).getTime() - new Date(baselineItem.endDate).getTime()) / 86400000)
                                                    : 0

                                                const isCriticalHighlighted = showCriticalPath && it.isCritical

                                                return (
                                                    <div
                                                        key={it.id}
                                                        className={`flex items-center hover:bg-slate-50/90 transition-colors py-2 ${h.isParent ? 'bg-slate-50/50 font-bold' : ''}`}
                                                    >
                                                        {/* Activity Title con Sangría y Colapso */}
                                                        <div className="w-64 px-3 border-r border-slate-100 flex-shrink-0 flex items-center gap-1.5">
                                                            <div style={{ width: `${h.depth * 14}px` }} className="flex-shrink-0" />
                                                            {h.isParent ? (
                                                                <button
                                                                    onClick={() => toggleCollapseParent(it.id)}
                                                                    className="w-4 h-4 rounded text-slate-400 hover:text-slate-700 flex items-center justify-center font-black text-[10px] cursor-pointer"
                                                                >
                                                                    {collapsedParents.has(it.id) ? '▶' : '▼'}
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">
                                                                    {it.isMilestone ? '◆' : '•'}
                                                                </span>
                                                            )}
                                                            <span
                                                                className={`truncate text-xs ${it.isMilestone ? 'text-amber-700 font-bold' : 'text-slate-800'}`}
                                                                title={it.title}
                                                            >
                                                                {it.title}
                                                            </span>
                                                        </div>

                                                        {/* Assignee */}
                                                        {visibleColumns.assignee && (
                                                            <div className="w-28 px-2 border-r border-slate-100 flex-shrink-0 text-[11px] text-slate-500 truncate">
                                                                {it.assignedTo ? `👤 @${it.assignedTo}` : 'Sin asignar'}
                                                            </div>
                                                        )}

                                                        {/* Dates */}
                                                        {visibleColumns.dates && (
                                                            <div className="w-24 px-2 border-r border-slate-100 flex-shrink-0 text-center text-[10px] text-slate-600 font-medium">
                                                                <div>{new Date(it.startDate).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</div>
                                                                <div className="text-slate-400">al {new Date(it.endDate).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</div>
                                                            </div>
                                                        )}

                                                        {/* Duration */}
                                                        {visibleColumns.duration && (
                                                            <div className="w-16 px-1 border-r border-slate-100 flex-shrink-0 text-center text-[11px] text-slate-700">
                                                                {it.isMilestone ? '0d' : `${durationDays}d`}
                                                            </div>
                                                        )}

                                                        {/* Progress */}
                                                        {visibleColumns.progress && (
                                                            <div className="w-20 px-2 border-r border-slate-100 flex-shrink-0 text-center">
                                                                <span className="inline-block px-2 py-0.5 bg-slate-100 rounded-full font-black text-[10px] text-slate-800">
                                                                    {it.progress}%
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Slack */}
                                                        {visibleColumns.slack && (
                                                            <div className="w-16 px-1 border-r border-slate-100 flex-shrink-0 text-center text-[10px]">
                                                                <span className={`font-bold ${it.totalFloat === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                                                    {it.totalFloat || 0}d
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Timeline Bar Area */}
                                                        <div
                                                            ref={timelineContainerRef}
                                                            className="flex-1 px-2 relative h-10 flex flex-col justify-center"
                                                        >
                                                            {/* Background Guide con Fines de Semana */}
                                                            <div className="absolute inset-0 flex pointer-events-none">
                                                                {timelineColumns.map((col, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={`flex-1 border-r ${
                                                                            col.isWeekend
                                                                                ? 'bg-amber-100/40 border-amber-200/80'
                                                                                : 'border-slate-200/40'
                                                                        }`}
                                                                    />
                                                                ))}
                                                            </div>

                                                            {/* Baseline Bar (Seguimiento) */}
                                                            {currentView === 'TRACKING' && baselineBarPos && baselineItem && (
                                                                <div
                                                                    style={{ left: baselineBarPos.left, width: baselineBarPos.width }}
                                                                    className="absolute top-1 h-3 rounded bg-slate-300 border border-slate-400/80 text-[8px] text-slate-700 flex items-center px-1 truncate shadow-2xs z-5"
                                                                    title={`Línea Base: ${new Date(baselineItem.startDate).toLocaleDateString()} al ${new Date(baselineItem.endDate).toLocaleDateString()}`}
                                                                >
                                                                    <span className="truncate opacity-75">Plan</span>
                                                                </div>
                                                            )}

                                                            {/* Actual Gantt Bar / Milestone Diamond */}
                                                            {it.isMilestone ? (
                                                                /* Hito (Rombo ◆) */
                                                                <div
                                                                    style={{ left: barPos.left }}
                                                                    onClick={() => selectedChart.isMine && openEditItemModal(it)}
                                                                    onMouseDown={e => handleMouseDownBar(e, it, 'MOVE')}
                                                                    className={`absolute w-5 h-5 bg-amber-500 rotate-45 rounded-sm shadow-md border-2 border-white cursor-pointer z-10 flex items-center justify-center transition-transform hover:scale-125 ${isCriticalHighlighted ? 'ring-2 ring-rose-500' : ''}`}
                                                                    title={`Hito: ${it.title} (${new Date(it.startDate).toLocaleDateString()})`}
                                                                />
                                                            ) : h.isParent ? (
                                                                /* Barra Resumen de Fase Padre */
                                                                <div
                                                                    style={{ left: barPos.left, width: barPos.width }}
                                                                    onClick={() => selectedChart.isMine && openEditItemModal(it)}
                                                                    className="absolute h-5 rounded-t-lg bg-slate-800 text-white shadow-sm flex items-center justify-between px-2 text-[10px] font-bold overflow-hidden cursor-pointer z-10"
                                                                >
                                                                    <div style={{ width: `${it.progress}%` }} className="absolute left-0 top-0 bottom-0 bg-cyan-600/40" />
                                                                    <span className="relative z-10 truncate">{it.title}</span>
                                                                    <span className="relative z-10 text-[9px]">{it.progress}%</span>
                                                                </div>
                                                            ) : (
                                                                /* Barra Estándar de Actividad (con Drag & Drop y Resize) */
                                                                <div
                                                                    style={{ left: barPos.left, width: barPos.width }}
                                                                    onClick={() => selectedChart.isMine && openEditItemModal(it)}
                                                                    onMouseDown={e => handleMouseDownBar(e, it, 'MOVE')}
                                                                    className={`absolute h-6 rounded-lg ${isCriticalHighlighted ? 'bg-rose-600 ring-2 ring-rose-300 shadow-rose-500/30' : colorObj.bar} text-white shadow-sm flex items-center justify-between px-2 text-[10px] font-bold overflow-hidden transition-all group z-10 select-none ${selectedChart.isMine ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-white/80' : ''}`}
                                                                    title={`${it.title} (${it.progress}%) - Arrastra para mover`}
                                                                >
                                                                    {/* Left Resize Handle */}
                                                                    {selectedChart.isMine && (
                                                                        <div
                                                                            onMouseDown={e => handleMouseDownBar(e, it, 'RESIZE_LEFT')}
                                                                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-20"
                                                                        />
                                                                    )}

                                                                    {/* Progress Fill */}
                                                                    <div
                                                                        style={{ width: `${it.progress}%` }}
                                                                        className="absolute left-0 top-0 bottom-0 bg-black/25 pointer-events-none"
                                                                    />
                                                                    <span className="relative z-10 truncate pointer-events-none">{it.title}</span>
                                                                    <span className="relative z-10 text-[9px] opacity-90 pointer-events-none">{it.progress}%</span>

                                                                    {/* Right Resize Handle */}
                                                                    {selectedChart.isMine && (
                                                                        <div
                                                                            onMouseDown={e => handleMouseDownBar(e, it, 'RESIZE_RIGHT')}
                                                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-20"
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Varianza en días (si estamos en vista seguimiento) */}
                                                            {currentView === 'TRACKING' && baselineItem && varianceDays !== 0 && (
                                                                <div
                                                                    style={{ left: `calc(${barPos.left} + ${barPos.width} + 8px)` }}
                                                                    className={`absolute text-[9px] font-black px-1.5 py-0.5 rounded-md ${varianceDays > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}
                                                                >
                                                                    {varianceDays > 0 ? `+${varianceDays}d atraso` : `${varianceDays}d adelanto`}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Acciones */}
                                                        {selectedChart.isMine && (
                                                            <div className="w-16 px-1 flex items-center justify-center gap-1 flex-shrink-0">
                                                                <button
                                                                    onClick={() => openEditItemModal(it)}
                                                                    className="p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteItem(it.id)}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* VISTA 2: CARGA DE TRABAJO (WORKLOAD MATRIX) */
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">Matriz de Asignación y Sobrecarga</h4>
                                            <p className="text-xs text-slate-500">
                                                Supervisa la distribución de tareas por persona y detecta cuellos de botella.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {users.map(u => {
                                            const userTasks = selectedChart.items.filter(it => it.assignedTo === u.username)
                                            const totalDays = userTasks.reduce((acc, it) => {
                                                return acc + (it.isMilestone ? 0 : Math.max(1, Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000)))
                                            }, 0)
                                            const criticalCount = userTasks.filter(it => it.isCritical).length
                                            const isOverloaded = userTasks.length > 3 || criticalCount >= 2

                                            return (
                                                <div
                                                    key={u.username}
                                                    className={`p-4 rounded-2xl border transition-all ${isOverloaded ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'}`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-cyan-600 text-white font-bold text-xs flex items-center justify-center">
                                                                {u.name.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-slate-800 text-xs">{u.name}</h5>
                                                                <span className="text-[10px] text-slate-400">@{u.username}</span>
                                                            </div>
                                                        </div>

                                                        {isOverloaded && (
                                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">
                                                                ⚠️ Sobrecarga
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs py-2 border-t border-b border-black/5 text-slate-600 mb-2">
                                                        <span>Tareas: <strong>{userTasks.length}</strong></span>
                                                        <span>Días Totales: <strong>{totalDays}d</strong></span>
                                                        <span>Críticas: <strong className="text-rose-600">{criticalCount}</strong></span>
                                                    </div>

                                                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                        {userTasks.length === 0 ? (
                                                            <span className="text-[11px] text-slate-400 italic">Sin tareas asignadas</span>
                                                        ) : (
                                                            userTasks.map(t => (
                                                                <div key={t.id} className="text-[11px] flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200">
                                                                    <span className="truncate flex-1">{t.title}</span>
                                                                    <span className="font-bold text-slate-500 ml-2">{t.progress}%</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-400">
                            <div className="text-6xl mb-3">📊</div>
                            <h4 className="text-lg font-bold text-slate-700">Selecciona o crea una Carta Gantt</h4>
                            <p className="text-xs text-slate-500 max-w-sm mt-1">
                                Administra tus cronogramas con WBS, Ruta Crítica, Líneas Base y Carga de Trabajo.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: Crear Carta Gantt */}
            {isCreateChartOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setIsCreateChartOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        >
                            ✕
                        </button>
                        <h3 className="text-lg font-black text-slate-900 mb-4">Nueva Carta Gantt</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault()
                            if (!newChartTitle.trim()) return
                            setIsSavingChart(true)
                            try {
                                const res = await createGanttChart({
                                    title: newChartTitle,
                                    description: newChartDesc,
                                    projectId: newChartProject || null,
                                    isShared: newChartShared
                                })
                                if (res.success && res.chart) {
                                    const newC: GanttChartItem = {
                                        id: res.chart.id,
                                        title: res.chart.title,
                                        description: res.chart.description,
                                        projectId: res.chart.projectId,
                                        createdBy: res.chart.createdBy,
                                        isShared: res.chart.isShared,
                                        isMine: true,
                                        createdAt: typeof res.chart.createdAt === 'string' ? res.chart.createdAt : new Date(res.chart.createdAt).toISOString(),
                                        updatedAt: typeof res.chart.updatedAt === 'string' ? res.chart.updatedAt : new Date(res.chart.updatedAt).toISOString(),
                                        items: [],
                                        baselines: []
                                    }
                                    setCharts([newC, ...charts])
                                    setSelectedChartId(newC.id)
                                    setIsCreateChartOpen(false)
                                    setNewChartTitle('')
                                    setNewChartDesc('')
                                } else if (res.error) {
                                    alert(res.error)
                                }
                            } catch (err: any) {
                                console.error('Error al crear carta Gantt:', err)
                                alert('Ocurrió un problema al crear la carta Gantt. Por favor intenta nuevamente.')
                            } finally {
                                setIsSavingChart(false)
                            }
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Título del Cronograma *</label>
                                <input
                                    type="text"
                                    required
                                    value={newChartTitle}
                                    onChange={e => setNewChartTitle(e.target.value)}
                                    placeholder="Ej: Plan Maestro de Auditoría Operacional"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
                                <textarea
                                    rows={2}
                                    value={newChartDesc}
                                    onChange={e => setNewChartDesc(e.target.value)}
                                    placeholder="Objetivos de este cronograma..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-sm resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateChartOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingChart}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50"
                                >
                                    {isSavingChart ? 'Creando...' : 'Crear Cronograma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Crear / Editar Actividad (con CPM, 4 dependencias con Lag, Jerarquía e Hitos) */}
            {isItemModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsItemModalOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        >
                            ✕
                        </button>
                        <h3 className="text-lg font-black text-slate-900 mb-4">
                            {editingItem ? 'Editar Actividad del Cronograma' : 'Añadir Actividad al Cronograma'}
                        </h3>

                        <form onSubmit={handleSaveItem} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre de la Actividad *</label>
                                <input
                                    type="text"
                                    required
                                    value={itemTitle}
                                    onChange={e => setItemTitle(e.target.value)}
                                    placeholder="Ej: Levantamiento de Requerimientos"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-xs"
                                />
                            </div>

                            {/* Hito Checkbox */}
                            <label className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={itemIsMilestone}
                                    onChange={e => setItemIsMilestone(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 rounded"
                                />
                                <div>
                                    <span className="text-xs font-bold text-amber-900 block">Marcar como Hito (Milestone ◆)</span>
                                    <span className="text-[10px] text-amber-700">Evento de duración cero días (ej. Aprobación Final, Lanzamiento).</span>
                                </div>
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Inicio *</label>
                                    <input
                                        type="date"
                                        required
                                        value={itemStart}
                                        onChange={e => setItemStart(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-xs"
                                    />
                                </div>

                                {!itemIsMilestone && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Término *</label>
                                        <input
                                            type="date"
                                            required
                                            value={itemEnd}
                                            onChange={e => setItemEnd(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-xs"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Tarea Padre (Jerarquía WBS) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Fase / Tarea Padre (Opcional)</label>
                                <select
                                    value={itemParentId}
                                    onChange={e => setItemParentId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-xs bg-white"
                                >
                                    <option value="">Ninguna (Nivel Principal)</option>
                                    {selectedChart?.items.filter(it => it.id !== editingItem?.id && !it.parentId).map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Slider de Avance */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-slate-600">Porcentaje de Avance</label>
                                    <span className="text-xs font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                        {itemProgress}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={itemProgress}
                                    onChange={e => setItemProgress(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                />
                            </div>

                            {/* Responsable y Colaboradores */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Responsable Principal</label>
                                    <select
                                        value={itemAssignedTo}
                                        onChange={e => setItemAssignedTo(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-xs bg-white"
                                    >
                                        <option value="">Sin responsable</option>
                                        {users.map(u => (
                                            <option key={u.username} value={u.username}>{u.name} (@{u.username})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Color de Barra</label>
                                    <div className="flex gap-1.5 pt-1">
                                        {GANTT_COLORS.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setItemColor(c.id)}
                                                className={`w-6 h-6 rounded-md ${c.bg} transition-all ${itemColor === c.id ? 'ring-2 ring-slate-800 scale-110 font-bold text-white text-[10px]' : 'opacity-70'}`}
                                            >
                                                {itemColor === c.id && '✓'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Dependencias con 4 Tipos y Lag */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700">Predecesoras y Dependencias</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const otherItems = selectedChart?.items.filter(it => it.id !== editingItem?.id) || []
                                            if (otherItems.length > 0) {
                                                setItemDependencies([...itemDependencies, { predecessorId: otherItems[0].id, type: 'FS', lagDays: 0 }])
                                            }
                                        }}
                                        className="text-[10px] font-bold text-cyan-600 hover:text-cyan-800 cursor-pointer"
                                    >
                                        + Añadir Dependencia
                                    </button>
                                </div>

                                {itemDependencies.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Sin dependencias (inicia libremente)</p>
                                ) : (
                                    itemDependencies.map((dep, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                            <select
                                                value={dep.predecessorId}
                                                onChange={e => {
                                                    const next = [...itemDependencies]
                                                    next[idx].predecessorId = e.target.value
                                                    setItemDependencies(next)
                                                }}
                                                className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                                            >
                                                {selectedChart?.items.filter(it => it.id !== editingItem?.id).map(it => (
                                                    <option key={it.id} value={it.id}>{it.title}</option>
                                                ))}
                                            </select>

                                            <select
                                                value={dep.type}
                                                onChange={e => {
                                                    const next = [...itemDependencies]
                                                    next[idx].type = e.target.value as DependencyType
                                                    setItemDependencies(next)
                                                }}
                                                className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                            >
                                                <option value="FS">Fin-a-Inicio (FS)</option>
                                                <option value="SS">Inicio-a-Inicio (SS)</option>
                                                <option value="FF">Fin-a-Fin (FF)</option>
                                                <option value="SF">Inicio-a-Fin (SF)</option>
                                            </select>

                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">Lag:</span>
                                                <input
                                                    type="number"
                                                    value={dep.lagDays}
                                                    onChange={e => {
                                                        const next = [...itemDependencies]
                                                        next[idx].lagDays = Number(e.target.value)
                                                        setItemDependencies(next)
                                                    }}
                                                    className="w-12 px-1 py-1 bg-white border border-slate-200 rounded-lg text-xs text-center"
                                                    placeholder="días"
                                                />
                                                <span className="text-[10px] text-slate-400">d</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setItemDependencies(itemDependencies.filter((_, i) => i !== idx))}
                                                className="text-rose-500 hover:text-rose-700 p-1"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsItemModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingItem}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingItem ? 'Guardando...' : (editingItem ? 'Actualizar Actividad' : 'Guardar Actividad')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Guardar Línea Base (Baseline) */}
            {isSaveBaselineOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setIsSaveBaselineOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        >
                            ✕
                        </button>
                        <h3 className="text-lg font-black text-slate-900 mb-2">📸 Guardar Línea Base (Baseline)</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Congela una fotografía de las fechas planificadas actuales para comparar el avance real vs planificado.
                        </p>
                        <form onSubmit={handleSaveBaseline} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre de la Línea Base</label>
                                <input
                                    type="text"
                                    value={baselineName}
                                    onChange={e => setBaselineName(e.target.value)}
                                    placeholder="Ej: Plan Inicial Aprobado Q4"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-400 text-slate-900 text-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsSaveBaselineOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingBaseline}
                                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50"
                                >
                                    {isSavingBaseline ? 'Guardando...' : 'Capturar Línea Base'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
