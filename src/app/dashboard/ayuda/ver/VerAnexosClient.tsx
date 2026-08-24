'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'

export interface Anexo {
    id: string
    sucursal: string
    cargo: string
    correo: string
    telefono1: string
    telefono2?: string
    telefono3?: string
    telefono4?: string
    nombre: string
    cumpleano?: string
    contacto?: string
    nota?: string
}

interface VerAnexosClientProps {
    initialAnexos: Anexo[]
    sucursales: string[]
    initialFilters: { sucursal: string, nombre: string }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function getInitial(nombre?: string | null): string {
    const clean = (nombre || 'A').trim()
    return clean.length > 0 ? clean.charAt(0).toUpperCase() : 'A'
}

function getAvatarColor(nombre?: string | null): { bg: string; text: string; ring: string } {
    const palettes = [
        { bg: 'from-cyan-500 to-sky-600', text: 'text-cyan-900', ring: 'ring-cyan-400/40' },
        { bg: 'from-indigo-600 to-violet-700', text: 'text-indigo-900', ring: 'ring-indigo-400/40' },
        { bg: 'from-emerald-500 to-teal-600', text: 'text-emerald-900', ring: 'ring-emerald-400/40' },
        { bg: 'from-rose-500 to-pink-600', text: 'text-rose-900', ring: 'ring-rose-400/40' },
        { bg: 'from-amber-500 to-orange-600', text: 'text-amber-900', ring: 'ring-amber-400/40' },
        { bg: 'from-blue-600 to-cyan-700', text: 'text-blue-900', ring: 'ring-blue-400/40' },
        { bg: 'from-purple-600 to-fuchsia-700', text: 'text-purple-900', ring: 'ring-purple-400/40' },
        { bg: 'from-teal-600 to-emerald-700', text: 'text-teal-900', ring: 'ring-teal-400/40' },
    ]
    const clean = (nombre || 'A').trim()
    const code = clean.length > 0 && !isNaN(clean.charCodeAt(0)) ? clean.charCodeAt(0) : 65
    const idx = Math.abs(code) % palettes.length
    return palettes[idx] || palettes[0]
}

function getSucursalBadge(sucursal?: string | null): { bg: string; border: string; text: string } {
    const s = (sucursal || 'CASA MATRIZ').toUpperCase()
    if (s.includes('MATRIZ')) {
        return { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800' }
    }
    if (s.includes('METRO') || s.includes('SANTIAGO')) {
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' }
    }
    if (s.includes('VALLENAR') || s.includes('NORTE')) {
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' }
    }
    if (s.includes('CONCEPCION') || s.includes('SUR')) {
        return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' }
    }
    return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700' }
}

export default function VerAnexosClient({ initialAnexos, sucursales, initialFilters }: VerAnexosClientProps) {
    const [filters, setFilters] = useState(initialFilters)
    const [activeLetter, setActiveLetter] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

    const showToast = (msg: string) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 3000)
    }

    // Filtrado base por sucursal y nombre/cargo/anexo
    const filteredAnexos = useMemo(() => {
        const term = (filters.nombre || '').toLowerCase().trim()
        return initialAnexos
            .filter(a => {
                const matchSucursal = !filters.sucursal || a.sucursal === filters.sucursal
                if (!term) return matchSucursal
                const matchNombre = a.nombre?.toLowerCase().includes(term)
                const matchCargo = a.cargo?.toLowerCase().includes(term)
                const matchCorreo = a.correo?.toLowerCase().includes(term)
                const matchPhone = [a.telefono1, a.telefono2, a.telefono3, a.telefono4].some(p => p && p.toLowerCase().includes(term))
                return matchSucursal && (matchNombre || matchCargo || matchCorreo || matchPhone)
            })
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    }, [initialAnexos, filters])

    // Letras disponibles con contactos
    const availableLetters = useMemo(() => {
        const set = new Set(filteredAnexos.map(a => getInitial(a.nombre)))
        return ALPHABET.filter(l => set.has(l))
    }, [filteredAnexos])

