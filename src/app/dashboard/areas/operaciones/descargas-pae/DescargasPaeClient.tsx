'use client'

import { useState, useEffect, useRef } from 'react'
import { getRbdsPorInstitucion } from './actions'
import JSZip from 'jszip'

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
    const [currentIndex, setCurrentIndex] = useState<number>(-1)
    const [currentSchoolName, setCurrentSchoolName] = useState<string>('')
    const [items, setItems] = useState<UrlItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const bookmarkRef = useRef<HTMLAnchorElement>(null);

    // Código JavaScript para el marcador (Bookmarklet)
    const bookmarkletCode = `javascript:(function(){
        const cookie = document.cookie;
        if (!cookie || !cookie.includes('ASPSESSIONID')) {
            alert('Error: No se detectó una sesión activa en Junaeb. Por favor inicia sesión primero en esta pestaña.');
            return;
        }
        const syncUrl = 'http://localhost:3001/dashboard/areas/operaciones/descargas-pae?cookie=' + encodeURIComponent(cookie);
        const w = window.open(syncUrl, 'hendaya_sync_popup', 'width=350,height=250,scrollbars=no,resizable=no');
        if (w) {
            alert('¡Sesión de Junaeb sincronizada con Hendaya exitosamente!');
        } else {
            alert('Por favor, permite ventanas emergentes en esta página para sincronizar tu sesión.');
        }
    })();`.replace(/\s+/g, ' ');

    // Escuchar la sincronización de cookies mediante URL o localStorage
    useEffect(() => {
        if (bookmarkRef.current) {
            bookmarkRef.current.setAttribute('href', bookmarkletCode);
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
        setCurrentIndex(-1)
        setCurrentSchoolName('')

        try {
            const res = await getRbdsPorInstitucion(institucion)
            if (!res.success || !res.data) {
                throw new Error(res.error || "Error al obtener RBDs")
            }
            const data = res.data;

            if (data.length === 0) {
                setError(`No se encontraron establecimientos para la institución ${institucion}.`)
                setLoading(false)
                return
            }

            const newItems: UrlItem[] = data.map((col: any) => {
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
            
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDescargarZIP = async () => {
        if (items.length === 0) return;
        if (!paeCookie) {
            setError("Debes vincular tu sesión de Junaeb primero.");
            return;
        }

        setDownloading(true);
        setError(null);
        setSuccessMessage(null);

        const zip = new JSZip();
        let successCount = 0;

        for (let i = 0; i < items.length; i++) {
            setCurrentIndex(i);
            setCurrentSchoolName(items[i].nombre);

            // Actualizar estado del elemento a 'Descargando'
            setItems(prev => {
                const copy = [...prev];
                copy[i].status = 'Descargando';
                return copy;
            });

            try {
                const response = await fetch('/api/areas/operaciones/descargas-pae/download-single', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        urlGenerada: items[i].urlGenerada,
                        paeCookie,
                        ano: items[i].ano,
                        mes: items[i].mes,
                        institucion: items[i].institucion,
                        rbd: items[i].rbd,
                        nombre: items[i].nombre
                    })
                });

                if (!response.ok) {
                    throw new Error(`Fallo status ${response.status}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                
                // Formatear nombre de archivo limpio dentro del ZIP
                const cleanName = items[i].nombre
                    .replace(/[^a-zA-Z0-9\s]/g, '')
                    .replace(/\s+/g, '_')
                    .slice(0, 50);
                const filename = `${items[i].rbd}_${cleanName}.pdf`;

                // Añadir al ZIP
                zip.file(filename, arrayBuffer);
                successCount++;

                // Actualizar estado del elemento a 'Descargado'
                setItems(prev => {
                    const copy = [...prev];
                    copy[i].status = 'Descargado';
                    return copy;
                });

            } catch (err) {
                console.error(`Error descargando ${items[i].rbd}:`, err);
                // Marcar como Fallo en la tabla para que el usuario sepa cuál falló, pero continuar con los demás
                setItems(prev => {
                    const copy = [...prev];
                    copy[i].status = 'Fallo';
                    return copy;
                });
            }

            // Un pequeño delay de 100ms para suavizar el renderizado visual
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (successCount === 0) {
            setError("No se pudo descargar ningún PDF. Por favor, asegúrate de tener una sesión activa de Junaeb.");
            setDownloading(false);
            setCurrentIndex(-1);
            setCurrentSchoolName('');
            return;
        }

        try {
            // Generar el archivo ZIP final
            const content = await zip.generateAsync({ type: 'blob' });
            
            // Descargar el archivo binario ZIP
            const url = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            const cleanDate = new Date().toISOString().slice(0, 10);
            a.download = `informes_pae_${institucion.toLowerCase()}_${mes}_${ano}_creado_${cleanDate}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setSuccessMessage(`¡Éxito! Se han descargado y empaquetado correctamente ${successCount} de ${items.length} informes en tu archivo ZIP.`);
        } catch (zipErr) {
            setError("Ocurrió un error al compilar el archivo ZIP comprimido.");
        } finally {
            setDownloading(false);
            setCurrentIndex(-1);
            setCurrentSchoolName('');
        }
    };

    const handleDesvincular = () => {
        localStorage.removeItem('pae_session_cookie');
        localStorage.removeItem('pae_session_linked_time');
        setPaeCookie('');
        setIsLinked(false);
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

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-100 animate-in fade-in">
                        {error}
                    </div>
                )}
            </div>

            {/* Real-time Queue Progress Bar */}
            {downloading && currentIndex >= 0 && (
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm animate-in slide-in-from-top duration-300">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-indigo-900">Progreso de Descarga e Integración ZIP</span>
                        <span className="text-xs font-black text-indigo-600 uppercase font-mono bg-indigo-100 px-2 py-1 rounded-md">
                            {currentIndex + 1} de {items.length} colegios ({Math.round(((currentIndex + 1) / items.length) * 100)}%)
                        </span>
                    </div>
                    
                    <div className="w-full bg-indigo-200/50 rounded-full h-3 mb-2 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
                        ></div>
                    </div>
                    
                    <p className="text-xs text-indigo-700 font-semibold mt-2">
                        Procesando actualmente: <strong className="text-indigo-950 font-bold">{currentSchoolName}</strong> (RBD: {items[currentIndex]?.rbd})
                    </p>
                </div>
            )}

            {/* Results Table */}
            {items.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Enlaces Disponibles ({items.length})</h3>
                            <p className="text-xs text-gray-500">Sincroniza tu sesión de Junaeb primero y luego inicia la descarga comprimida.</p>
                        </div>
                        <button 
                            onClick={handleDescargarZIP}
                            disabled={downloading || !isLinked}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20 font-bold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 animate-in zoom-in"
                        >
                            <span>⚡</span> {downloading ? 'Descargando...' : 'Descargar Todo en un ZIP'}
                        </button>
                    </div>

                    {successMessage && (
                        <div className="p-3 bg-green-50 border-b border-green-100 text-green-800 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top duration-300">
                            <span>✅</span> {successMessage}
                        </div>
                    )}

                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-sm text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 font-bold">RBD</th>
                                    <th className="px-6 py-3 font-bold">Establecimiento</th>
                                    <th className="px-6 py-3 font-bold">URL Destino</th>
                                    <th className="px-6 py-3 font-bold text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map((item, idx) => (
                                    <tr 
                                        key={idx} 
                                        className={`transition-colors duration-150 ${
                                            item.status === 'Descargando' 
                                                ? 'bg-indigo-50 hover:bg-indigo-100/50' 
                                                : item.status === 'Descargado' 
                                                    ? 'bg-emerald-50/20 hover:bg-emerald-50/40' 
                                                    : item.status === 'Fallo' 
                                                        ? 'bg-red-50/30 hover:bg-red-50/50'
                                                        : 'hover:bg-gray-50/50'
                                        }`}
                                    >
                                        <td className="px-6 py-3">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-bold font-mono">
                                                {item.rbd}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-900 max-w-[250px] truncate" title={item.nombre}>
                                            {item.nombre}
                                        </td>
                                        <td className="px-6 py-3 max-w-[300px] truncate">
                                            <a href={item.urlGenerada} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline font-mono text-xs">
                                                {item.urlGenerada}
                                            </a>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {item.status === 'Pendiente' ? (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-bold">Pendiente</span>
                                            ) : item.status === 'Descargando' ? (
                                                <span className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold animate-pulse">⏳ Descargando</span>
                                            ) : item.status === 'Fallo' ? (
                                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-bold">✗ Falló</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold">✓ Completado</span>
                                            )}
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
