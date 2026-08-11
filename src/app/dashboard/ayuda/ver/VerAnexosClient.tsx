'use client'

import { useState, useMemo, useRef, useEffect } from 'react'

interface Anexo {
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

function getInitial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase()
}

function getAvatarColor(nombre: string): string {
    const colors = [
        'from-cyan-500 to-sky-600',
        'from-indigo-500 to-violet-600',
        'from-emerald-500 to-teal-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-purple-500 to-fuchsia-600',
        'from-blue-500 to-cyan-600',
        'from-green-500 to-emerald-600',
    ]
    const idx = nombre.charCodeAt(0) % colors.length
    return colors[idx]
}

export default function VerAnexosClient({ initialAnexos, sucursales, initialFilters }: VerAnexosClientProps) {
    const [filters, setFilters] = useState(initialFilters)
    const [activeLetter, setActiveLetter] = useState<string | null>(null)
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // Filtrado base por sucursal y nombre
    const filteredAnexos = useMemo(() => {
        return initialAnexos
            .filter(a => {
                const matchSucursal = !filters.sucursal || a.sucursal === filters.sucursal
                const matchNombre = !filters.nombre || a.nombre.toLowerCase().includes(filters.nombre.toLowerCase())
                return matchSucursal && matchNombre
            })
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    }, [initialAnexos, filters])

    // Letras que tienen resultados
    const availableLetters = useMemo(() => {
        const set = new Set(filteredAnexos.map(a => getInitial(a.nombre)))
        return ALPHABET.filter(l => set.has(l))
    }, [filteredAnexos])

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

    // Cuando cambian los filtros, resetear la letra activa
    useEffect(() => {
        setActiveLetter(null)
    }, [filters])

    // Letra activa filtrada: si hay una letra seleccionada, solo mostrar esa sección
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

    const scrollToLetter = (letter: string) => {
        if (activeLetter === letter) {
            setActiveLetter(null)
        } else {
            setActiveLetter(letter)
        }
    }

    return (
        <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sucursal</label>
                    <select
                        title="Filtrar por sucursal"
                        value={filters.sucursal}
                        onChange={(e) => setFilters(prev => ({ ...prev, sucursal: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-gray-900 outline-none transition-all cursor-pointer font-medium"
                    >
                        <option value="">Todas las sucursales</option>
                        {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Buscar</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={filters.nombre}
                            onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-gray-900 placeholder-gray-400 outline-none transition-all"
                        />
                    </div>
                </div>
                <div className="self-end">
                    <div className="px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-center">
                        <span className="text-2xl font-black text-cyan-600">{filteredAnexos.length}</span>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">contactos</p>
                    </div>
                </div>
            </div>

            {/* Tabs del abecedario — Barra tipo agenda */}
            {filteredAnexos.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span>🔤</span> Índice alfabético
                            {activeLetter && (
                                <button
                                    onClick={() => setActiveLetter(null)}
                                    className="ml-auto text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-100 hover:bg-cyan-100 transition-colors cursor-pointer"
                                >
                                    Ver todos ✕
                                </button>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {ALPHABET.map(letter => {
                                const hasEntries = availableLetters.includes(letter)
                                const isActive = activeLetter === letter
                                return (
                                    <button
                                        key={letter}
                                        onClick={() => hasEntries ? scrollToLetter(letter) : undefined}
                                        disabled={!hasEntries}
                                        className={`
                                            w-8 h-8 rounded-lg text-xs font-black transition-all duration-150 cursor-pointer
                                            ${!hasEntries
                                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                : isActive
                                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-200 scale-110'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-cyan-100 hover:text-cyan-700 hover:scale-105'
                                            }
                                        `}
                                    >
                                        {letter}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Cuerpo de la agenda */}
                    <div className="divide-y divide-gray-50">
                        {displayedLetters.map(letter => (
                            <div
                                key={letter}
                                ref={el => { sectionRefs.current[letter] = el }}
                                className="relative"
                            >
                                {/* Separador letra */}
                                <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                                        {letter}
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {groupedByLetter[letter]?.length || 0} {groupedByLetter[letter]?.length === 1 ? 'contacto' : 'contactos'}
                                    </span>
                                </div>

                                {/* Cards de la letra */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                    {(groupedByLetter[letter] || []).map(anexo => (
                                        <ContactCard
                                            key={anexo.id}
                                            anexo={anexo}
                                            formatWhatsApp={formatWhatsApp}
                                            avatarColor={getAvatarColor(anexo.nombre)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredAnexos.length === 0 && (
                        <div className="py-16 text-center">
                            <span className="text-5xl block mb-3">🔍</span>
                            <p className="text-gray-500 font-medium">No se encontraron contactos con estos criterios.</p>
                            <p className="text-xs text-gray-400 mt-1">Intenta con otra sucursal o nombre.</p>
                        </div>
                    )}
                </div>
            )}

            {filteredAnexos.length === 0 && (
                <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-sm">
                    <span className="text-5xl block mb-3">📭</span>
                    <p className="text-gray-500 font-semibold">No se encontraron contactos.</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta ajustar los filtros de búsqueda.</p>
                </div>
            )}
        </div>
    )
}

function ContactCard({ anexo, formatWhatsApp, avatarColor }: {
    anexo: Anexo
    formatWhatsApp: (num: string | undefined) => string
    avatarColor: string
}) {
    const phones = [anexo.telefono1, anexo.telefono2, anexo.telefono3, anexo.telefono4].filter(Boolean) as string[]
    const primaryPhone = phones[0] as string | undefined

    return (
        <div className="group bg-white border border-gray-100 rounded-2xl hover:border-cyan-200 hover:shadow-md transition-all duration-200 overflow-hidden">
            {/* Cabecera de la tarjeta */}
            <div className="p-4 flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-black text-xl shrink-0 shadow-sm`}>
                    {anexo.nombre.trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 truncate leading-tight">{anexo.nombre}</h3>
                            <p className="text-xs text-cyan-600 font-semibold mt-0.5 truncate">{anexo.cargo}</p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                            {anexo.sucursal}
                        </span>
                    </div>
                </div>
            </div>

            {/* Información de contacto */}
            <div className="px-4 pb-3 space-y-1.5">
                {anexo.correo && (
                    <a
                        href={`mailto:${anexo.correo}`}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-cyan-600 transition-colors truncate group/email"
                    >
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📧</span>
                        <span className="truncate group-hover/email:underline">{anexo.correo}</span>
                    </a>
                )}
                {phones.map((phone, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center text-sm">📞</span>
                        <span>{phone}</span>
                        {i === 0 && <span className="ml-auto text-[10px] text-gray-400 font-normal">Principal</span>}
                    </div>
                ))}
                {anexo.nota && (
                    <p className="mt-1 text-xs italic bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 text-amber-700 flex items-start gap-1.5">
                        <span className="shrink-0">💬</span>
                        <span>{anexo.nota}</span>
                    </p>
                )}
            </div>

            {/* Botones de acción */}
            {primaryPhone && (
                <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
                    <a
                        href={`tel:${primaryPhone}`}
                        className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-cyan-50 transition-colors group/btn"
                    >
                        <span className="text-base">📞</span>
                        <span className="text-[9px] font-bold text-gray-500 group-hover/btn:text-cyan-700 mt-0.5 uppercase tracking-wide">Llamar</span>
                    </a>
                    <a
                        href={`https://wa.me/${formatWhatsApp(primaryPhone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-green-50 transition-colors group/btn"
                    >
                        <span className="text-base">💬</span>
                        <span className="text-[9px] font-bold text-gray-500 group-hover/btn:text-green-700 mt-0.5 uppercase tracking-wide">WhatsApp</span>
                    </a>
                    <a
                        href={`sms:${primaryPhone}`}
                        className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-indigo-50 transition-colors group/btn"
                    >
                        <span className="text-base">✉️</span>
                        <span className="text-[9px] font-bold text-gray-500 group-hover/btn:text-indigo-700 mt-0.5 uppercase tracking-wide">Mensaje</span>
                    </a>
                </div>
            )}
        </div>
    )
}
