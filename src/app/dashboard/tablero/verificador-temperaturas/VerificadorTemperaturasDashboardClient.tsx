'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { getCalendarWeeksForMonth } from '@/app/dashboard/areas/calidad/verificador-temperaturas/calendarUtils'

interface Props {
    registros: any[]
    sucursales: { id: string; nombre: string }[]
    currentUser: string
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const CAMERA_COLORS = [
    '#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0284c7', '#14b8a6', '#f97316', '#84cc16'
]

export default function VerificadorTemperaturasDashboardClient({
    registros,
    sucursales,
    currentUser
}: Props) {
    // Filtros de navegación y analítica
    const [selectedSucursal, setSelectedSucursal] = useState<string>('TODAS')
    const [selectedTipoCamara, setSelectedTipoCamara] = useState<string>('TODOS')
    const [selectedAnio, setSelectedAnio] = useState<string>('TODOS')
    const [selectedMes, setSelectedMes] = useState<string>('TODOS')
    const [selectedDia, setSelectedDia] = useState<string>('TODOS')
    const [selectedSemestre, setSelectedSemestre] = useState<string>('TODOS')
    const [searchTerm, setSearchTerm] = useState<string>('')
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [signaturesCurrentPage, setSignaturesCurrentPage] = useState<number>(1)

    // Obtener años únicos registrados
    const aniosDisponibles = useMemo(() => {
        const set = new Set<number>()
        registros.forEach(r => {
            if (r.anio) set.add(r.anio)
            if (r.fechaRegistro) set.add(new Date(r.fechaRegistro).getFullYear())
        })
        const list = Array.from(set).sort((a, b) => b - a)
        return list.length > 0 ? list : [new Date().getFullYear()]
    }, [registros])

    // Filtrado de registros cabecera según los filtros seleccionados
    const registrosFiltrados = useMemo(() => {
        return registros.filter(r => {
            // Sucursal
            if (selectedSucursal !== 'TODAS' && r.idEntidad !== selectedSucursal && r.nombreEntidad !== selectedSucursal) {
                return false
            }

            // Tipo de Cámara
            if (selectedTipoCamara !== 'TODOS' && r.tipoCamara !== selectedTipoCamara) {
                return false
            }

            // Año
            const rAnio = r.anio || (r.fechaRegistro ? new Date(r.fechaRegistro).getFullYear() : null)
            if (selectedAnio !== 'TODOS' && rAnio !== parseInt(selectedAnio, 10)) {
                return false
            }

            // Búsqueda por texto libre
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase()
                const matchNombre = r.nombreEntidad?.toLowerCase().includes(term)
                const matchMonitor = r.monitorResponsable?.toLowerCase().includes(term)
                const matchTipo = r.tipoCamara?.toLowerCase().includes(term)
                if (!matchNombre && !matchMonitor && !matchTipo) return false
            }

            return true
        })
    }, [registros, selectedSucursal, selectedTipoCamara, selectedAnio, searchTerm])

