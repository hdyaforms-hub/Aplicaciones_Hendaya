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
    },
    {
        id: 'form-submission-pdf',
        name: 'Envío Formulario PDF',
        description: 'Configura el asunto y cuerpo del correo cuando se envía un formulario en formato PDF.'
    },
    {
        id: 'RETORNO_PRODUCTOS',
        name: 'Retirada de productos',
        description: 'Se envía un aviso al crear una alerta de calidad o registrar un movimiento de sucursal.'
    },
    {
        id: 'matriz-prestador',
        name: 'Matriz de Riesgo - Prestador',
        description: 'Se envía una alerta cuando se finaliza la matriz con desviaciones a cargo del Prestador.'
    },
    {
        id: 'calidad-transporte-higiene',
        name: 'Registro transportista interno higiene y estado Transporte',
        description: 'Se envía un aviso al Jefe de Bodega cuando el Encargado de Calidad firma el registro diario de transporte e higiene.'
    },
    {
        id: 'calidad-higiene-personal',
        name: 'Registro de Transportista interno Higiene Personal',
        description: 'Se envía un aviso al Jefe de Bodega cuando el Encargado de Calidad firma el registro diario de higiene personal de transportistas.'
    },
    {
        id: 'cambio-rbd-personal',
        name: 'Cambio de RBD (Personal)',
        description: 'Se envía un aviso al momento de registrar un cambio de RBD de una manipuladora (Anexo de traslado o Comisión de servicio).'
    }
]

const HELP_KEYWORDS: Record<string, { tag: string, desc: string }[]> = {
    'Comunes': [
        { tag: '<RBD>', desc: 'RBD (Rol Base de Datos) del establecimiento.' },
        { tag: '<Usuario>', desc: 'Nombre del usuario que realiza la acción.' },
        { tag: '<Sucursal>', desc: 'Nombre de la sucursal o bodega correspondiente.' },
    ],
    'Cambio de RBD (Personal)': [
        { tag: '<Rut>', desc: 'RUT de la colaboradora o manipuladora.' },
        { tag: '<Nombre>', desc: 'Nombre completo de la manipuladora.' },
        { tag: '<RbdOrigen>', desc: 'RBD de origen del establecimiento.' },
        { tag: '<ColegioOrigen>', desc: 'Nombre del establecimiento educacional de origen.' },
        { tag: '<SucursalOrigen>', desc: 'Sucursal o zona operativa de origen.' },
        { tag: '<RbdDestino>', desc: 'RBD de destino al que se traslada.' },
        { tag: '<ColegioDestino>', desc: 'Nombre del establecimiento educacional de destino.' },
        { tag: '<TipoCambio>', desc: 'Tipo de traslado (Anexos de traslado o Comisión de servicio).' },
        { tag: '<FechaDesde>', desc: 'Fecha de inicio del cambio o traslado (DD/MM/AAAA).' },
        { tag: '<FechaHasta>', desc: 'Fecha de término (aplica para Comisión de servicio).' },
        { tag: '<Supervisor>', desc: 'Nombre del supervisor a cargo.' },
        { tag: '<Usuario>', desc: 'Usuario que gestionó el cambio de RBD en el sistema.' }
    ],
    'Registro transportista interno higiene y estado Transporte': [
        { tag: '<Fecha>', desc: 'Fecha del registro de inspección (DD/MM/AAAA).' },
        { tag: '<FechaInspeccion>', desc: 'Fecha formateada de la inspección de vehículos.' },
        { tag: '<Sucursal>', desc: 'Nombre de la sucursal o bodega inspeccionada.' },
        { tag: '<UsuarioCalidad>', desc: 'Nombre del Encargado de Calidad que firma y cierra el registro.' },
        { tag: '<Usuario>', desc: 'Nombre del usuario que realiza la firma/envío.' },
        { tag: '<TotalVehiculos>', desc: 'Cantidad total de vehículos inspeccionados.' },
        { tag: '<TotalTransportes>', desc: 'Cantidad total de vehículos inspeccionados (alias).' },
        { tag: '<Desviaciones>', desc: 'Resumen detallado de vehículos con no conformidades / observaciones.' },
        { tag: '<DiasAtraso>', desc: 'Días de retraso si la firma de calidad es extemporánea.' },
        { tag: '<ObservacionesGenerales>', desc: 'Observaciones generales registradas en la planilla.' }
    ],
    'Registro de Transportista interno Higiene Personal': [
        { tag: '<Fecha>', desc: 'Fecha del control de higiene personal (DD/MM/AAAA).' },
        { tag: '<FechaInspeccion>', desc: 'Fecha formateada del control higiénico.' },
        { tag: '<Sucursal>', desc: 'Nombre de la sucursal o bodega inspeccionada.' },
        { tag: '<UsuarioCalidad>', desc: 'Nombre del Encargado de Calidad que firma y cierra el registro.' },
        { tag: '<Usuario>', desc: 'Nombre del usuario que realiza la firma/envío.' },
        { tag: '<TotalTrabajadores>', desc: 'Cantidad total de trabajadores / transportistas evaluados.' },
        { tag: '<TotalPersonas>', desc: 'Cantidad total de trabajadores evaluados (alias).' },
        { tag: '<TotalTransportistas>', desc: 'Total de transportistas evaluados (alias).' },
        { tag: '<Desviaciones>', desc: 'Resumen de trabajadores con observaciones higiénicas o síntomas de salud.' },
        { tag: '<DiasAtraso>', desc: 'Días de retraso si la firma de calidad es extemporánea.' },
        { tag: '<ObservacionesGenerales>', desc: 'Observaciones generales registradas en la planilla.' }
    ],
    'Ingreso de Raciones': [
        { tag: '<Colegio>', desc: 'Nombre del establecimiento educacional.' },
        { tag: '<Programa>', desc: 'Nombre del programa (Ej: PAE).' },
        { tag: '<Estrato>', desc: 'Estrato correspondiente de las raciones.' },
        { tag: '<FechaIngreso>', desc: 'Fecha configurada para el ingreso de raciones.' },
        { tag: '<TotalIng>', desc: 'Suma total de raciones ingresadas.' },
        { tag: '<Observacion>', desc: 'Observaciones extra añadidas.' },
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
    ],
    'Envío Formulario PDF': [
        { tag: '<UT>', desc: 'Unidad Territorial (si aplica).' },
        { tag: '<RBD>', desc: 'RBD del establecimiento (si aplica).' },
    ],
    'Retirada de productos': [
        { tag: '<Titulo>', desc: 'Título de la alerta de calidad.' },
        { tag: '<Observacion>', desc: 'Descripción detallada del producto o incidencia.' },
        { tag: '<Horas>', desc: 'Plazo de tiempo otorgado para la gestión.' },
        { tag: '<Sucursal>', desc: 'Nombre de la bodega/sucursal que reporta.' },
        { tag: '<Comentario>', desc: 'Texto del movimiento o novedad recién registrada.' },
    ],
    'Matriz de Riesgo - Prestador': [
        { tag: '<RBD>', desc: 'RBD del establecimiento.' },
        { tag: '<Colegio>', desc: 'Nombre del establecimiento.' },
        { tag: '<Usuario>', desc: 'Nombre del auditor/supervisor que completó la matriz.' },
        { tag: '<Sucursal>', desc: 'Nombre de la sucursal del establecimiento.' },
        { tag: '<DetalleDesviaciones>', desc: 'Listado detallado de desviaciones y compromisos del Prestador.' }
    ]
}

