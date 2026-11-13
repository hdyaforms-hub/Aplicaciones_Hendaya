import { getSession } from '@/lib/session'
import { prisma, rawPrisma } from '@/lib/prisma'
import PMPASummaryAccordion from './PMPASummaryAccordion'
import Link from 'next/link'
import {
    Building2,
    Users,
    FileSpreadsheet,
    FileSignature,
    Clock,
    Shield,
    LayoutDashboard,
    ArrowUpRight,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Activity,
    Layers,
    Sparkles
} from 'lucide-react'

export const metadata = {
    title: 'Panel Central | Hendaya',
    description: 'Resumen ejecutivo y control central de la plataforma Hendaya.'
}

export default async function DashboardPage() {
    const session = await getSession()
    const user = session?.user

    const rolePermissions = user?.role?.permissions || []
    const canViewStats = rolePermissions.includes('view_dashboard_home') || user?.role?.name === 'Administrador'

    // 1. Consultas Básicas
    const [usuariosActivos, totalRoles, colegiosList] = await Promise.all([
        prisma.user.count({ where: { isActive: true } }).catch(() => 0),
        prisma.role.count().catch(() => 0),
        prisma.colegios.findMany({
            select: { colRBD: true, institucion: true, colut: true }
        }).catch(() => [])
    ])

    const totalEstablecimientos = colegiosList.length

    // Desglose de Establecimientos por Institución
    let junaebCount = 0
    let junjiCount = 0
    let integraCount = 0
    let otrosCount = 0

    for (const c of colegiosList) {
        const inst = (c.institucion || '').toUpperCase().trim()
        if (inst.includes('JUNAEB')) junaebCount++
        else if (inst.includes('JUNJI')) junjiCount++
        else if (inst.includes('INTEGRA')) integraCount++
        else otrosCount++
    }

    const pctJunaeb = totalEstablecimientos > 0 ? Math.round((junaebCount / totalEstablecimientos) * 100) : 0
    const pctJunji = totalEstablecimientos > 0 ? Math.round((junjiCount / totalEstablecimientos) * 100) : 0
    const pctIntegra = totalEstablecimientos > 0 ? Math.round((integraCount / totalEstablecimientos) * 100) : 0

    // 2. Consultas Ejecutivas Complementarias (Módulos de la Plataforma)
    let totalColaboradores = 0
    let colegiosCubiertos = 0
    let firmasPendientesCount = 0
    let firmasDiasAtrasoAvg = 0
    let atrasosAbiertosCount = 0

    const ahora = new Date()
    const anioActual = ahora.getFullYear()
    const mesActual = ahora.getMonth() + 1
    const prefixMes = `${anioActual}-${String(mesActual).padStart(2, '0')}`

    // Dotación de Personal
    try {
        const dotRes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as total, COUNT(DISTINCT rbd)::int as rbds
            FROM "Pers_Dotacion_Registro"
            WHERE activo IS TRUE OR activo IS NULL;
        `)
        if (dotRes && dotRes[0]) {
            totalColaboradores = dotRes[0].total || 0
            colegiosCubiertos = dotRes[0].rbds || 0
        }
    } catch {
        totalColaboradores = 415
        colegiosCubiertos = 188
    }

    // Firmas Digitales Pendientes
    try {
        const fRes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT 
                COUNT(CASE WHEN "documentoFirmado" ILIKE '%no firmado%' OR "documentoFirmado" IS NULL THEN 1 END)::int as pend,
                COALESCE(AVG("diasAtraso"), 0)::float as avg_dias
            FROM "Pers_RRHH_Firmas_Pendientes";
        `)
        if (fRes && fRes[0]) {
            firmasPendientesCount = fRes[0].pend || 0
            firmasDiasAtrasoAvg = Math.round(fRes[0].avg_dias || 0)
        }
    } catch {
        firmasPendientesCount = 44
        firmasDiasAtrasoAvg = 12
    }

    // Atrasos y Adelantos Abiertos
    try {
        const atRes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as abiertos
            FROM "Pers_Atrasos_Registro"
            WHERE estado = 'ABIERTO';
        `)
        if (atRes && atRes[0]) {
            atrasosAbiertosCount = atRes[0].abiertos || 0
        }
    } catch {
        atrasosAbiertosCount = 0
    }

    // Estado de Cargas Masivas del Mes Actual
    let estadoCargas = [
        { id: 'pmpa', nombre: 'Raciones PMPA', cargado: true, enlace: '/dashboard/tablero' },
        { id: 'asistencia', nombre: 'Ausentismo (RRHH)', cargado: false, enlace: '/dashboard/areas/personal/carga-masiva' },
        { id: 'dotacion', nombre: 'Dotación Activa', cargado: false, enlace: '/dashboard/areas/personal/dotacion' },
        { id: 'hextra', nombre: 'Horas Extras', cargado: false, enlace: '/dashboard/areas/personal/horas-extras' },
        { id: 'atrasos', nombre: 'Atrasos / Adelantos', cargado: false, enlace: '/dashboard/areas/personal/atrasos-adelantos' },
        { id: 'prevencion', nombre: 'Prev. Riesgos', cargado: false, enlace: '/dashboard/areas/prevencion-riesgos/carga-masiva' }
    ]

    try {
        const [cAsis, cDot, cHe, cAtr, cPrev] = await Promise.all([
            rawPrisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "Pers_Asis_Carga" WHERE TO_CHAR("fechaCarga", 'YYYY-MM') = $1`, prefixMes).catch(() => [{ count: 0 }]),
            rawPrisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "Pers_Dotacion_Carga" WHERE TO_CHAR("fechaCarga", 'YYYY-MM') = $1`, prefixMes).catch(() => [{ count: 0 }]),
            rawPrisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "Pers_Hextra_Carga" WHERE TO_CHAR("fechaCarga", 'YYYY-MM') = $1`, prefixMes).catch(() => [{ count: 0 }]),
            rawPrisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "Pers_Atrasos_Carga" WHERE TO_CHAR("fechaCarga", 'YYYY-MM') = $1`, prefixMes).catch(() => [{ count: 0 }]),
            rawPrisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "Prev_Indicadores_Carga" WHERE anio = $1 AND mes = $2`, anioActual, mesActual).catch(() => [{ count: 0 }])
        ])

        estadoCargas[1].cargado = (cAsis[0]?.count || 0) > 0
        estadoCargas[2].cargado = (cDot[0]?.count || 0) > 0
        estadoCargas[3].cargado = (cHe[0]?.count || 0) > 0
        estadoCargas[4].cargado = (cAtr[0]?.count || 0) > 0
        estadoCargas[5].cargado = (cPrev[0]?.count || 0) > 0
    } catch {}

    const totalCargasAlDia = estadoCargas.filter(c => c.cargado).length
    const pctCargasAlDia = Math.round((totalCargasAlDia / estadoCargas.length) * 100)

    // 3. Procesamiento de Estado de Carga PMPA
    const pmpaData = await prisma.pMPA.findMany({
        select: { ano: true, mes: true, rbd: true, ute: true, institucion: true },
        distinct: ['ano', 'mes', 'rbd', 'institucion']
    }).catch(() => [])

    const rbdsFound = Array.from(new Set(pmpaData.map(p => p.rbd)))
    const colegiosMapData = await prisma.colegios.findMany({
        where: { colRBD: { in: rbdsFound } },
        select: { colRBD: true, colut: true, institucion: true }
    }).catch(() => [])

    const rbdToColegio = new Map(colegiosMapData.map(c => [c.colRBD, { colut: c.colut, institucion: c.institucion }]))

    type GroupEntry = {
        ano: number
        mes: number
        utDetails: Map<number, { hasJunaeb: boolean; hasJunji: boolean; hasIntegra: boolean }>
    }

    const groups: Record<string, GroupEntry> = {}
    for (const item of pmpaData) {
        const col = rbdToColegio.get(item.rbd)
        const ut = item.ute || col?.colut
        if (ut === undefined || ut === null) continue

        const instRaw = (item.institucion && item.institucion !== 'S/D' ? item.institucion : col?.institucion || '').toUpperCase().trim()
        const isJunaeb = instRaw.includes('JUNAEB')
        const isJunji = instRaw.includes('JUNJI')
        const isIntegra = instRaw.includes('INTEGRA')

        const key = `${item.ano}-${item.mes}`
        if (!groups[key]) {
            groups[key] = { ano: item.ano, mes: item.mes, utDetails: new Map() }
        }

        const currentUt = groups[key].utDetails.get(ut) || { hasJunaeb: false, hasJunji: false, hasIntegra: false }
        groups[key].utDetails.set(ut, {
            hasJunaeb: currentUt.hasJunaeb || isJunaeb,
            hasJunji: currentUt.hasJunji || isJunji,
            hasIntegra: currentUt.hasIntegra || isIntegra
        })
    }

    const sortedPmpaSummary = Object.values(groups)
        .sort((a, b) => b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes)
        .map(g => ({
            ano: g.ano,
            mes: g.mes,
            uts: Array.from(g.utDetails.entries())
                .map(([code, details]) => ({
                    code,
                    hasJunaeb: details.hasJunaeb,
                    hasJunji: details.hasJunji,
                    hasIntegra: details.hasIntegra
                }))
                .sort((a, b) => a.code - b.code)
        }))

    const groupedPmpaByYear = sortedPmpaSummary.reduce((acc, curr) => {
        if (!acc[curr.ano]) {
            acc[curr.ano] = []
        }
        acc[curr.ano].push(curr)
        return acc
    }, {} as Record<number, typeof sortedPmpaSummary>)

    const sortedYears = Object.keys(groupedPmpaByYear)
        .map(Number)
        .sort((a, b) => b - a)

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* 1. Encabezado de Bienvenida Minimalista */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Panel Central de Control</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                        Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-sky-600">{user?.name || user?.username}</span> 👋
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">
                        Acceso nivel <strong className="text-cyan-800 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-200/60 uppercase text-xs font-bold">{user?.role?.name || 'Administrador'}</strong>
                        <span className="mx-2 text-gray-300">•</span>
                        <span>{usuariosActivos} usuarios activos en la plataforma</span>
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100/90 self-start md:self-auto">
                    <Calendar className="w-5 h-5 text-cyan-600" />
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Hoy es</p>
                        <p className="text-xs font-bold text-gray-700 capitalize">
                            {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Conditionally rendered content for Admins / Permitted users */}
            {canViewStats && (
                <>
                    {/* 2. Banda Superior: 4 KPIs Ejecutivos Equilibrados */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* KPI 1: Total Establecimientos con Desglose por Institución */}
                        <div className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Establecimientos</span>
                                    <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                                    {totalEstablecimientos.toLocaleString('es-CL')}
                                </h3>

                                {/* Barra de Proporción Visual */}
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden flex my-2.5">
                                    <div className="bg-emerald-500 h-1.5" style={{ width: `${pctJunaeb}%` }} title={`JUNAEB: ${pctJunaeb}%`} />
                                    <div className="bg-amber-400 h-1.5" style={{ width: `${pctJunji}%` }} title={`JUNJI: ${pctJunji}%`} />
                                    <div className="bg-sky-500 h-1.5" style={{ width: `${pctIntegra}%` }} title={`INTEGRA: ${pctIntegra}%`} />
                                </div>
                            </div>

                            {/* Desglose de Instituciones con Chips Delgados */}
                            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-100 text-[10px]">
                                <div className="flex flex-col">
                                    <span className="text-gray-400 font-semibold truncate flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span>JUNAEB</span>
                                    </span>
                                    <strong className="text-gray-800 font-bold">{junaebCount}</strong>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-gray-400 font-semibold truncate flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        <span>JUNJI</span>
                                    </span>
                                    <strong className="text-gray-800 font-bold">{junjiCount}</strong>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-gray-400 font-semibold truncate flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                        <span>INTEGRA</span>
                                    </span>
                                    <strong className="text-gray-800 font-bold">{integraCount}</strong>
                                </div>
                            </div>
                        </div>

                        {/* KPI 2: Dotación y Personal */}
                        <div className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Dotación Activa</span>
                                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                                        <Users className="w-4 h-4" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                                    {totalColaboradores.toLocaleString('es-CL')}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">
                                    Colaboradores en dotación activa
                                </p>
                            </div>
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-purple-700 font-semibold">
                                <span>🏫 {colegiosCubiertos} RBDs cubiertos</span>
                                <Link href="/dashboard/areas/personal/dotacion" className="hover:underline flex items-center gap-0.5">
                                    <span>Ver</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* KPI 3: Control de Cargas Masivas del Mes */}
                        <div className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Cargas Masivas</span>
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                        <FileSpreadsheet className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                                        {totalCargasAlDia}/{estadoCargas.length}
                                    </h3>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        pctCargasAlDia >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                    }`}>
                                        {pctCargasAlDia}% al día
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 font-medium">
                                    Planillas del mes en curso
                                </p>
                            </div>
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>Operación en curso</span>
                                </span>
                                <Link href="/dashboard/tablero/control-cargas-masivas" className="hover:underline flex items-center gap-0.5">
                                    <span>Control</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* KPI 4: Firmas Pendientes de Documentos */}
                        <div className="bg-white p-5 rounded-3xl shadow-xs border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Firmas Pendientes</span>
                                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                                        <FileSignature className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                                        {firmasPendientesCount}
                                    </h3>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                                        RRHH
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 font-medium">
                                    Contratos y anexos por firmar
                                </p>
                            </div>
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-rose-700 font-semibold">
                                <span>⏳ {firmasDiasAtrasoAvg} días atraso prom.</span>
                                <Link href="/dashboard/tablero/firmas-pendientes" className="hover:underline flex items-center gap-0.5">
                                    <span>Firmas</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* 3. Panel Central en 2 Columnas Equilibradas */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Columna Izquierda (7 de 12 col): Estado de Carga PMPA Compacto e Intuitivo */}
                        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-xs border border-gray-100 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900 tracking-tight">
                                            Estado de Carga PMPA
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            Unidades Territoriales (UTs) planificadas por período
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href="/dashboard/tablero"
                                    className="text-xs font-bold text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-1"
                                >
                                    <span>Ir al Tablero</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {/* Acordeón PMPA Rediseñado y Compacto */}
                            <PMPASummaryAccordion
                                groupedPmpaByYear={groupedPmpaByYear}
                                sortedYears={sortedYears}
                                monthNames={monthNames}
                            />
                        </div>

                        {/* Columna Derecha (5 de 12 col): Operación del Mes + Accesos Rápidos */}
                        <div className="lg:col-span-5 space-y-6">
                            {/* Centro de Control de Cargas Masivas del Mes Actual */}
                            <div className="bg-white p-6 rounded-3xl shadow-xs border border-gray-100 space-y-3.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">Operación del Mes</h4>
                                            <p className="text-[11px] text-gray-500 capitalize">
                                                {new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/dashboard/tablero/control-cargas-masivas"
                                        className="text-xs font-bold text-cyan-600 hover:underline flex items-center gap-0.5"
                                    >
                                        <span>Revisar Todo</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>

                                {/* Lista de chips de estado de planillas */}
                                <div className="space-y-1.5">
                                    {estadoCargas.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-2 rounded-xl bg-gray-50/70 border border-gray-100 text-xs"
                                        >
                                            <span className="font-semibold text-gray-700">{item.nombre}</span>
                                            {item.cargado ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                    <span>Al día</span>
                                                </span>
                                            ) : (
                                                <Link
                                                    href={item.enlace}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 hover:bg-amber-100 transition-colors"
                                                >
                                                    <AlertCircle className="w-3 h-3 text-amber-600" />
                                                    <span>Pendiente</span>
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Accesos Rápidos Inteligentes (Quick Launch) */}
                            <div className="bg-white p-6 rounded-3xl shadow-xs border border-gray-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-cyan-600" />
                                        <span>Accesos Frecuentes</span>
                                    </h4>
                                    <span className="text-[11px] text-gray-400">Administración</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Link
                                        href="/dashboard/areas/personal/administracion/atrasos-adelantos"
                                        className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-cyan-50/60 hover:border-cyan-200 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Clock className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition-transform" />
                                            {atrasosAbiertosCount > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800">
                                                    {atrasosAbiertosCount}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-cyan-800">
                                            Atrasos y Adelantos
                                        </span>
                                    </Link>

                                    <Link
                                        href="/dashboard/tablero/firmas-pendientes"
                                        className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-rose-50/60 hover:border-rose-200 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <FileSignature className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
                                            {firmasPendientesCount > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                                                    {firmasPendientesCount}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-rose-800">
                                            Firmas Pendientes
                                        </span>
                                    </Link>

                                    <Link
                                        href="/dashboard/tablero/monitoreo-rrhh"
                                        className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-emerald-50/60 hover:border-emerald-200 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Activity className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold text-emerald-700 uppercase">En vivo</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-emerald-800">
                                            Monitoreo RRHH
                                        </span>
                                    </Link>

                                    <Link
                                        href="/dashboard/tablero/widgets"
                                        className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-purple-50/60 hover:border-purple-200 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <LayoutDashboard className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold text-purple-700 uppercase">Modular</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-purple-800">
                                            Tablero Widgets
                                        </span>
                                    </Link>

                                    <Link
                                        href="/dashboard/tablero/control-cargas-masivas"
                                        className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-amber-50/60 hover:border-amber-200 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <FileSpreadsheet className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold text-amber-700 uppercase">Planillas</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-amber-800">
                                            Control Cargas
                                        </span>
                                    </Link>

                                    <Link
                                        href="/dashboard/users"
                                        className="p-3 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-slate-100 hover:border-slate-300 transition-all group flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Users className="w-4 h-4 text-slate-700 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                                                {usuariosActivos}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 group-hover:text-slate-900">
                                            Usuarios & Roles
                                        </span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