    // Cálculo exhaustivo del estado de las firmas realizadas y faltantes por los 3 Niveles
    const statsFirmas = useMemo(() => {
        let n1TotalEsperado = 0
        let n1Firmadas = 0

        let n2TotalEsperado = 0
        let n2Firmadas = 0

        let n3TotalEsperado = 0
        let n3Firmadas = 0

        const desgloseRegistros: any[] = []

        registrosFiltrados.forEach(r => {
            const mesesPresentesSet = new Set<number>()
            r.detalles?.forEach((d: any) => {
                if (d.mes) mesesPresentesSet.add(d.mes)
            })
            if (mesesPresentesSet.size === 0 && r.fechaRegistro) {
                mesesPresentesSet.add(new Date(r.fechaRegistro).getMonth() + 1)
            }

            const anioRecord = r.anio || (r.fechaRegistro ? new Date(r.fechaRegistro).getFullYear() : 2026)

            let regN1Esperado = 0
            let regN1Firmado = 0
            let regN2Esperado = 0
            let regN2Firmado = 0
            let regN3Esperado = 0
            let regN3Firmado = 0

            const semanasPendientes: string[] = []

            mesesPresentesSet.forEach(m => {
                if (selectedMes !== 'TODOS' && m !== parseInt(selectedMes, 10)) return
                if (selectedSemestre !== 'TODOS') {
                    const sem = parseInt(selectedSemestre, 10)
                    if (sem === 1 && (m < 1 || m > 6)) return
                    if (sem === 2 && (m < 7 || m > 12)) return
                }

                // Días registrados en el mes
                const diasDetalleSet = new Set<number>()
                r.detalles?.filter((d: any) => d.mes === m).forEach((d: any) => diasDetalleSet.add(d.dia))

                // Nivel 1: Verificaciones Diarias (Monitor)
                const vDiariasMes = r.verificacionesDiarias?.filter((v: any) => v.mes === m) || []
                const firmadosDiariosSet = new Set<number>()
                vDiariasMes.forEach((v: any) => {
                    if (v.firmado || v.firma) firmadosDiariosSet.add(v.dia)
                })

                diasDetalleSet.forEach(dia => {
                    if (selectedDia !== 'TODOS' && dia !== parseInt(selectedDia, 10)) return
                    regN1Esperado++
                    if (firmadosDiariosSet.has(dia)) {
                        regN1Firmado++
                    }
                })

                // Nivel 2 y Nivel 3: Verificaciones Semanales (Jefe de Bodega y Jefe Zonal)
                const weeks = getCalendarWeeksForMonth(anioRecord, m)
                const activeWeeks = weeks.filter(w => {
                    return Array.from(diasDetalleSet).some(d => d >= w.startDay && d <= w.endDay)
                })

                const vSemanalesMes = r.verificacionesSemanales?.filter((v: any) => v.mes === m) || []

                activeWeeks.forEach(w => {
                    const semNum = w.semanaNum
                    regN2Esperado++
                    regN3Esperado++

                    const semEntry = vSemanalesMes.find((v: any) => v.semana === semNum)
                    const n2Done = Boolean(semEntry?.firmadoJefeBodega || semEntry?.firmaJefeBodega)
                    const n3Done = Boolean(semEntry?.firmadoJefeZonal || semEntry?.firmaJefeZonal)

                    if (n2Done) regN2Firmado++
                    else semanasPendientes.push(`Nivel 2 (Bodega) Sem ${semNum} [${MESES_NOMBRES[m - 1].slice(0, 3)}]`)

                    if (n3Done) regN3Firmado++
                    else semanasPendientes.push(`Nivel 3 (Zonal) Sem ${semNum} [${MESES_NOMBRES[m - 1].slice(0, 3)}]`)
                })
            })

            n1TotalEsperado += regN1Esperado
            n1Firmadas += regN1Firmado
            n2TotalEsperado += regN2Esperado
            n2Firmadas += regN2Firmado
            n3TotalEsperado += regN3Esperado
            n3Firmadas += regN3Firmado

            const regTotalFirmasEsperadas = regN1Esperado + regN2Esperado + regN3Esperado
            const regTotalFirmasRealizadas = regN1Firmado + regN2Firmado + regN3Firmado
            const regPctComp = regTotalFirmasEsperadas > 0 ? (regTotalFirmasRealizadas / regTotalFirmasEsperadas) * 100 : 100

            desgloseRegistros.push({
                idRegistro: r.idRegistro,
                nombreEntidad: r.nombreEntidad,
                tipoCamara: r.tipoCamara,
                anio: anioRecord,
                regN1Firmado,
                regN1Esperado,
                regN2Firmado,
                regN2Esperado,
                regN3Firmado,
                regN3Esperado,
                regTotalFirmasRealizadas,
                regTotalFirmasEsperadas,
                regPctComp: Math.round(regPctComp),
                semanasPendientes
            })
        })

        const n1Pct = n1TotalEsperado > 0 ? (n1Firmadas / n1TotalEsperado) * 100 : 100
        const n2Pct = n2TotalEsperado > 0 ? (n2Firmadas / n2TotalEsperado) * 100 : 100
        const n3Pct = n3TotalEsperado > 0 ? (n3Firmadas / n3TotalEsperado) * 100 : 100

        const totalGeneralEsperadas = n1TotalEsperado + n2TotalEsperado + n3TotalEsperado
        const totalGeneralFirmadas = n1Firmadas + n2Firmadas + n3Firmadas
        const totalGeneralPct = totalGeneralEsperadas > 0 ? (totalGeneralFirmadas / totalGeneralEsperadas) * 100 : 100

        return {
            n1TotalEsperado,
            n1Firmadas,
            n1Faltantes: Math.max(0, n1TotalEsperado - n1Firmadas),
            n1Pct: Math.round(n1Pct),

            n2TotalEsperado,
            n2Firmadas,
            n2Faltantes: Math.max(0, n2TotalEsperado - n2Firmadas),
            n2Pct: Math.round(n2Pct),

            n3TotalEsperado,
            n3Firmadas,
            n3Faltantes: Math.max(0, n3TotalEsperado - n3Firmadas),
            n3Pct: Math.round(n3Pct),

            totalGeneralEsperadas,
            totalGeneralFirmadas,
            totalGeneralFaltantes: Math.max(0, totalGeneralEsperadas - totalGeneralFirmadas),
            totalGeneralPct: Math.round(totalGeneralPct),

            desgloseRegistros
        }
    }, [registrosFiltrados, selectedMes, selectedSemestre, selectedDia])

