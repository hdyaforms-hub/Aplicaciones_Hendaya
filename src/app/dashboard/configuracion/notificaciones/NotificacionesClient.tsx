'use client'

import { useState } from 'react'
import { saveScreenNotification, savePlantillaCorreo, getMockDataForPreview } from './actions'

type PantallaInfo = {
    id: string
    name: string
    description: string
}

const PANTALLAS: PantallaInfo[] = [
    { 
        id: 'ingreso-raciones', 
        name: 'Ingreso de Raciones', 
        description: 'Se envía un aviso al momento de presionar Guardar el registro diario de raciones.' 
    },
    { 
        id: 'solicitud-pan', 
        name: 'Solicitud de Pan', 
        description: 'Se envía un aviso al crear una solicitud de pan.' 
    },
    { 
        id: 'retiro-saldos', 
        name: 'Retiro de Saldos', 
        description: 'Se envía un aviso al momento de registrar un retiro de saldo o rebaja de stock.' 
    },
    { 
        id: 'solicitud-gas', 
        name: 'Solicitud de Gas', 
        description: 'Se envía un aviso al momento de crear una nueva solicitud de gas.' 
    },
    { 
        id: 'solicitud-gas-exceso', 
        name: 'Alerta Exceso de Gas', 
        description: 'Se envía una alerta cuando un usuario intenta pedir gas superando los límites permitidos.' 
    }
]

const HELP_KEYWORDS: Record<string, { tag: string, desc: string }[]> = {
    'Comunes': [
        { tag: '<RBD>', desc: 'RBD (Rol Base de Datos) del establecimiento.' },
        { tag: '<Usuario>', desc: 'Nombre del usuario que realiza la acción.' },
        { tag: '<Sucursal>', desc: 'Nombre de la sucursal o bodega correspondiente.' },
    ],
    'Solicitud de Pan': [
        { tag: '<FechaSistema>', desc: 'Fecha y hora en que se crea el registro.' },
        { tag: '<Solicitud>', desc: 'Tipo de solicitud (Aumento o Disminución).' },
        { tag: '<Cantidad>', desc: 'Cantidad de pan solicitada (Kg).' },
        { tag: '<FechaGestacion>', desc: 'Fecha requerida para el consumo del pan.' },
        { tag: '<Servicio>', desc: 'Nombre del servicio (Ej: Desayuno, Almuerzo).' },
        { tag: '<Motivo>', desc: 'Motivo o justificación de la solicitud.' },
    ],
    'Retiro de Saldos': [
        { tag: '<Folio>', desc: 'Número de folio único del retiro.' },
        { tag: '<Tipo>', desc: 'Tipo de operación (Retiro de saldo / Rebaja de stock).' },
        { tag: '<Supervisor>', desc: 'Nombre del supervisor que firma el retiro.' },
        { tag: '<NombreAutoriza>', desc: 'Nombre de la persona que autorizó el movimiento.' },
        { tag: '<DetalleProductos>', desc: 'Lista detallada de productos y cantidades.' },
    ],
    'Solicitud de Gas': [
        { tag: '<TipoGas>', desc: 'Formato del gas (Cilindro / Bombona).' },
        { tag: '<CantidadLitros>', desc: 'Cantidad total solicitada expresada en litros.' },
        { tag: '<Distribuidor>', desc: 'Empresa distribuidora asignada.' },
        { tag: '<Observacion>', desc: 'Comentarios adicionales del solicitante.' },
    ],
    'Alerta Exceso de Gas': [
        { tag: '<MotivoBloqueo>', desc: 'Explicación del porqué se ha detenido el pedido.' },
        { tag: '<LimiteMensual>', desc: 'Cupo máximo configurado para el establecimiento.' },
        { tag: '<AcumuladoActual>', desc: 'Total consumido previo a este intento.' },
    ]
}

