import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

export default async function AvancePreventivoPage({
    searchParams
}: {
    searchParams: { year?: string, institucion?: string }
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_estado_avance_tp')) {
        redirect('/dashboard')
    }

    const currentYear = new Date().getFullYear()
    const selectedYear = searchParams.year ? parseInt(searchParams.year) : currentYear
    const selectedInst = searchParams.institucion || 'TODAS'

    // Fetch all needed data
    const colegiosRaw = await prisma.colegios.findMany()
    const otsRaw = await prisma.trabajoPreventivo.findMany({
        where: {
            fechaTrabajo: {
                gte: new Date(selectedYear, 0, 1),
                lt: new Date(selectedYear + 1, 0, 1)
            }
        }
    })
    const presupuestosRaw = await prisma.presupuesto.findMany({
        where: { ano: selectedYear }
    })

    // Filter by institution if selected
    const institutions = ['JUNJI', 'INTEGRA', 'JUNAEB']
    const activeInstitutions = selectedInst === 'TODAS' ? institutions : [selectedInst]
    
    const colegios = colegiosRaw.filter(c => activeInstitutions.includes(c.institucion.toUpperCase()))
    
    // OTs need to be filtered by the institution of the school they belong to
    const ots = otsRaw.filter(ot => {
        const colegio = colegiosRaw.find(c => c.colRBD === ot.rbd)
        return colegio && activeInstitutions.includes(colegio.institucion.toUpperCase())
    })

    const sucursales = Array.from(new Set(colegiosRaw.map(c => c.sucursal))).sort()
    const months = Array.from({ length: 12 }, (_, i) => i + 1)

    // Helper: Get Color for sucursal
    const colorSchemes: Record<string, string> = {
        'COPIAPO': 'bg-emerald-500',
        'VALLENAR': 'bg-sky-500',
        'METRO': 'bg-amber-400',
        'COYHAIQUE': 'bg-orange-400',
        'DEFAULT': 'bg-slate-500'
    }
    const getBaseColor = (name: string) => {
        const key = Object.keys(colorSchemes).find(k => name.toUpperCase().includes(k))
        return colorSchemes[key || 'DEFAULT']
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 text-black pb-20">
            {/* Header section with Filters */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-bl-full -z-10 opacity-70" />
                
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">📈</span>
                        Estado de Avance Integral
                    </h2>
                    <p className="text-gray-500 mt-2 font-medium">Análisis Financiero, Operativo y de Cumplimiento</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Year Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-3">Año</span>
                        {[2024, 2025, 2026].map(y => (
                            <Link 
                                key={y} 
                                href={`?year=${y}&institucion=${selectedInst}`}
                                className={`px-4 py-2 rounded-xl font-bold transition-all text-sm ${selectedYear === y ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                                {y}
                            </Link>
                        ))}
                    </div>

                    {/* Institution Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-inner">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-3">Entidad</span>
                        {['TODAS', ...institutions].map(inst => (
                            <Link 
                                key={inst} 
                                href={`?year=${selectedYear}&institucion=${inst}`}
                                className={`px-4 py-2 rounded-xl font-bold transition-all text-sm ${selectedInst === inst ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                                {inst}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* 1. SECCION: ANALISIS SEMESTRAL (Existing) */}
            <DashboardSection title="Resumen de Cumplimiento Semestral" icon="📅">
                {sucursales.map(sucursal => {
                    const instData = institutions.filter(i => selectedInst === 'TODAS' || i === selectedInst).map(inst => {
                        const adj = colegiosRaw.filter(c => c.sucursal === sucursal && c.institucion === inst).length
                        const filterOTs = (s: number) => otsRaw.filter(ot => {
                            const m = new Date(ot.fechaTrabajo).getMonth()
                            if (s === 1 && m >= 6) return false
                            if (s === 2 && m < 6) return false
                            const col = colegiosRaw.find(c => c.colRBD === ot.rbd)
                            return col?.sucursal === sucursal && col?.institucion === inst
                        }).length
                        return { name: inst, adj, r1: filterOTs(1), r2: filterOTs(2) }
                    })
                    if (instData.length === 0) return null
                    return (
                        <div key={sucursal} className="mb-8 border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                            <div className={`${getBaseColor(sucursal)} p-3 text-center text-xs font-black text-white uppercase tracking-widest`}>{sucursal}</div>
                            <div className="overflow-x-auto"><table className="w-full text-[11px]">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Periodo</th>
                                        {instData.map(i => <th key={i.name} colSpan={4} className="text-center border-x border-slate-100 uppercase">{i.name}</th>)}
                                    </tr>
                                    <tr className="text-[9px] text-slate-400">
                                        <th className="border-r border-slate-100"></th>
                                        {instData.map(i => <React.Fragment key={i.name}><th className="px-1 text-center">Adj.</th><th className="px-1 text-center">Real.</th><th className="px-1 text-center">Falt.</th><th className="px-1 text-center bg-slate-100/50">%</th></React.Fragment>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2].map(s => (
                                        <tr key={s} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="py-3 px-4 font-bold text-slate-500">{s}er Semestre</td>
                                            {instData.map(i => {
                                                const real = s === 1 ? i.r1 : i.r2
                                                const falt = Math.max(0, i.adj - real)
                                                const perc = i.adj > 0 ? (real / i.adj) * 100 : 0
                                                return <React.Fragment key={i.name}><td className="text-center font-bold">{i.adj}</td><td className="text-center text-indigo-600 font-bold">{real}</td><td className="text-center text-rose-500 font-bold">{falt}</td><td className="text-center font-black bg-slate-50">{perc.toFixed(0)}%</td></React.Fragment>
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table></div>
                        </div>
                    )
                })}
            </DashboardSection>

            {/* 2. SECCION: GASTOS MENSUALES (Monto Materiales y Mano de Obra) */}
            <DashboardSection title="Cantidad Monto Mensual" icon="💵">
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="bg-indigo-600 text-white">
                                <th className="px-4 py-3 text-left font-black uppercase sticky left-0 z-10 bg-indigo-600">Sucursal</th>
                                {months.map(m => (
                                    <th key={m} colSpan={2} className="px-2 py-3 text-center border-l border-indigo-500 font-black uppercase">
                                        {selectedYear}/{m.toString().padStart(2, '0')}
                                    </th>
                                ))}
                                <th colSpan={2} className="px-3 py-3 text-center border-l bg-indigo-700 font-black">TOTAL</th>
                            </tr>
                            <tr className="bg-indigo-50 text-indigo-900 border-b border-indigo-100">
                                <th className="sticky left-0 bg-indigo-50"></th>
                                {months.map(m => (
                                    <React.Fragment key={m}>
                                        <th className="px-1 py-2 text-[8px] font-black border-l">Materiales</th>
                                        <th className="px-1 py-2 text-[8px] font-black border-l">M. Obra</th>
                                    </React.Fragment>
                                ))}
                                <th className="px-2 py-2 font-black border-l bg-indigo-100">Materiales</th>
                                <th className="px-2 py-2 font-black border-l bg-indigo-100">M. Obra</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sucursales.map(suc => {
                                let totalMat = 0, totalMano = 0
                                return (
                                    <tr key={suc} className="hover:bg-indigo-50/20">
                                        <td className="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-white border-r border-slate-100">{suc}</td>
                                        {months.map(m => {
                                            const monthOTs = ots.filter(ot => ot.sucursal === suc && new Date(ot.fechaTrabajo).getMonth() + 1 === m)
                                            const mat = monthOTs.reduce((acc, ot) => acc + (ot.montoMateriales || 0), 0)
                                            const mano = monthOTs.reduce((acc, ot) => acc + (ot.montoManoObra || 0), 0)
                                            totalMat += mat; totalMano += mano
                                            return (
                                                <React.Fragment key={m}>
                                                    <td className="px-1 py-3 text-center italic text-slate-400 border-l">${mat.toLocaleString()}</td>
                                                    <td className="px-1 py-3 text-center italic text-slate-400 border-l">${mano.toLocaleString()}</td>
                                                </React.Fragment>
                                            )
                                        })}
                                        <td className="px-3 py-3 text-center font-black bg-indigo-50/30 border-l">${totalMat.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-center font-black bg-indigo-50/30 border-l">${totalMano.toLocaleString()}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>

            {/* 3. SECCION: GASTOS POR SUCURSAL VS PRESUPUESTO (Trimestral) */}
            <DashboardSection title="Gastos por sucursal vs Presupuesto" icon="📊">
                <div className="overflow-x-auto text-[10px]">
                    <div className="flex gap-8 mb-4">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-600 rounded-full"></span><span>Gastos Reales</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span><span>Presupuesto</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-500 rounded-full"></span><span>Diferencia (Exceso)</span></div>
                    </div>
                    {Array.from({ length: 4 }, (_, i) => i + 1).map(q => {
                        const qMonths = [ (q-1)*3 + 1, (q-1)*3 + 2, (q-1)*3 + 3 ]
                        return (
                            <div key={q} className="mb-10">
                                <h4 className="px-6 py-2 bg-slate-800 text-white font-black uppercase rounded-t-2xl tracking-widest">{q}º Trimestre</h4>
                                <table className="w-full border-collapse">
                                    <thead className="bg-slate-100">
                                        <tr className="border-b border-white">
                                            <th className="px-6 py-3 text-left">Sucursal</th>
                                            <th className="px-4 py-3 text-center">Monto Materiales</th>
                                            <th className="px-4 py-3 text-center">Monto Mano de Obra</th>
                                            <th className="px-4 py-3 text-center font-black bg-slate-200">TOTAL Gastos</th>
                                            <th className="px-4 py-3 text-center font-black bg-emerald-100 text-emerald-800">Presupuesto</th>
                                            <th className="px-4 py-3 text-center font-black bg-slate-200">Diferencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sucursales.map(suc => {
                                            const qOTs = ots.filter(ot => ot.sucursal === suc && qMonths.includes(new Date(ot.fechaTrabajo).getMonth() + 1))
                                            const mat = qOTs.reduce((acc, ot) => acc + (ot.montoMateriales || 0), 0)
                                            const mano = qOTs.reduce((acc, ot) => acc + (ot.montoManoObra || 0), 0)
                                            const total = mat + mano
                                            const presu = budgetsFor(suc, selectedYear, presupuestosRaw) / 4
                                            const diff = presu - total
                                            return (
                                                <tr key={suc} className="bg-white hover:bg-slate-50 italic">
                                                    <td className="px-6 py-4 font-bold not-italic">{suc}</td>
                                                    <td className="text-center">${mat.toLocaleString()}</td>
                                                    <td className="text-center">${mano.toLocaleString()}</td>
                                                    <td className="text-center font-black bg-slate-50">${total.toLocaleString()}</td>
                                                    <td className="text-center font-black bg-emerald-50 text-emerald-700">${presu.toLocaleString()}</td>
                                                    <td className={`text-center font-black bg-slate-50 ${diff < 0 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600'}`}>
                                                        ${diff.toLocaleString()}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })}
                </div>
            </DashboardSection>

            {/* 4. SECCION: CUMPLIMIENTO Y REPETITIVIDAD */}
            <DashboardSection title="Resumen de Realizadas y Repetitividad" icon="🔄">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th rowSpan={2} className="px-4 py-4 text-left border-r border-slate-700">Sucursal</th>
                                {institutions.map(inst => (
                                    <th key={inst} colSpan={4} className={`px-4 py-2 border-l border-slate-700 uppercase tracking-widest font-black ${inst === 'JUNAEB' ? 'bg-emerald-800' : inst === 'JUNJI' ? 'bg-indigo-800' : 'bg-amber-700'}`}>
                                        {inst} {selectedYear}
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-slate-800 text-[9px] text-slate-300">
                                {institutions.map(inst => (
                                    <React.Fragment key={inst}>
                                        <th className="px-2 py-2 border-l border-slate-700">Realiz. (No Repet.)</th>
                                        <th className="px-2 py-2 border-l border-slate-600">Realiz. (Totales)</th>
                                        <th className="px-2 py-2 border-l border-slate-600">Repetidas</th>
                                        <th className="px-2 py-1 border-l border-slate-600 bg-slate-700">Faltantes</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sucursales.map(suc => (
                                <tr key={suc} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-4 text-left font-bold bg-slate-50 border-r border-slate-100">{suc}</td>
                                    {institutions.map(inst => {
                                        const adj = colegiosRaw.filter(c => c.sucursal === suc && c.institucion === inst).length
                                        const instOTs = otsRaw.filter(ot => {
                                            const col = colegiosRaw.find(c => c.colRBD === ot.rbd)
                                            return col?.sucursal === suc && col?.institucion === inst
                                        })
                                        const total = instOTs.length
                                        const uniqueRBDs = new Set(instOTs.map(ot => ot.rbd)).size
                                        const repet = total - uniqueRBDs
                                        const falt = Math.max(0, adj - uniqueRBDs)
                                        return (
                                            <React.Fragment key={inst}>
                                                <td className="py-4 font-bold">{uniqueRBDs}</td>
                                                <td className="py-4 font-bold text-slate-400">{total}</td>
                                                <td className="py-4 font-bold text-amber-600 bg-amber-50/30">{repet}</td>
                                                <td className="py-4 font-black bg-slate-100/50">{falt}</td>
                                            </React.Fragment>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>

            {/* 5. SECCION: CANTIDAD DE REGISTROS POR MES (Simple) */}
            <DashboardSection title="Cantidad de registros de OT por mes" icon="📝">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead>
                            <tr className="bg-indigo-600 text-white">
                                <th className="px-4 py-3 text-left border-r border-indigo-400">Sucursal</th>
                                {months.map(m => <th key={m} className="px-2 py-3 border-l border-indigo-400">{selectedYear}/{m.toString().padStart(2, '0')}</th>)}
                                <th className="px-4 py-3 border-l bg-indigo-700">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sucursales.map(suc => {
                                let rowTotal = 0
                                return (
                                    <tr key={suc} className="border-b border-slate-50 hover:bg-indigo-50/10">
                                        <td className="px-4 py-4 text-left font-bold bg-slate-50 border-r border-slate-100">{suc}</td>
                                        {months.map(m => {
                                            const count = ots.filter(ot => ot.sucursal === suc && new Date(ot.fechaTrabajo).getMonth() + 1 === m).length
                                            rowTotal += count
                                            return <td key={m} className={`py-4 font-bold ${count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{count}</td>
                                        })}
                                        <td className="py-4 font-black bg-indigo-50/50">{rowTotal}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>
        </div>
    )
}

function budgetsFor(sucursalName: string, year: number, budgets: any[]) {
    const b = budgets.find(b => b.ano === year && sucursalName.includes(b.sucursalId) || b.sucursal?.nombre === sucursalName)
    return b ? b.montoAnual : 0
}

function DashboardSection({ title, icon, children }: { title: string, icon: string, children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100/50 p-8">
            <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3 decoration-indigo-500 decoration-4 underline-offset-8">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">{icon}</span>
                {title}
            </h3>
            {children}
        </section>
    )
}