type ListaCorreoItem = {
    id: string
    nombre: string
    descripcion?: string | null
    para?: string | null
    cc?: string | null
    sucursalId?: string | null
    porSucursal?: string | null
    sucursal?: { id: string, nombre: string } | null
}

const PANTALLA_META: Record<string, { icon: string, color: string }> = {
    'cambio-rbd-personal': { icon: '🔄', color: 'from-cyan-500 to-sky-600' },
    'ingreso-raciones': { icon: '📊', color: 'from-blue-500 to-indigo-600' },
    'solicitud-pan': { icon: '🍞', color: 'from-amber-500 to-orange-600' },
    'retiro-saldos': { icon: '📦', color: 'from-purple-500 to-violet-600' },
    'solicitud-gas': { icon: '⛽', color: 'from-orange-500 to-amber-600' },
    'solicitud-gas-exceso': { icon: '🚨', color: 'from-red-500 to-rose-600' },
    'form-submission-pdf': { icon: '📑', color: 'from-emerald-500 to-teal-600' },
    'RETORNO_PRODUCTOS': { icon: '⚠️', color: 'from-rose-500 to-pink-600' },
    'matriz-prestador': { icon: '🛡️', color: 'from-indigo-500 to-blue-600' },
    'calidad-transporte-higiene': { icon: '🚛', color: 'from-teal-500 to-cyan-600' },
    'calidad-higiene-personal': { icon: '🧼', color: 'from-sky-500 to-cyan-600' },
}