    // Conteo por sucursal para las pastillas rápidas
    const branchCounts = useMemo(() => {
        const map: Record<string, number> = {}
        for (const a of initialAnexos) {
            map[a.sucursal] = (map[a.sucursal] || 0) + 1
        }
        return map
    }, [initialAnexos])

    // Agrupar por letra inicial
    const groupedByLetter = useMemo(() => {
        const map: Record<string, Anexo[]> = {}
        for (const a of filteredAnexos) {
            const letter = getInitial(a.nombre)
            if (!map[letter]) map[letter] = []
            map[letter].push(a)
        }
        return map
    }, [filteredAnexos])

    // Reset letra al cambiar filtros
    useEffect(() => {
        setActiveLetter(null)
    }, [filters])

    const displayedLetters = activeLetter
        ? availableLetters.filter(l => l === activeLetter)
        : availableLetters

    const formatWhatsApp = (num: string | undefined) => {
        if (!num) return ''
        let cleaned = num.replace(/\D/g, '')
        if (cleaned.length === 9) cleaned = '56' + cleaned
        if (cleaned.length === 8) cleaned = '569' + cleaned
        return cleaned
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        showToast(`¡${label} copiado al portapapeles!`)
    }

    return (
        <div className="space-y-6">
            {/* Toast Flotante */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-cyan-500/40 animate-in fade-in slide-in-from-bottom-5 duration-200">
                    <span className="text-cyan-400 text-lg">✨</span>
                    <span className="text-xs font-bold">{toastMessage}</span>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 1. HERO BANNER PRINCIPAL: DIRECTORIO CORPORATIVO HENDAYA                  */}
            {/* ========================================================================= */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
                {/* Glow decorativo de fondo */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-xl text-[11px] font-black uppercase tracking-wider border border-cyan-400/30 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                HENDAYA • Directorio Corporativo
                            </span>
                            <span className="px-2.5 py-1 bg-slate-800/80 text-slate-300 rounded-xl text-[11px] font-bold border border-slate-700">
                                📖 Anexos Telefónicos
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                            Directorio y Anexos Telefónicos
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed font-medium">
                            Encuentra anexos internos, números directos, correos corporativos y comunícate con el equipo por WhatsApp o llamada directa.
                        </p>
                    </div>

                    {/* Tarjetas de Métricas Rápidas */}
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center min-w-[100px] shadow-inner">
                            <span className="text-2xl sm:text-3xl font-black text-cyan-300">{filteredAnexos.length}</span>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Contactos</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center min-w-[100px] shadow-inner">
                            <span className="text-2xl sm:text-3xl font-black text-emerald-300">{sucursales.length}</span>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Sucursales</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. BARRA DE CONTROL, FILTROS Y BÚSQUEDA                                   */}
            {/* ========================================================================= */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    {/* Buscador inteligente */}
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, cargo, anexo o correo..."
                            value={filters.nombre}
                            onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
                            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium outline-none transition-all"
                        />
                        {filters.nombre && (
                            <button
                                onClick={() => setFilters(prev => ({ ...prev, nombre: '' }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                                title="Limpiar búsqueda"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Selector de Sucursal y Vista */}
                    <div className="flex items-center gap-3">
                        <div className="min-w-[200px] flex-1 sm:flex-initial">
                            <select
                                title="Filtrar por sucursal"
                                value={filters.sucursal}
                                onChange={(e) => setFilters(prev => ({ ...prev, sucursal: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 text-slate-800 text-xs sm:text-sm font-bold outline-none cursor-pointer transition-all"
                            >
                                <option value="">🏢 Todas las sucursales ({initialAnexos.length})</option>
                                {sucursales.map(s => (
                                    <option key={s} value={s}>
                                        🏢 {s} ({branchCounts[s] || 0})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Switch de Modo de Vista (Tarjetas vs Lista) */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === 'grid'
                                        ? 'bg-white text-cyan-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Vista de Tarjetas"
                            >
                                <span>🔲</span>
                                <span className="hidden sm:inline">Tarjetas</span>
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === 'table'
                                        ? 'bg-white text-cyan-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Vista de Lista / Tabla"
                            >
                                <span>📋</span>
                                <span className="hidden sm:inline">Lista</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pastillas Rápidas de Sucursales */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <span>🏷️</span> Sucursal:
                    </span>
                    <button
                        onClick={() => setFilters(prev => ({ ...prev, sucursal: '' }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                            !filters.sucursal
                                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <span>Todas</span>
                        <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${!filters.sucursal ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {initialAnexos.length}
                        </span>
                    </button>
                    {sucursales.map(s => {
                        const isSelected = filters.sucursal === s
                        return (
                            <button
                                key={s}
                                onClick={() => setFilters(prev => ({ ...prev, sucursal: isSelected ? '' : s }))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-200'
                                        : 'bg-slate-100 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700'
                                }`}
                            >
                                <span>{s}</span>
                                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${isSelected ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {branchCounts[s] || 0}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. ÍNDICE ALFABÉTICO (BARRA TIPO AGENDA VIP)                               */}
            {/* ========================================================================= */}
            {filteredAnexos.length > 0 && (
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 font-bold text-xs flex items-center justify-center">🔤</span>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                Índice Alfabético de Contactos
                            </span>
                        </div>
                        {activeLetter && (
                            <button
                                onClick={() => setActiveLetter(null)}
                                className="text-xs font-bold text-cyan-600 bg-cyan-50 hover:bg-cyan-100 px-3 py-1 rounded-xl border border-cyan-200 transition-all cursor-pointer flex items-center gap-1"
                            >
                                <span>Mostrar todo el abecedario</span>
                                <span>✕</span>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {ALPHABET.map(letter => {
                            const hasEntries = availableLetters.includes(letter)
                            const count = groupedByLetter[letter]?.length || 0
                            const isActive = activeLetter === letter
                            return (
                                <button
                                    key={letter}
                                    onClick={() => hasEntries && setActiveLetter(isActive ? null : letter)}
                                    disabled={!hasEntries}
                                    className={`
                                        h-9 min-w-[36px] px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer
                                        ${!hasEntries
                                            ? 'bg-slate-50 text-slate-300 opacity-40 cursor-not-allowed'
                                            : isActive
                                                ? 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-300 scale-105 ring-2 ring-cyan-400/50'
                                                : 'bg-slate-100 text-slate-700 hover:bg-cyan-100 hover:text-cyan-800 hover:scale-105'
                                        }
                                    `}
                                    title={hasEntries ? `${count} contactos con la letra ${letter}` : 'Sin contactos'}
                                >
                                    <span>{letter}</span>
                                    {hasEntries && (
                                        <span className={`text-[9px] font-bold opacity-75 ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. CUERPO DE CONTACTOS (VISTA GRID O TABLA)                                */}
            {/* ========================================================================= */}
            {filteredAnexos.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 shadow-sm">
                    <span className="text-5xl block mb-3">🔍</span>
                    <h3 className="text-base font-black text-slate-800">No se encontraron contactos</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        No hay resultados que coincidan con &quot;{filters.nombre}&quot; en la sucursal seleccionada.
                    </p>
                    <button
                        onClick={() => setFilters({ sucursal: '', nombre: '' })}
                        className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md"
                    >
                        Limpiar todos los filtros
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="space-y-8">
                    {displayedLetters.map(letter => {
                        const group = groupedByLetter[letter] || []
                        if (group.length === 0) return null
                        return (
                            <div
                                key={letter}
                                ref={el => { sectionRefs.current[letter] = el }}
                                className="space-y-3"
                            >
                                {/* Cabecera de la Letra */}
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-sky-700 flex items-center justify-center text-white font-black text-base shadow-sm">
                                        {letter}
                                    </div>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        {group.length} {group.length === 1 ? 'contacto' : 'contactos'}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200 ml-2" />
                                </div>

                                {/* Grilla de Tarjetas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {group.map(anexo => (
                                        <ContactCard
                                            key={anexo.id}
                                            anexo={anexo}
                                            formatWhatsApp={formatWhatsApp}
                                            onCopy={copyToClipboard}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* Vista de Tabla / Lista Compacta */
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 uppercase text-[10px] font-black tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Contacto / Cargo</th>
                                    <th className="py-3 px-4">Sucursal</th>
                                    <th className="py-3 px-4">Anexos / Teléfonos</th>
                                    <th className="py-3 px-4">Correo</th>
                                    <th className="py-3 px-4 text-center">Acciones Rápidas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {filteredAnexos.map(anexo => {
                                    const badge = getSucursalBadge(anexo.sucursal)
                                    const avatar = getAvatarColor(anexo.nombre)
                                    const phones = [anexo.telefono1, anexo.telefono2, anexo.telefono3, anexo.telefono4].filter(Boolean) as string[]
                                    const primaryPhone = phones[0]

                                    return (
                                        <tr key={anexo.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatar.bg} text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs`}>
                                                        {getInitial(anexo.nombre)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{anexo.nombre || 'Sin nombre'}</p>
                                                        <p className="text-[11px] text-cyan-700 font-semibold">{anexo.cargo || 'Personal Hendaya'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.border} ${badge.text}`}>
                                                    {anexo.sucursal}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {phones.map((p, i) => {
                                                        const isAnexo = p.trim().length <= 5 && !p.startsWith('+')
                                                        return (
                                                            <span
                                                                key={i}
                                                                onClick={() => copyToClipboard(p, isAnexo ? 'Anexo' : 'Teléfono')}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer hover:opacity-80 transition-opacity ${
                                                                    isAnexo ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                                }`}
                                                                title="Clic para copiar"
                                                            >
                                                                {isAnexo ? `📟 ${p}` : `📞 ${p}`}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {anexo.correo ? (
                                                    <a
                                                        href={`mailto:${anexo.correo}`}
                                                        className="text-cyan-700 hover:underline flex items-center gap-1 font-semibold"
                                                    >
                                                        <span>📧</span>
                                                        <span className="truncate max-w-[200px]">{anexo.correo}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {primaryPhone && (
                                                        <>
                                                            <a
                                                                href={`tel:${primaryPhone}`}
                                                                className="p-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs"
                                                                title="Llamar"
                                                            >
                                                                📞
                                                            </a>
                                                            <a
                                                                href={`https://wa.me/${formatWhatsApp(primaryPhone)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs"
                                                                title="WhatsApp"
                                                            >
                                                                💬
                                                            </a>
                                                        </>
                                                    )}
                                                    {anexo.correo && (
                                                        <a
                                                            href={`mailto:${anexo.correo}`}
                                                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs"
                                                            title="Enviar Correo"
                                                        >
                                                            ✉️
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

function ContactCard({
    anexo,
    formatWhatsApp,
    onCopy
}: {
    anexo: Anexo
    formatWhatsApp: (num: string | undefined) => string
    onCopy: (text: string, label: string) => void
}) {
    const avatar = getAvatarColor(anexo.nombre)
    const badge = getSucursalBadge(anexo.sucursal)
    const phones = [anexo.telefono1, anexo.telefono2, anexo.telefono3, anexo.telefono4].filter(Boolean) as string[]
    const primaryPhone = phones[0] as string | undefined

    return (
        <div className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-cyan-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden">
            {/* Header de la Tarjeta */}
            <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar estilizado con gradiente */}
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatar.bg} text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md ${avatar.ring}`}>
                            {getInitial(anexo.nombre)}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-cyan-700 transition-colors">
                                {anexo.nombre || 'Sin nombre'}
                            </h3>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-100 text-cyan-800 font-bold text-[11px] truncate max-w-full">
                                {anexo.cargo || 'Personal Hendaya'}
                            </span>
                        </div>
                    </div>

                    {/* Sucursal Badge */}
                    <span className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${badge.bg} ${badge.border} ${badge.text}`}>
                        {anexo.sucursal}
                    </span>
                </div>

                {/* Lista de Teléfonos y Anexos */}
                <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100">
                    {phones.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Sin teléfonos registrados</p>
                    ) : (
                        phones.map((phone, i) => {
                            const isAnexo = phone.trim().length <= 5 && !phone.startsWith('+')
                            return (
                                <div
                                    key={i}
                                    onClick={() => onCopy(phone, isAnexo ? 'Anexo' : 'Teléfono')}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-cyan-50/70 border border-slate-100 hover:border-cyan-200 transition-all cursor-pointer group/phone"
                                    title="Clic para copiar"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs">{isAnexo ? '📟' : '📞'}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-800 group-hover/phone:text-cyan-900">
                                                {phone}
                                            </span>
                                            {isAnexo && (
                                                <span className="text-[9px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                                                    ANEXO
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 group-hover/phone:text-cyan-600 font-bold opacity-0 group-hover/phone:opacity-100 transition-opacity">
                                        Copiar 📋
                                    </span>
                                </div>
                            )
                        })
                    )}

                    {/* Correo Electrónico */}
                    {anexo.correo && (
                        <div
                            onClick={() => onCopy(anexo.correo, 'Correo electrónico')}
                            className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 transition-all cursor-pointer group/mail"
                            title="Clic para copiar correo"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs">📧</span>
                                <span className="text-xs font-bold text-indigo-950 group-hover/mail:underline truncate">
                                    {anexo.correo}
                                </span>
                            </div>
                            <span className="text-[10px] text-indigo-500 font-bold opacity-0 group-hover/mail:opacity-100 transition-opacity">
                                Copiar 📋
                            </span>
                        </div>
                    )}

                    {/* Nota o Información Adicional */}
                    {anexo.nota && (
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 flex items-start gap-1.5 mt-1 font-medium">
                            <span className="shrink-0">💬</span>
                            <span className="line-clamp-2">{anexo.nota}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Barra de Acciones Directas */}
            <div className="grid grid-cols-3 gap-px bg-slate-100 border-t border-slate-100">
                {primaryPhone ? (
                    <a
                        href={`tel:${primaryPhone}`}
                        className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-cyan-500 hover:text-white transition-all group/btn"
                        title={`Llamar a ${primaryPhone}`}
                    >
                        <span className="text-sm group-hover/btn:scale-110 transition-transform">📞</span>
                        <span className="text-[10px] font-black text-slate-600 group-hover/btn:text-white mt-0.5 uppercase tracking-wide">
                            Llamar
                        </span>
                    </a>
                ) : (
                    <div className="flex flex-col items-center justify-center py-2.5 bg-slate-50 opacity-40">
                        <span className="text-sm">📞</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Llamar</span>
                    </div>
                )}

                {primaryPhone ? (
                    <a
                        href={`https://wa.me/${formatWhatsApp(primaryPhone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-emerald-500 hover:text-white transition-all group/btn"
                        title="Abrir WhatsApp"
                    >
                        <span className="text-sm group-hover/btn:scale-110 transition-transform">💬</span>
                        <span className="text-[10px] font-black text-slate-600 group-hover/btn:text-white mt-0.5 uppercase tracking-wide">
                            WhatsApp
                        </span>
                    </a>
                ) : (
                    <div className="flex flex-col items-center justify-center py-2.5 bg-slate-50 opacity-40">
                        <span className="text-sm">💬</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</span>
                    </div>
                )}

                {anexo.correo ? (
                    <a
                        href={`mailto:${anexo.correo}`}
                        className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-indigo-600 hover:text-white transition-all group/btn"
                        title="Enviar correo"
                    >
                        <span className="text-sm group-hover/btn:scale-110 transition-transform">✉️</span>
                        <span className="text-[10px] font-black text-slate-600 group-hover/btn:text-white mt-0.5 uppercase tracking-wide">
                            Correo
                        </span>
                    </a>
                ) : (
                    <div className="flex flex-col items-center justify-center py-2.5 bg-slate-50 opacity-40">
                        <span className="text-sm">✉️</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Correo</span>
                    </div>
                )}
            </div>
        </div>
    )
}