    // Aplanar y filtrar todas las mediciones (detalles) registradas
    const medicionesDetalladas = useMemo(() => {
        const list: any[] = []

        registrosFiltrados.forEach(r => {
            const configMap = new Map<string, { maxTemp: number; nombre: string }>()
            r.configuraciones?.forEach((c: any) => {
                const max = c.temperaturaMaxima ?? (r.tipoCamara === 'Congelado' ? -18.0 : 5.0)
                const nombre = c.nombreCamara || `Cámara ${c.numeroCamaraMes.toString().padStart(2, '0')}`
                configMap.set(`${c.mes}_${c.numeroCamaraMes}`, { maxTemp: max, nombre })
            })

            r.detalles?.forEach((d: any) => {
                const m = d.mes
                const dia = d.dia

                // Filtro por Mes
                if (selectedMes !== 'TODOS' && m !== parseInt(selectedMes, 10)) return

                // Filtro por Día
                if (selectedDia !== 'TODOS' && dia !== parseInt(selectedDia, 10)) return

                // Filtro por Semestre
                if (selectedSemestre !== 'TODOS') {
                    const sem = parseInt(selectedSemestre, 10)
                    if (sem === 1 && (m < 1 || m > 6)) return
                    if (sem === 2 && (m < 7 || m > 12)) return
                }

                const cfg = configMap.get(`${m}_${d.numeroCamara}`)
                const maxTempAllowed = cfg?.maxTemp ?? (r.tipoCamara === 'Congelado' ? -18.0 : 5.0)
                const minTempAllowed = r.tipoCamara === 'Refrigerado' ? 0.0 : null

                const temp = d.temperatura
                let isOutOfRange = false

                if (temp !== null && temp !== undefined) {
                    if (r.tipoCamara === 'Refrigerado') {
                        if (temp < 0.0 || temp > maxTempAllowed) isOutOfRange = true
                    } else {
                        if (temp > maxTempAllowed) isOutOfRange = true
                    }
                }

                const equipoNombre = cfg?.nombre || `Cámara ${d.numeroCamara ? d.numeroCamara.toString().padStart(2, '0') : '01'}`

                list.push({
                    idRegistro: r.idRegistro,
                    nombreEntidad: r.nombreEntidad,
                    tipoCamara: r.tipoCamara,
                    anio: r.anio,
                    mes: m,
                    mesNombre: MESES_NOMBRES[m - 1],
                    dia,
                    fechaEtiqueta: `Día ${dia} (${MESES_NOMBRES[m - 1].slice(0, 3)})`,
                    numeroCamara: d.numeroCamara,
                    equipoNombre,
                    producto: d.nombreProducto || d.tipoProducto || 'Sin especificar',
                    temperatura: temp,
                    maxTempAllowed,
                    minTempAllowed,
                    isOutOfRange
                })
            })
        })

        return list.sort((a, b) => a.mes - b.mes || a.dia - b.dia || a.numeroCamara - b.numeroCamara)
    }, [registrosFiltrados, selectedMes, selectedDia, selectedSemestre])