export default function NotificacionesClient({ 
    configuraciones, 
    listasCorreo,
    plantillas
}: { 
    configuraciones: any[]
    listasCorreo: ListaCorreoItem[]
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
    const [showConditionalHelp, setShowConditionalHelp] = useState(false)
    const [searchHelp, setSearchHelp] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [filterTab, setFilterTab] = useState<'all' | 'active' | 'withRules'>('all')

    const getScreenKeywords = (pantallaId: string) => {
        const pantalla = PANTALLAS.find(p => p.id === pantallaId)
        if (!pantalla) return []
        return HELP_KEYWORDS[pantalla.name] || []
    }

    const handleSave = async (codigoPantalla: string, listas: any[], activa: boolean) => {
        setLoading(prev => ({ ...prev, [codigoPantalla]: true }))
        try {
            const result = await saveScreenNotification(codigoPantalla, listas, activa)
            if (result.success) {
                alert('Configuración y reglas guardadas correctamente.')
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

    // Estadísticas y filtrado
    const activeScreensCount = PANTALLAS.filter(p => {
        const cfgs = configuraciones.filter(c => c.codigoPantalla === p.id)
        return cfgs.length > 0 && cfgs[0].activa
    }).length

    const rulesScreensCount = PANTALLAS.filter(p => {
        const cfgs = configuraciones.filter(c => c.codigoPantalla === p.id)
        return cfgs.some(c => c.condicionOperador && c.condicionOperador !== 'ALWAYS')
    }).length

    const filteredPantallas = PANTALLAS.filter(p => {
        const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             p.description.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matchesQuery) return false

        const cfgs = configuraciones.filter(c => c.codigoPantalla === p.id)
        const isActiva = cfgs.length > 0 && cfgs[0].activa
        const hasRules = cfgs.some(c => c.condicionOperador && c.condicionOperador !== 'ALWAYS')

        if (filterTab === 'active') return isActiva
        if (filterTab === 'withRules') return hasRules
        return true
    })

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* CABECERA SUPERIOR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                <div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                        <span>✉️</span> Notificaciones por Pantalla y Módulos
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Asocia listas de distribución a cada evento del sistema y personaliza reglas condicionales dinámicas con amplitud y comodidad.
                    </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                    <button 
                        onClick={() => setShowConditionalHelp(true)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-2 hover:scale-102 active:scale-98"
                        title="Aprende cómo configurar listas de correo condicionales por etiqueta"
                    >
                        <span>💡</span>
                        <span>Guía de Notificaciones Condicionales</span>
                    </button>
                    <button 
                        onClick={() => setShowHelp(true)}
                        className="w-10 h-10 bg-cyan-50 text-cyan-700 rounded-2xl flex items-center justify-center font-black text-base hover:bg-cyan-100 transition-all border border-cyan-200 shrink-0"
                        title="Ver catálogo de palabras reservadas"
                    >
                        ?
                    </button>
                </div>
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTRADO */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
                <div className="flex-1 relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar pantalla o módulo (ej: Cambio de RBD, Raciones, Gas, Pan, Transporte)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
                    <button
                        onClick={() => setFilterTab('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            filterTab === 'all'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                        Todos ({PANTALLAS.length})
                    </button>
                    <button
                        onClick={() => setFilterTab('active')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            filterTab === 'active'
                                ? 'bg-cyan-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                        Activos ({activeScreensCount})
                    </button>
                    <button
                        onClick={() => setFilterTab('withRules')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            filterTab === 'withRules'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                        Con Reglas ({rulesScreensCount})
                    </button>
                </div>
            </div>

            {/* LISTADO DE MÓDULOS EN TARJETAS AMPLIAS */}
            {filteredPantallas.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                    <div className="text-4xl">🔍</div>
                    <h3 className="text-base font-bold text-slate-700">No se encontraron pantallas con los filtros aplicados</h3>
                    <p className="text-xs text-slate-400">Intenta buscar con otros términos o restablece los filtros.</p>
                    <button
                        onClick={() => { setSearchQuery(''); setFilterTab('all'); }}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"
                    >
                        Restablecer Filtros
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredPantallas.map(pantalla => {
                        const configPantalla = configuraciones.filter(c => c.codigoPantalla === pantalla.id)
                        const defaultActiva = configPantalla.length > 0 ? configPantalla[0].activa : true

                        return (
                            <ConfigRow 
                                key={pantalla.id}
                                pantalla={pantalla}
                                listasCorreo={listasCorreo}
                                configPantalla={configPantalla}
                                defaultActiva={defaultActiva}
                                onSave={handleSave}
                                isSaving={loading[pantalla.id] || false}
                                onEditTemplate={() => openTemplateModal(pantalla.id)}
                                keywords={getScreenKeywords(pantalla.id)}
                            />
                        )
                    })}
                </div>
            )}

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
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-black font-black"
                                            value={templateModal.asunto}
                                            onChange={(e) => setTemplateModal({...templateModal, asunto: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cuerpo (Mensaje)</label>
                                        <textarea 
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none h-48 font-mono text-sm bg-white text-black font-black"
                                            value={templateModal.cuerpo}
                                            onChange={(e) => setTemplateModal({...templateModal, cuerpo: e.target.value})}
                                        />
                                    </div>

                                    {templateModal && getScreenKeywords(templateModal.pantallaId).length > 0 && (
                                        <div className="bg-cyan-50/70 border border-cyan-100 rounded-xl p-3.5 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
                                                    <span>🏷️</span> Palabras reservadas disponibles (clic para insertar):
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowHelp(true)}
                                                    className="text-[11px] text-cyan-700 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    📖 Ver Guía Completa
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getScreenKeywords(templateModal.pantallaId).map(kw => (
                                                    <button
                                                        key={kw.tag}
                                                        type="button"
                                                        onClick={() => {
                                                            setTemplateModal(prev => prev ? {
                                                                ...prev,
                                                                cuerpo: prev.cuerpo ? `${prev.cuerpo} ${kw.tag}` : kw.tag
                                                            } : null)
                                                        }}
                                                        className="px-2.5 py-1 bg-white hover:bg-cyan-600 hover:text-white border border-cyan-200 text-cyan-800 font-mono text-xs font-bold rounded-lg shadow-sm transition-all"
                                                        title={`${kw.desc} (Clic para insertar en el cuerpo)`}
                                                    >
                                                        {kw.tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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

                        <div className="px-8 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                            <span className="text-gray-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar palabra reservada (ej: <Fecha>, <TotalVehiculos>, <Desviaciones>) o por módulo..."
                                value={searchHelp}
                                onChange={(e) => setSearchHelp(e.target.value)}
                                className="w-full text-sm outline-none bg-transparent placeholder-gray-400 text-gray-800 font-medium"
                            />
                            {searchHelp && (
                                <button onClick={() => setSearchHelp('')} className="text-xs text-gray-400 hover:text-gray-600 font-bold">✕ Limpiar</button>
                            )}
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {Object.entries(HELP_KEYWORDS)
                                    .filter(([module, keywords]) => {
                                        if (!searchHelp.trim()) return true
                                        const q = searchHelp.toLowerCase()
                                        const inModule = module.toLowerCase().includes(q)
                                        const inKeywords = keywords.some(k => k.tag.toLowerCase().includes(q) || k.desc.toLowerCase().includes(q))
                                        return inModule || inKeywords
                                    })
                                    .map(([module, keywords]) => {
                                        const filteredKws = !searchHelp.trim()
                                            ? keywords
                                            : keywords.filter(k => 
                                                module.toLowerCase().includes(searchHelp.toLowerCase()) ||
                                                k.tag.toLowerCase().includes(searchHelp.toLowerCase()) || 
                                                k.desc.toLowerCase().includes(searchHelp.toLowerCase())
                                            )
                                        if (filteredKws.length === 0) return null
                                        return (
                                            <div key={module} className="space-y-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 bg-cyan-50 w-fit px-3 py-1 rounded-full">{module}</h4>
                                                <div className="space-y-2">
                                                    {filteredKws.map(kw => (
                                                        <div key={kw.tag} className="flex flex-col p-3 bg-gray-50 border border-gray-100 rounded-2xl group hover:bg-white hover:border-cyan-200 hover:shadow-md transition-all">
                                                            <code className="text-sm font-bold text-cyan-700 group-hover:scale-105 transition-transform origin-left">{kw.tag}</code>
                                                            <span className="text-xs text-gray-500 mt-1">{kw.desc}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-center">
                            <button onClick={() => setShowHelp(false)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Entendido</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GUÍA DE REGLAS CONDICIONALES UNIVERSALES */}
            {showConditionalHelp && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
                        {/* CABECERA */}
                        <div className="p-6 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-bold rounded-full uppercase tracking-wider border border-cyan-500/30">
                                        Motor Universal • Hendaya
                                    </span>
                                </div>
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <span>💡</span> Guía de Notificaciones Condicionales
                                </h3>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Aprende cómo filtrar y enviar correos automáticamente a diferentes listas según lo que ocurra en cualquier pantalla.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowConditionalHelp(false)} 
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 text-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* CUERPO DE LA GUÍA */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs">
                            {/* 1. QUÉ ES */}
                            <div className="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-4 space-y-1.5">
                                <h4 className="font-bold text-sm text-cyan-950 flex items-center gap-1.5">
                                    <span>🎯</span> ¿Para qué sirven las Notificaciones Condicionales?
                                </h4>
                                <p className="leading-relaxed text-slate-600">
                                    Permiten que un mismo evento o módulo despache correos a <b>distintos destinatarios</b> en función de las opciones que seleccione el usuario (por ejemplo: si es traslado definitivo o comisión temporal, si es Copiapó o Santiago, o si es alta prioridad).
                                </p>
                            </div>

                            {/* 2. CASO PRÁCTICO EN CAMBIO DE RBD */}
                            <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                        <span>🔄</span> Ejemplo Real: Módulo "Cambio de RBD"
                                    </h4>
                                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                                        cambio-rbd-personal
                                    </span>
                                </div>

                                <p className="text-slate-600 leading-relaxed">
                                    En este módulo existen 2 tipos de movimientos: <b>Comisión de servicio</b> y <b>Anexos de traslado</b>.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                                        <span className="font-bold text-amber-900 block text-xs">Para Comisión de Servicio:</span>
                                        <p className="text-[11px] text-amber-800">
                                            Asocia la lista que incluye a los <b>Usuarios A y B</b> y define la regla:
                                        </p>
                                        <div className="font-mono text-[11px] bg-white p-1.5 rounded border border-amber-200 text-amber-900 font-bold">
                                            &lt;TipoCambio&gt; = COMISION_SERVICIO
                                        </div>
                                    </div>

                                    <div className="p-3 bg-cyan-50/80 border border-cyan-200 rounded-xl space-y-1">
                                        <span className="font-bold text-cyan-900 block text-xs">Para Anexos de Traslado:</span>
                                        <p className="text-[11px] text-cyan-800">
                                            Asocia la lista que incluye solo al <b>Usuario B</b> y define la regla:
                                        </p>
                                        <div className="font-mono text-[11px] bg-white p-1.5 rounded border border-cyan-200 text-cyan-900 font-bold">
                                            &lt;TipoCambio&gt; = ANEXO_TRASLADO
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. APLICACIÓN EN MÓDULOS FUTUROS */}
                            <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-3">
                                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                    <span>🚀</span> ¿Cómo usarlo en cualquier Módulo Nuevo del Futuro?
                                </h4>
                                <p className="text-slate-600 leading-relaxed">
                                    El motor es <b>100% universal</b>. Cualquier etiqueta que el módulo nuevo genere puede ser utilizada como criterio de filtrado sin necesidad de reprogramar:
                                </p>

                                <div className="space-y-2">
                                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-slate-800 block text-[11px]">Módulo de Permisos / Licencias</span>
                                            <span className="text-[10px] text-slate-500">Filtrar para avisar a RRHH solo cuando sea médica</span>
                                        </div>
                                        <code className="text-[11px] font-bold text-cyan-700 bg-white px-2 py-1 rounded border border-slate-200">
                                            &lt;TipoLicencia&gt; = MEDICA
                                        </code>
                                    </div>

                                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-slate-800 block text-[11px]">Módulo de Calidad o Incidentes</span>
                                            <span className="text-[10px] text-slate-500">Filtrar para avisar a Gerencia solo en alertas graves</span>
                                        </div>
                                        <code className="text-[11px] font-bold text-cyan-700 bg-white px-2 py-1 rounded border border-slate-200">
                                            &lt;Criticidad&gt; = ALTA
                                        </code>
                                    </div>

                                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-slate-800 block text-[11px]">Módulo por Sucursales</span>
                                            <span className="text-[10px] text-slate-500">Filtrar destinatarios de la bodega de Copiapó</span>
                                        </div>
                                        <code className="text-[11px] font-bold text-cyan-700 bg-white px-2 py-1 rounded border border-slate-200">
                                            &lt;Sucursal&gt; = CD COPIAPO
                                        </code>
                                    </div>
                                </div>
                            </div>

                            {/* 4. TABLA DE OPERADORES */}
                            <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-2">
                                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                    <span>⚙️</span> Operadores de Condición Disponibles
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                        <b className="text-slate-800 block">Enviar Siempre:</b>
                                        <span className="text-slate-500">Comportamiento habitual sin filtro.</span>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                        <b className="text-slate-800 block">Igual a (=):</b>
                                        <span className="text-slate-500">Coincidencia exacta del valor.</span>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                        <b className="text-slate-800 block">Contiene texto:</b>
                                        <span className="text-slate-500">Si contiene parte de la palabra.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PIE */}
                        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-medium">
                                Los cambios surten efecto de inmediato al pulsar "Guardar" en cada pantalla.
                            </span>
                            <button 
                                onClick={() => setShowConditionalHelp(false)} 
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-md"
                            >
                                Entendido
                            </button>
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
    configPantalla, 
    defaultActiva, 
    onSave, 
    isSaving,
    onEditTemplate,
    keywords
}: {
    pantalla: PantallaInfo
    listasCorreo: ListaCorreoItem[]
    configPantalla: any[]
    defaultActiva: boolean
    onSave: (id: string, listas: any[], activa: boolean) => void
    isSaving: boolean
    onEditTemplate: () => void
    keywords: { tag: string, desc: string }[]
}) {
    // Mapa de configuración por cada lista disponible
    const [listasState, setListasState] = useState<Record<string, {
        selected: boolean
        condicionTag: string
        condicionOperador: string
        condicionValor: string
    }>>(() => {
        const map: Record<string, any> = {}
        listasCorreo.forEach(l => {
            const existing = configPantalla.find(c => c.listaCorreoId === l.id)
            map[l.id] = {
                selected: !!existing,
                condicionTag: existing?.condicionTag || '',
                condicionOperador: existing?.condicionOperador || 'ALWAYS',
                condicionValor: existing?.condicionValor || ''
            }
        })
        return map
    })

    const [editingListId, setEditingListId] = useState<string | null>(null)
    const [activa, setActiva] = useState(defaultActiva)

    const handleToggleLista = (id: string) => {
        setListasState(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                selected: !prev[id]?.selected
            }
        }))
    }

    const handleUpdateRule = (id: string, updates: Partial<{ condicionTag: string, condicionOperador: string, condicionValor: string }>) => {
        setListasState(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                ...updates
            }
        }))
    }

    const handleSaveClick = () => {
        const payload = Object.entries(listasState)
            .filter(([_, cfg]) => cfg.selected)
            .map(([listaCorreoId, cfg]) => ({
                listaCorreoId,
                condicionTag: cfg.condicionTag.trim() || null,
                condicionOperador: cfg.condicionOperador || 'ALWAYS',
                condicionValor: cfg.condicionValor.trim() || null
            }))

        onSave(pantalla.id, payload, activa)
    }

    const selectedCount = Object.values(listasState).filter(c => c.selected).length
    const rulesCount = Object.values(listasState).filter(c => c.selected && c.condicionOperador !== 'ALWAYS' && c.condicionTag && c.condicionValor).length

    const meta = PANTALLA_META[pantalla.id] || { icon: '📧', color: 'from-slate-600 to-slate-800' }

    const countEmails = (str?: string | null) => {
        if (!str) return 0
        return str.split(',').map(s => s.trim()).filter(Boolean).length
    }

    const getOperatorLabel = (op: string) => {
        switch (op) {
            case 'EQUALS': return '='
            case 'CONTAINS': return 'contiene'
            case 'NOT_EQUALS': return '≠'
            default: return 'siempre'
        }
    }

    return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300">
            {/* CABECERA DE LA TARJETA DEL MÓDULO */}
            <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-2xl shadow-md text-white shrink-0`}>
                        {meta.icon}
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                {pantalla.name}
                            </h3>
                            {activa && selectedCount > 0 ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                    Activo
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                    Pausado
                                </span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                                {selectedCount} {selectedCount === 1 ? 'lista vinculada' : 'listas vinculadas'}
                            </span>
                            {rulesCount > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                    <span>⚙️</span> {rulesCount} {rulesCount === 1 ? 'con regla' : 'con reglas'}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                            {pantalla.description}
                        </p>
                    </div>
                </div>

                {/* ACCIONES DE CABECERA */}
                <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-auto shrink-0">
                    <button 
                        type="button" 
                        onClick={onEditTemplate} 
                        className="px-3.5 py-2 bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 rounded-xl border border-slate-200 hover:border-cyan-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                        <span>✏️</span> Editar Formato Plantilla
                    </button>

                    <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => setActiva(!activa)}
                            disabled={selectedCount === 0}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activa && selectedCount > 0 ? 'bg-cyan-500' : 'bg-gray-300'} ${selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={selectedCount === 0 ? 'Selecciona al menos una lista para activar' : (activa ? 'Pausar avisos' : 'Activar avisos')}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activa && selectedCount > 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-700 select-none">
                            {selectedCount === 0 ? 'Sin listas' : (activa ? 'Avisos Activos' : 'Pausado')}
                        </span>
                    </div>

                    <button
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-cyan-900 hover:to-slate-900 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 text-xs hover:scale-102 active:scale-98"
                    >
                        {isSaving ? (
                            <span className="animate-spin text-sm">↻</span>
                        ) : (
                            <span className="text-sm">💾</span>
                        )}
                        <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                </div>
            </div>

            {/* SECCIÓN AMPLIA DE LISTAS DE DISTRIBUCIÓN */}
            <div className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span>📋</span> Listas de Distribución Disponibles ({selectedCount} de {listasCorreo.length} activadas):
                    </span>
                    <span className="text-slate-400 text-[11px]">
                        Haz clic en una lista para marcarla o desmarcarla. Puedes añadir condiciones a cada una.
                    </span>
                </div>

                {listasCorreo.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-500 text-xs">
                        No hay listas de correo configuradas en el sistema. Puedes crearlas en el menú lateral en "Listas de Distribución".
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {listasCorreo.map(lista => {
                            const cfg = listasState[lista.id] || { selected: false, condicionTag: '', condicionOperador: 'ALWAYS', condicionValor: '' }
                            const hasCondition = cfg.condicionOperador !== 'ALWAYS' && cfg.condicionTag && cfg.condicionValor
                            const isEditingThis = editingListId === lista.id

                            return (
                                <div 
                                    key={lista.id} 
                                    className={`rounded-2xl border transition-all p-4 flex flex-col justify-between gap-3 ${
                                        cfg.selected 
                                            ? 'bg-gradient-to-br from-cyan-50/40 via-white to-sky-50/30 border-cyan-400 shadow-sm ring-1 ring-cyan-200/50' 
                                            : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300 hover:bg-white text-slate-500'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-start gap-3">
                                            <label className="flex items-start gap-3 cursor-pointer select-none group flex-1">
                                                <input 
                                                    type="checkbox" 
                                                    className="hidden"
                                                    checked={cfg.selected}
                                                    onChange={() => handleToggleLista(lista.id)}
                                                />
                                                <span className={`w-5 h-5 mt-0.5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                                                    cfg.selected 
                                                        ? 'bg-cyan-500 border-cyan-500 text-white shadow-xs' 
                                                        : 'bg-white border-slate-300 group-hover:border-cyan-400'
                                                }`}>
                                                    {cfg.selected && (
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm leading-snug break-words ${cfg.selected ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>
                                                        {lista.nombre}
                                                    </div>
                                                    {lista.descripcion && (
                                                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                                            {lista.descripcion}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                        </div>

                                        {/* Sucursal y cantidad de destinatarios */}
                                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 ml-8">
                                            {(() => {
                                                let zonesCount = 0
                                                try {
                                                    if (lista.porSucursal) {
                                                        const p = typeof lista.porSucursal === 'string' ? JSON.parse(lista.porSucursal) : lista.porSucursal
                                                        zonesCount = Object.keys(p || {}).length
                                                    }
                                                } catch {}
                                                if (zonesCount > 0) {
                                                    return (
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold">
                                                            🏢 Multi-Sucursal ({zonesCount} zonas)
                                                        </span>
                                                    )
                                                }
                                                return null
                                            })()}
                                            {lista.sucursal?.nombre && (
                                                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 rounded-md text-[10px] font-bold">
                                                    📍 {lista.sucursal.nombre}
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-medium">
                                                ✉️ {countEmails(lista.para)} PARA {lista.cc ? `• ${countEmails(lista.cc)} CC` : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ZONA DE CONDICIÓN SI ESTÁ MARCADA */}
                                    {cfg.selected && (
                                        <div className="pt-2.5 border-t border-slate-100 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                {hasCondition ? (
                                                    <div className="flex-1 min-w-0">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-100 text-cyan-950 border border-cyan-300 rounded-xl text-[11px] font-mono font-bold max-w-full truncate" title={`Regla: Si <${cfg.condicionTag}> ${getOperatorLabel(cfg.condicionOperador)} "${cfg.condicionValor}"`}>
                                                            <span>⚙️</span> Si &lt;{cfg.condicionTag}&gt; {getOperatorLabel(cfg.condicionOperador)} "{cfg.condicionValor}"
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                                        <span>🟢</span> Siempre (Sin filtro)
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => setEditingListId(isEditingThis ? null : lista.id)}
                                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shrink-0 ${
                                                        isEditingThis 
                                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                                                            : hasCondition
                                                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100'
                                                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {isEditingThis ? 'Cerrar' : (hasCondition ? '✏️ Modificar' : '➕ Condición')}
                                                </button>
                                            </div>

                                            {/* DRAWER AMPLIO DE CONFIGURACIÓN */}
                                            {isEditingThis && (
                                                <div className="p-3.5 bg-white border-2 border-cyan-400 rounded-2xl shadow-lg space-y-3 animate-in fade-in zoom-in-95 duration-150">
                                                    <div className="flex items-center justify-between border-b border-cyan-100 pb-2">
                                                        <span className="text-xs font-black text-cyan-950 flex items-center gap-1">
                                                            <span>⚙️</span> Regla de Envío para: <span className="text-cyan-700 font-bold">"{lista.nombre}"</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingListId(null)}
                                                            className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        {/* CAMPO 1: TAG */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <label className="text-[11px] font-bold text-slate-700">
                                                                    1. Etiqueta / Campo dinámico:
                                                                </label>
                                                                <span className="text-[10px] text-cyan-700 font-medium">Ej: &lt;TipoCambio&gt;</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                list={`tags-${pantalla.id}`}
                                                                placeholder="Escribe o selecciona etiqueta (ej: TipoCambio)"
                                                                value={cfg.condicionTag}
                                                                onChange={(e) => handleUpdateRule(lista.id, { condicionTag: e.target.value.replace(/[<>]/g, '') })}
                                                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-slate-50/50 font-mono text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                                            />
                                                            <datalist id={`tags-${pantalla.id}`}>
                                                                {keywords.map(kw => (
                                                                    <option key={kw.tag} value={kw.tag.replace(/[<>]/g, '')}>{kw.desc}</option>
                                                                ))}
                                                            </datalist>

                                                            {/* TAGS RÁPIDOS SUGERIDOS */}
                                                            {keywords.length > 0 && (
                                                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                                                    <span className="text-[10px] text-slate-400 font-bold">Sugeridos:</span>
                                                                    {keywords.slice(0, 5).map(kw => {
                                                                        const raw = kw.tag.replace(/[<>]/g, '')
                                                                        return (
                                                                            <button
                                                                                key={kw.tag}
                                                                                type="button"
                                                                                onClick={() => handleUpdateRule(lista.id, { condicionTag: raw })}
                                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                                                                                    cfg.condicionTag.toLowerCase() === raw.toLowerCase()
                                                                                        ? 'bg-cyan-600 text-white border-cyan-600'
                                                                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-cyan-50 hover:text-cyan-800'
                                                                                }`}
                                                                            >
                                                                                {kw.tag}
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* CAMPO 2: OPERADOR */}
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                                2. Condición lógica (Operador):
                                                            </label>
                                                            <select
                                                                value={cfg.condicionOperador}
                                                                onChange={(e) => handleUpdateRule(lista.id, { condicionOperador: e.target.value })}
                                                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-slate-50/50 font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                                            >
                                                                <option value="ALWAYS">🟢 Enviar Siempre (Sin filtro condicional)</option>
                                                                <option value="EQUALS">Igual exactamente a (=)</option>
                                                                <option value="CONTAINS">Contiene el texto indicado</option>
                                                                <option value="NOT_EQUALS">Diferente de (≠)</option>
                                                            </select>
                                                        </div>

                                                        {/* CAMPO 3: VALOR */}
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                                3. Valor que debe cumplir:
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Ej: Comisión de Servicio, Anexos de Traslado..."
                                                                value={cfg.condicionValor}
                                                                onChange={(e) => handleUpdateRule(lista.id, { condicionValor: e.target.value })}
                                                                disabled={cfg.condicionOperador === 'ALWAYS'}
                                                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-slate-50/50 font-bold text-slate-900 disabled:opacity-40 disabled:bg-slate-100 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                                                            />

                                                            {/* ATAJOS RÁPIDOS PARA CAMBIO DE RBD */}
                                                            {pantalla.id === 'cambio-rbd-personal' && cfg.condicionOperador !== 'ALWAYS' && (
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                    <span className="text-[10px] text-slate-400 font-bold">Valores comunes:</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateRule(lista.id, { condicionTag: 'TipoCambio', condicionValor: 'Comisión de Servicio' })}
                                                                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                                                                    >
                                                                        Comisión de Servicio
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateRule(lista.id, { condicionTag: 'TipoCambio', condicionValor: 'Anexos de traslado' })}
                                                                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100"
                                                                    >
                                                                        Anexos de traslado
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* EXPLICACIÓN HUMANA DE LA REGLA */}
                                                    <div className="p-2.5 bg-cyan-50/80 border border-cyan-200 rounded-xl text-[11px] text-cyan-900 leading-snug">
                                                        {cfg.condicionOperador === 'ALWAYS' || !cfg.condicionTag || !cfg.condicionValor ? (
                                                            <span>💡 <b>Envío normal:</b> Esta lista recibirá correos siempre que se ejecute una acción en este módulo.</span>
                                                        ) : (
                                                            <span>
                                                                💡 <b>Regla activa:</b> Esta lista recibirá correo <u>solo cuando</u> el tag <b>&lt;{cfg.condicionTag}&gt;</b> {getOperatorLabel(cfg.condicionOperador)} <b>"{cfg.condicionValor}"</b>.
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* ACCIONES DEL DRAWER */}
                                                    <div className="flex items-center justify-between pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleUpdateRule(lista.id, { condicionTag: '', condicionOperador: 'ALWAYS', condicionValor: '' })
                                                                setEditingListId(null)
                                                            }}
                                                            className="text-[11px] text-red-600 hover:underline font-bold"
                                                        >
                                                            Quitar regla (Enviar siempre)
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingListId(null)}
                                                            className="px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-102"
                                                        >
                                                            ✓ Aplicar Regla
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
