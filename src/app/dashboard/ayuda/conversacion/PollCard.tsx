'use client'

import React, { useState } from 'react'
import { voteChatPollAction } from './actions'

export interface PollOptionItem {
    id: number
    text: string
}

export interface PollVoteItem {
    id?: string
    pollId: string
    username: string
    fullName?: string | null
    optionIndex: number
}

export interface PollItem {
    id: string
    conversationId: string
    question: string
    options: PollOptionItem[]
    allowMultiple: boolean
    isAnonymous: boolean
    expiresAt?: string | null
    createdBy: string
    votes: PollVoteItem[]
}

interface PollCardProps {
    poll: PollItem
    currentUsername: string
}

export default function PollCard({ poll, currentUsername }: PollCardProps) {
    const [votes, setVotes] = useState<PollVoteItem[]>(poll.votes || [])
    const [voting, setVoting] = useState(false)

    const totalVotes = votes.length
    const userVotes = votes.filter(v => v.username === currentUsername).map(v => v.optionIndex)

    const handleVote = async (optionIndex: number) => {
        if (voting) return
        setVoting(true)
        const res = await voteChatPollAction(poll.id, optionIndex)
        if (res.success && res.votes) {
            setVotes(res.votes)
        }
        setVoting(false)
    }

    const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt)

    return (
        <div className="my-2 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-800 space-y-3 max-w-sm">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 flex items-center gap-1">
                        <span>📊</span> Encuesta {poll.isAnonymous ? '(Anónima)' : ''}
                    </span>
                    <h4 className="font-extrabold text-xs text-slate-900 mt-0.5 leading-snug">
                        {poll.question}
                    </h4>
                </div>

                {isExpired && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                        Cerrada
                    </span>
                )}
            </div>

            {/* Opciones con Barras de Progreso */}
            <div className="space-y-2">
                {poll.options.map((opt) => {
                    const optVotes = votes.filter(v => v.optionIndex === opt.id)
                    const count = optVotes.length
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                    const isSelected = userVotes.includes(opt.id)

                    return (
                        <div
                            key={opt.id}
                            onClick={() => !isExpired && handleVote(opt.id)}
                            className={`relative p-2.5 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                                isSelected
                                    ? 'border-cyan-500 bg-cyan-50/60 ring-1 ring-cyan-400'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                            }`}
                        >
                            {/* Barra de Porcentaje en Fondo */}
                            <div
                                style={{ width: `${pct}%` }}
                                className="absolute inset-y-0 left-0 bg-cyan-200/50 rounded-xl transition-all duration-500 pointer-events-none"
                            />

                            <div className="relative z-10 flex items-center justify-between text-xs gap-2">
                                <div className="flex items-center gap-2">
                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-black ${
                                        isSelected ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-slate-400 bg-white'
                                    }`}>
                                        {isSelected ? '✓' : ''}
                                    </span>
                                    <span className="font-bold text-slate-800">{opt.text}</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                    <span className="text-slate-500">{count} votos</span>
                                    <span className="text-cyan-700 font-black">{pct}%</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Pie de Encuesta */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span>{totalVotes} votos totales • {poll.allowMultiple ? 'Opción múltiple' : 'Opción única'}</span>
                <span>Por @{poll.createdBy}</span>
            </div>
        </div>
    )
}
