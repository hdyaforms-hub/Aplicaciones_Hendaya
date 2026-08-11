'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ActaField, saveActaPlantilla, duplicateActaPlantilla, deleteActaPlantilla, toggleActaState } from '../actions'

interface Props {
    initialPlantilla?: any
    initialPlantillas?: any[]
    licitaciones: { licId: number; licitacionHomologada: string | null }[]
    rolesList?: { id: string; name: string; description?: string | null }[]
}

const FIELD_TYPES = [
    {
        category: 'Básico',
        items: [
            { id: 'text', label: 'Texto Corto', icon: '📝' },
            { id: 'textarea', label: 'Texto Largo', icon: '📄' },
            { id: 'date', label: 'Fecha', icon: '📅' },
            { id: 'time', label: 'Hora', icon: '⏰' }
        ]
    },
    {
        category: 'Selección',
        items: [
            { id: 'select', label: 'Selección Única (Dropdown)', icon: '🔽' },
            { id: 'multiselect', label: 'Selección Múltiple', icon: '☑️' },
            { id: 'radio', label: 'Radio Button', icon: '🔘' },
            { id: 'checkbox', label: 'Casilla de Verificación', icon: '✅' }
        ]
    },
    {
        category: 'Avanzado',
        items: [
            { id: 'audit_item', label: 'Requisito de Acta (Estado C/NC/NA + Obs + Acción Correctiva)', icon: '📋' },
            { id: 'numeric_special', label: 'Numérico Especial (Texto + Número/Valor)', icon: '🔢' },
            { id: 'totalizer', label: 'Totalizador / Calculador (Operación sobre Numérico Especial)', icon: '🧮' },
            { id: 'group', label: 'Agrupar (Grupo de Preguntas)', icon: '📁' },
            { id: 'section', label: 'Sección / Título Separador', icon: '🏷️' },
            { id: 'separator', label: 'Separador (Salto de línea)', icon: '↵' },
            { id: 'linear_scale', label: 'Escala Lineal', icon: '📏' },
            { id: 'rating', label: 'Calificaciones (Estrellas)', icon: '⭐' },
            { id: 'evaluation', label: 'Evaluación (Campo numérico calculado)', icon: '📊' },
            { id: 'observation', label: 'Observación', icon: '💬' },
            { id: 'grid_options', label: 'Cuadrícula de Opciones Múltiple', icon: '▦' },
            { id: 'grid_checkbox', label: 'Cuadrícula de Casilla', icon: '🖽' },
            { id: 'table', label: 'Tabla Estática', icon: '📋' },
            { id: 'dynamic_table', label: 'Tabla Dinámica Repetible (el usuario puede agregar filas)', icon: '📊' },
            { id: 'signature', label: 'Firma Digital Simple (Solo recuadro de firma)', icon: '✍️' },
            { id: 'signature_with_data', label: 'Firma Digital con Datos (Firma + Nombre y RUT)', icon: '🖋️' },
            { id: 'file', label: 'Cargar Archivo', icon: '📎' }
        ]
    }
]