    // Estadísticas globales KPI
    const statsKPI = useMemo(() => {
        let totalValidos = 0
        let fueraDeRango = 0
        let sumaTemp = 0

        medicionesDetalladas.forEach(m => {
            if (m.temperatura !== null && m.temperatura !== undefined) {
                totalValidos++
                sumaTemp += m.temperatura
                if (m.isOutOfRange) fueraDeRango++
            }
        })

        const cumplimientoPct = totalValidos > 0 ? ((totalValidos - fueraDeRango) / totalValidos) * 100 : 100
        const promedioTemp = totalValidos > 0 ? sumaTemp / totalValidos : null

        return {
            totalMediciones: medicionesDetalladas.length,
            totalValidos,
            fueraDeRango,
            cumplimientoPct: Math.round(cumplimientoPct * 10) / 10,
            promedioTemp: promedioTemp !== null ? Math.round(promedioTemp * 10) / 10 : null
        }
    }, [medicionesDetalladas])

    // Preparar datos de Recharts para Variaciones de Temperatura
    const chartDataRecharts = useMemo(() => {
        const mapByTime = new Map<string, any>()
        const cameraNamesSet = new Set<string>()

        medicionesDetalladas.forEach(m => {
            if (m.temperatura !== null && m.temperatura !== undefined) {
                const timeKey = m.fechaEtiqueta
                cameraNamesSet.add(m.equipoNombre)

                if (!mapByTime.has(timeKey)) {
                    mapByTime.set(timeKey, {
                        timeKey,
                        dia: m.dia,
                        mes: m.mes,
                        maxLimit: m.maxTempAllowed,
                        minLimit: m.minTempAllowed
                    })
                }

                const entry = mapByTime.get(timeKey)
                entry[m.equipoNombre] = m.temperatura
            }
        })

        const list = Array.from(mapByTime.values()).sort((a, b) => a.mes - b.mes || a.dia - b.dia)
        const cameraNames = Array.from(cameraNamesSet)

        return { list, cameraNames }
    }, [medicionesDetalladas])

    // Límites de referencia para el gráfico según el filtro de tipo de cámara
    const referenceLimits = useMemo(() => {
        if (selectedTipoCamara === 'Refrigerado') {
            return { max: 5.0, min: 0.0, maxLabel: 'Tope Máx Permitido (5.0°C)', minLabel: 'Tope Mín Mínimo (0.0°C)' }
        } else if (selectedTipoCamara === 'Congelado') {
            return { max: -18.0, min: null, maxLabel: 'Tope Máx Permitido (-18.0°C)', minLabel: null }
        }
        return { max: 5.0, min: 0.0, maxLabel: 'Tope Máx Ref (5.0°C)', minLabel: 'Tope Mín Ref (0.0°C)' }
    }, [selectedTipoCamara])

