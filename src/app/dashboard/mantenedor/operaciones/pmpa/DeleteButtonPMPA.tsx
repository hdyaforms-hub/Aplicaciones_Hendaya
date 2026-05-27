'use client'

import { useState } from 'react'
import { deletePMPAPeriod } from './actions'

interface DeleteButtonPMPAProps {
    ano?: number
    mes?: number
    sucursal?: string
}

export default function DeleteButtonPMPA({ ano, mes, sucursal }: DeleteButtonPMPAProps) {
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!ano || !mes) {
            alert('Debes seleccionar al menos Año y Mes para eliminar un período.')
            return
        }

        const confirmMsg = sucursal 
            ? `¿Estás seguro de eliminar todos los registros de PMPA para la sucursal "${sucursal}", año ${ano} y mes ${mes}?`
            : `¿Estás seguro de eliminar TODOS los registros de PMPA para el año ${ano} y mes ${mes}?`

        if (!confirm(confirmMsg)) return

        setLoading(true)
        const res = await deletePMPAPeriod(ano, mes, sucursal)
        setLoading(false)

        if (res.success) {
            alert(`Se eliminaron ${res.count} registros con éxito.`)
        } else {
            alert(`Error: ${res.error}`)
        }
    }

    const isDisabled = !ano || !mes

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={isDisabled || loading}
            className={`px-4 py-2.5 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2 shadow-sm
                ${isDisabled 
                    ? 'bg-gray-300 cursor-not-allowed opacity-50' 
                    : 'bg-red-600 hover:bg-red-700 shadow-red-100 hover:shadow-red-200 active:scale-95'
                } ${loading ? 'animate-pulse' : ''}`}
        >
            {loading ? 'Eliminando...' : '🗑️ Eliminar Período'}
        </button>
    )
}