export default function CrearActaClient({ initialPlantilla, initialPlantillas, licitaciones, rolesList = [] }: Props) {
    const router = useRouter()

    // Configuración Inicial Obligatoria del Acta
    const [nombre, setNombre] = useState(initialPlantilla?.nombre || '')
    const [licitacionId, setLicitacionId] = useState<number | string>(initialPlantilla?.licitacionId || '')
    const [anio, setAnio] = useState<number>(initialPlantilla?.anio || new Date().getFullYear())
    const [estado, setEstado] = useState<boolean>(initialPlantilla ? initialPlantilla.estado : true)
    const [conLogo, setConLogo] = useState<boolean>(
        initialPlantilla ? initialPlantilla.logoUrl !== 'false' : true
    )
    const [instrucciones, setInstrucciones] = useState<string>(initialPlantilla?.instrucciones || '')
    const [codigo, setCodigo] = useState<string>(initialPlantilla?.codigo || '')
    const [version, setVersion] = useState<string>(initialPlantilla?.version || '')
    const [fecha, setFecha] = useState<string>(initialPlantilla?.fecha || '')
    
    // Configuración Adicional (Correlativos y códigos)
    const [codigoAdicional, setCodigoAdicional] = useState<string>(initialPlantilla?.codigoAdicional || '')
    const [mostrarCodigoAdicional, setMostrarCodigoAdicional] = useState<boolean>(initialPlantilla?.mostrarCodigoAdicional ?? false)
    const [correlativoAutomatico, setCorrelativoAutomatico] = useState<boolean>(initialPlantilla?.correlativoAutomatico ?? false)
    const [mostrarCodigoVersionFecha, setMostrarCodigoVersionFecha] = useState<boolean>(initialPlantilla?.mostrarCodigoVersionFecha ?? true)

    // Campos del formulario
    const [fields, setFields] = useState<ActaField[]>(initialPlantilla?.campos || [])
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [previewMode, setPreviewMode] = useState(false)
    const [previewModalPlantilla, setPreviewModalPlantilla] = useState<any | null>(null)

    // Agregar campo con generador de ID seguro para HTTP/HTTPS
    const addField = (afterIndex?: number) => {
        const safeId = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)

        const newField: ActaField = {
            id: safeId,
            label: 'Nuevo Campo / Pregunta',
            type: 'text',
            required: false,
            validation: 'Ninguna (Texto libre)'
        }

        if (typeof afterIndex === 'number') {
            const copy = [...fields]
            copy.splice(afterIndex + 1, 0, newField)
            setFields(copy)
        } else {
            setFields([...fields, newField])
        }
    }

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id))
    }

    const updateField = (id: string, updates: Partial<ActaField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
    }

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newFields = [...fields]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newFields.length) return
        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]]
        setFields(newFields)
    }

    const duplicateField = (id: string, index: number) => {
        const fieldToDuplicate = fields.find(f => f.id === id)
        if (!fieldToDuplicate) return

        const safeId = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
            
        const duplicatedField: ActaField = {
            ...fieldToDuplicate,
            id: safeId,
            label: '',
            auditColumns: fieldToDuplicate.auditColumns ? JSON.parse(JSON.stringify(fieldToDuplicate.auditColumns)) : undefined,
            options: fieldToDuplicate.options ? [...fieldToDuplicate.options] : undefined
        }

        const copy = [...fields]
        copy.splice(index + 1, 0, duplicatedField)
        setFields(copy)
    }



    const AVAILABLE_INSTITUCIONES = ['JUNAEB', 'JUNJI', 'INTEGRA']

    const parseInitialInstituciones = (data: any): string[] => {
        if (!data) return ['JUNAEB']
        if (Array.isArray(data)) return data
        try {
            const parsed = JSON.parse(data)
            return Array.isArray(parsed) ? parsed : [data]
        } catch {
            return String(data).split(',').map(s => s.trim())
        }
    }

    const [selectedInstituciones, setSelectedInstituciones] = useState<string[]>(
        parseInitialInstituciones(initialPlantilla?.instituciones)
    )
    const [isInstDropdownOpen, setIsInstDropdownOpen] = useState(false)

    const toggleInstitucion = (inst: string) => {
        if (selectedInstituciones.includes(inst)) {
            // Evitar desmarcar todas
            if (selectedInstituciones.length > 1) {
                setSelectedInstituciones(selectedInstituciones.filter(i => i !== inst))
            }
        } else {
            setSelectedInstituciones([...selectedInstituciones, inst])
        }
    }

    const parseInitialRoles = (data: any): string[] => {
        if (!data) return []
        if (Array.isArray(data)) return data
        try {
            const parsed = JSON.parse(data)
            return Array.isArray(parsed) ? parsed : [data]
        } catch {
            return String(data).split(',').map(s => s.trim()).filter(Boolean)
        }
    }

    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        parseInitialRoles(initialPlantilla?.rolesPerfiles)
    )
    const [isRolesDropdownOpen, setIsRolesDropdownOpen] = useState(false)

    const toggleRole = (roleName: string) => {
        if (selectedRoles.includes(roleName)) {
            setSelectedRoles(selectedRoles.filter(r => r !== roleName))
        } else {
            setSelectedRoles([...selectedRoles, roleName])
        }
    }

    const [plantillasList, setPlantillasList] = useState<any[]>(initialPlantillas || [])
    const [viewMode, setViewMode] = useState<'table' | 'builder'>(
        initialPlantilla ? 'builder' : 'table'
    )
    const [tableSearch, setTableSearch] = useState('')
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const handleToggleState = async (id: string, currentState: boolean) => {
        setLoadingId(id)
        const res = await toggleActaState(id, !currentState)
        if (res.success) {
            setPlantillasList(prev => prev.map(p => p.id === id ? { ...p, estado: !currentState } : p))
        } else {
            alert(res.error || 'Error al cambiar estado')
        }
        setLoadingId(null)
    }

    // Modal para duplicar formulario completo solicitando nuevo nombre
    const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; item?: any; newName: string }>({
        open: false,
        newName: ''
    })

    const openDuplicateModal = (item: any) => {
        setDuplicateModal({
            open: true,
            item,
            newName: `Copia de ${item.nombre}`
        })
    }

    const confirmDuplicate = async () => {
        if (!duplicateModal.item) return
        if (!duplicateModal.newName.trim()) {
            alert('Debes ingresar un nombre para la copia del formulario')
            return
        }

        setLoadingId(duplicateModal.item.id)
        const res = await duplicateActaPlantilla(duplicateModal.item.id, duplicateModal.newName.trim())
        if (res.success && res.copy) {
            setPlantillasList(prev => [res.copy, ...prev])
            setMessage({ type: 'success', text: `¡Formulario duplicado con éxito como "${res.copy.nombre}"!` })
            setDuplicateModal({ open: false, newName: '' })
        } else {
            alert(res.error || 'Error al duplicar formulario')
        }
        setLoadingId(null)
    }

    const handleDelete = async (id: string, nombre: string, respuestasCount: number) => {
        if (respuestasCount > 0) {
            alert(`No se puede eliminar la cabecera "${nombre}" porque ya cuenta con ${respuestasCount} respuesta(s) registrada(s) en terreno.`)
            return
        }
        if (!confirm(`¿Estás seguro de eliminar la cabecera del acta "${nombre}"?`)) return

        setLoadingId(id)
        const res = await deleteActaPlantilla(id)
        if (res.success) {
            setPlantillasList(prev => prev.filter(p => p.id !== id))
            setMessage({ type: 'success', text: `Cabecera "${nombre}" eliminada exitosamente.` })
        } else {
            alert(res.error || 'Error al eliminar la cabecera')
        }
        setLoadingId(null)
    }

    const handleCreateNew = () => {
        setNombre('')
        setLicitacionId('')
        setAnio(new Date().getFullYear())
        setEstado(true)
        setConLogo(true)
        setInstrucciones('')
        setCodigo('')
        setVersion('')
        setFecha('')
        setCodigoAdicional('')
        setMostrarCodigoAdicional(false)
        setCorrelativoAutomatico(false)
        setMostrarCodigoVersionFecha(true)
        setSelectedRoles([])
        setFields([])
        setMessage({ type: '', text: '' })
        setPreviewMode(false)
        setViewMode('builder')
    }

    const [currentActaId, setCurrentActaId] = useState<string | null>(initialPlantilla?.id || null)
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null)
    const [isAutoSaving, setIsAutoSaving] = useState(false)

    const initialRender = useRef(true)
    useEffect(() => {
        if (initialRender.current) {
            initialRender.current = false
            return
        }
        
        setIsAutoSaving(true)
        const timeoutId = setTimeout(() => {
            // Auto-guardar silencioso si los datos mínimos están
            if (nombre.trim() && licitacionId && selectedInstituciones.length > 0 && fields.length > 0) {
                handleSave(true)
            } else {
                setIsAutoSaving(false)
            }
        }, 1500) // Debounce de 1.5s

        return () => clearTimeout(timeoutId)
    }, [fields, nombre, licitacionId, anio, estado, conLogo, instrucciones, codigo, version, fecha, codigoAdicional, mostrarCodigoAdicional, correlativoAutomatico, mostrarCodigoVersionFecha, selectedInstituciones, selectedRoles])


    const handleSave = async (isAutoSave: boolean = false) => {
        if (!nombre.trim() || !licitacionId || selectedInstituciones.length === 0 || fields.length === 0) {
            if (!isAutoSave) {
                if (!nombre.trim()) setMessage({ type: 'error', text: 'Debes ingresar el Nombre del Acta' })
                else if (!licitacionId) setMessage({ type: 'error', text: 'Debes seleccionar la Licitación' })
                else if (selectedInstituciones.length === 0) setMessage({ type: 'error', text: 'Debes seleccionar al menos una Institución' })
                else if (fields.length === 0) setMessage({ type: 'error', text: 'Añade al menos un campo al formulario del acta' })
            }
            setIsAutoSaving(false)
            return
        }

        if (!isAutoSave) {
            setIsSaving(true)
            setMessage({ type: '', text: '' })
        }

        try {
            const res = await saveActaPlantilla({
                id: currentActaId,
                nombre,
                licitacionId: Number(licitacionId),
                anio: Number(anio),
                instituciones: selectedInstituciones,
                rolesPerfiles: selectedRoles,
                estado,
                logoUrl: conLogo ? 'true' : 'false',
                instrucciones,
                codigo,
                version,
                fecha,
                codigoAdicional,
                mostrarCodigoAdicional,
                correlativoAutomatico,
                mostrarCodigoVersionFecha,
                campos: fields
            })

            if (res.success) {
                if (res.id) setCurrentActaId(res.id)
                setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
                
                if (!isAutoSave) {
                    setMessage({ type: 'success', text: '¡Acta guardada con éxito! Redirigiendo...' })
                    setTimeout(() => {
                        router.push('/dashboard/mantenedor/actas-supervision/crear')
                        router.refresh()
                    }, 1000)
                }
            } else {
                if (!isAutoSave) {
                    setMessage({ type: 'error', text: res.error || 'Error al guardar el acta' })
                    setIsSaving(false)
                }
            }
        } catch (err: any) {
            console.error('Error saving acta:', err)
            if (!isAutoSave) {
                setMessage({ type: 'error', text: err.message || 'Error inesperado al guardar el acta' })
                setIsSaving(false)
            }
        } finally {
            setIsAutoSaving(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto pb-24 space-y-8 animate-in fade-in duration-300">
            {/* Header bar */}
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-full blur-3xl -z-0" />
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {viewMode === 'builder' ? (
                                <button
                                    onClick={() => {
                                        router.push('/dashboard/mantenedor/actas-supervision/crear')
                                        router.refresh()
                                    }}
                                    className="text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    ⬅ Volver a la Tabla
                                </button>
                            ) : (
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    ⬅ Inicio
                                </button>
                            )}
                            <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                                {viewMode === 'table' ? 'Mantenedor • Actas de Supervisión' : 'Constructor de Actas'}
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                            {viewMode === 'table' ? '📋 Gestor y Constructor de Actas' : (initialPlantilla ? '✏️ Editar Formulario de Acta' : '📋 Crear Nueva Cabecera de Acta')}
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {viewMode === 'table' 
                                ? 'Administra las cabeceras creadas, edita parámetros, duplica o diseña nuevos formularios.' 
                                : 'Diseña formularios dinámicos institucionales con firma digital, evaluaciones y tablas.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {viewMode === 'table' ? (
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2 cursor-pointer"
                            >
                                <span>➕</span> CREAR NUEVA CABECERA
                            </button>
                        ) : (
                            <>
                                {isAutoSaving ? (
                                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                                        <span className="animate-spin">⏳</span> Guardando cabecera...
                                    </span>
                                ) : lastSavedTime ? (
                                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                        <span>🟢</span> Auto-guardado ({lastSavedTime})
                                    </span>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={() => setPreviewMode(!previewMode)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                                        previewMode 
                                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20' 
                                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                                    }`}
                                >
                                    <span>{previewMode ? '✏️ Modo Edición' : '👁️ Vista Previa'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="animate-spin">⏳</span> Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <span>💾</span> GUARDAR ACTA
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mensajes de feedback */}
            {message.text && (
                <div className={`p-4 rounded-2xl text-sm font-bold border flex items-center gap-3 animate-in zoom-in-95 duration-200 ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    <span>{message.type === 'success' ? '✅' : '⚠️'}</span>
                    <span>{message.text}</span>
                </div>
            )}

            {/* VISTA 1: TABLA DE CABECERAS CREADAS */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                <span>📋</span> Tabla de Cabeceras Registradas ({plantillasList.length})
                            </h2>
                            <p className="text-xs text-gray-500">Selecciona un título para editarlo o gestionarlo</p>
                        </div>
                        <div className="w-full sm:w-72">
                            <input
                                type="text"
                                placeholder="🔍 Buscar por título o licitación..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-slate-800 bg-gray-50 focus:ring-2 focus:ring-cyan-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <th className="p-3.5">Título de la Cabecera</th>
                                    <th className="p-3.5">Licitación</th>
                                    <th className="p-3.5">Año</th>
                                    <th className="p-3.5">Instituciones</th>
                                    <th className="p-3.5">Roles / Perfiles</th>
                                    <th className="p-3.5 text-center">Campos</th>
                                    <th className="p-3.5 text-center">Respuestas</th>
                                    <th className="p-3.5 text-center">Estado</th>
                                    <th className="p-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                                {plantillasList
                                    .filter(p => !tableSearch || p.nombre.toLowerCase().includes(tableSearch.toLowerCase()))
                                    .map((p) => {
                                        const respuestasCount = p._count?.respuestas || 0
                                        let insts: string[] = []
                                        try {
                                            const parsed = JSON.parse(p.instituciones || '[]')
                                            insts = Array.isArray(parsed) ? parsed : [p.instituciones]
                                        } catch {
                                            insts = (p.instituciones || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                                        }

                                        let rolesAsignados: string[] = []
                                        try {
                                            const parsedRoles = JSON.parse(p.rolesPerfiles || '[]')
                                            rolesAsignados = Array.isArray(parsedRoles) ? parsedRoles : [p.rolesPerfiles]
                                        } catch {
                                            rolesAsignados = (p.rolesPerfiles || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                                        }

                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="p-3.5 font-bold text-slate-900">
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/dashboard/mantenedor/actas-supervision/crear/${p.id}`)}
                                                        className="hover:text-cyan-600 transition-colors text-left font-black"
                                                    >
                                                        {p.nombre}
                                                    </button>
                                                </td>
                                                <td className="p-3.5 font-semibold text-slate-600">
                                                    Lic. #{p.licitacionId || 'N/A'}
                                                </td>
                                                <td className="p-3.5 font-semibold text-slate-600">
                                                    {p.anio}
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {insts.map((inst: string) => (
                                                            <span key={inst} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded">
                                                                {inst}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {rolesAsignados.length > 0 ? (
                                                            rolesAsignados.map((r: string) => (
                                                                <span key={r} className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-100 text-[9px] font-bold rounded">
                                                                    {r}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-medium rounded italic">
                                                                Todos los Perfiles
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-center font-bold text-slate-700">
                                                    {p.campos?.length || 0}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                                        respuestasCount > 0 
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {respuestasCount} respuestas
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleState(p.id, p.estado)}
                                                        disabled={loadingId === p.id}
                                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                                            p.estado 
                                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200' 
                                                                : 'bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200'
                                                        }`}
                                                    >
                                                        {p.estado ? 'Vigente' : 'No Vigente'}
                                                    </button>
                                                </td>
                                                <td className="p-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewModalPlantilla(p)}
                                                            className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg text-xs transition-colors cursor-pointer"
                                                            title="Vista Previa de la Cabecera y Formulario"
                                                        >
                                                            👁️
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push(`/dashboard/mantenedor/actas-supervision/crear/${p.id}`)}
                                                            className="p-1.5 bg-slate-100 hover:bg-cyan-100 text-slate-700 hover:text-cyan-700 rounded-lg text-xs transition-colors cursor-pointer"
                                                            title="Editar Cabecera y Campos"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openDuplicateModal(p)}
                                                            disabled={loadingId === p.id}
                                                            className="p-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-lg text-xs transition-colors cursor-pointer"
                                                            title="Duplicar Formulario Completo"
                                                        >
                                                            📋
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(p.id, p.nombre, respuestasCount)}
                                                            disabled={loadingId === p.id || respuestasCount > 0}
                                                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                                                                respuestasCount > 0 
                                                                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                                                                    : 'bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 cursor-pointer'
                                                            }`}
                                                            title={respuestasCount > 0 ? "No se puede eliminar porque ya cuenta con respuestas en terreno" : "Eliminar Cabecera"}
                                                        >
                                                            {respuestasCount > 0 ? '🔒' : '🗑️'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>

                        {plantillasList.length === 0 && (
                            <div className="py-12 text-center text-gray-400 space-y-2">
                                <span className="text-4xl block">📭</span>
                                <p className="font-semibold text-xs">No hay cabeceras registradas aún.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* MODAL PARA DUPLICAR FORMULARIO COMPLETO */}
            {duplicateModal.open && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl p-2 bg-indigo-50 text-indigo-600 rounded-2xl">📋</span>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Duplicar Formulario Completo</h3>
                                    <p className="text-xs text-gray-500">Copia la cabecera y todos los campos del acta</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDuplicateModal({ open: false, newName: '' })}
                                className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-1">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Acta Original</span>
                                <p className="text-xs font-extrabold text-indigo-950">{duplicateModal.item?.nombre}</p>
                                <p className="text-[10px] text-indigo-700">
                                    Lic. #{duplicateModal.item?.licitacionId} • Año {duplicateModal.item?.anio} • {duplicateModal.item?.campos?.length || 0} campos
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    Nombre para el Nuevo Formulario Duplicado <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={duplicateModal.newName}
                                    onChange={(e) => setDuplicateModal({ ...duplicateModal, newName: e.target.value })}
                                    placeholder="Ej: Copia - Acta de Inspección 2026"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 text-sm outline-none bg-slate-50"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setDuplicateModal({ open: false, newName: '' })}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmDuplicate}
                                disabled={loadingId === duplicateModal.item?.id}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer"
                            >
                                {loadingId === duplicateModal.item?.id ? '⏳ Duplicando...' : '📋 Confirmar y Duplicar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VISTA PREVIA DE CABECERA Y FORMULARIO (VISTA PREVIA EN TIEMPO REAL IDÉNTICA AL CONSTRUCTOR) */}
            {previewModalPlantilla && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-5xl w-full shadow-2xl border border-gray-100 space-y-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {/* Barra Superior del Modal */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl p-2 bg-amber-50 text-amber-600 rounded-2xl">👁️</span>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Vista Previa: {previewModalPlantilla.nombre}</h3>
                                    <p className="text-xs text-gray-500">Visualización idéntica al formulario en terreno y a la vista previa del editor</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewModalPlantilla(null)}
                                className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* CONTENEDOR DE LA VISTA PREVIA COMPLETA */}
                        {(() => {
                            const pNombre = previewModalPlantilla.nombre || 'TÍTULO DEL ACTA'
                            const pInstrucciones = previewModalPlantilla.instrucciones || ''
                            const pCodigo = previewModalPlantilla.codigo || '-'
                            const pVersion = previewModalPlantilla.version || '-'
                            const pFecha = previewModalPlantilla.fecha || '-'
                            const pLicitacion = previewModalPlantilla.licitacionId || 'N/A'
                            const pAnio = previewModalPlantilla.anio || new Date().getFullYear()

                            let pInsts: string[] = []
                            try {
                                const parsed = JSON.parse(previewModalPlantilla.instituciones || '[]')
                                pInsts = Array.isArray(parsed) ? parsed : [previewModalPlantilla.instituciones]
                            } catch {
                                pInsts = (previewModalPlantilla.instituciones || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                            }

                            const pShowLogo = previewModalPlantilla.logoUrl !== 'false'

                            const pCampos: ActaField[] = typeof previewModalPlantilla.campos === 'string'
                                ? JSON.parse(previewModalPlantilla.campos || '[]')
                                : (previewModalPlantilla.campos || [])

                            return (
                                <div className="space-y-6">
                                    {/* Tarjeta Principal de la Cabecera */}
                                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative space-y-4">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                            {/* 1. Logo (Izquierda) */}
                                            <div className="md:w-1/4 flex justify-center md:justify-start">
                                                {pShowLogo ? (
                                                    <div className="px-2 py-2 inline-flex items-center">
                                                        <span className="text-2xl font-black text-cyan-500 tracking-widest uppercase">HENDAYA</span>
                                                    </div>
                                                ) : (
                                                    <div className="w-28 h-10 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase">
                                                        Sin Logo
                                                    </div>
                                                )}
                                            </div>

                                            {/* 2. Título (Centro) */}
                                            <div className="md:w-2/4 flex flex-col items-center justify-center text-center">
                                                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                                                    {pNombre}
                                                </h2>
                                                <p className="text-xs text-slate-500 mt-2 max-w-md">
                                                    {pInstrucciones || 'Procedimiento: revisión de cada ítem mencionado en listado. Frecuencia: Mensual.'}
                                                </p>
                                            </div>

                                            {/* 3. Info Extra (Derecha) */}
                                            <div className="md:w-1/4 flex justify-center md:justify-end relative">
                                                <span className="absolute -top-7 right-0 px-3 py-1 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-lg border border-amber-200 uppercase tracking-wider shadow-sm z-10">
                                                    👁️ VISTA PREVIA
                                                </span>
                                                {(previewModalPlantilla.mostrarCodigoVersionFecha !== false || (previewModalPlantilla.mostrarCodigoAdicional && previewModalPlantilla.codigoAdicional) || previewModalPlantilla.correlativoAutomatico) && (
                                                    <table className="text-[10px] text-left border-collapse border border-gray-300 bg-white min-w-[120px]">
                                                        <tbody>
                                                            {previewModalPlantilla.mostrarCodigoVersionFecha !== false && (
                                                                <>
                                                                    <tr>
                                                                        <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Código</th>
                                                                        <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{pCodigo}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Versión</th>
                                                                        <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{pVersion}</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Fecha</th>
                                                                        <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{pFecha}</td>
                                                                    </tr>
                                                                </>
                                                            )}
                                                            {previewModalPlantilla.mostrarCodigoAdicional && (
                                                                <tr>
                                                                    <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Cód. Adicional</th>
                                                                    <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{previewModalPlantilla.codigoAdicional || '-'}</td>
                                                                </tr>
                                                            )}
                                                            {previewModalPlantilla.correlativoAutomatico && (
                                                                <tr>
                                                                    <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Correlativo</th>
                                                                    <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">0000000001</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata inferior del encabezado */}
                                        <div className="flex flex-wrap justify-center gap-2 mt-4 pt-4 border-t border-gray-100 text-[10px] font-bold">
                                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-700">Lic. #{pLicitacion}</span>
                                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-700">Año {pAnio}</span>
                                            <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-1 rounded-full">
                                                🏛️ {pInsts.join(' • ')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Encabezado de Terreno (Autocompletado) */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-wider">Encabezado de Terreno (Autocompletado)</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-700">
                                            <div><span className="font-bold text-gray-400 block">RBD:</span> 12345</div>
                                            <div><span className="font-bold text-gray-400 block">Establecimiento:</span> Escuela Ejemplo</div>
                                            <div><span className="font-bold text-gray-400 block">Comuna / Ciudad:</span> Santiago</div>
                                            <div><span className="font-bold text-gray-400 block">Supervisor:</span> Juan Pérez</div>
                                        </div>
                                    </div>

                                    {/* Tabla de Requisitos del Formulario */}
                                    <div className="space-y-6 pt-2">
                                        {(() => {
                                            const segments: { type: 'audit-table' | 'regular'; fields: ActaField[] }[] = []
                                            let current: { type: 'audit-table' | 'regular'; fields: ActaField[] } | null = null

                                            for (const f of pCampos) {
                                                const isAudit = f.type === 'audit_item' || f.type === 'group'
                                                if (isAudit) {
                                                    if (!current || current.type !== 'audit-table') {
                                                        current = { type: 'audit-table', fields: [] }
                                                        segments.push(current)
                                                    }
                                                    current.fields.push(f)
                                                } else {
                                                    if (!current || current.type !== 'regular') {
                                                        current = { type: 'regular', fields: [] }
                                                        segments.push(current)
                                                    }
                                                    current.fields.push(f)
                                                }
                                            }

                                            if (segments.length === 0) {
                                                return <p className="text-xs text-gray-400 italic text-center py-6">Sin preguntas registradas en este formulario.</p>
                                            }

                                            return segments.map((seg, si) => {
                                                if (seg.type === 'regular') {
                                                    return (
                                                        <div key={si} className="flex flex-wrap gap-4">
                                                            {seg.fields.map((f, i) => (
                                                                <PreviewFieldRenderer key={f.id} field={f} index={i} />
                                                            ))}
                                                        </div>
                                                    )
                                                }

                                                const firstAudit = seg.fields.find(f => f.type === 'audit_item')
                                                const auditCols = firstAudit?.auditColumns && firstAudit.auditColumns.length > 0
                                                    ? firstAudit.auditColumns
                                                    : [
                                                        { key: 'col_req', label: 'REQUISITO', type: 'text' as const, options: [] as string[] },
                                                        { key: 'col_est', label: 'ESTADO', type: 'select' as const, options: ['Cumple', 'No Cumple', 'No Aplica'] },
                                                        { key: 'col_obs', label: 'OBSERVACIÓN', type: 'text' as const, options: [] as string[] },
                                                        { key: 'col_acc', label: 'ACCIÓN CORRECTIVA', type: 'text' as const, options: [] as string[] }
                                                    ]

                                                let currentGroup = ''
                                                let groupRowCount: Record<string, number> = {}

                                                seg.fields.forEach(f => {
                                                    if (f.type === 'group') {
                                                        currentGroup = f.label || 'GRUPO'
                                                        groupRowCount[currentGroup] = 0
                                                    } else if (f.type === 'audit_item') {
                                                        if (currentGroup) groupRowCount[currentGroup] = (groupRowCount[currentGroup] || 0) + 1
                                                    }
                                                })

                                                currentGroup = ''
                                                const renderedGroups = new Set<string>()

                                                return (
                                                    <div key={si} className="overflow-x-auto rounded-2xl border border-gray-300 shadow-sm">
                                                        <table className="w-full border-collapse text-xs" style={{ minWidth: '650px' }}>
                                                            <thead>
                                                                <tr className="bg-slate-900 text-white">
                                                                    {seg.fields.some(f => f.type === 'group') && (
                                                                        <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-700 w-20 text-[10px]">GRUPO</th>
                                                                    )}
                                                                    {auditCols.map((col) => (
                                                                        <th key={col.key} className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-700 text-[10px]">
                                                                            {col.label}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {seg.fields.map((f, fi) => {
                                                                    if (f.type === 'group') {
                                                                        currentGroup = f.label || 'GRUPO'
                                                                        return null
                                                                    }
                                                                    if (f.type !== 'audit_item') return null

                                                                    const rowCols = f.auditColumns && f.auditColumns.length > 0
                                                                        ? f.auditColumns
                                                                        : auditCols

                                                                    const showGroupCell = seg.fields.some(f2 => f2.type === 'group') && !renderedGroups.has(currentGroup)
                                                                    if (showGroupCell && currentGroup) renderedGroups.add(currentGroup)

                                                                    return (
                                                                        <tr key={f.id} className={fi % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                                            {seg.fields.some(f2 => f2.type === 'group') && (
                                                                                showGroupCell ? (
                                                                                    <td
                                                                                        rowSpan={groupRowCount[currentGroup] || 1}
                                                                                        className="border-r border-gray-200 border-b border-gray-200 bg-slate-900 text-center align-middle p-0"
                                                                                        style={{ minWidth: '60px' }}
                                                                                    >
                                                                                        <div className="flex items-center justify-center h-full py-3 px-1">
                                                                                            <span
                                                                                                className="text-cyan-300 font-black text-[9px] uppercase tracking-widest"
                                                                                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
                                                                                            >
                                                                                                {currentGroup}
                                                                                            </span>
                                                                                        </div>
                                                                                    </td>
                                                                                ) : <td className="hidden" />
                                                                            )}
                                                                            {rowCols.map((col, ci) => (
                                                                                <td key={col.key} className="px-2.5 py-2 border-r border-b border-gray-200 align-middle">
                                                                                    {col.type === 'select' ? (
                                                                                        <select disabled className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-slate-800 font-bold cursor-not-allowed">
                                                                                            {(col.options && col.options.length > 0 ? col.options : ['Cumple', 'No Cumple', 'No Aplica']).map((opt, j) => (
                                                                                                <option key={j}>{opt}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    ) : col.type === 'number' ? (
                                                                                        <input type="number" placeholder="0" disabled className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white cursor-not-allowed" />
                                                                                    ) : (
                                                                                        <span className="text-slate-800 font-medium">{ci === 0 ? f.label : ''}</span>
                                                                                    )}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                </div>
                            )
                        })()}

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setPreviewModalPlantilla(null)}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                            >
                                ✕ Cerrar Vista Previa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA 2: CONSTRUCTOR / EDICIÓN DE CABECERA Y CAMPOS */}
            {viewMode === 'builder' && (
                <div className="space-y-8">

            {/* 1. CONFIGURACIÓN CABECERA DEL ACTA */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>⚙️</span> Parámetros Principales del Acta
                        </h2>
                        <p className="text-xs text-gray-500">Configuración requerida antes de agregar campos</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <span className={`text-xs font-bold uppercase tracking-wider ${estado ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {estado ? 'Vigente' : 'No Vigente'}
                        </span>
                        <input
                            type="checkbox"
                            checked={estado}
                            onChange={(e) => setEstado(e.target.checked)}
                            className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                        />
                    </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    {/* Licitación */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Licitación <span className="text-rose-500">*</span>
                        </label>
                        <select
                            title="Seleccionar licitación"
                            value={licitacionId}
                            onChange={(e) => setLicitacionId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-sm outline-none transition-all"
                        >
                            <option value="">Selecciona Licitación...</option>
                            {licitaciones.map(l => (
                                <option key={l.licId} value={l.licId}>
                                    Lic. #{l.licId} {l.licitacionHomologada ? `(${l.licitacionHomologada})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Año */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Año <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={anio}
                            onChange={(e) => setAnio(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-sm outline-none transition-all"
                            placeholder="Ej: 2026"
                        />
                    </div>

                    {/* Institución (Lista Desplegable Múltiple Selección) */}
                    <div className="space-y-1.5 relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Institución <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsInstDropdownOpen(!isInstDropdownOpen)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-xs outline-none transition-all flex justify-between items-center text-left"
                            >
                                <span className="truncate">
                                    {selectedInstituciones.length === 0
                                        ? 'Seleccionar Institución...'
                                        : selectedInstituciones.join(', ')}
                                </span>
                                <span className="text-xs text-gray-400 shrink-0 ml-2">
                                    {isInstDropdownOpen ? '▲' : '▼'}
                                </span>
                            </button>

                            {isInstDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 z-30 space-y-2 animate-in zoom-in-95 duration-150">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                        Selecciona una o más:
                                    </div>
                                    {AVAILABLE_INSTITUCIONES.map((inst) => {
                                        const isSelected = selectedInstituciones.includes(inst)
                                        return (
                                            <div
                                                key={inst}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleInstitucion(inst)
                                                }}
                                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                                                    isSelected
                                                        ? 'bg-cyan-50 text-cyan-800 border-cyan-300 font-extrabold'
                                                        : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100 font-medium'
                                                }`}
                                            >
                                                <span className="text-xs">{inst}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    readOnly
                                                    className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 pointer-events-none"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Roles y Perfiles (Lista Desplegable Múltiple Selección) */}
                    <div className="space-y-1.5 relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Roles y Perfiles
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsRolesDropdownOpen(!isRolesDropdownOpen)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-xs outline-none transition-all flex justify-between items-center text-left"
                            >
                                <span className="truncate">
                                    {selectedRoles.length === 0
                                        ? 'Todos los Perfiles'
                                        : selectedRoles.join(', ')}
                                </span>
                                <span className="text-xs text-gray-400 shrink-0 ml-2">
                                    {isRolesDropdownOpen ? '▲' : '▼'}
                                </span>
                            </button>

                            {isRolesDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 z-30 space-y-2 max-h-60 overflow-y-auto animate-in zoom-in-95 duration-150">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            Perfiles con acceso:
                                        </span>
                                        {selectedRoles.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRoles([])}
                                                className="text-[10px] text-cyan-600 font-bold hover:underline"
                                            >
                                                Limpiar (Todos)
                                            </button>
                                        )}
                                    </div>
                                    {rolesList && rolesList.length > 0 ? (
                                        rolesList.map((r) => {
                                            const isSelected = selectedRoles.includes(r.name) || selectedRoles.includes(r.id)
                                            return (
                                                <div
                                                    key={r.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleRole(r.name)
                                                    }}
                                                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                                                        isSelected
                                                            ? 'bg-cyan-50 text-cyan-800 border-cyan-300 font-extrabold'
                                                            : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100 font-medium'
                                                    }`}
                                                >
                                                    <span className="text-xs">{r.name}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 pointer-events-none"
                                                    />
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="text-xs text-gray-400 p-2 text-center">Cargando roles...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Nombre del Acta */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Nombre del Acta <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej: Acta de Inspección Técnica Operativa"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-sm outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Logo de Empresa e Instrucciones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Encabezado Corporativo
                        </label>
                        <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100/80 transition-all cursor-pointer">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🖼️</span>
                                <div>
                                    <span className="text-xs font-extrabold text-slate-800 block">Incluir Logo de Empresa (HENDAYA)</span>
                                    <span className="text-[10px] text-gray-500">Muestra la marca institucional en el encabezado del acta</span>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={conLogo}
                                onChange={(e) => setConLogo(e.target.checked)}
                                className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                            />
                        </label>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Instrucciones o Descripción del Acta
                        </label>
                        <textarea
                            rows={3}
                            value={instrucciones}
                            onChange={(e) => setInstrucciones(e.target.value)}
                            placeholder="Instrucciones para el supervisor al llenar esta acta..."
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 text-sm text-gray-800 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Campos Adicionales: Código, Versión, Fecha */}
                <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Metadata Básica del Encabezado
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1 rounded-xl border border-gray-200 hover:bg-slate-100 transition-all">
                            <input
                                type="checkbox"
                                checked={mostrarCodigoVersionFecha}
                                onChange={(e) => setMostrarCodigoVersionFecha(e.target.checked)}
                                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                            />
                            <span className={`text-xs font-bold uppercase tracking-wider ${mostrarCodigoVersionFecha ? 'text-cyan-600' : 'text-slate-400'}`}>
                                {mostrarCodigoVersionFecha ? 'Mostrar Código, Versión y Fecha' : 'Ocultar Código, Versión y Fecha'}
                            </span>
                        </label>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all ${!mostrarCodigoVersionFecha ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Código Base
                            </label>
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                disabled={!mostrarCodigoVersionFecha}
                                placeholder="Ej: REG-01"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-sm outline-none transition-all disabled:bg-gray-100"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Versión
                            </label>
                            <input
                                type="text"
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                disabled={!mostrarCodigoVersionFecha}
                                placeholder="Ej: 1.0"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-sm outline-none transition-all disabled:bg-gray-100"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Fecha
                            </label>
                            <input
                                type="text"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                disabled={!mostrarCodigoVersionFecha}
                                placeholder="Ej: Agosto 2026"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 font-bold text-gray-800 text-sm outline-none transition-all disabled:bg-gray-100"
                            />
                        </div>
                    </div>
                </div>

                {/* Configuración Adicional de Código */}
                <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1.5 lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Código Adicional <span className="text-gray-400 font-normal lowercase">(Opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={codigoAdicional}
                            onChange={(e) => setCodigoAdicional(e.target.value)}
                            disabled={!mostrarCodigoAdicional}
                            placeholder="Ej: COD-REF-02"
                            className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 font-bold text-sm outline-none transition-all ${
                                !mostrarCodigoAdicional ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-800'
                            }`}
                        />
                    </div>
                    <div className="space-y-3 lg:col-span-2 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-start items-start sm:items-center pt-5">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={mostrarCodigoAdicional}
                                onChange={(e) => setMostrarCodigoAdicional(e.target.checked)}
                                className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 border-gray-300 cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-800 uppercase group-hover:text-cyan-600 transition-colors">Activar Código en Vista</span>
                                <span className="text-[10px] text-gray-500">Muestra este código en el acta visual.</span>
                            </div>
                        </label>

                        <div className="hidden sm:block w-px h-10 bg-gray-200"></div>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={correlativoAutomatico}
                                onChange={(e) => setCorrelativoAutomatico(e.target.checked)}
                                className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 border-gray-300 cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-800 uppercase group-hover:text-cyan-600 transition-colors">Correlativo Automático</span>
                                <span className="text-[10px] text-gray-500">Asigna correlativo +1 a cada acta nueva.</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* BANNER INFORMATIVO DE CAMPOS POR DEFECTO DEL SISTEMA */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white border border-indigo-900/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 text-2xl shrink-0">
                    ℹ️
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-extrabold text-sm text-cyan-300 uppercase tracking-wider">
                        Campos de Encabezado Institucional Guardados Automáticamente
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Al responder esta acta en terreno, el sistema completará de forma automática y por defecto los datos de: 
                        <strong className="text-white"> RBD, Nombre del Establecimiento, Dirección, Ciudad, Institución, Sucursal, Fecha de Creación, Supervisor y RUT de Supervisor</strong>. Solo se le solicitará al usuario ingresar o buscar el RBD.
                    </p>
                </div>
            </div>

            {/* 2. CONSTRUCTOR DE CAMPOS DEL FORMULARIO */}
            {!previewMode ? (
                <div className="space-y-6">
                    <div className="flex items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                            <span>🏗️</span> Campos del Formulario ({fields.length})
                        </h2>
                    </div>

                    {fields.length === 0 ? (
                        <div className="bg-white py-16 px-6 rounded-3xl border-2 border-dashed border-gray-200 text-center space-y-4 shadow-sm">
                            <span className="text-5xl block animate-bounce">📝</span>
                            <h3 className="text-lg font-bold text-gray-800">Formulario sin campos</h3>
                            <p className="text-xs text-gray-500 max-w-md mx-auto">
                                Haz clic en el botón inferior para comenzar a añadir preguntas, listas, tablas o campos de evaluación a tu acta.
                            </p>
                            <button
                                type="button"
                                onClick={() => addField()}
                                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                            >
                                <span>➕</span> Agregar Primer Campo
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <FieldBuilderCard
                                    key={field.id}
                                    field={field}
                                    index={index}
                                    total={fields.length}
                                    allFields={fields}
                                    onUpdate={(updates) => updateField(field.id, updates)}
                                    onRemove={() => removeField(field.id)}
                                    onMove={(dir) => moveField(index, dir)}
                                    onAddAfter={() => addField(index)}
                                    onDuplicate={() => duplicateField(field.id, index)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Botones inferiores: Agregar Campo + Vista Previa */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => addField()}
                            className="w-full sm:w-auto px-8 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <span>➕</span> AGREGAR CAMPO
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewMode(true)}
                            className="w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <span>👁️</span> VISTA PREVIA
                        </button>
                    </div>
                </div>
            ) : (
                /* 3. VISTA PREVIA DEL FORMULARIO */
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8 animate-in fade-in duration-200">
                    {/* ENCABEZADO DE LA VISTA PREVIA - NUEVO DISEÑO */}
                    <div className="border-b border-gray-200 pb-4 relative">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left relative z-0">
                            
                            {/* 1. Logo (Izquierda) */}
                            <div className="md:w-1/4 flex justify-center md:justify-start">
                                {conLogo ? (
                                    <div className="px-2 py-2 inline-flex items-center">
                                        <span className="text-2xl font-black text-cyan-500 tracking-widest uppercase">HENDAYA</span>
                                    </div>
                                ) : (
                                    <div className="w-28 h-12 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase">
                                        Sin Logo
                                    </div>
                                )}
                            </div>

                            {/* 2. Título (Centro) */}
                            <div className="md:w-2/4 flex flex-col items-center justify-center text-center">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                                    {nombre || 'TÍTULO DEL ACTA'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-2 max-w-md">
                                    {instrucciones || 'Sin instrucciones adicionales'}
                                </p>
                            </div>

                            {/* 3. Info Extra (Derecha) */}
                            <div className="md:w-1/4 flex justify-center md:justify-end">
                                {(mostrarCodigoVersionFecha || (mostrarCodigoAdicional && codigoAdicional) || correlativoAutomatico) && (
                                    <table className="text-[10px] text-left border-collapse border border-gray-300 bg-white min-w-[120px]">
                                        <tbody>
                                            {mostrarCodigoVersionFecha && (
                                                <>
                                                    <tr>
                                                        <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Código</th>
                                                        <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{codigo || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Versión</th>
                                                        <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{version || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Fecha</th>
                                                        <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">{fecha || '-'}</td>
                                                    </tr>
                                                </>
                                            )}
                                            {mostrarCodigoAdicional && (
                                                <tr>
                                                    <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Cód. Adicional</th>
                                                    <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">
                                                        {codigoAdicional || '-'}
                                                    </td>
                                                </tr>
                                            )}
                                            {correlativoAutomatico && (
                                                <tr>
                                                    <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-700 font-bold uppercase">Correlativo</th>
                                                    <td className="border border-gray-300 px-2 py-1 font-semibold text-gray-800">
                                                        0000000001
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Badge Flotante Vista Previa */}
                        <span className="absolute -top-6 right-0 px-3 py-1 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-lg border border-amber-200 uppercase tracking-wider shadow-sm z-10">
                            👁️ VISTA PREVIA
                        </span>

                        {/* Metadata inferior del encabezado */}
                        <div className="flex flex-wrap justify-center gap-2 mt-4 pt-4 border-t border-gray-100 text-[10px] font-bold">
                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-700">Lic. #{licitacionId || 'N/A'}</span>
                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-700">Año {anio}</span>
                            <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-1 rounded-full">
                                🏛️ {selectedInstituciones.join(' • ')}
                            </span>
                        </div>
                    </div>

                    {/* Pre-filled automatic header preview */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-wider">Encabezado de Terreno (Autocompletado)</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-700">
                            <div><span className="font-bold text-gray-400 block">RBD:</span> 12345</div>
                            <div><span className="font-bold text-gray-400 block">Establecimiento:</span> Escuela Ejemplo</div>
                            <div><span className="font-bold text-gray-400 block">Comuna / Ciudad:</span> Santiago</div>
                            <div><span className="font-bold text-gray-400 block">Supervisor:</span> Juan Pérez</div>
                        </div>
                    </div>

                    {/* Renderizado inteligente: audit_item + group como tabla tipo Excel, resto individual */}
                    <div className="space-y-6 pt-2">
                        {(() => {
                            const segments: { type: 'audit-table' | 'regular'; fields: ActaField[] }[] = []
                            let current: { type: 'audit-table' | 'regular'; fields: ActaField[] } | null = null

                            for (const f of fields) {
                                const isAudit = f.type === 'audit_item' || f.type === 'group'
                                if (isAudit) {
                                    if (!current || current.type !== 'audit-table') {
                                        current = { type: 'audit-table', fields: [] }
                                        segments.push(current)
                                    }
                                    current.fields.push(f)
                                } else {
                                    if (!current || current.type !== 'regular') {
                                        current = { type: 'regular', fields: [] }
                                        segments.push(current)
                                    }
                                    current.fields.push(f)
                                }
                            }

                            return segments.map((seg, si) => {
                                if (seg.type === 'regular') {
                                    return (
                                        <div key={si} className="flex flex-wrap gap-4">
                                            {seg.fields.map((f, i) => (
                                                <PreviewFieldRenderer key={f.id} field={f} index={i} />
                                            ))}
                                        </div>
                                    )
                                }

                                // Render de tabla tipo Excel para audit_item + group
                                // Detectar columnas del primer audit_item del segmento
                                const firstAudit = seg.fields.find(f => f.type === 'audit_item')
                                const auditCols = firstAudit?.auditColumns && firstAudit.auditColumns.length > 0
                                    ? firstAudit.auditColumns
                                    : [{ key: 'col_a_default', label: 'Requisito / Pregunta', type: 'text' as const, options: [] as string[] }]

                                let currentGroup = ''
                                let groupRowCount: Record<string, number> = {}

                                // Pre-calcular cuántas filas tiene cada grupo para rowspan
                                seg.fields.forEach(f => {
                                    if (f.type === 'group') {
                                        currentGroup = f.label || 'GRUPO'
                                        groupRowCount[currentGroup] = 0
                                    } else if (f.type === 'audit_item') {
                                        if (currentGroup) groupRowCount[currentGroup] = (groupRowCount[currentGroup] || 0) + 1
                                    }
                                })

                                currentGroup = ''
                                const renderedGroups = new Set<string>()

                                return (
                                    <div key={si} className="overflow-x-auto rounded-2xl border border-gray-300 shadow-sm">
                                        <table className="w-full border-collapse text-xs" style={{ minWidth: '600px' }}>
                                            <thead>
                                                <tr className="bg-slate-800 text-white">
                                                    {/* Col. Grupo (solo si hay groups) */}
                                                    {seg.fields.some(f => f.type === 'group') && (
                                                        <th className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-600 w-20 text-[10px]">Grupo</th>
                                                    )}
                                                    {auditCols.map((col, ci) => (
                                                        <th key={col.key} className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-600 text-[10px]">
                                                            {col.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {seg.fields.map((f, fi) => {
                                                    if (f.type === 'group') {
                                                        currentGroup = f.label || 'GRUPO'
                                                        return null // Se maneja con rowspan en las filas audit_item
                                                    }
                                                    if (f.type !== 'audit_item') return null

                                                    const rowCols = f.auditColumns && f.auditColumns.length > 0
                                                        ? f.auditColumns
                                                        : auditCols

                                                    const showGroupCell = seg.fields.some(f2 => f2.type === 'group') && !renderedGroups.has(currentGroup)
                                                    if (showGroupCell && currentGroup) renderedGroups.add(currentGroup)

                                                    return (
                                                        <tr key={f.id} className={fi % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                            {/* Celda de grupo con rowspan */}
                                                            {seg.fields.some(f2 => f2.type === 'group') && (
                                                                showGroupCell ? (
                                                                    <td
                                                                        rowSpan={groupRowCount[currentGroup] || 1}
                                                                        className="border-r border-gray-200 border-b border-gray-200 bg-slate-900 text-center align-middle p-0"
                                                                        style={{ minWidth: '60px' }}
                                                                    >
                                                                        <div className="flex items-center justify-center h-full py-3 px-1">
                                                                            <span
                                                                                className="text-cyan-300 font-black text-[9px] uppercase tracking-widest"
                                                                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
                                                                            >
                                                                                {currentGroup}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                ) : <td className="hidden" />
                                                            )}
                                                            {/* Celdas de datos */}
                                                            {rowCols.map((col, ci) => (
                                                                <td key={col.key} className="px-2 py-1.5 border-r border-b border-gray-200 align-middle">
                                                                    {col.type === 'select' ? (
                                                                        <select disabled className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-white text-slate-700 font-medium cursor-not-allowed">
                                                                            {(col.options || []).filter(o => o.trim()).map((opt, j) => (
                                                                                <option key={j}>{opt}</option>
                                                                            ))}
                                                                            {(!col.options || col.options.filter(o => o.trim()).length === 0) && (
                                                                                <option>{col.label}...</option>
                                                                            )}
                                                                        </select>
                                                                    ) : col.type === 'number' ? (
                                                                        <input type="number" placeholder="0" disabled className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-white cursor-not-allowed" />
                                                                    ) : (
                                                                        <span className="text-slate-700">{ci === 0 ? f.label : ''}</span>
                                                                    )}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            })
                        })()}
                    </div>
                </div>
            )}
            </div>
            )}
        </div>
    )
}

/**
 * Tarjeta para construir un campo (fiel a las imágenes adjuntas por el usuario)
 */
function FieldBuilderCard({
    field,
    index,
    total,
    allFields = [],
    onUpdate,
    onRemove,
    onMove,
    onAddAfter,
    onDuplicate
}: {
    field: ActaField
    index: number
    total: number
    allFields?: ActaField[]
    onUpdate: (updates: Partial<ActaField>) => void
    onRemove: () => void
    onMove: (dir: 'up' | 'down') => void
    onAddAfter: () => void
    onDuplicate: () => void
}) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-cyan-300 transition-all space-y-4 relative group">
            {/* Cabecera del campo: Etiqueta + Tipo de Campo + Acciones de Reorden */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                
                {/* Etiqueta del campo */}
                <div className="md:col-span-6 space-y-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        ETIQUETA DEL CAMPO / PREGUNTA
                    </label>
                    <input
                        type="text"
                        value={field.type === 'separator' ? 'Separador (Salto de línea)' : field.label}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        disabled={field.type === 'separator'}
                        className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 font-extrabold text-slate-800 text-sm outline-none ${field.type === 'separator' ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-slate-50/50'}`}
                        placeholder="Ej: Estado de la infraestructura en bodega"
                    />
                </div>

                {/* Selector de Tipo de Campo Categorizado (Fiel a la Imagen 2) */}
                <div className="md:col-span-4 space-y-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        TIPO DE CAMPO
                    </label>
                    <select
                        title="Seleccionar tipo de campo"
                        value={field.type}
                        onChange={(e) => onUpdate({ type: e.target.value as any })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 font-bold text-slate-800 text-sm bg-white cursor-pointer outline-none"
                    >
                        {FIELD_TYPES.map(cat => (
                            <optgroup key={cat.category} label={cat.category}>
                                {cat.items.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.icon} {item.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {/* Botones laterales de Reordenación (+, ↑, ↓, 🗑️) Fiel a la Imagen 1 */}
                <div className="md:col-span-2 flex items-center justify-end gap-1 pt-4 md:pt-6">
                    <button
                        type="button"
                        onClick={() => onMove('up')}
                        disabled={index === 0}
                        title="Mover arriba"
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove('down')}
                        disabled={index === total - 1}
                        title="Mover abajo"
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={onAddAfter}
                        title="Insertar campo debajo"
                        className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 border border-cyan-200 flex items-center justify-center font-black text-sm transition-colors cursor-pointer"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicate}
                        title="Duplicar campo"
                        className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
                    >
                        📋
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        title="Eliminar campo"
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Fila 2: Validación de Datos + Ancho en Línea + Checkboxes (Imagen 1) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-gray-100 flex-wrap">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider shrink-0">
                            VALIDACIÓN
                        </span>
                        <select
                            title="Seleccionar validación"
                            value={field.validation || 'Ninguna (Texto libre)'}
                            onChange={(e) => onUpdate({ validation: e.target.value })}
                            disabled={field.type === 'separator'}
                            className={`px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-700 focus:outline-none ${field.type === 'separator' ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-gray-50'}`}
                        >
                            <option value="Ninguna (Texto libre)">Ninguna (Texto libre)</option>
                            <option value="Número Entero">Número Entero</option>
                            <option value="Número Decimal">Número Decimal</option>
                            <option value="Correo Electrónico">Correo Electrónico</option>
                            <option value="Solo Texto / Letras">Solo Texto / Letras</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider shrink-0">
                            ANCHO EN LÍNEA
                        </span>
                        <select
                            title="Seleccionar ancho de campo"
                            value={field.layoutWidth || '100%'}
                            onChange={(e) => onUpdate({ layoutWidth: e.target.value as any })}
                            disabled={field.type === 'separator' || field.type === 'section'}
                            className={`px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-700 focus:outline-none ${field.type === 'separator' || field.type === 'section' ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-gray-50'}`}
                        >
                            <option value="100%">100% (1 por línea - Completo)</option>
                            <option value="50%">50% (2 por línea - Medio)</option>
                            <option value="33%">33% (3 por línea - Tercio)</option>
                            <option value="25%">25% (4 por línea - Cuarto)</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={field.hideNumber || false}
                            onChange={(e) => onUpdate({ hideNumber: e.target.checked })}
                            className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                        />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-600">SIN NUMERACIÓN</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => onUpdate({ required: e.target.checked })}
                            className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                        />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-600">OBLIGATORIO</span>
                    </label>
                </div>
            </div>

            {/* Configuraciones Específicas por Tipo de Campo */}
            {['select', 'multiselect', 'radio', 'checkbox'].includes(field.type) && (
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200/60">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        OPCIONES DE SELECCIÓN (Una por línea)
                    </label>
                    <textarea
                        rows={3}
                        value={(field.options || []).join('\n')}
                        onChange={(e) => onUpdate({ options: e.target.value.split('\n') })}
                        placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                        className="w-full p-2.5 rounded-lg border border-gray-200 text-xs font-medium text-slate-800 bg-white"
                    />
                </div>
            )}

            {field.type === 'audit_item' && (() => {
                // Si no hay columnas, inicializamos con Col. A por defecto
                const cols = field.auditColumns && field.auditColumns.length > 0
                    ? field.auditColumns
                    : [{ key: 'col_a_default', label: 'Requisito / Pregunta', type: 'text' as const, options: [] }]

                const updateCols = (newCols: typeof cols) => onUpdate({ auditColumns: newCols })
                const addCol = () => {
                    const key = 'col_' + Date.now()
                    updateCols([...cols, { key, label: 'Nueva Columna', type: 'text' as const, options: [] }])
                }
                const removeCol = (key: string) => updateCols(cols.filter(c => c.key !== key))
                const updateCol = (key: string, patch: Partial<(typeof cols)[0]>) =>
                    updateCols(cols.map(c => c.key === key ? { ...c, ...patch } : c))

                return (
                    <div className="space-y-3 border border-indigo-200 rounded-2xl p-4 bg-indigo-50/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base">📋</span>
                                <div>
                                    <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">Columnas del Requisito</p>
                                    <p className="text-[10px] text-indigo-600">Todas las columnas son editables y eliminables. La primera columna suele ser el enunciado o pregunta.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={addCol}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                ➕ Agregar Columna
                            </button>
                        </div>

                        {cols.map((col, i) => (
                            <div key={col.key} className="bg-white rounded-xl border border-indigo-100 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase w-16 shrink-0">
                                        Col. {String.fromCharCode(65 + i)}
                                    </span>
                                    <input
                                        type="text"
                                        value={col.label}
                                        onChange={(e) => updateCol(col.key, { label: e.target.value })}
                                        placeholder="Nombre de la columna"
                                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                    <select
                                        value={col.type}
                                        onChange={(e) => {
                                            const newType = e.target.value as any
                                            const defaultOpts = newType === 'number_special'
                                                ? ['Cumple = 2', 'Cumple Parcial = 1', 'No cumple = 0', 'No evaluado = NE', 'No aplica = NA']
                                                : []
                                            updateCol(col.key, { type: newType, options: defaultOpts })
                                        }}
                                        className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-700 bg-gray-50 focus:outline-none cursor-pointer"
                                    >
                                        <option value="text">Texto</option>
                                        <option value="select">Lista Desplegable</option>
                                        <option value="number">Número</option>
                                        <option value="number_special">Numérico Especial</option>
                                        <option value="totalizer">Totalizador</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => removeCol(col.key)}
                                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="Eliminar columna"
                                    >🗑️</button>
                                </div>
                                {col.type === 'select' && (
                                    <div className="ml-16">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                            Opciones del Dropdown (una por línea)
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={(col.options || []).join('\n')}
                                            onChange={(e) => updateCol(col.key, { options: e.target.value.split('\n') })}
                                            placeholder={"Opción 1\nOpción 2\nOpción 3"}
                                            className="w-full p-2 rounded-lg border border-gray-200 text-xs font-medium text-slate-800 bg-gray-50 focus:outline-none resize-none"
                                        />
                                    </div>
                                )}
                                {col.type === 'number_special' && (() => {
                                    const defaultOpts = ["Cumple = 2", "Cumple Parcial = 1", "No cumple = 0", "No evaluado = NE", "No aplica = NA"]
                                    const currentText = (col.options && col.options.length > 0) ? col.options.join('\n') : defaultOpts.join('\n')

                                    return (
                                        <div className="ml-16 space-y-1">
                                            <label className="block text-[9px] font-black text-emerald-700 uppercase tracking-widest">
                                                Opciones Numéricas Especiales (Formato: Etiqueta = Valor, una por línea)
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={currentText}
                                                onChange={(e) => updateCol(col.key, { options: e.target.value.split('\n') })}
                                                placeholder={"Cumple = 2\nCumple Parcial = 1\nNo cumple = 0\nNo evaluado = NE\nNo aplica = NA"}
                                                className="w-full p-2 rounded-lg border border-emerald-200 text-xs font-medium text-slate-800 bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none font-mono"
                                            />
                                            <p className="text-[10px] text-gray-500">Ejemplo: <code>Cumple = 2</code> asociará el número 2 a la nota Cumple.</p>
                                        </div>
                                    )
                                })()}
                                {(col.type === 'number' || col.type === 'number_special') && (
                                    <div className="ml-16 pt-1 flex items-center gap-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={col.includeInTotalizer !== false}
                                                onChange={(e) => updateCol(col.key, { includeInTotalizer: e.target.checked })}
                                                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                                            />
                                            <span>🧮 Incluir en Totalizador / Calculador</span>
                                        </label>
                                        <span className="text-[10px] text-gray-500 italic">
                                            {col.includeInTotalizer !== false ? '(Se considerará en el cálculo)' : '(Excluido del cálculo)'}
                                        </span>
                                    </div>
                                )}
                                {col.type === 'totalizer' && (
                                    <div className="ml-16 space-y-2.5 p-3 bg-cyan-50/60 rounded-xl border border-cyan-200">
                                        <label className="block text-[10px] font-black text-cyan-900 uppercase tracking-wider">
                                            Cálculo a Realizar en el Totalizador
                                        </label>
                                        <select
                                            value={col.operation || 'sum'}
                                            onChange={(e) => updateCol(col.key, { operation: e.target.value as any })}
                                            className="w-full px-3 py-2 rounded-lg border border-cyan-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                        >
                                            <option value="sum">🧮 Suma de valores</option>
                                            <option value="average">📊 Promedio de valores evaluados</option>
                                            <option value="percentage">📈 % de Cumplimiento (Notas obtenidas vs Máximas)</option>
                                            <option value="subtract">➖ Resta secuencial</option>
                                            <option value="multiply">✖️ Multiplicación</option>
                                            <option value="divide">➗ División</option>
                                        </select>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-cyan-200/60">
                                            <div>
                                                <label className="block text-[9px] font-black text-cyan-800 uppercase tracking-wider mb-1">
                                                    Dato Obtenido / Numerador (ej: Col L. Promedio)
                                                </label>
                                                <select
                                                    value={col.numeratorColKey || ''}
                                                    onChange={(e) => updateCol(col.key, { numeratorColKey: e.target.value || undefined })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-cyan-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">✨ Auto (Todas las columnas numéricas)</option>
                                                    {cols.filter(c => c.key !== col.key).map((c) => (
                                                        <option key={c.key} value={c.key}>
                                                            Col {String.fromCharCode(65 + cols.findIndex(x => x.key === c.key))}. {c.label || 'Sin título'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-cyan-800 uppercase tracking-wider mb-1">
                                                    Dato Estándar / Denominador (ej: Col M. Estándar)
                                                </label>
                                                <select
                                                    value={col.denominatorColKey || ''}
                                                    onChange={(e) => updateCol(col.key, { denominatorColKey: e.target.value || undefined })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-cyan-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">✨ Auto (Notas Máximas de opciones)</option>
                                                    {cols.filter(c => c.key !== col.key).map((c) => (
                                                        <option key={c.key} value={c.key}>
                                                            Col {String.fromCharCode(65 + cols.findIndex(x => x.key === c.key))}. {c.label || 'Sin título'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {col.operation === 'percentage' && (
                                            <div className="pt-1">
                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-cyan-950">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(col.capAt100)}
                                                        onChange={(e) => updateCol(col.key, { capAt100: e.target.checked })}
                                                        className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                                                    />
                                                    <span>Topar resultado a un máximo de 100.00%</span>
                                                </label>
                                            </div>
                                        )}

                                        <p className="text-[10px] text-cyan-700 font-medium pt-0.5">
                                            {col.numeratorColKey && col.denominatorColKey
                                                ? `Calcula dividiendo la columna "${cols.find(c => c.key === col.numeratorColKey)?.label || col.numeratorColKey}" entre la columna "${cols.find(c => c.key === col.denominatorColKey)?.label || col.denominatorColKey}".`
                                                : 'Calcula automáticamente sobre las columnas numéricas marcadas como "Incluir en Totalizador".'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                        {cols.length === 0 && (
                            <p className="text-center text-[11px] text-indigo-400 py-2 italic">
                                Sin columnas. Haz clic en "Agregar Columna" para comenzar.
                            </p>
                        )}
                    </div>
                )
            })()}

            {field.type === 'numeric_special' && (() => {
                const opts = field.numericOptions && field.numericOptions.length > 0
                    ? field.numericOptions
                    : [
                        { label: 'Cumple', value: '2' },
                        { label: 'Cumple Parcial', value: '1' },
                        { label: 'No cumple', value: '0' },
                        { label: 'No evaluado', value: 'NE' },
                        { label: 'No aplica', value: 'NA' }
                    ]

                const updateOpts = (newOpts: typeof opts) => onUpdate({ numericOptions: newOpts })
                const addOpt = () => updateOpts([...opts, { label: 'Nueva Opción', value: '0' }])
                const removeOpt = (idx: number) => updateOpts(opts.filter((_, i) => i !== idx))
                const updateOpt = (idx: number, patch: Partial<typeof opts[0]>) =>
                    updateOpts(opts.map((o, i) => i === idx ? { ...o, ...patch } : o))

                return (
                    <div className="space-y-3 border border-emerald-200 rounded-2xl p-4 bg-emerald-50/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🔢</span>
                                <div>
                                    <p className="text-xs font-black text-emerald-900 uppercase tracking-wider">Opciones de Numérico Especial</p>
                                    <p className="text-[10px] text-emerald-700">Asocia un texto a un número o código especial (ej: 2 = Cumple, 1 = Cumple Parcial, 0 = No cumple, NE = No evaluado, NA = No aplica)</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={addOpt}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                ➕ Agregar Opción
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {opts.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-100 shadow-sm">
                                    <span className="text-[10px] font-bold text-gray-400 w-5 text-center">{i + 1}.</span>
                                    <input
                                        type="text"
                                        value={opt.label}
                                        onChange={(e) => updateOpt(i, { label: e.target.value })}
                                        placeholder="Etiqueta (ej: Cumple)"
                                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-slate-800 bg-gray-50 focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-400 font-bold">=</span>
                                    <input
                                        type="text"
                                        value={opt.value}
                                        onChange={(e) => updateOpt(i, { value: e.target.value })}
                                        placeholder="Valor (ej: 2)"
                                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-black text-emerald-800 text-center bg-gray-50 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeOpt(i)}
                                        className="p-1 text-rose-400 hover:text-rose-600 rounded cursor-pointer"
                                        title="Eliminar opción"
                                    >🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })()}

            {field.type === 'totalizer' && (() => {
                const numericFields = (allFields || []).filter(f => f.type === 'numeric_special')
                const selectedTargets = field.targetFields || []

                const toggleTarget = (id: string) => {
                    if (selectedTargets.includes(id)) {
                        onUpdate({ targetFields: selectedTargets.filter(t => t !== id) })
                    } else {
                        onUpdate({ targetFields: [...selectedTargets, id] })
                    }
                }

                return (
                    <div className="space-y-4 border border-cyan-200 rounded-2xl p-4 bg-cyan-50/40">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🧮</span>
                            <div>
                                <p className="text-xs font-black text-cyan-950 uppercase tracking-wider">Configuración de Totalizador / Calculador</p>
                                <p className="text-[10px] text-cyan-700">Calcula totales, promedios o % de cumplimiento de los campos Numérico Especial.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-cyan-900 uppercase tracking-wider mb-1">
                                    Operación a Realizar
                                </label>
                                <select
                                    value={field.operation || 'percentage'}
                                    onChange={(e) => onUpdate({ operation: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-xl border border-cyan-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                                >
                                    <option value="percentage">% de Cumplimiento (% Éxito)</option>
                                    <option value="sum">Suma (Sumar valores numéricos)</option>
                                    <option value="average">Promedio (Calcular promedio numérico)</option>
                                    <option value="subtract">Resta (Restar valores)</option>
                                    <option value="multiply">Multiplicación (Multiplicar valores)</option>
                                    <option value="divide">División (Dividir valores)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-cyan-900 uppercase tracking-wider mb-1">
                                    Campos a Incluir en el Cálculo
                                </label>
                                {numericFields.length === 0 ? (
                                    <p className="text-xs text-amber-700 italic bg-amber-50 p-2 rounded-lg border border-amber-200">
                                        ⚠️ Agrega primero campos de tipo "Numérico Especial" para seleccionarlos aquí. (Por defecto se evaluarán todos los campos Numéricos Especiales).
                                    </p>
                                ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-cyan-100">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 pb-1 border-b border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedTargets.length === 0}
                                                onChange={() => onUpdate({ targetFields: [] })}
                                                className="w-3.5 h-3.5 text-cyan-600 rounded"
                                            />
                                            <span className="text-cyan-800">✨ Todos los campos Numérico Especial</span>
                                        </label>
                                        {numericFields.map((nf) => (
                                            <label key={nf.id} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTargets.includes(nf.id)}
                                                    onChange={() => toggleTarget(nf.id)}
                                                    className="w-3.5 h-3.5 text-cyan-600 rounded"
                                                />
                                                <span className="truncate">{nf.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {field.type === 'group' && (
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-xl text-white space-y-1 border border-indigo-800/60 shadow-inner">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                        <span>📂</span> AGRUPACIÓN DE PREGUNTAS (Categoría Vertical en Columna A)
                    </div>
                    <p className="text-[11px] text-slate-300">
                        Este campo funciona como un bloque agrupador (ej: <strong className="text-white">MANTENCIÓN</strong>, <strong className="text-white">SUPERVISIÓN</strong>). Todas las preguntas o requisitos creados a continuación formarán parte de este grupo.
                    </p>
                </div>
            )}

            {(field.type === 'signature_with_data' || field.type === 'signature') && (
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
                    <p className="text-[11px] font-extrabold text-indigo-900">
                        {field.type === 'signature_with_data' 
                            ? '✒️ Firma Digital con Datos (Incluye recuadro Canvas + Campos Nombre y RUT)' 
                            : '✍️ Firma Digital Simple (Solo recuadro Canvas)'}
                    </p>
                    {field.type === 'signature_with_data' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-1">
                                    Etiqueta Dato 1
                                </label>
                                <input
                                    type="text"
                                    value={field.dato1Label || 'Nombre y Apellidos'}
                                    onChange={(e) => onUpdate({ dato1Label: e.target.value })}
                                    placeholder="Ej: Nombre y Apellidos"
                                    className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-1">
                                    Etiqueta Dato 2
                                </label>
                                <input
                                    type="text"
                                    value={field.dato2Label || 'RUT'}
                                    onChange={(e) => onUpdate({ dato2Label: e.target.value })}
                                    placeholder="Ej: RUT"
                                    className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {field.type === 'evaluation' && (
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-amber-800 uppercase tracking-widest">Puntaje Máximo</label>
                        <input
                            type="number"
                            value={field.maxScore || 100}
                            onChange={(e) => onUpdate({ maxScore: Number(e.target.value) })}
                            className="w-full p-2 rounded-lg border border-amber-300 text-xs font-bold text-amber-900 bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-amber-800 uppercase tracking-widest">Ponderación (%)</label>
                        <input
                            type="number"
                            value={field.weight || 100}
                            onChange={(e) => onUpdate({ weight: Number(e.target.value) })}
                            className="w-full p-2 rounded-lg border border-amber-300 text-xs font-bold text-amber-900 bg-white"
                        />
                    </div>
                </div>
            )}

            {/* ── Tabla Dinámica Repetible ── */}
            {field.type === 'dynamic_table' && (
                <div className="space-y-3 bg-slate-900/5 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">📊 Columnas de la Tabla</span>
                        <button
                            type="button"
                            onClick={() => {
                                const newCol = {
                                    key: `col_${Date.now()}`,
                                    label: `Título ${(field.tableColumns?.length || 0) + 1}`,
                                    type: 'text_short' as const,
                                    options: [] as string[]
                                }
                                onUpdate({ tableColumns: [...(field.tableColumns || []), newCol] })
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer shadow-md"
                        >
                            <span>+</span> Agregar Columna
                        </button>
                    </div>

                    {(!field.tableColumns || field.tableColumns.length === 0) && (
                        <p className="text-[10px] text-slate-500 italic text-center py-3">
                            Aún no hay columnas. Presiona "+ Agregar Columna" para empezar.
                        </p>
                    )}

                    {/* Cabeceras de columna en horizontal */}
                    {(field.tableColumns || []).length > 0 && (
                        <div className="overflow-x-auto">
                            <div className="flex gap-2 min-w-max pb-2">
                                {(field.tableColumns || []).map((col, ci) => (
                                    <div key={col.key} className="flex flex-col gap-1.5 min-w-[180px]">
                                        {/* Cabecera corporativa slate-800 / blanco */}
                                        <div style={{ backgroundColor: '#1e293b' }} className="px-3 py-1.5 rounded-t-lg font-black text-[11px] uppercase flex items-center justify-between gap-1">
                                            <input
                                                type="text"
                                                value={col.label}
                                                onChange={(e) => {
                                                    const updated = (field.tableColumns || []).map((c, i) =>
                                                        i === ci ? { ...c, label: e.target.value } : c
                                                    )
                                                    onUpdate({ tableColumns: updated })
                                                }}
                                                style={{ background: 'transparent' }}
                                                className="header-title-input w-full outline-none font-black placeholder:text-slate-400"
                                                placeholder="Título columna"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = (field.tableColumns || []).filter((_, i) => i !== ci)
                                                    onUpdate({ tableColumns: updated })
                                                }}
                                                className="text-rose-400 hover:text-rose-200 font-black text-sm leading-none cursor-pointer"
                                            >✕</button>
                                        </div>

                                        {/* Selector de tipo de celda */}
                                        <select
                                            value={col.type}
                                            onChange={(e) => {
                                                const updated = (field.tableColumns || []).map((c, i) =>
                                                    i === ci ? { ...c, type: e.target.value as any, options: [] } : c
                                                )
                                                onUpdate({ tableColumns: updated })
                                            }}
                                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            <option value="text_short">Texto Corto (una línea)</option>
                                            <option value="text">Texto Largo (párrafo)</option>
                                            <option value="number">Numérico</option>
                                            <option value="number_special">Numérico especial (0 a N, incluye "NA")</option>
                                            <option value="rut">Rut (##.###.###-#)</option>
                                            <option value="signature">Firma</option>
                                            <option value="file">Adjuntar docto (PDF e imágenes)</option>
                                            <option value="select">Lista desplegable</option>
                                            <option value="radio">Opción Única</option>
                                            <option value="checkbox">Opción Múltiple</option>
                                            <option value="rating">Calificación (1–5 estrellas)</option>
                                            <option value="totalizer">Totalizador (suma fila Numérico)</option>
                                        </select>

                                        {/* Opciones para select / radio / checkbox */}
                                        {(col.type === 'select' || col.type === 'radio' || col.type === 'checkbox') && (
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">Opciones (una por línea)</label>
                                                <textarea
                                                    rows={3}
                                                    value={(col.options || []).join('\n')}
                                                    onChange={(e) => {
                                                        const updated = (field.tableColumns || []).map((c, i) =>
                                                            i === ci ? { ...c, options: e.target.value.split('\n') } : c
                                                        )
                                                        onUpdate({ tableColumns: updated })
                                                    }}
                                                    placeholder={"Opción 1\nOpción 2\nOpción 3"}
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-800 bg-white outline-none resize-none font-medium"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Botón + Título a la derecha */}
                                <div className="flex items-start">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newCol = {
                                                key: `col_${Date.now()}`,
                                                label: `Título ${(field.tableColumns?.length || 0) + 1}`,
                                                type: 'text_short' as const,
                                                options: [] as string[]
                                            }
                                            onUpdate({ tableColumns: [...(field.tableColumns || []), newCol] })
                                        }}
                                        className="mt-0 bg-slate-700 hover:bg-slate-600 text-cyan-300 font-black text-[10px] px-3 py-1.5 rounded-lg border-2 border-dashed border-slate-500 cursor-pointer whitespace-nowrap transition-all"
                                    >
                                        + (Título)
                                    </button>
                                </div>
                            </div>

                            {/* Fila simulada de datos */}
                            <div className="flex gap-2 mt-1 min-w-max">
                                {(field.tableColumns || []).map((col, ci) => (
                                    <div key={col.key} className="min-w-[180px]">
                                        {col.type === 'signature'
                                            ? <div className="h-8 border border-dashed border-indigo-200 rounded bg-indigo-50/40 flex items-center justify-center text-[10px] text-indigo-400">✍️ Firma</div>
                                            : col.type === 'totalizer'
                                            ? <div className="h-8 border border-cyan-200 rounded bg-cyan-50 flex items-center justify-center text-[10px] font-bold text-cyan-700">Σ Auto</div>
                                            : <div className="h-8 border border-gray-200 rounded bg-white flex items-center px-2 text-[10px] text-gray-400 italic">dato...</div>
                                        }
                                    </div>
                                ))}
                                {/* Botón + Agregar registro */}
                                <div className="flex items-center">
                                    <div className="bg-cyan-600 text-white text-[13px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow cursor-pointer">+</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * Renderizado en Vista Previa
 */
function PreviewFieldRenderer({ field, index, currentGroupName }: { field: ActaField; index: number; currentGroupName?: string }) {
    if (field.type === 'group') {
        return (
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-between border-l-8 border-cyan-400 shadow-md mt-6 mb-2">
                <div className="flex items-center gap-2.5">
                    <span className="text-xl">📂</span>
                    <span className="text-cyan-200">{field.label || 'NUEVA AGRUPACIÓN / CATEGORÍA'}</span>
                </div>
                <span className="text-[10px] bg-slate-800 text-cyan-300 px-3 py-1 rounded-xl border border-slate-700 font-bold uppercase tracking-widest">
                    Columna A • Agrupador
                </span>
            </div>
        )
    }

    if (field.type === 'audit_item') {
        // En tabla Excel el audit_item se renderiza dentro del contexto de tabla
        // Este fallback solo aplica si se llama fuera del contexto de tabla
        return (
            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-gray-200 text-xs text-slate-700">
                {field.label}
            </div>
        )
    }

    if (field.type === 'separator') {
        return <div className="w-full py-4"></div>
    }

    if (field.type === 'section') {
        return (
            <div className="w-full border-b-2 border-cyan-500 pb-2 pt-4">
                <h3 className="text-lg font-black text-cyan-900 uppercase tracking-tight">{field.label}</h3>
            </div>
        )
    }

    /* ─── Vista Previa Tabla Dinámica ─── */
    if (field.type === 'dynamic_table') {
        const cols = field.tableColumns || []
        return (
            <div className="w-full space-y-2">
                <label className="block text-xs font-extrabold text-slate-800">
                    {field.hideNumber ? '' : `${index + 1}. `}{field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table className="w-full border-collapse text-xs min-w-max">
                        <thead>
                            <tr>
                                {cols.map((col) => (
                                    <th key={col.key} className="bg-slate-800 text-cyan-300 font-black px-3 py-2 text-left border-r border-slate-700 whitespace-nowrap text-[11px] uppercase tracking-wide">
                                        {col.label}
                                    </th>
                                ))}
                                <th className="bg-cyan-600 text-white font-black px-3 py-2 text-center border-r border-cyan-700 whitespace-nowrap text-[11px]">
                                    + Fila
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {cols.map((col) => (
                                    <td key={col.key} className="border border-slate-100 px-2 py-2 text-slate-400 italic text-[10px] bg-white">
                                        {col.type === 'signature' ? '✍️ Firma' : col.type === 'totalizer' ? 'Σ Auto' : 'dato...'}
                                    </td>
                                ))}
                                <td className="border border-slate-100 bg-slate-50 px-2 py-2 text-center text-slate-400">🗑️</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    let widthClass = 'w-full'
    if (field.layoutWidth === '50%') widthClass = 'w-full sm:w-[calc(50%-0.5rem)]'
    else if (field.layoutWidth === '33%') widthClass = 'w-full sm:w-[calc(33.333%-0.75rem)]'
    else if (field.layoutWidth === '25%') widthClass = 'w-full sm:w-[calc(25%-0.75rem)]'

    return (
        <div className={`space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-gray-100 ${widthClass}`}>
            <label className="block text-xs font-extrabold text-slate-800">
                {field.hideNumber ? '' : `${index + 1}. `}{field.label} {field.required && <span className="text-rose-500">*</span>}
            </label>

            {field.type === 'text' && (
                <input type="text" placeholder="Respuesta corta..." disabled className="w-full p-2.5 rounded-xl border border-gray-200 text-xs bg-white" />
            )}
            {field.type === 'textarea' && (
                <textarea rows={2} placeholder="Respuesta detallada..." disabled className="w-full p-2.5 rounded-xl border border-gray-200 text-xs bg-white resize-none" />
            )}
            {field.type === 'date' && (
                <input type="date" disabled className="p-2 rounded-xl border border-gray-200 text-xs bg-white" />
            )}
            {field.type === 'time' && (
                <input type="time" disabled className="p-2 rounded-xl border border-gray-200 text-xs bg-white" />
            )}
            {field.type === 'select' && (
                <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 text-xs bg-white">
                    <option>Seleccionar opción...</option>
                    {(field.options || ['Opción 1', 'Opción 2']).map((opt, i) => (
                        <option key={i}>{opt}</option>
                    ))}
                </select>
            )}
            {(field.type === 'multiselect' || field.type === 'checkbox') && (
                <div className="space-y-2 pt-1">
                    {(field.options || ['Opción 1', 'Opción 2']).map((opt, i) => (
                        <label key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 opacity-70">
                            <input type="checkbox" disabled className="w-4 h-4 text-cyan-600 rounded" />
                            <span>{opt}</span>
                        </label>
                    ))}
                </div>
            )}
            {field.type === 'radio' && (
                <div className="space-y-2 pt-1">
                    {(field.options || ['Opción 1', 'Opción 2']).map((opt, i) => (
                        <label key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 opacity-70">
                            <input type="radio" disabled className="w-4 h-4 text-cyan-600" />
                            <span>{opt}</span>
                        </label>
                    ))}
                </div>
            )}
            {field.type === 'signature' && (
                <div className="p-4 rounded-2xl border border-indigo-100 bg-white space-y-2 shadow-sm">
                    <div className="h-28 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 flex flex-col items-center justify-center text-xs text-indigo-400 font-bold gap-1">
                        <span className="text-xl">✍️</span>
                        <span>Firma Digital Simple (Canvas de dibujo con dedo o mouse)</span>
                    </div>
                </div>
            )}
            {field.type === 'signature_with_data' && (
                <div className="p-4 rounded-2xl border border-indigo-100 bg-white space-y-3 shadow-sm">
                    <div className="h-28 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 flex flex-col items-center justify-center text-xs text-indigo-400 font-bold gap-1">
                        <span className="text-xl">🖋️</span>
                        <span>Firma Digital con Datos (Canvas para firmar + Nombre y RUT)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase">{field.dato1Label || 'Nombre y Apellidos'}</label>
                            <input type="text" disabled placeholder="Escriba Nombre y Apellidos..." className="w-full p-2 rounded-xl border border-gray-200 text-xs bg-gray-50" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-gray-500 uppercase">{field.dato2Label || 'RUT'}</label>
                            <input type="text" disabled placeholder="Escriba RUT..." className="w-full p-2 rounded-xl border border-gray-200 text-xs bg-gray-50" />
                        </div>
                    </div>
                </div>
            )}
            {field.type === 'evaluation' && (
                <div className="flex items-center gap-3">
                    <input type="number" placeholder="Ingresar puntaje..." disabled className="w-36 p-2 rounded-xl border border-gray-200 text-xs font-bold bg-white" />
                    <span className="text-xs text-slate-500 font-bold">/ {field.maxScore || 100} pts</span>
                </div>
            )}
            {field.type === 'numeric_special' && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {(field.numericOptions || [
                        { label: 'Cumple', value: '2' },
                        { label: 'Cumple Parcial', value: '1' },
                        { label: 'No cumple', value: '0' },
                        { label: 'No evaluado', value: 'NE' },
                        { label: 'No aplica', value: 'NA' }
                    ]).map((opt, i) => (
                        <div key={i} className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs font-bold text-slate-700 flex items-center gap-1.5 opacity-90">
                            <span>{opt.label}</span>
                            <span className="px-1.5 py-0.5 bg-emerald-700 text-white rounded-md text-[10px] font-black">{opt.value}</span>
                        </div>
                    ))}
                </div>
            )}
            {field.type === 'totalizer' && (
                <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🧮</span>
                        <div>
                            <p className="text-xs font-black text-cyan-900 uppercase">
                                Totalizador ({field.operation === 'percentage' ? '% de Cumplimiento' : field.operation === 'sum' ? 'Suma' : field.operation === 'average' ? 'Promedio' : field.operation === 'subtract' ? 'Resta' : field.operation === 'multiply' ? 'Multiplicación' : 'División'})
                            </p>
                            <p className="text-[10px] text-cyan-700 font-medium">Calculado automáticamente en el formulario</p>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-slate-900 text-cyan-300 font-black text-sm rounded-lg shadow-sm">
                        {field.operation === 'percentage' ? '0.00%' : '0.00'}
                    </div>
                </div>
            )}
        </div>
    )
}
