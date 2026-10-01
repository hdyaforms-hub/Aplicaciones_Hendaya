'use client'

import { useState } from 'react'
import { deleteColegioByRBD, syncJUNAEBToMatriz } from './actions'
import { useRouter } from 'next/navigation'
import CrearColegioModal from './CrearColegioModal'

export default function ColegiosActions() {
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        const rbdStr = prompt("Ingrese el RBD del colegio que desea eliminar:")
        if (!rbdStr) return
        
        const rbd = parseInt(rbdStr, 10)
        if (isNaN(rbd)) {
            alert("RBD inválido")
            return
        }

        if (!confirm(`¿Está seguro que desea eliminar el colegio con RBD ${rbd}? Se marcará como inactivo en la matriz.`)) return

        setIsDeleting(true)
        const res = await deleteColegioByRBD(rbd)
        setIsDeleting(false)

        if (res.success) {
            alert("Colegio eliminado correctamente")
            router.refresh()
        } else {
            alert(res.error || "Error al eliminar")
        }
    }

    const handleSync = async () => {
        if (!confirm("¿Desea sincronizar los colegios con la matriz de riesgo?\n\n- Se agregarán los colegios JUNAEB faltantes.\n- Se actualizarán los datos de colegios existentes.\n- Se removerán de la matriz los colegios que hayan cambiado a JUNJI, INTEGRA u otra institución.")) return

        setIsSyncing(true)
        const res = await syncJUNAEBToMatriz()
        setIsSyncing(false)

        if (res.success) {
            const added = res.addedCount ?? 0
            const updated = res.updatedCount ?? 0
            const removed = res.removedCount ?? 0
            alert(`Sincronización completada con éxito:\n\n• Colegios agregados: ${added}\n• Colegios actualizados: ${updated}\n• Colegios removidos (no JUNAEB): ${removed}`)
            router.refresh()
        } else {
            alert(res.error || "Error al sincronizar")
        }
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
                {isSyncing ? '⌛' : '🔄'} {isSyncing ? 'Sincronizando...' : 'Sincronizar JUNAEB'}
            </button>
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
                {isDeleting ? '⌛' : '🗑️'} {isDeleting ? 'Eliminando...' : 'Eliminar por RBD'}
            </button>
            <CrearColegioModal />
        </div>
    )
}
