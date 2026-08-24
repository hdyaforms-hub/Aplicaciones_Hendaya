'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

export interface MentionUser {
    id: string
    username: string
    name: string
    role?: string
}

interface MentionInputProps {
    value: string
    onChange: (val: string) => void
    users: MentionUser[]
    placeholder?: string
    rows?: number
    className?: string
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    autoFocus?: boolean
}

export default function MentionInput({
    value,
    onChange,
    users,
    placeholder = 'Escribe un mensaje... (usa @ para mencionar colegas)',
    rows = 3,
    className = '',
    onKeyDown,
    autoFocus = false
}: MentionInputProps) {
    const [showMenu, setShowMenu] = useState(false)
    const [mentionFilter, setMentionFilter] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Filtrar usuarios según lo tipeado tras '@'
    const filteredUsers = users.filter(u => {
        const query = mentionFilter.toLowerCase()
        return (
            u.username.toLowerCase().includes(query) ||
            u.name.toLowerCase().includes(query)
        )
    }).slice(0, 6)

    // Detectar si el cursor está inmediatamente después de un '@'
    const checkMentionTrigger = useCallback(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        const cursorIndex = textarea.selectionStart
        const textBeforeCursor = value.slice(0, cursorIndex)
        const match = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/)

        if (match) {
            setMentionFilter(match[1])
            setSelectedIndex(0)
            setShowMenu(true)
        } else {
            setShowMenu(false)
        }
    }, [value])

    useEffect(() => {
        checkMentionTrigger()
    }, [value, checkMentionTrigger])

    // Insertar mención seleccionada
    const insertMention = (selectedUser: MentionUser) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const cursorIndex = textarea.selectionStart
        const textBeforeCursor = value.slice(0, cursorIndex)
        const textAfterCursor = value.slice(cursorIndex)

        const match = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/)
        if (!match) return

        const prefix = textBeforeCursor.slice(0, match.index)
        const newText = `${prefix}@${selectedUser.username} ${textAfterCursor}`

        onChange(newText)
        setShowMenu(false)

        setTimeout(() => {
            if (textarea) {
                const newCursorPos = prefix.length + selectedUser.username.length + 2
                textarea.focus()
                textarea.setSelectionRange(newCursorPos, newCursorPos)
            }
        }, 10)
    }

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showMenu && filteredUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % filteredUsers.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length)
                return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                insertMention(filteredUsers[selectedIndex])
                return
            }
            if (e.key === 'Escape') {
                e.preventDefault()
                setShowMenu(false)
                return
            }
        }

        if (onKeyDown) {
            onKeyDown(e)
        }
    }

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleKeyDownInternal}
                onClick={checkMentionTrigger}
                onKeyUp={checkMentionTrigger}
                placeholder={placeholder}
                rows={rows}
                autoFocus={autoFocus}
                className={className || "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-cyan-400 focus:border-cyan-500 outline-none transition-all resize-none"}
            />

            {/* Menú Flotante de Autocompletado de Menciones */}
            {showMenu && filteredUsers.length > 0 && (
                <div
                    ref={menuRef}
                    className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-cyan-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                >
                    <div className="p-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 text-white flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <span>@</span> Mencionar Colega
                        </span>
                        <span className="text-[10px] text-cyan-100 font-medium">Usa ↑ ↓ y Enter</span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredUsers.map((user, idx) => (
                            <div
                                key={user.id || user.username}
                                onClick={() => insertMention(user)}
                                className={`p-2.5 flex items-center gap-2.5 cursor-pointer transition-colors ${
                                    idx === selectedIndex ? 'bg-cyan-50 text-cyan-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <div className="w-7 h-7 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center justify-center flex-shrink-0">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate leading-tight">{user.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">@{user.username} {user.role ? `• ${user.role}` : ''}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
