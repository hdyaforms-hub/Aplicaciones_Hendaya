'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchAuditLogsAction, fetchAuditUsersAction, fetchAllAuditLogsForExport } from './actions'
import Link from 'next/link'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

type AuditLogItem = {
    id: string
    username: string
    userId: string | null
    action: string
    modulo: string
    detalle: string
    ip: string | null
    createdAt: string | Date
}

type UserOption = {
    username: string
    name: string
}

export default function AuditoriaPage() {
    const [logs, setLogs] = useState<AuditLogItem[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [exporting, setExporting] = useState<boolean>(false)
    const [exportingType, setExportingType] = useState<'pdf' | 'excel' | null>(null)
    const [error, setError] = useState<string>('')

    // Filtros
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [selectedUser, setSelectedUser] = useState<string>('ALL')
    const [selectedModulo, setSelectedModulo] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState<string>('')

    // Paginación
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [totalPages, setTotalPages] = useState<number>(1)
    const [totalRecords, setTotalRecords] = useState<number>(0)
    const limit = 25

    // Cargar lista de usuarios al montar
    useEffect(() => {
        async function loadUsers() {
            try {
                const uList = await fetchAuditUsersAction()
                setUsers(uList)
            } catch (e) {
                console.error('Error al cargar usuarios:', e)
            }
        }
        loadUsers()
    }, [])

    // Función para obtener logs
    const loadLogs = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const data = await fetchAuditLogsAction({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                username: selectedUser,
                modulo: selectedModulo,
                search: searchQuery,
                page: currentPage,
                limit,
            })

            setLogs(data.logs)
            setTotalPages(data.totalPages || 1)
            setTotalRecords(data.total || 0)
        } catch (err: any) {
            setError(err?.message || 'Error al cargar registros de auditoría')
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo, selectedUser, selectedModulo, searchQuery, currentPage])

    useEffect(() => {
        loadLogs()
    }, [loadLogs])

    const handleFilterSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setCurrentPage(1)
        loadLogs()
    }

    const handleResetFilters = () => {
        setDateFrom('')
        setDateTo('')
        setSelectedUser('ALL')
        setSelectedModulo('ALL')
        setSearchQuery('')
        setCurrentPage(1)
    }

    // Exportar a Excel
    const handleExportExcel = async () => {
        try {
            setExporting(true)
            setExportingType('excel')

            const allLogs = await fetchAllAuditLogsForExport({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                username: selectedUser,
                modulo: selectedModulo,
                search: searchQuery,
            })

            const excelData = allLogs.map((log: any, index: number) => ({
                N: index + 1,
                'Fecha y Hora': new Date(log.createdAt).toLocaleString('es-CL'),
                Usuario: log.username,
                Módulo: log.modulo,
                Acción: log.action,
                Detalle: log.detalle,
                IP: log.ip || 'N/A'
            }))

            const worksheet = XLSX.utils.json_to_sheet(excelData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoría')

            // Ajustar ancho de columnas
            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 20 },
                { wch: 20 },
                { wch: 25 },
                { wch: 18 },
                { wch: 55 },
                { wch: 15 }
            ]

            const nowStr = new Date().toISOString().slice(0, 10)
            XLSX.writeFile(workbook, `Auditoria_Hendaya_${selectedUser !== 'ALL' ? selectedUser : 'General'}_${nowStr}.xlsx`)
        } catch (err: any) {
            alert('Error al generar Excel: ' + err?.message)
        } finally {
            setExporting(false)
            setExportingType(null)
        }
    }

    // Exportar a PDF
    const handleExportPDF = async () => {
        try {
            setExporting(true)
            setExportingType('pdf')

            const allLogs = await fetchAllAuditLogsForExport({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                username: selectedUser,
                modulo: selectedModulo,
                search: searchQuery,
            })

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

            // Encabezado Hendaya
            doc.setFillColor(15, 23, 42) // slate-900
            doc.rect(0, 0, 297, 24, 'F')

            doc.setTextColor(255, 255, 255)
            doc.setFontSize(16)
            doc.setFont('helvetica', 'bold')
            doc.text('HENDAYA - INFORME DE AUDITORÍA DE USUARIOS', 14, 12)

            doc.setFontSize(9)
            doc.setFont('helvetica', 'normal')
            doc.text(`Fecha de emisión: ${new Date().toLocaleString('es-CL')}`, 200, 12)

            // Resumen de filtros
            doc.setTextColor(51, 65, 85)
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text('Filtros Aplicados:', 14, 32)

            doc.setFont('helvetica', 'normal')
            const filterSummary = [
                `Usuario: ${selectedUser === 'ALL' ? 'Todos los usuarios' : selectedUser}`,
                `Desde: ${dateFrom || 'Sin límite'}`,
                `Hasta: ${dateTo || 'Sin límite'}`,
                `Módulo: ${selectedModulo === 'ALL' ? 'Todos los módulos' : selectedModulo}`,
                `Total Registros: ${allLogs.length}`
            ].join('  |  ')
            doc.text(filterSummary, 14, 38)

            // Tabla de auditoría
            const tableRows = allLogs.map((log: any, index: number) => [
                (index + 1).toString(),
                new Date(log.createdAt).toLocaleString('es-CL'),
                log.username,
                log.modulo,
                log.action,
                log.detalle
            ])

            autoTable(doc, {
                startY: 44,
                head: [['#', 'Fecha y Hora', 'Usuario', 'Módulo', 'Acción', 'Detalle']],
                body: tableRows,
                styles: { fontSize: 8, cellPadding: 2.5 },
                headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: 'bold' }, // cyan-500
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 38 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 45 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 'auto' }
                }
            })

            const nowStr = new Date().toISOString().slice(0, 10)
            doc.save(`Auditoria_Hendaya_${selectedUser !== 'ALL' ? selectedUser : 'General'}_${nowStr}.pdf`)
        } catch (err: any) {
            alert('Error al generar PDF: ' + err?.message)
        } finally {
            setExporting(false)
            setExportingType(null)
        }
    }

    // Helper para insignia de acción
    const renderActionBadge = (action: string) => {
        const act = action.toUpperCase()
        if (act.includes('INICIO')) return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">🟢 {action}</span>
        if (act.includes('CIERRE')) return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">🔴 {action}</span>
        if (act.includes('NAVEGACION')) return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-100 text-sky-700 border border-sky-200">👁️ {action}</span>
        if (act.includes('CREAC')) return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">✨ {action}</span>
        if (act.includes('EDIT') || act.includes('MODIF')) return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">✏️ {action}</span>
        if (act.includes('ELIM')) return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">🗑️ {action}</span>
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">🔹 {action}</span>
    }

    return (
        <div className="space-y-6">
            {/* Header Principal */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider border border-cyan-500/30">
                            Tableros y Avances
                        </span>
                        <h2 className="text-3xl font-black tracking-tight mt-2 flex items-center gap-3">
                            <span>🛡️</span> Auditoría de Usuarios
                        </h2>
                        <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                            Registro de conexiones, navegación por módulos e interacciones en tiempo real de cada usuario en el sistema.
                        </p>
                    </div>

                    {/* Botones de Descarga */}
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <Link
                            href="/dashboard/mantenedor/actas-supervision/asociar-rbd"
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold shadow-lg shadow-slate-800/30 transition-all flex items-center gap-2 text-sm"
                        >
                            <span>🏫</span> Asociar RBD a Usuario
                        </Link>

                        <button
                            onClick={handleExportPDF}
                            disabled={exporting || totalRecords === 0}
                            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 text-sm"
                        >
                            <span>{exporting && exportingType === 'pdf' ? '⌛' : '📄'}</span>
                            {exporting && exportingType === 'pdf' ? 'Generando PDF...' : 'Descargar PDF'}
                        </button>

                        <button
                            onClick={handleExportExcel}
                            disabled={exporting || totalRecords === 0}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 text-sm"
                        >
                            <span>{exporting && exportingType === 'excel' ? '⌛' : '📊'}</span>
                            {exporting && exportingType === 'excel' ? 'Generando Excel...' : 'Descargar Excel'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Panel de Filtros */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <form onSubmit={handleFilterSubmit} className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <span>🔍</span> Criterios de Selección y Filtro
                        </h3>
                        {(dateFrom || dateTo || selectedUser !== 'ALL' || selectedModulo !== 'ALL' || searchQuery) && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs font-semibold text-cyan-600 hover:text-cyan-800 hover:underline"
                            >
                                Limpiar Filtros
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Fecha Desde */}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Fecha Desde</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                            />
                        </div>

                        {/* Fecha Hasta */}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Fecha Hasta</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                            />
                        </div>

                        {/* Selección de Usuario */}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Usuario</label>
                            <select
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                            >
                                <option value="ALL">-- Todos los Usuarios --</option>
                                {users.map((u) => (
                                    <option key={u.username} value={u.username}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selección de Módulo */}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Módulo</label>
                            <select
                                value={selectedModulo}
                                onChange={(e) => setSelectedModulo(e.target.value)}
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                            >
                                <option value="ALL">-- Todos los Módulos --</option>
                                <option value="Autenticación">Autenticación (Login/Logout)</option>
                                <option value="Tableros y Avances">Tableros y Avances</option>
                                <option value="Aplicaciones">Aplicaciones</option>
                                <option value="Áreas -> Operaciones">Áreas - Operaciones</option>
                                <option value="Áreas -> Manipuladoras">Áreas - Manipuladoras</option>
                                <option value="Áreas -> Calidad">Áreas - Calidad</option>
                                <option value="Áreas -> Multas">Áreas - Multas</option>
                                <option value="Matriz de Riesgo">Matriz de Riesgo</option>
                                <option value="Formularios">Formularios</option>
                                <option value="Mantenedor">Mantenedores</option>
                                <option value="Administración">Administración & Roles</option>
                                <option value="Reportes">Reportes</option>
                                <option value="Ayuda">Ayuda</option>
                            </select>
                        </div>

                        {/* Búsqueda General */}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Buscar en Detalle</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Ej: Login, PMPA, OT..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-black font-semibold"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-md shadow-cyan-600/20 transition-all text-sm shrink-0"
                                >
                                    Filtrar
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Registros de Actividad</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Mostrando {logs.length} de {totalRecords} eventos registrados
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50/80 text-xs font-bold uppercase text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="py-3.5 px-4">Fecha y Hora</th>
                                <th className="py-3.5 px-4">Usuario</th>
                                <th className="py-3.5 px-4">Módulo</th>
                                <th className="py-3.5 px-4">Acción</th>
                                <th className="py-3.5 px-4">Detalle / Actividad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-2xl animate-spin">🌀</span>
                                            <span>Cargando datos de auditoría...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-3xl">📁</span>
                                            <span className="font-semibold text-gray-600">No se encontraron registros de auditoría</span>
                                            <span className="text-xs text-gray-400">Prueba cambiando los criterios de selección (fechas o usuario).</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-cyan-50/30 transition-colors">
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                            {new Date(log.createdAt).toLocaleString('es-CL', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                            })}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-800 font-bold text-xs flex items-center justify-center border border-cyan-200">
                                                    {log.username.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span>{log.username}</span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                                            <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                                                {log.modulo}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {renderActionBadge(log.action)}
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-gray-700 max-w-md truncate" title={log.detalle}>
                                            {log.detalle}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {!loading && totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 text-xs">
                        <span className="text-gray-500 font-medium">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 rounded-lg font-semibold text-gray-700 shadow-sm"
                            >
                                ← Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 rounded-lg font-semibold text-gray-700 shadow-sm"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