    // Paginación de la tabla de detalles
    const itemsPerPage = 15
    const totalPages = Math.max(1, Math.ceil(medicionesDetalladas.length / itemsPerPage))
    const currentTableMediciones = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return medicionesDetalladas.slice(start, start + itemsPerPage)
    }, [medicionesDetalladas, currentPage])

    // Paginación de la tabla de desgloses de firmas
    const signaturesPerPage = 10
    const totalSignaturesPages = Math.max(1, Math.ceil(statsFirmas.desgloseRegistros.length / signaturesPerPage))
    const currentSignaturesTable = useMemo(() => {
        const start = (signaturesCurrentPage - 1) * signaturesPerPage
        return statsFirmas.desgloseRegistros.slice(start, start + signaturesPerPage)
    }, [statsFirmas.desgloseRegistros, signaturesCurrentPage])

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50 min-h-screen">
            {/* Header del Tablero */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black text-cyan-600 uppercase tracking-widest">
                        <Link href="/dashboard" className="hover:underline">Inicio</Link>
                        <span>/</span>
                        <span>Tableros y Avances</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                        <span className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-2xl text-xl shadow-md">
                            📊
                        </span>
                        Tablero Verificador de Temperaturas
                    </h1>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-2xl">
                        Análisis gerencial de variaciones de temperatura, auditoría de picos térmicos y control de avance de firmas en los 3 Niveles de Supervisión.
                    </p>
                </div>
                <div className="flex items-center gap-3 self-start md:self-center">
                    <Link
                        href="/dashboard/areas/calidad/verificador-temperaturas"
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl transition-all shadow-sm flex items-center gap-2"
                    >
                        <span>📝</span> Ir al Registro de Temperaturas
                    </Link>
                </div>
            </div>

            {/* Panel de Filtros Avanzados */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span>🔍</span> Filtros del Tablero
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedSucursal('TODAS')
                            setSelectedTipoCamara('TODOS')
                            setSelectedAnio('TODOS')
                            setSelectedMes('TODOS')
                            setSelectedDia('TODOS')
                            setSelectedSemestre('TODOS')
                            setSearchTerm('')
                            setCurrentPage(1)
                            setSignaturesCurrentPage(1)
                        }}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 underline cursor-pointer"
                    >
                        Limpiar Filtros
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs font-bold">
                    {/* Filtro Sucursal */}
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Sucursal:</label>
                        <select
                            value={selectedSucursal}
                            onChange={(e) => { setSelectedSucursal(e.target.value); setCurrentPage(1); setSignaturesCurrentPage(1) }}
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {sucursales.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Tipo Cámara */}
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Cámara:</label>
                        <select
                            value={selectedTipoCamara}
                            onChange={(e) => { setSelectedTipoCamara(e.target.value); setCurrentPage(1); setSignaturesCurrentPage(1) }}
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Tipos</option>
                            <option value="Refrigerado">🧊 Refrigerado</option>
                            <option value="Congelado">❄️ Congelado</option>
                        </select>
                    </div>

                    {/* Filtro Año */}
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Año:</label>
                        <select
                            value={selectedAnio}
                            onChange={(e) => { setSelectedAnio(e.target.value); setCurrentPage(1); setSignaturesCurrentPage(1) }}
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Años</option>
                            {aniosDisponibles.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Semestre */}
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Semestre:</label>
                        <select
                            value={selectedSemestre}
                            onChange={(e) => { setSelectedSemestre(e.target.value); setCurrentPage(1); setSignaturesCurrentPage(1) }}
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Semestres</option>
                            <option value="1">1° Semestre (Ene - Jun)</option>
                            <option value="2">2° Semestre (Jul - Dic)</option>
                        </select>
                    </div>

                    {/* Filtro Mes */}
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Mes:</label>
                        <select
                            value={selectedMes}
                            onChange={(e) => { setSelectedMes(e.target.value); setCurrentPage(1); setSignaturesCurrentPage(1) }}
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Meses</option>
                            {MESES_NOMBRES.map((m, idx) => (
                                <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Día */}
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Día:</label>
                        <select
                            value={selectedDia}
                            onChange={(e) => { setSelectedDia(e.target.value); setCurrentPage(1); setSignaturesCurrentPage(1) }}
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        >
                            <option value="TODOS">Todos los Días</option>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                <option key={d} value={d}>Día {d}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: CONTROL Y AUDITORÍA DE FIRMAS DE LOS 3 NIVELES */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <span>🖊️</span> Estado de Firmas y Verificaciones por Nivel
                    </h2>
                    <span className="text-xs font-bold text-slate-500">
                        Consolidado Global: <strong className="text-slate-900">{statsFirmas.totalGeneralPct}% completado</strong>
                    </span>
                </div>

                {/* Tarjetas KPI de los 3 Niveles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* NIVEL 1 */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                                Nivel 1: Monitor Responsable
                            </span>
                            <span className="text-xl">👨‍💻</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-black text-slate-900">{statsFirmas.n1Firmadas}</span>
                                <span className="text-xs text-slate-400 font-bold"> / {statsFirmas.n1TotalEsperado} días firmados</span>
                            </div>
                            <span className="text-sm font-black text-cyan-600">{statsFirmas.n1Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full transition-all duration-500" style={{ width: `${statsFirmas.n1Pct}%` }}></div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                            <span>Firmadas: {statsFirmas.n1Firmadas}</span>
                            <span className={statsFirmas.n1Faltantes > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                                {statsFirmas.n1Faltantes > 0 ? `⚠️ ${statsFirmas.n1Faltantes} faltantes` : '✅ Al día'}
                            </span>
                        </div>
                    </div>

                    {/* NIVEL 2 */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                                Nivel 2: Jefe de Bodega
                            </span>
                            <span className="text-xl">📦</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-black text-slate-900">{statsFirmas.n2Firmadas}</span>
                                <span className="text-xs text-slate-400 font-bold"> / {statsFirmas.n2TotalEsperado} semanas firmadas</span>
                            </div>
                            <span className="text-sm font-black text-indigo-600">{statsFirmas.n2Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${statsFirmas.n2Pct}%` }}></div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                            <span>Firmadas: {statsFirmas.n2Firmadas}</span>
                            <span className={statsFirmas.n2Faltantes > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                                {statsFirmas.n2Faltantes > 0 ? `⚠️ ${statsFirmas.n2Faltantes} faltantes` : '✅ Al día'}
                            </span>
                        </div>
                    </div>

                    {/* NIVEL 3 */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                                Nivel 3: Jefe Zonal
                            </span>
                            <span className="text-xl">👔</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-black text-slate-900">{statsFirmas.n3Firmadas}</span>
                                <span className="text-xs text-slate-400 font-bold"> / {statsFirmas.n3TotalEsperado} semanas firmadas</span>
                            </div>
                            <span className="text-sm font-black text-purple-600">{statsFirmas.n3Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${statsFirmas.n3Pct}%` }}></div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                            <span>Firmadas: {statsFirmas.n3Firmadas}</span>
                            <span className={statsFirmas.n3Faltantes > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                                {statsFirmas.n3Faltantes > 0 ? `⚠️ ${statsFirmas.n3Faltantes} faltantes` : '✅ Al día'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabla de Desglose de Firmas por Registro */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <span>📜</span> Desglose de Avance de Verificaciones por Registro y Sucursal
                        </h3>
                        <span className="text-xs font-bold text-slate-500">
                            {statsFirmas.desgloseRegistros.length} registros auditados
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="p-3">Sucursal</th>
                                    <th className="p-3">Tipo Cámara</th>
                                    <th className="p-3 text-center">Nivel 1 (Monitor)</th>
                                    <th className="p-3 text-center">Nivel 2 (Jefe Bodega)</th>
                                    <th className="p-3 text-center">Nivel 3 (Jefe Zonal)</th>
                                    <th className="p-3 text-center">Avance Consolidado</th>
                                    <th className="p-3">Firmas Faltantes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white font-medium text-slate-700">
                                {currentSignaturesTable.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-gray-400 font-semibold">
                                            No se encontraron registros para auditar firmas.
                                        </td>
                                    </tr>
                                ) : (
                                    currentSignaturesTable.map((r, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-all">
                                            <td className="p-3 font-bold text-slate-900">{r.nombreEntidad}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                                    r.tipoCamara === 'Congelado' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                                }`}>
                                                    {r.tipoCamara === 'Congelado' ? '❄️ Congelado' : '🧊 Refrigerado'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                                    r.regN1Firmado === r.regN1Esperado && r.regN1Esperado > 0
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                }`}>
                                                    {r.regN1Firmado} / {r.regN1Esperado} días
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                                    r.regN2Firmado === r.regN2Esperado && r.regN2Esperado > 0
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                }`}>
                                                    {r.regN2Firmado} / {r.regN2Esperado} sem
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                                    r.regN3Firmado === r.regN3Esperado && r.regN3Esperado > 0
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                }`}>
                                                    {r.regN3Firmado} / {r.regN3Esperado} sem
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-black">
                                                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                                                    r.regPctComp >= 100
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                        : r.regPctComp >= 50
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                                }`}>
                                                    {r.regPctComp}%
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                {r.semanasPendientes.length === 0 ? (
                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                        ✅ Todas las firmas al día
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {r.semanasPendientes.slice(0, 3).map((pend: string, pIdx: number) => (
                                                            <span key={pIdx} className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                                                ⚠️ {pend}
                                                            </span>
                                                        ))}
                                                        {r.semanasPendientes.length > 3 && (
                                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                +{r.semanasPendientes.length - 3} más
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación de Tabla de Firmas */}
                    {totalSignaturesPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100">
                            <div className="text-xs font-bold text-slate-500">
                                Página <strong className="text-slate-900">{signaturesCurrentPage}</strong> de <strong className="text-slate-900">{totalSignaturesPages}</strong>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSignaturesCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={signaturesCurrentPage === 1}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl disabled:opacity-40 cursor-pointer"
                                >
                                    &larr; Anterior
                                </button>
                                <button
                                    onClick={() => setSignaturesCurrentPage(prev => Math.min(totalSignaturesPages, prev + 1))}
                                    disabled={signaturesCurrentPage === totalSignaturesPages}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl disabled:opacity-40 cursor-pointer"
                                >
                                    Siguiente &rarr;
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 2: MEDISIONES Y VARIACIONES TÉRMICAS */}
            {/* Tarjetas KPI de Resumen de Lecturas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total de Lecturas Evaluadas</span>
                    <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-slate-900">{statsKPI.totalMediciones}</span>
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-2xl text-lg">📋</span>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{statsKPI.totalValidos} mediciones numéricas válidas</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">% Cumplimiento de Límite</span>
                    <div className="flex items-center justify-between">
                        <span className={`text-2xl font-black ${statsKPI.cumplimientoPct >= 95 ? 'text-emerald-600' : statsKPI.cumplimientoPct >= 80 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {statsKPI.cumplimientoPct}%
                        </span>
                        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl text-lg">🎯</span>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">Meta óptima: &ge; 95%</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lecturas Fuera de Rango</span>
                    <div className="flex items-center justify-between">
                        <span className={`text-2xl font-black ${statsKPI.fueraDeRango > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {statsKPI.fueraDeRango}
                        </span>
                        <span className="p-2 bg-rose-50 text-rose-600 rounded-2xl text-lg">⚠️</span>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">Excedieron el tope máximo o mínimo</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">T° Promedio Registrada</span>
                    <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-cyan-700">
                            {statsKPI.promedioTemp !== null ? `${statsKPI.promedioTemp}°C` : '--'}
                        </span>
                        <span className="p-2 bg-cyan-50 text-cyan-600 rounded-2xl text-lg">🌡️</span>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">Promedio de lecturas filtradas</span>
                </div>
            </div>

            {/* Gráfico de Variación de Temperatura con Líneas de Tope Máximo y Mínimo */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <span>📈</span> Gráfico de Variaciones de Temperatura por Equipo
                        </h3>
                        <p className="text-xs text-gray-500">
                            Curvas térmicas continuas por cámara/reefer comparadas con los límites de tope máximo y tope mínimo.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {referenceLimits.max !== null && (
                            <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 bg-rose-500 inline-block"></span>
                                {referenceLimits.maxLabel}
                            </span>
                        )}
                        {referenceLimits.min !== null && (
                            <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-extrabold rounded-xl flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 bg-blue-500 inline-block"></span>
                                {referenceLimits.minLabel}
                            </span>
                        )}
                    </div>
                </div>

                {chartDataRecharts.list.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                        <span className="text-4xl block opacity-40">📉</span>
                        <h4 className="text-sm font-bold text-slate-700">Sin lecturas para graficar</h4>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                            Ajusta los filtros de sucursal, mes o día para visualizar la curva de variación de temperaturas.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartDataRecharts.list} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="timeKey" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                                    <YAxis
                                        unit="°C"
                                        tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                                        formatter={(val: any, name: any) => [`${val}°C`, name]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />

                                    {/* Línea de Tope Máximo */}
                                    {referenceLimits.max !== null && (
                                        <ReferenceLine
                                            y={referenceLimits.max}
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            label={{ value: `Límite Máx (${referenceLimits.max}°C)`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold', position: 'top' }}
                                        />
                                    )}

                                    {/* Línea de Tope Mínimo (cuando corresponde) */}
                                    {referenceLimits.min !== null && (
                                        <ReferenceLine
                                            y={referenceLimits.min}
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            label={{ value: `Límite Mín (${referenceLimits.min}°C)`, fill: '#3b82f6', fontSize: 10, fontWeight: 'bold', position: 'bottom' }}
                                        />
                                    )}

                                    {/* Líneas por cada equipo / cámara */}
                                    {chartDataRecharts.cameraNames.map((camName, idx) => (
                                        <Line
                                            key={camName}
                                            type="monotone"
                                            dataKey={camName}
                                            name={camName}
                                            stroke={CAMERA_COLORS[idx % CAMERA_COLORS.length]}
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 7 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabla Detallada de Mediciones Auditadas */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <span>📋</span> Detalle de Mediciones y Variaciones de Temperatura
                        </h3>
                        <span className="text-xs text-gray-500 font-bold">
                            Total: {medicionesDetalladas.length} registros auditados
                        </span>
                    </div>
                    <div className="w-full sm:w-64">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                            placeholder="Buscar por equipo, sucursal..."
                            className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="p-3">Fecha / Día</th>
                                <th className="p-3">Sucursal</th>
                                <th className="p-3">Tipo Cámara</th>
                                <th className="p-3">Equipo / Cámara</th>
                                <th className="p-3">Producto Auditado</th>
                                <th className="p-3 text-right">T° Registrada</th>
                                <th className="p-3 text-center">Límite Permitido</th>
                                <th className="p-3 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white font-medium text-slate-700">
                            {currentTableMediciones.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-400 font-semibold">
                                        No hay mediciones que coincidan con los filtros aplicados.
                                    </td>
                                </tr>
                            ) : (
                                currentTableMediciones.map((m, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-all">
                                        <td className="p-3 font-bold text-slate-900">Día {m.dia} ({m.mesNombre})</td>
                                        <td className="p-3 font-bold text-slate-800">{m.nombreEntidad}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                                m.tipoCamara === 'Congelado' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                            }`}>
                                                {m.tipoCamara === 'Congelado' ? '❄️ Congelado' : '🧊 Refrigerado'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-bold text-cyan-900">{m.equipoNombre}</td>
                                        <td className="p-3 text-slate-700">{m.producto}</td>
                                        <td className="p-3 text-right font-black">
                                            {m.temperatura !== null && m.temperatura !== undefined ? (
                                                <span className={m.isOutOfRange ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-black border border-rose-200' : 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-extrabold border border-emerald-200'}>
                                                    {m.temperatura}°C
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-normal italic">Sin producto / En blanco</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center font-bold text-slate-600">
                                            {m.minTempAllowed !== null ? `${m.minTempAllowed}°C a ` : ''}&le; {m.maxTempAllowed}°C
                                        </td>
                                        <td className="p-3 text-center">
                                            {m.temperatura === null || m.temperatura === undefined ? (
                                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                                                    ⚪ En Blanco
                                                </span>
                                            ) : m.isOutOfRange ? (
                                                <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                                                    ⚠️ Fuera de Rango
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                                    ✅ Óptimo
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-gray-100">
                        <div className="text-xs font-bold text-slate-500">
                            Página <strong className="text-slate-900">{currentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl disabled:opacity-40 cursor-pointer"
                            >
                                &larr; Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl disabled:opacity-40 cursor-pointer"
                            >
                                Siguiente &rarr;
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