export default function NotificacionesClient({ 
    configuraciones, 
    listasCorreo,
    plantillas
}: { 
    configuraciones: any[]
    listasCorreo: { id: string, nombre: string }[]
    plantillas: any[]
}) {
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [templateModal, setTemplateModal] = useState<{ 
        isOpen: boolean, 
        pantallaId: string, 
        asunto: string, 
        cuerpo: string,
        showPreview: boolean,
        mockData: any
    } | null>(null)
    const [showHelp, setShowHelp] = useState(false)

    const handleSave = async (codigoPantalla: string, listas: string[], activa: boolean) => {
        setLoading(prev => ({ ...prev, [codigoPantalla]: true }))
        try {
            const result = await saveScreenNotification(codigoPantalla, listas, activa)
            if (result.success) {
                alert('Configuración guardada correctamente.')
            } else {
                alert(result.error || 'Hubo un error al guardar.')
            }
        } catch (error) {
            console.error(error)
            alert('Error en la comunicación con el servidor.')
        } finally {
            setLoading(prev => ({ ...prev, [codigoPantalla]: false }))
        }
    }

    const openTemplateModal = async (pantallaId: string) => {
        const pInfo = plantillas.find(p => p.codigoPantalla === pantallaId)
        const mock = await getMockDataForPreview(pantallaId)
        setTemplateModal({
            isOpen: true,
            pantallaId,
            asunto: pInfo?.asunto || '',
            cuerpo: pInfo?.cuerpo || '',
            showPreview: false,
            mockData: mock
        })
    }

    const saveTemplate = async () => {
        if (!templateModal) return;
        setLoading(prev => ({ ...prev, templateSave: true }))
        try {
            const res = await savePlantillaCorreo(templateModal.pantallaId, templateModal.asunto, templateModal.cuerpo)
            if (res.success) {
                alert('Plantilla guardada correctamente.')
                setTemplateModal(null)
            } else {
                alert(res.error)
            }
        } catch(e) {
            alert('Error al grabar.')
        } finally {
            setLoading(prev => ({ ...prev, templateSave: false }))
        }
    }

    const renderPreview = (text: string) => {
        if (!templateModal?.mockData) return text
        let result = text
        Object.entries(templateModal.mockData).forEach(([tag, value]) => {
            const regex = new RegExp(`<${tag}.*?>`, 'gi')
            result = result.replace(regex, String(value))
        })
        return result
    }

    return (
        <div className="overflow-x-auto p-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">✉️ Configuración de Alertas</h2>
                    <p className="text-xs text-gray-500">Administra qué listas de correo reciben avisos de cada proceso.</p>
                </div>
                <button 
                    onClick={() => setShowHelp(true)}
                    className="w-10 h-10 bg-cyan-50 text-cyan-600 rounded-full flex items-center justify-center font-black text-xl hover:bg-cyan-100 transition-all shadow-sm border border-cyan-100"
                    title="Ver palabras reservadas"
                >
                    ?
                </button>
            </div>

            <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-100 text-gray-600 rounded-t-lg">
                    <tr>
                        <th className="px-5 py-4 font-semibold rounded-tl-lg">Pantalla / Módulo</th>
                        <th className="px-5 py-4 font-semibold">Listas de Distribución</th>
                        <th className="px-5 py-4 font-semibold">Estado</th>
                        <th className="px-5 py-4 font-semibold rounded-tr-lg">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {PANTALLAS.map(pantalla => {
                        const configPantalla = configuraciones.filter(c => c.codigoPantalla === pantalla.id)
                        const defaultListasIds = configPantalla.map(c => c.listaCorreoId)
                        const defaultActiva = configPantalla.length > 0 ? configPantalla[0].activa : true

                        return (
                            <ConfigRow 
                                key={pantalla.id}
                                pantalla={pantalla}
                                listasCorreo={listasCorreo}
                                defaultListasIds={defaultListasIds}
                                defaultActiva={defaultActiva}
                                onSave={handleSave}
                                isSaving={loading[pantalla.id] || false}
                                onEditTemplate={() => openTemplateModal(pantalla.id)}
                            />
                        )
                    })}
                </tbody>
            </table>

            {templateModal && templateModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span>📧</span> {templateModal.showPreview ? 'Vista Previa del Correo' : 'Formato de Correo'}
                            </h3>
                            <button onClick={() => setTemplateModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {!templateModal.showPreview ? (
                                <>
                                    <p className="text-xs text-gray-500 mb-2">Aquí puedes personalizar qué dirá el Asunto y el Cuerpo del correo para este módulo. Puedes usar etiquetas como <code className="bg-gray-100 text-cyan-600 px-1 rounded">&lt;Usuario&gt;</code>, <code className="bg-gray-100 text-cyan-600 px-1 rounded">&lt;RBD&gt;</code> que reemplazaremos internamente al enviar.</p>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Asunto</label>
                                        <input 
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-gray-900 font-medium"
                                            value={templateModal.asunto}
                                            onChange={(e) => setTemplateModal({...templateModal, asunto: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cuerpo (Mensaje)</label>
                                        <textarea 
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none h-48 font-mono text-sm bg-white text-gray-900 font-medium"
                                            value={templateModal.cuerpo}
                                            onChange={(e) => setTemplateModal({...templateModal, cuerpo: e.target.value})}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-inner space-y-4">
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Asunto:</span>
                                        <div className="text-gray-900 font-semibold text-lg py-2 border-b border-slate-200">
                                            {renderPreview(templateModal.asunto) || '(Sin asunto)'}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mensaje:</span>
                                        <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed py-4 min-h-[200px]">
                                            {renderPreview(templateModal.cuerpo) || '(Cuerpo vacío)'}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-200 italic text-[10px] text-slate-400 text-center">
                                        * Esta es una representación visual del correo que recibirán los destinatarios.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 text-sm">
                            <button 
                                onClick={() => setTemplateModal({...templateModal, showPreview: !templateModal.showPreview})}
                                className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                                    templateModal.showPreview 
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                }`}
                            >
                                {templateModal.showPreview ? '⬅ Ver Editor' : '👁️ Vista Previa'}
                            </button>

                            <div className="flex gap-3">
                                <button onClick={() => setTemplateModal(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                                <button 
                                    onClick={saveTemplate}
                                    disabled={loading['templateSave']}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 shadow-md shadow-slate-900/20"
                                >
                                    {loading['templateSave'] ? 'Guardando...' : 'Guardar Formato'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showHelp && (
                <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Guía de Palabras Reservadas</h3>
                                <p className="text-xs text-gray-500 mt-1">Utiliza estas etiquetas en tus plantillas para insertar datos dinámicos automáticamente.</p>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {Object.entries(HELP_KEYWORDS).map(([module, keywords]) => (
                                    <div key={module} className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 bg-cyan-50 w-fit px-3 py-1 rounded-full">{module}</h4>
                                        <div className="space-y-2">
                                            {keywords.map(kw => (
                                                <div key={kw.tag} className="flex flex-col p-3 bg-gray-50 border border-gray-100 rounded-2xl group hover:bg-white hover:border-cyan-200 hover:shadow-md transition-all">
                                                    <code className="text-sm font-bold text-cyan-700 group-hover:scale-105 transition-transform origin-left">{kw.tag}</code>
                                                    <span className="text-xs text-gray-500 mt-1">{kw.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-center">
                            <button onClick={() => setShowHelp(false)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Entendido</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ConfigRow({ 
    pantalla, 
    listasCorreo, 
    defaultListasIds, 
    defaultActiva, 
    onSave, 
    isSaving,
    onEditTemplate
}: {
    pantalla: PantallaInfo
    listasCorreo: { id: string, nombre: string }[]
    defaultListasIds: string[]
    defaultActiva: boolean
    onSave: (id: string, listas: string[], activa: boolean) => void
    isSaving: boolean
    onEditTemplate: () => void
}) {
    const [selectedListas, setSelectedListas] = useState<string[]>(defaultListasIds)
    const [activa, setActiva] = useState(defaultActiva)

    const handleToggleLista = (id: string) => {
        setSelectedListas(prev => 
            prev.includes(id) ? prev.filter(listaId => listaId !== id) : [...prev, id]
        )
    }

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-5 py-5 border-b border-gray-100 align-top">
                <div className="font-semibold text-gray-900 text-base">{pantalla.name}</div>
                <div className="text-gray-500 text-xs mt-1">{pantalla.description}</div>
                <div className="mt-3">
                    <button type="button" onClick={onEditTemplate} className="text-xs font-semibold text-cyan-600 hover:text-cyan-800 flex items-center gap-1 transition-colors bg-cyan-50 px-2 py-1 rounded inline-block">
                        <span>✏️</span> Editar Formato Plantilla
                    </button>
                </div>
            </td>
            <td className="px-5 py-5 border-b border-gray-100 min-w-[200px]">
                {listasCorreo.length === 0 ? (
                    <span className="text-red-500 text-xs">No hay listas de correo configuradas</span>
                ) : (
                    <div className="flex flex-col gap-2 relative max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {listasCorreo.map(lista => (
                            <label key={lista.id} className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    className="hidden"
                                    checked={selectedListas.includes(lista.id)}
                                    onChange={() => handleToggleLista(lista.id)}
                                />
                                <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                    selectedListas.includes(lista.id) 
                                        ? 'bg-cyan-500 border-cyan-500 text-white' 
                                        : 'bg-white border-gray-300 group-hover:border-cyan-400'
                                }`}>
                                    {selectedListas.includes(lista.id) && (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </span>
                                <span className={`${selectedListas.includes(lista.id) ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                                    {lista.nombre}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </td>
            <td className="px-5 py-5 border-b border-gray-100 align-top">
                <button 
                    onClick={() => setActiva(!activa)}
                    disabled={selectedListas.length === 0}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activa && selectedListas.length > 0 ? 'bg-cyan-500' : 'bg-gray-300'} ${selectedListas.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activa && selectedListas.length > 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <div className="text-xs text-gray-500 mt-1 font-medium select-none">
                    {selectedListas.length === 0 ? 'Inactivo (Sin Listas)' : (activa ? 'Emitiendo Avisos' : 'Avisos Pausados')}
                </div>
            </td>
            <td className="px-5 py-5 border-b border-gray-100 align-top">
                <button
                    onClick={() => onSave(pantalla.id, selectedListas, activa)}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    {isSaving ? (
                        <span className="animate-spin text-sm">↻</span>
                    ) : (
                        <span className="text-sm">💾</span>
                    )}
                    {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
            </td>
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </tr>
    )
}
