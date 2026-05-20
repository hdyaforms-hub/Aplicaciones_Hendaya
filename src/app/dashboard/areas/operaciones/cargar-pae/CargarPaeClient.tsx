'use client'

import { useState, useEffect, useMemo } from 'react'
import { buscarRbdAutocomplete, obtenerPaeOnline, guardarRegistrosPae, eliminarRegistrosPae, obtenerDetalleFolio } from './actions'

const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function CargarPaeClient() {
    // Estados principales
    const [registros, setRegistros] = useState<any[]>([])
    const [sortField, setSortField] = useState<string>('')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    // Filtros
    const [fLicitacion, setFLicitacion] = useState('')
    const [fInstitucion, setFInstitucion] = useState('')
    const [fAno, setFAno] = useState<number | ''>('')
    const [fMes, setFMes] = useState<number | ''>('')
    const [fRbdText, setFRbdText] = useState('')
    const [fRbdValor, setFRbdValor] = useState<number | null>(null)
    const [rbdSuggestions, setRbdSuggestions] = useState<any[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Estados de Carga (Upload)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [fileToUpload, setFileToUpload] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [conflictos, setConflictos] = useState<any[]>([])
    const [listos, setListos] = useState<any[]>([])
    const [showConflictModal, setShowConflictModal] = useState(false)

    // Estado del Detalle (Modal Folio)
    const [detalleFolio, setDetalleFolio] = useState<any | null>(null)
    const [causasMap, setCausasMap] = useState<Record<number, { descripcion: string; imputable: string; definicion: string }>>({})

    // Estados del Modal de Eliminar
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [delTipo, setDelTipo] = useState<'periodo' | 'rbd' | 'folio'>('periodo')
    const [delAno, setDelAno] = useState<number | ''>(new Date().getFullYear())
    const [delMes, setDelMes] = useState<number | ''>(new Date().getMonth() + 1)
    const [delRbd, setDelRbd] = useState('')
    const [delFolio, setDelFolio] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        cargarTabla()
    }, [])

    const cargarTabla = async () => {
        setLoading(true)
        const res = await obtenerPaeOnline({
            licitacion: fLicitacion || undefined,
            institucion: fInstitucion || undefined,
            ano: fAno === '' ? undefined : Number(fAno),
            mes: fMes === '' ? undefined : Number(fMes),
            rbd: fRbdValor || undefined
        })
        if (res.success && res.data) {
            setRegistros(res.data)
        } else {
            setError('Error al cargar la tabla')
        }
        setLoading(false)
    }

    const handleSearchRBD = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFRbdText(val);
        setFRbdValor(null); // Si el usuario edita, reseteamos el valor exacto

        if (val.length >= 2) {
            const res = await buscarRbdAutocomplete(val);
            if (res.success && res.data) {
                setRbdSuggestions(res.data);
                setShowSuggestions(true);
            }
        } else {
            setShowSuggestions(false);
        }
    }

    const selectRBD = (rbd: number, nombre: string) => {
        setFRbdValor(rbd);
        setFRbdText(`${rbd} - ${nombre}`);
        setShowSuggestions(false);
    }

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!fileToUpload) return

        setUploading(true)
        setError(null)
        setSuccessMsg(null)

        const formData = new FormData()
        formData.append('file', fileToUpload)

        try {
            const res = await fetch('/api/areas/operaciones/cargar-pae/upload', {
                method: 'POST',
                body: formData
            })
            
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo')

            if (data.totalArchivosLeidos === 0) {
                setError('No se pudo extraer información de ningún archivo PDF válido dentro del ZIP. Verifica que el archivo contenga los reportes digitales correctos y no plantillas vacías.');
                setSuccessMsg(null);
                return;
            }

            setListos(data.listosParaGuardar)
            
            if (data.conConflictos && data.conConflictos.length > 0) {
                setConflictos(data.conConflictos)
                setShowConflictModal(true)
            } else {
                await ejecutarGuardadoFinal(data.listosParaGuardar, [])
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUploading(false)
            setShowUploadModal(false)
        }
    }

    const ejecutarGuardadoFinal = async (nuevos: any[], actualizarExistentes: any[]) => {
        setUploading(true)
        const todos = [...nuevos, ...actualizarExistentes]
        
        const res = await guardarRegistrosPae(todos)
        if (res.success) {
            setSuccessMsg(`Carga exitosa. ${res.insertados} registros nuevos. ${res.actualizados} registros actualizados.`)
            cargarTabla() // Recargar la tabla
        } else {
            setError(res.error || 'Error al guardar en base de datos')
        }
        setUploading(false)
        setShowConflictModal(false)
        setFileToUpload(null)
    }

    // Manejar eliminación por lote
    const handleEliminarRegistros = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!confirm('¿Estás completamente seguro de que deseas eliminar estos registros? Esta acción es irreversible.')) return

        setDeleting(true)
        setError(null)
        setSuccessMsg(null)

        const res = await eliminarRegistrosPae({
            tipo: delTipo,
            ano: delAno === '' ? undefined : Number(delAno),
            mes: delMes === '' ? undefined : Number(delMes),
            rbd: delRbd === '' ? undefined : Number(delRbd),
            folio: delFolio || undefined
        })

        if (res.success) {
            setSuccessMsg(`Eliminación exitosa. Se eliminaron ${res.count} registros.`);
            setShowDeleteModal(false);
            cargarTabla(); // Actualizar la vista
            // Resetear inputs de eliminación
            setDelRbd('');
            setDelFolio('');
        } else {
            setError(res.error || 'Error al intentar eliminar los registros.');
        }

        setDeleting(false)
    }

    // Eliminar un Folio único directamente de la fila de la tabla
    const handleEliminarUnico = async (folio: string) => {
        if (!confirm(`¿Deseas eliminar permanentemente el Folio ${folio} de la base de datos?`)) return

        setLoading(true)
        setError(null)
        setSuccessMsg(null)

        const res = await eliminarRegistrosPae({
            tipo: 'folio',
            folio
        })

        if (res.success) {
            setSuccessMsg(`Folio ${folio} eliminado correctamente.`);
            cargarTabla();
        } else {
            setError(res.error || 'Error al eliminar el folio.');
        }
        setLoading(false)
    }

    // Obtener y mostrar el detalle del folio de manera dinámica
    const handleVerDetalle = async (folio: string) => {
        setLoading(true)
        setError(null)
        setSuccessMsg(null)
        
        const res = await obtenerDetalleFolio(folio)
        if (res.success && res.data) {
            setDetalleFolio(res.data)
            setCausasMap(res.causas || {})
        } else {
            setError(res.error || 'Error al obtener el detalle del folio.')
        }
        setLoading(false)
    }

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedRegistros = useMemo(() => {
        if (!sortField) return registros;

        return [...registros].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            // Caso especial para ordenar por Año y Mes combinado
            if (sortField === 'ano_mes') {
                if (a.ano !== b.ano) {
                    return sortDirection === 'asc' ? a.ano - b.ano : b.ano - a.ano;
                }
                return sortDirection === 'asc' ? a.mes - b.mes : b.mes - a.mes;
            }

            // Normalización para strings
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDirection === 'asc' 
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            // Para valores indefinidos o nulos
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            // Números y otros tipos comparables
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [registros, sortField, sortDirection]);

    const renderSortIcon = (field: string) => {
        if (sortField !== field) {
            return <span className="text-gray-400 opacity-40 group-hover:opacity-100 ml-1.5 transition-opacity duration-150 font-normal">⇅</span>;
        }
        return sortDirection === 'asc' 
            ? <span className="text-indigo-600 ml-1.5 font-bold animate-in fade-in duration-200">▲</span>
            : <span className="text-indigo-600 ml-1.5 font-bold animate-in fade-in duration-200">▼</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">📤</span> 
                        Cargar PaeOnline
                    </h2>
                    <p className="text-gray-500 mt-2 font-medium">Extraer y consolidar la información de los archivos ZIP de Junaeb.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                        onClick={() => setShowDeleteModal(true)}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-xl shadow-md shadow-red-600/30 font-bold hover:bg-red-500 transition-all flex items-center gap-2 text-sm justify-center flex-1 sm:flex-none"
                    >
                        <span>🗑️</span> Eliminar Registros
                    </button>
                    <button 
                        onClick={() => setShowUploadModal(true)}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/30 font-bold hover:bg-indigo-500 transition-all flex items-center gap-2 text-sm justify-center flex-1 sm:flex-none"
                    >
                        <span>📁</span> Subir ZIP PAE
                    </button>
                </div>
            </div>

            {/* Mensajes Globales */}
            {error && <div className="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100 animate-in fade-in">{error}</div>}
            {successMsg && <div className="p-4 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100 animate-in fade-in">{successMsg}</div>}

            {/* Filtros de Búsqueda */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Filtros de Búsqueda</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Institución</label>
                        <select value={fInstitucion} onChange={e => setFInstitucion(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500">
                            <option value="">Todas</option>
                            <option value="JUNAEB">JUNAEB</option>
                            <option value="JUNJI">JUNJI</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Año</label>
                        <input type="number" value={fAno} onChange={e => setFAno(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500" placeholder="Ej: 2026" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Mes</label>
                        <select value={fMes} onChange={e => setFMes(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500">
                            <option value="">Todos</option>
                            {nombresMeses.map((nombre, index) => (
                                <option key={index + 1} value={index + 1}>{nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Licitación</label>
                        <input type="text" value={fLicitacion} onChange={e => setFLicitacion(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500" placeholder="Ej: 5323" />
                    </div>
                    
                    {/* Autocomplete RBD */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Colegio (RBD / Nombre)</label>
                        <input 
                            type="text" 
                            value={fRbdText} 
                            onChange={handleSearchRBD} 
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500" 
                            placeholder="Buscar RBD..." 
                        />
                        {showSuggestions && rbdSuggestions.length > 0 && (
                            <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {rbdSuggestions.map(s => (
                                    <li 
                                        key={s.colRBD} 
                                        onClick={() => selectRBD(s.colRBD, s.nombreEstablecimiento)}
                                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm font-medium text-gray-700"
                                    >
                                        <span className="font-bold text-indigo-600">{s.colRBD}</span> - {s.nombreEstablecimiento}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                
                <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button 
                        onClick={cargarTabla}
                        className="px-6 py-2 bg-gray-900 text-white rounded-xl shadow-md font-bold hover:bg-gray-800 transition-all"
                    >
                        Buscar Registros
                    </button>
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 font-bold">
                            <tr>
                                <th onClick={() => handleSort('folio')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Folio</span>
                                        {renderSortIcon('folio')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('licitacion')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Licitación</span>
                                        {renderSortIcon('licitacion')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('institucion')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Institución</span>
                                        {renderSortIcon('institucion')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('ano_mes')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Año/Mes</span>
                                        {renderSortIcon('ano_mes')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('rbd')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>RBD</span>
                                        {renderSortIcon('rbd')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('estrato')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Estrato</span>
                                        {renderSortIcon('estrato')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('programa')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Programa</span>
                                        {renderSortIcon('programa')}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('certificacion')} className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200/80 transition-colors group">
                                    <div className="flex items-center">
                                        <span>Certificación</span>
                                        {renderSortIcon('certificacion')}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center select-none">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-gray-500">Cargando datos...</td></tr>
                            ) : sortedRegistros.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-gray-500">No se encontraron registros PAE. Sube un archivo ZIP para comenzar.</td></tr>
                            ) : (
                                sortedRegistros.map(reg => (
                                    <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <button 
                                                onClick={() => handleVerDetalle(reg.folio)}
                                                className="text-indigo-600 font-bold hover:underline"
                                            >
                                                {reg.folio}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{reg.licitacion}</td>
                                        <td className="px-4 py-3 font-medium">{reg.institucion}</td>
                                        <td className="px-4 py-3">{reg.ano} / {reg.mes}</td>
                                        <td className="px-4 py-3 font-bold text-gray-900">{reg.rbd}</td>
                                        <td className="px-4 py-3">{reg.estrato}</td>
                                        <td className="px-4 py-3">{reg.programa}</td>
                                        <td className="px-4 py-3 text-xs max-w-[200px] truncate font-medium text-gray-500" title={reg.certificacion}>{reg.certificacion}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => handleEliminarUnico(reg.folio)}
                                                className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                                                title="Eliminar este folio permanentemente"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Upload ZIP */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Subir y Analizar ZIP</h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-700">✖</button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUploadSubmit} className="space-y-6">
                                
                                <div className="flex flex-col items-center justify-center w-full">
                                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-indigo-300 border-dashed rounded-2xl cursor-pointer bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <span className="text-4xl mb-3">📁</span>
                                            <p className="mb-2 text-sm font-bold text-indigo-900">Haz clic para buscar un archivo .zip</p>
                                            <p className="text-xs text-indigo-500 font-medium">Extraído del módulo Descargas PAE Online</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            accept=".zip" 
                                            className="hidden" 
                                            onChange={e => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                                        />
                                    </label>
                                </div>
                                {fileToUpload && (
                                    <p className="text-sm font-bold text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                                        Seleccionado: <span className="text-indigo-600">{fileToUpload.name}</span>
                                    </p>
                                )}
                                
                                <button 
                                    type="submit" 
                                    disabled={!fileToUpload || uploading}
                                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-500 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                                >
                                    {uploading ? 'Procesando PDFs...' : 'Cargar y Analizar'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Conflictos */}
            {showConflictModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-red-100 bg-red-50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-red-900 flex items-center gap-2">
                                <span>⚠️</span> Conflicto de Datos Detectado
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-700 font-medium text-sm">
                                El archivo ZIP contiene <strong className="text-indigo-600">{conflictos.length} folios</strong> que <strong className="text-red-600">ya existen</strong> en la base de datos, además de {listos.length} folios completamente nuevos.
                            </p>
                            <p className="text-gray-500 text-xs">
                                ¿Deseas sobrescribir los folios existentes con la información nueva del ZIP, o prefieres ignorarlos y guardar solo los nuevos?
                            </p>
                            
                            <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-2">
                                <ul className="text-xs space-y-1">
                                    {conflictos.slice(0, 50).map(c => (
                                        <li key={c.folio} className="font-mono text-gray-600">Folio Existente: <span className="font-bold text-gray-900">{c.folio}</span> (RBD: {c.rbd})</li>
                                    ))}
                                    {conflictos.length > 50 && <li className="font-bold text-indigo-600 pt-2">... y {conflictos.length - 50} más.</li>}
                                </ul>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={() => ejecutarGuardadoFinal(listos, conflictos)}
                                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-500 transition-all text-sm"
                                >
                                    Actualizar Todos
                                </button>
                                <button 
                                    onClick={() => ejecutarGuardadoFinal(listos, [])}
                                    className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-gray-800 transition-all text-sm"
                                >
                                    Ignorar y Cargar Solo Nuevos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Vista de Folio */}
            {detalleFolio && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-black" style={{ color: '#111827' }}>Folio: <span style={{ color: '#4f46e5' }}>{detalleFolio.folio}</span></h3>
                                <p className="text-sm font-medium" style={{ color: '#4b5563' }}>{detalleFolio.institucion} - Período: {detalleFolio.mes}/{detalleFolio.ano}</p>
                            </div>
                            <button onClick={() => setDetalleFolio(null)} className="text-gray-400 hover:text-gray-700 bg-white p-2 rounded-full shadow-sm">✖</button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-grow bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <div className="md:col-span-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>Establecimiento</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.establecimiento}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>RBD</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.rbd}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>Comuna</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.comuna}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>Estrato</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.estrato}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>Programa</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.programa}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>Licitación</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.licitacion}</span>
                                </div>
                                <div className="md:col-span-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                                    <span className="block text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: '#4f46e5' }}>Certificación</span>
                                    <span className="text-sm font-black leading-snug" style={{ color: '#0f172a' }}>{detalleFolio.certificacion}</span>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-6">
                                <h4 className="font-extrabold text-lg mb-2 flex items-center gap-2" style={{ color: '#1e293b' }}>
                                    <span>📊</span> Certificación Diaria de Raciones (Detalles de PAE Online)
                                </h4>
                                <p className="text-sm font-medium mb-4" style={{ color: '#64748b' }}>A continuación se muestran las raciones certificadas día a día para este Folio.</p>

                                <div className="rounded-2xl border border-slate-200 shadow-sm overflow-visible bg-white">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-xs uppercase bg-slate-100 font-bold border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-center" style={{ color: '#1e293b' }}>Día</th>
                                                <th className="px-4 py-3 text-right" style={{ color: '#1e293b' }}>Raciones Completas</th>
                                                <th className="px-4 py-3 text-right" style={{ color: '#1e293b' }}>Raciones Incompletas</th>
                                                <th className="px-4 py-3 text-center" style={{ color: '#1e293b' }}>Cód. Producto</th>
                                                <th className="px-4 py-3 text-right" style={{ color: '#1e293b' }}>No Servidas</th>
                                                <th className="px-4 py-3 text-center" style={{ color: '#1e293b' }}>Cód. Causa</th>
                                                <th className="px-4 py-3 text-right font-black" style={{ color: '#0f172a' }}>Total Raciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {detalleFolio.detalles && detalleFolio.detalles.length > 0 ? (
                                                detalleFolio.detalles.map((d: any) => (
                                                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-4 py-2.5 text-center font-black" style={{ color: '#090d16' }}>{d.dia}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#0f172a' }}>{d.serCompletas}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#0f172a' }}>{d.serIncompletas}</td>
                                                        <td className="px-4 py-2.5 text-center font-medium" style={{ color: '#334155' }}>{d.codProducto || '-'}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: '#0f172a' }}>{d.noServido}</td>
                                                        <td className="px-4 py-2.5 text-center font-medium" style={{ color: '#334155' }}>
                                                            {(() => {
                                                                const causaInt = parseInt(d.codCausa, 10);
                                                                if (isNaN(causaInt) || causaInt <= 0) {
                                                                    return <span>{d.codCausa || '0'}</span>;
                                                                }
                                                                const causaInfo = causasMap[causaInt];
                                                                return (
                                                                    <div className="inline-flex items-center gap-1.5 justify-center">
                                                                        <span className="font-extrabold text-slate-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm">{d.codCausa}</span>
                                                                        {causaInfo ? (
                                                                            <div className="relative group flex items-center justify-center">
                                                                                <span className="cursor-help text-base select-none transition-transform hover:scale-125">
                                                                                    ❓
                                                                                </span>
                                                                                <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-900 text-white text-xs font-semibold py-2.5 px-3.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-xl border border-slate-700/50 z-30 text-left leading-normal">
                                                                                    <div className="font-extrabold text-sm text-amber-400 mb-1">
                                                                                        {(() => {
                                                                                            const desc = causaInfo.descripcion || '';
                                                                                            const hasCodigo = desc.toLowerCase().startsWith('código') || desc.toLowerCase().startsWith('codigo');
                                                                                            return hasCodigo ? desc : `Código ${causaInt}: ${desc}`;
                                                                                        })()}
                                                                                    </div>
                                                                                    <div className="mb-2">
                                                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                                                            causaInfo.imputable === 'Imputable' 
                                                                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                                                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                                                        }`}>
                                                                                            {causaInfo.imputable || 'Imputable'}
                                                                                        </span>
                                                                                    </div>
                                                                                    {causaInfo.definicion && (
                                                                                        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-medium">
                                                                                            {causaInfo.definicion}
                                                                                        </div>
                                                                                    )}
                                                                                    {/* Flecha del tooltip */}
                                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="cursor-help text-xs text-amber-500 font-bold" title="Sin descripción registrada">
                                                                                ⚠️
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-bold bg-indigo-50/30" style={{ color: '#4338ca' }}>{d.totalRaciones}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-8 text-center italic font-medium" style={{ color: '#94a3b8' }}>No hay detalles de raciones registrados para este folio.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Eliminación por Lote */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50 text-red-900">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <span>🗑️</span> Eliminar Registros PAE
                            </h3>
                            <button onClick={() => setShowDeleteModal(false)} className="text-red-400 hover:text-red-700 font-bold bg-white px-2 py-0.5 rounded-lg">✖</button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleEliminarRegistros} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Criterio de Eliminación</label>
                                    <select 
                                        value={delTipo} 
                                        onChange={e => setDelTipo(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 font-bold text-gray-700 bg-gray-50 focus:bg-white"
                                    >
                                        <option value="periodo">Por Período (Año y Mes) - Por defecto</option>
                                        <option value="rbd">Por RBD (Colegio)</option>
                                        <option value="folio">Por Folio único</option>
                                    </select>
                                </div>

                                {delTipo === 'periodo' && (
                                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-150">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Año</label>
                                            <input 
                                                type="number" 
                                                value={delAno} 
                                                onChange={e => setDelAno(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 font-medium"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Mes</label>
                                            <select 
                                                value={delMes} 
                                                onChange={e => setDelMes(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 font-medium"
                                                required
                                            >
                                                {nombresMeses.map((nombre, index) => (
                                                    <option key={index + 1} value={index + 1}>{nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {delTipo === 'rbd' && (
                                    <div className="animate-in slide-in-from-top-2 duration-150">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">RBD del Colegio</label>
                                        <input 
                                            type="number" 
                                            value={delRbd} 
                                            onChange={e => setDelRbd(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 font-medium"
                                            placeholder="Ingresa el número de RBD..."
                                            required
                                        />
                                    </div>
                                )}

                                {delTipo === 'folio' && (
                                    <div className="animate-in slide-in-from-top-2 duration-150">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Folio a Eliminar</label>
                                        <input 
                                            type="text" 
                                            value={delFolio} 
                                            onChange={e => setDelFolio(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 font-medium"
                                            placeholder="Ingresa el folio..."
                                            required
                                        />
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-100 flex gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={deleting}
                                        className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-500 transition-all shadow-md shadow-red-600/20"
                                    >
                                        {deleting ? 'Eliminando...' : 'Confirmar Eliminación'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
