'use client'

import { useState, useEffect, useRef } from 'react'
import { getRbdsPorInstitucion } from './actions'

interface UrlItem {
    ano: number;
    mes: number;
    institucion: string;
    rbd: number;
    nombre: string;
    urlGenerada: string;
    status: 'Pendiente' | 'Descargando' | 'Descargado' | 'Fallo';
}

export default function DescargasPaeClient() {
    const [ano, setAno] = useState<number>(new Date().getFullYear())
    const [mes, setMes] = useState<number>(new Date().getMonth() + 1)
    const [institucion, setInstitucion] = useState<string>('JUNAEB')
    const [paeCookie, setPaeCookie] = useState<string>('')
    const [isLinked, setIsLinked] = useState<boolean>(false)
    
    const [loading, setLoading] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [jobId, setJobId] = useState<string | null>(null)
    const [progress, setProgress] = useState<{ total: number, processed: number }>({ total: 0, processed: 0 })
    const [currentIndex, setCurrentIndex] = useState<number>(-1)
    const [currentSchoolName, setCurrentSchoolName] = useState<string>('')
    const [items, setItems] = useState<UrlItem[]>([])
    const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState<string>('')

    const bookmarkRef = useRef<HTMLAnchorElement>(null);
    const masterCheckboxRef = useRef<HTMLInputElement>(null);

    // Escuchar la sincronización de cookies mediante URL o localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && bookmarkRef.current) {
            const origin = window.location.origin;
            const dynamicBookmarkletCode = `javascript:(function(){
                const cookie = document.cookie;
                if (!cookie || !cookie.includes('ASPSESSIONID')) {
                    alert('Error: No se detectó una sesión activa en Junaeb. Por favor inicia sesión primero en esta pestaña.');
                    return;
                }
                const syncUrl = '${origin}/dashboard/areas/operaciones/descargas-pae?cookie=' + encodeURIComponent(cookie);
                const w = window.open(syncUrl, 'hendaya_sync_popup', 'width=350,height=250,scrollbars=no,resizable=no');
                if (w) {
                    alert('¡Sesión de Junaeb sincronizada con Hendaya exitosamente!');
                } else {
                    alert('Por favor, permite ventanas emergentes en esta página para sincronizar tu sesión.');
                }
            })();`.replace(/\s+/g, ' ');

            bookmarkRef.current.setAttribute('href', dynamicBookmarkletCode);
        }

        // 1. Detectar si entramos desde el mini-popup de sincronización
        const params = new URLSearchParams(window.location.search);
        const cookieParam = params.get('cookie');
        
        if (cookieParam) {
            localStorage.setItem('pae_session_cookie', cookieParam);
            localStorage.setItem('pae_session_linked_time', Date.now().toString());
            
            if (window.opener) {
                window.close();
            }
        }

        // 2. Comprobar si ya existe una cookie válida guardada
        checkSavedCookie();

        // 3. Escuchar cambios de localStorage en tiempo real
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'pae_session_cookie') {
                checkSavedCookie();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const checkSavedCookie = () => {
        const saved = localStorage.getItem('pae_session_cookie');
        const savedTime = localStorage.getItem('pae_session_linked_time');
        
        if (saved) {
            const isExpired = savedTime ? (Date.now() - Number(savedTime) > 45 * 60 * 1000) : true;
            if (!isExpired) {
                setPaeCookie(saved);
                setIsLinked(true);
            } else {
                localStorage.removeItem('pae_session_cookie');
                localStorage.removeItem('pae_session_linked_time');
                setPaeCookie('');
                setIsLinked(false);
            }
        } else {
            setIsLinked(false);
        }
    };

    const handleGenerar = async () => {
        setLoading(true)
        setError(null)
        setSuccessMessage(null)
        setItems([])
        setSeleccionados(new Set())
        setCurrentIndex(-1)
        setCurrentSchoolName('')

        try {
            const res = await getRbdsPorInstitucion(institucion)
            if (!res.success || !res.data) {
                throw new Error(res.error || "Error al obtener RBDs")
            }
            const data = res.data;

            const RBDS_EXCLUIDOS = [31, 32, 1101, 1302];
            const filteredData = data.filter((col: any) => !RBDS_EXCLUIDOS.includes(col.colRBD));

            if (filteredData.length === 0) {
                setError(`No se encontraron establecimientos para la institución ${institucion}.`)
                setLoading(false)
                return
            }

            const newItems: UrlItem[] = filteredData.map((col: any) => {
                let url = '';
                if (institucion.toUpperCase() === 'JUNAEB') {
                    url = `https://pae.junaeb.cl/reportes/pdf/informePDFRBD.asp?month=${mes}&iYear=${ano}&tipo=1&RBD=${col.colRBD}`;
                } else if (institucion.toUpperCase() === 'JUNJI') {
                    url = `https://pae.junaeb.cl/reportes/pdf/informePDFRBD.asp?month=${mes}&iYear=${ano}&tipo=1&RBD=110011${col.colRBD}`;
                }

                return {
                    ano,
                    mes,
                    institucion: institucion.toUpperCase(),
                    rbd: col.colRBD,
                    nombre: col.nombreEstablecimiento,
                    urlGenerada: url,
                    status: 'Pendiente'
                }
            });

            setItems(newItems)
            setSeleccionados(new Set(newItems.map(item => item.rbd)))
            
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDescargarZIP = async () => {
        const selectedItems = items.filter(item => seleccionados.has(item.rbd));
        if (selectedItems.length === 0) {
            setError("Debes seleccionar al menos un RBD para descargar.");
            return;
        }
        if (!paeCookie) {
            setError("Debes vincular tu sesión de Junaeb primero.");
            return;
        }

        setDownloading(true);
        setError(null);
        setSuccessMessage("Iniciando tarea en segundo plano...");
        setProgress({ total: selectedItems.length, processed: 0 });

        try {
            const res = await fetch('/api/areas/operaciones/descargas-pae/download-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    payload: {
                        paeCookie,
                        items: selectedItems,
                        institucion,
                        mes,
                        ano
                    }
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Error al iniciar la descarga');
            }

            setJobId(data.jobId);
            setSuccessMessage("Tarea en segundo plano iniciada con éxito. Por favor espera mientras se procesa...");
        } catch (err: any) {
            setError(err.message);
            setSuccessMessage(null);
            setDownloading(false);
        }
    };

    const handleCancelarZIP = async () => {
        if (!jobId) return;
        try {
            await fetch('/api/areas/operaciones/descargas-pae/download-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', jobId })
            });
            // El polling recogerá el estado "cancelled"
        } catch (err: any) {
            console.error('Error cancelando:', err);
        }
    };

    // Polling effect
    useEffect(() => {
        if (!jobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/areas/operaciones/descargas-pae/download-zip?action=status&jobId=${jobId}`);
                const data = await res.json();

                if (res.ok) {
                    setProgress({ total: data.total, processed: data.processed });

                    if (data.status === 'completed' || data.status === 'cancelled') {
                        clearInterval(interval);
                        setDownloading(false);
                        setJobId(null);
                        setSuccessMessage(data.status === 'completed' ? '¡Descarga completada! El archivo final está guardándose.' : 'Descarga cancelada. Generando archivo con el progreso parcial...');
                        
                        // Iniciar la descarga del archivo estático
                        window.location.href = `/api/areas/operaciones/descargas-pae/download-zip?action=download&jobId=${jobId}`;
                    }
                }
            } catch (err) {
                console.error("Error consultando estado", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [jobId]);

    const handleDesvincular = () => {
        localStorage.removeItem('pae_session_cookie');
        localStorage.removeItem('pae_session_linked_time');
        setPaeCookie('');
        setIsLinked(false);
    };

    const filteredItems = items.filter(item => item.rbd.toString().includes(searchQuery) || item.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
    const allSelected = filteredItems.length > 0 && seleccionados.size === filteredItems.length;
    const someSelected = filteredItems.length > 0 && seleccionados.size > 0 && seleccionados.size < filteredItems.length;

    useEffect(() => {
        if (masterCheckboxRef.current) {
            masterCheckboxRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    const handleToggleAll = () => {
        if (allSelected) {
            setSeleccionados(new Set());
        } else {
            setSeleccionados(new Set(filteredItems.map(item => item.rbd)));
        }
    };

    const handleToggleRow = (rbd: number) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            if (next.has(rbd)) {
                next.delete(rbd);
            } else {
                next.add(rbd);
            }
            return next;
        });
    };

    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-bl-full -z-10 opacity-70" />
                
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">📥</span> 
                        Descargas PAE Online
                    </h2>
                    <p className="text-gray-500 mt-2 font-medium">Descarga e integración de informes de Junaeb en un único archivo comprimido.</p>
                </div>
            </div>

            {/* Instruction Banner - Visual Drag and Drop */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-600 p-6 rounded-r-2xl shadow-sm space-y-4">
                <h3 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                    <span>⚡</span> Vinculación Rápida en 1 Clic (Sin Códigos)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-3 text-sm text-indigo-950 font-medium">
                        <p>Sigue estos dos sencillos pasos para activar la sincronización automática:</p>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>
                                <strong>Arrastra</strong> el botón de la derecha a tu <strong>barra de marcadores/favoritos</strong> de tu navegador (solo se hace una vez).
                            </li>
                            <li>
                                Abre tu sesión en <a href="https://pae.junaeb.cl" target="_blank" className="text-indigo-600 hover:underline font-bold">Junaeb</a> en otra pestaña y haz clic en el marcador guardado. ¡Listo!
                            </li>
                        </ol>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Arrastra este botón a tus marcadores:</span>
                        <a 
                            ref={bookmarkRef}
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl shadow-lg shadow-indigo-600/30 font-black text-sm hover:scale-105 transition-all cursor-move flex items-center gap-2 border border-indigo-700 select-none"
                            title="Arrastra esto a tu barra de marcadores"
                        >
                            <span>🔗</span> Sincronizar Junaeb
                        </a>
                        <span className="text-[10px] text-indigo-500 font-semibold italic text-center">
                            * Arrástralo hacia arriba a tu barra de marcadores
                        </span>
                    </div>
                </div>
            </div>

            {/* Connection and Filters Area */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                
                {/* Session Link Badge */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{isLinked ? '🟢' : '🔴'}</span>
                        <div>
                            <p className="text-sm font-bold text-gray-900">
                                {isLinked ? 'Sesión de Junaeb Vinculada' : 'Sin Sesión de Junaeb activa'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {isLinked ? 'Listo para descargar informes directamente.' : 'Sigue el paso de marcadores arriba para activar.'}
                            </p>
                        </div>
                    </div>
                    {isLinked && (
                        <button 
                            onClick={handleDesvincular}
                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all"
                        >
                            Desvincular
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-5 items-end">
                    <div className="w-full sm:w-48">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Institución</label>
                        <select 
                            value={institucion}
                            onChange={(e) => setInstitucion(e.target.value)}
                            disabled={downloading}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                        >
                            <option value="JUNAEB">JUNAEB</option>
                            <option value="JUNJI">JUNJI</option>
                        </select>
                    </div>

                    <div className="w-full sm:w-48">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mes a procesar</label>
                        <select 
                            value={mes}
                            onChange={(e) => setMes(Number(e.target.value))}
                            disabled={downloading}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                        >
                            {mesesNombres.map((m, idx) => (
                                <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-32">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Año</label>
                        <input 
                            type="number" 
                            value={ano}
                            onChange={(e) => setAno(Number(e.target.value))}
                            disabled={downloading}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                        />
                    </div>

                    <div className="w-full sm:w-auto flex-grow sm:flex-grow-0 sm:ml-auto">
                        <button 
                            onClick={handleGenerar}
                            disabled={loading || downloading}
                            className="w-full sm:w-auto px-6 py-2 bg-gray-900 text-white rounded-xl shadow-md shadow-gray-900/20 font-bold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <span>🔗</span>
                            )}
                            {loading ? 'Generando...' : 'Generar Enlaces'}
                        </button>
                    </div>
                </div>

                {/* Mensajes Globales de la Interfaz */}
                {error && (
                    <div className="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100 animate-in fade-in max-w-7xl mx-auto">
                        {error}
                    </div>
                )}
                
                {/* Barra de Progreso */}
                {downloading && (
                    <div className="p-6 bg-indigo-50 text-indigo-900 font-medium rounded-xl border border-indigo-100 animate-in fade-in max-w-7xl mx-auto shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-lg flex items-center gap-2">
                                <span className="animate-spin inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                                Generando archivo ZIP...
                            </h4>
                            <span className="font-bold text-indigo-600 text-lg">
                                {progress.processed} / {progress.total}
                            </span>
                        </div>
                        <div className="w-full bg-indigo-200 rounded-full h-3">
                            <div 
                                className="bg-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <p className="text-indigo-700">Por favor, no cierres esta ventana hasta que finalice.</p>
                            <button 
                                onClick={handleCancelarZIP}
                                className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 rounded-lg font-bold transition-colors flex items-center gap-2"
                            >
                                <span>🛑</span> Detener y Guardar Progreso
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Mensaje de éxito */}
                {successMessage && !downloading && (
                    <div className="p-6 bg-emerald-50 text-emerald-800 font-medium rounded-xl border border-emerald-100 animate-in fade-in max-w-7xl mx-auto shadow-sm flex items-start gap-4">
                        <span className="text-2xl">✅</span>
                        <div>
                            <h4 className="font-bold text-lg mb-1">Operación Finalizada</h4>
                            <p className="text-sm">{successMessage}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Table */}
            {items.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
                        <div className="flex justify-between items-center w-full">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Enlaces Disponibles ({filteredItems.length})</h3>
                                <p className="text-xs text-gray-500">Sincroniza tu sesión de Junaeb primero y luego inicia la descarga comprimida.</p>
                            </div>
                            <button 
                                onClick={handleDescargarZIP}
                                disabled={downloading || !isLinked || seleccionados.size === 0}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20 font-bold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 animate-in zoom-in"
                            >
                                <span>⚡</span>{' '}
                                {downloading
                                    ? 'Descargando...'
                                    : seleccionados.size === filteredItems.length && filteredItems.length > 0
                                    ? `Descargar Todo en un ZIP (${seleccionados.size})`
                                    : `Descargar Seleccionados (${seleccionados.size}) en un ZIP`}
                            </button>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Buscar por RBD o Establecimiento..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                disabled={downloading}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                        </div>
                    </div>
                    
                    {/* Quitamos el success message de acá porque lo mostramos globalmente arriba */}

                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-sm text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12">
                                        <input 
                                            type="checkbox" 
                                            ref={masterCheckboxRef}
                                            checked={allSelected}
                                            onChange={handleToggleAll}
                                            disabled={downloading}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer disabled:opacity-50 transition-colors"
                                        />
                                    </th>
                                    <th className="px-6 py-3 font-bold">RBD</th>
                                    <th className="px-6 py-3 font-bold">Establecimiento</th>
                                    <th className="px-6 py-3 font-bold">Mes</th>
                                    <th className="px-6 py-3 font-bold">Año</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredItems.map((item, idx) => (
                                    <tr 
                                        key={idx} 
                                        className="transition-colors duration-150 hover:bg-gray-50/50"
                                    >
                                        <td className="px-4 py-3 text-center w-12">
                                            <input 
                                                type="checkbox" 
                                                checked={seleccionados.has(item.rbd)}
                                                onChange={() => handleToggleRow(item.rbd)}
                                                disabled={downloading}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer disabled:opacity-50 transition-colors"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-bold font-mono">
                                                {item.rbd}
                                             </span>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-900 max-w-[250px] truncate" title={item.nombre}>
                                            {item.nombre}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-600">
                                            {mesesNombres[item.mes - 1]}
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-600 font-mono">
                                            {item.ano}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
