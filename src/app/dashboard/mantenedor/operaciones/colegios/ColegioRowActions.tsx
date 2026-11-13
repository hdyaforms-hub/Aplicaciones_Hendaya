'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleColegioActivo, deleteColegioByRBD } from './actions'

type ToggleProps = {
    id: string
    rbd: number
    initialActivo: boolean
}

export function ColegioActivoToggle({ id, rbd, initialActivo }: ToggleProps) {
    const [activo, setActivo] = useState(initialActivo)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleToggle = () => {
        const nextState = !activo
        setActivo(nextState) // Actualización optimista

        startTransition(async () => {
            const res = await toggleColegioActivo(id, nextState)
            if (!res.success) {
                setActivo(!nextState) // Revertir en caso de error
                alert(res.error || 'No se pudo actualizar el estado del colegio')
            } else {
                router.refresh()
            }
        })
    }

    return (
        <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border shadow-xs ${
                activo
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:border-slate-300'
            } ${isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            title={activo ? 'Colegio activo. Clic para marcar como inactivo' : 'Colegio inactivo. Clic para activar'}
        >
            <span className={`w-2 h-2 rounded-full ${activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>{isPending ? 'Guardando...' : (activo ? 'Activo' : 'Inactivo')}</span>
        </button>
    )
}

type DeleteProps = {
    rbd: number
    nombre: string
}

export function ColegioDeleteButton({ rbd, nombre }: DeleteProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        const confirmed = window.confirm(
            `¿Está seguro de eliminar el colegio "${nombre}" (RBD: ${rbd})?\n\nEsta acción solo se completará si el colegio no tiene usuarios asociados.`
        )
        if (!confirmed) return

        setIsDeleting(true)
        const res = await deleteColegioByRBD(rbd)
        setIsDeleting(false)

        if (res.success) {
            alert(`El colegio "${nombre}" (RBD: ${rbd}) fue eliminado exitosamente.`)
            router.refresh()
        } else {
            alert(res.error || 'No se pudo eliminar el colegio.')
        }
    }

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            title="Eliminar colegio"
            aria-label={`Eliminar colegio ${nombre}`}
        >
            {isDeleting ? (
                <span className="text-xs animate-spin">⏳</span>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            )}
        </button>
    )
}

