'use client'

import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
    getParametrosLicitacion,
    guardarParametrosLicitacion,
    restablecerParametrosDefecto,
    getHorariosServicio,
    guardarHorariosServicio,
    cargarHorariosSugeridos,
    getEstratosExcluidos,
    guardarEstratoExcluido,
    toggleEstratoExcluido,
    eliminarEstratoExcluido,
    cargarEstratosSugeridos,
    getDotacionManipuladoras,
    guardarDotacionManipuladora,
    importarDotacionMasiva,
    eliminarDotacionManipuladora,
    getMinutaMes,
    guardarMinutaMes,
    sincronizarMinutasDesdeSistema,
    eliminarMinutaMes
} from './actions'
import { getComparacionExtraccionLicitacion } from '@/app/dashboard/areas/multas/calculos/actions'
import { CATALOGO_REGLAS, ReglaCatalogoInfo } from '@/lib/multas/reglas/definiciones'
import {
    ModuloSistemaConfig,
    SubModuloReglasC5,
    SUBMODULOS_C5_DEFAULT,
    SubModuloCatalogosC2,
    SUBMODULOS_C2_DEFAULT,
    SubModuloDatosFolioC3,
    SUBMODULOS_C3_DEFAULT,
    SubModuloExtraccionC4,
    SUBMODULOS_C4_DEFAULT,
    HorarioServicioItem,
    ManipuladoraMesItem,
    MinutaMesItem
} from './types'

interface LicitacionOption {
    licId: number
    licitacionHomologada: string | null
    estado: number | null
}

interface Props {
    licitaciones: LicitacionOption[]
}

export default function ConfiguracionMultasClient({ licitaciones }: Props) {
    const [selectedLicId, setSelectedLicId] = useState<number>(licitaciones[0]?.licId || 0)
    const [activeTab, setActiveTab] = useState<'modulos' | 'horarios' | 'estratos' | 'dotacion' | 'minutas' | 'comparacionC4' | 'catalogoReglasC5' | 'parametros' | 'aql' | 'causas'>('modulos')

    // Estado C5: Calibración de Reglas NC y Parámetros
    const [c5MargenTemp, setC5MargenTemp] = useState<number>(1.0)
    const [c5UmbralDotacion, setC5UmbralDotacion] = useState<number>(50)
    const [c5TolAnticipado, setC5TolAnticipado] = useState<number>(60)
    const [c5TolPesaje, setC5TolPesaje] = useState<number>(10)
    const [c5ReglasHabilitadas, setC5ReglasHabilitadas] = useState<Record<string, boolean>>({})
    const [c5FiltroTexto, setC5FiltroTexto] = useState('')
    const [c5FiltroAspecto, setC5FiltroAspecto] = useState('ALL')
    const [c5FiltroSeveridad, setC5FiltroSeveridad] = useState('ALL')

    // Estado Modo Comparación C4
    const [compMes, setCompMes] = useState('Todos los meses')
    const [compAnho, setCompAnho] = useState(new Date().getFullYear())
    const [loadingComp, setLoadingComp] = useState(false)
    const [compData, setCompData] = useState<any>(null)
    const [compSelectedFolio, setCompSelectedFolio] = useState<any>(null)

    // Estado de parámetros
    const [loading, setLoading] = useState<boolean>(false)
    const [saving, setSaving] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Form data Parámetros
    const [modulos, setModulos] = useState<ModuloSistemaConfig[]>([])
    const [ratioH, setRatioH] = useState<number>(70)
    const [tempRefriMin, setTempRefriMin] = useState<number>(0.0)
    const [tempRefriMax, setTempRefriMax] = useState<number>(5.0)
    const [tempCongelacionMax, setTempCongelacionMax] = useState<number>(-18.0)
    const [tolLeve, setTolLeve] = useState<number>(10.0)
    const [tolMod, setTolMod] = useState<number>(5.0)
    const [tolGrave, setTolGrave] = useState<number>(0.0)
    const [plazoCorreccion, setPlazoCorreccion] = useState<number>(5)
    const [tablaAql, setTablaAql] = useState<any[]>([])
    const [causas, setCausas] = useState<any[]>([])
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)
    const [usuarioModif, setUsuarioModif] = useState<string | null>(null)

    // Form data C2.1 Horarios por Servicio
    const [horarios, setHorarios] = useState<HorarioServicioItem[]>([])
    const [savingHorarios, setSavingHorarios] = useState(false)

    // Form data C2.2 Estratos Excluidos
    const [estratos, setEstratos] = useState<any[]>([])
    const [nuevoEstrato, setNuevoEstrato] = useState('')
    const [descEstrato, setDescEstrato] = useState('')
    const [savingEstrato, setSavingEstrato] = useState(false)

    // Form data C2.3 Dotación Oficial de Manipuladoras
    const [dotacionAnio, setDotacionAnio] = useState<number>(new Date().getFullYear())
    const [dotacionMes, setDotacionMes] = useState<number>(new Date().getMonth() + 1)
    const [dotaciones, setDotaciones] = useState<ManipuladoraMesItem[]>([])
    const [dotacionSearch, setDotacionSearch] = useState('')
    const [loadingDotacion, setLoadingDotacion] = useState(false)
    const [importingDotacion, setImportingDotacion] = useState(false)
    const [showModalDotacion, setShowModalDotacion] = useState(false)
    const [nuevoRbdDotacion, setNuevoRbdDotacion] = useState<number | ''>('')
    const [nuevoTotalDotacion, setNuevoTotalDotacion] = useState<number | ''>('')
    const [nuevoEstablecimientoDotacion, setNuevoEstablecimientoDotacion] = useState('')

    // Form data C2.4 Minutas Planificadas
    const [minutaAnio, setMinutaAnio] = useState<number>(new Date().getFullYear())
    const [minutaMes, setMinutaMes] = useState<number>(new Date().getMonth() + 1)
    const [minutaNivel, setMinutaNivel] = useState<string>('B')
    const [minutaActual, setMinutaActual] = useState<MinutaMesItem | null>(null)
    const [diasMinutaMap, setDiasMinutaMap] = useState<Record<number, Array<{ servicio: string; preparacion: string }>>>({})
    const [loadingMinuta, setLoadingMinuta] = useState(false)
    const [syncingMinuta, setSyncingMinuta] = useState(false)

    // Cargar datos al seleccionar licitación
    useEffect(() => {
        if (!selectedLicId) return
        loadLicitacionConfig(selectedLicId)
        loadHorarios(selectedLicId)
        loadEstratos(selectedLicId)
        loadDotaciones(selectedLicId, dotacionAnio, dotacionMes)
        loadMinuta(selectedLicId, minutaAnio, minutaMes, minutaNivel)
    }, [selectedLicId])

    useEffect(() => {
        if (!selectedLicId) return
        loadDotaciones(selectedLicId, dotacionAnio, dotacionMes)
    }, [selectedLicId, dotacionAnio, dotacionMes])

    useEffect(() => {
        if (!selectedLicId) return
        loadMinuta(selectedLicId, minutaAnio, minutaMes, minutaNivel)
    }, [selectedLicId, minutaAnio, minutaMes, minutaNivel])

    const loadDotaciones = async (licId: number, anio: number, mes: number) => {
        setLoadingDotacion(true)
        try {
            const res = await getDotacionManipuladoras(licId, anio, mes)
            if (res.dotaciones) {
                setDotaciones(res.dotaciones)
            }
        } catch (e) {
            console.error('Error al cargar dotaciones:', e)
        } finally {
            setLoadingDotacion(false)
        }
    }

    const loadMinuta = async (licId: number, anio: number, mes: number, nivel: string) => {
        setLoadingMinuta(true)
        try {
            const res = await getMinutaMes(licId, anio, mes, nivel)
            if (res.minuta) {
                setMinutaActual(res.minuta)
                try {
                    const parsed = JSON.parse(res.minuta.datosJson)
                    setDiasMinutaMap(parsed)
                } catch {
                    setDiasMinutaMap({})
                }
            } else {
                setMinutaActual(null)
                setDiasMinutaMap({})
            }
        } catch (e) {
            console.error('Error al cargar minuta:', e)
        } finally {
            setLoadingMinuta(false)
        }
    }

    const loadLicitacionConfig = async (licId: number) => {
        setLoading(true)
        setError(null)
        try {
            const res = await getParametrosLicitacion(licId)
            if (res.error) {
                setError(res.error)
            } else if (res.parametros) {
                const p = res.parametros
                setModulos(p.modulos || [])
                setRatioH(p.ratioManipuladorasH)
                setTempRefriMin(p.tempRefriMin)
                setTempRefriMax(p.tempRefriMax)
                setTempCongelacionMax(p.tempCongelacionMax)
                setTolLeve(p.toleranciaFLeve)
                setTolMod(p.toleranciaFModerado)
                setTolGrave(p.toleranciaFGrave)
                setPlazoCorreccion(p.plazoCorreccionDias)
                setTablaAql(p.tablaAql || [])
                setCausas(p.causasNoImputables || [])
                const c5Mod = (p.modulos || []).find((m: any) => m.codigo === 'C5')
                if (c5Mod?.parametros) {
                    setC5MargenTemp(c5Mod.parametros.margenTemperaturaMax ?? 1.0)
                    setC5UmbralDotacion(c5Mod.parametros.umbralDotacionInasistenciaPct ?? 50)
                    setC5TolAnticipado(c5Mod.parametros.toleranciaHorarioAnticipadoMin ?? 60)
                    setC5TolPesaje(c5Mod.parametros.toleranciaHorarioPesajeMin ?? 10)
                    setC5ReglasHabilitadas(c5Mod.parametros.reglasHabilitadas ?? {})
                } else {
                    setC5MargenTemp(1.0)
                    setC5UmbralDotacion(50)
                    setC5TolAnticipado(60)
                    setC5TolPesaje(10)
                    setC5ReglasHabilitadas({})
                }
                setLastUpdated(p.updatedAt ? new Date(p.updatedAt).toLocaleString('es-CL') : null)
                setUsuarioModif(p.usuarioModif || null)
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar la configuración de la licitación.')
        } finally {
            setLoading(false)
        }
    }

    const loadHorarios = async (licId: number) => {
        try {
            const res = await getHorariosServicio(licId)
            if (res.horarios) {
                setHorarios(res.horarios)
            }
        } catch (err) {
            console.error('Error cargando horarios:', err)
        }
    }

    const loadEstratos = async (licId: number) => {
        try {
            const res = await getEstratosExcluidos(licId)
            if (res.estratos) {
                setEstratos(res.estratos)
            }
        } catch (err) {
            console.error('Error cargando estratos:', err)
        }
    }

    const handleToggleModulo = (codigo: string) => {
        setModulos(prev =>
            prev.map(m => (m.codigo === codigo ? { ...m, activo: !m.activo } : m))
        )
    }

    const handleToggleSubmoduloC5 = (subKey: keyof SubModuloReglasC5) => {
        setModulos(prev =>
            prev.map(m => {
                if (m.codigo !== 'C5') return m
                const currentSub = m.submodulos || { ...SUBMODULOS_C5_DEFAULT }
                return {
                    ...m,
                    submodulos: {
                        ...currentSub,
                        [subKey]: !currentSub[subKey]
                    }
                }
            })
        )
    }

    const handleToggleSubmoduloC2 = (subKey: keyof SubModuloCatalogosC2) => {
        setModulos(prev =>
            prev.map(m => {
                if (m.codigo !== 'C2') return m
                const currentSub = m.submodulos || { ...SUBMODULOS_C2_DEFAULT }
                return {
                    ...m,
                    submodulos: {
                        ...currentSub,
                        [subKey]: !currentSub[subKey]
                    }
                }
            })
        )
    }

    const handleToggleSubmoduloC3 = (subKey: keyof SubModuloDatosFolioC3) => {
        setModulos(prev =>
            prev.map(m => {
                if (m.codigo !== 'C3') return m
                const currentSub = m.submodulos || { ...SUBMODULOS_C3_DEFAULT }
                return {
                    ...m,
                    submodulos: {
                        ...currentSub,
                        [subKey]: !currentSub[subKey]
                    }
                }
            })
        )
    }

    const handleToggleSubmoduloC4 = (subKey: keyof SubModuloExtraccionC4) => {
        setModulos(prev =>
            prev.map(m => {
                if (m.codigo !== 'C4') return m
                const currentSub = m.submodulos || { ...SUBMODULOS_C4_DEFAULT }
                return {
                    ...m,
                    submodulos: {
                        ...currentSub,
                        [subKey]: !currentSub[subKey]
                    }
                }
            })
        )
    }

    const handleEjecutarComparacion = async () => {
        if (!selectedLicId) return
        setLoadingComp(true)
        setError(null)
        setCompSelectedFolio(null)
        try {
            const res = await getComparacionExtraccionLicitacion({
                licId: selectedLicId,
                mes: compMes,
                anho: compAnho,
                limit: 50
            })
            if (res.error) {
                setError(res.error)
            } else {
                setCompData(res)
            }
        } catch (e: any) {
            setError(e.message || 'Error al ejecutar comparación.')
        } finally {
            setLoadingComp(false)
        }
    }

    const handleSave = async () => {
        if (!selectedLicId) return
        setSaving(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const modulosConC5 = modulos.map(m => {
                if (m.codigo === 'C5') {
                    return {
                        ...m,
                        parametros: {
                            margenTemperaturaMax: Number(c5MargenTemp),
                            umbralDotacionInasistenciaPct: Number(c5UmbralDotacion),
                            toleranciaHorarioAnticipadoMin: Number(c5TolAnticipado),
                            toleranciaHorarioPesajeMin: Number(c5TolPesaje),
                            reglasHabilitadas: c5ReglasHabilitadas
                        }
                    }
                }
                return m
            })

            const res = await guardarParametrosLicitacion({
                licId: selectedLicId,
                modulos: modulosConC5,
                ratioManipuladorasH: Number(ratioH),
                tempRefriMin: Number(tempRefriMin),
                tempRefriMax: Number(tempRefriMax),
                tempCongelacionMax: Number(tempCongelacionMax),
                toleranciaFLeve: Number(tolLeve),
                toleranciaFModerado: Number(tolMod),
                toleranciaFGrave: Number(tolGrave),
                plazoCorreccionDias: Number(plazoCorreccion),
                tablaAql,
                causasNoImputables: causas
            })
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('¡Configuración guardada exitosamente y sincronizada con el motor de multas!')
                loadLicitacionConfig(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al guardar la configuración.')
        } finally {
            setSaving(false)
        }
    }

    const handleReset = async () => {
        if (!selectedLicId) return
        if (!confirm('¿Estás seguro de restablecer todos los parámetros a los valores por defecto oficiales de la IT?')) {
            return
        }
        setSaving(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await restablecerParametrosDefecto(selectedLicId)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('Parámetros restablecidos a los valores por defecto.')
                loadLicitacionConfig(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al restablecer configuración.')
        } finally {
            setSaving(false)
        }
    }

    // Handlers C2.1 Horarios
    const handleUpdateHorario = (index: number, field: keyof HorarioServicioItem, val: any) => {
        const next = [...horarios]
        next[index] = { ...next[index], [field]: val }
        setHorarios(next)
    }

    const handleSaveHorarios = async () => {
        if (!selectedLicId) return
        setSavingHorarios(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await guardarHorariosServicio(selectedLicId, horarios)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('¡Horarios por servicio guardados exitosamente!')
                loadHorarios(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al guardar horarios.')
        } finally {
            setSavingHorarios(false)
        }
    }

    const handleCargarHorariosSugeridos = async () => {
        if (!selectedLicId) return
        setSavingHorarios(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await cargarHorariosSugeridos(selectedLicId)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('¡Horarios sugeridos oficiales cargados exitosamente!')
                loadHorarios(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar horarios sugeridos.')
        } finally {
            setSavingHorarios(false)
        }
    }

    // Handlers C2.2 Estratos
    const handleAddEstrato = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedLicId || !nuevoEstrato.trim()) return
        setSavingEstrato(true)
        setError(null)
        try {
            const res = await guardarEstratoExcluido(selectedLicId, nuevoEstrato, descEstrato)
            if (res.error) {
                setError(res.error)
            } else {
                setNuevoEstrato('')
                setDescEstrato('')
                setSuccessMessage(`Estrato ${nuevoEstrato} agregado exitosamente.`)
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al agregar estrato.')
        } finally {
            setSavingEstrato(false)
        }
    }

    // Handlers C2.3 Dotación Oficial de Manipuladoras
    const handleFileUploadDotacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedLicId) return
        setImportingDotacion(true)
        setError(null)
        setSuccessMessage(null)

        try {
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const rawData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 })

            if (!rawData || rawData.length < 2) {
                setError('El archivo Excel no contiene filas de datos.')
                setImportingDotacion(false)
                return
            }

            const headers = (rawData[0] as any[]).map(h => String(h || '').trim().toUpperCase())
            const rbdIdx = headers.findIndex(h => h.includes('RBD'))
            const totalIdx = headers.findIndex(h => h.includes('TOTAL') || h.includes('MANIPULADORA') || h.includes('DOTACION') || h.includes('CANTIDAD'))
            const estabIdx = headers.findIndex(h => h.includes('ESTABLECIMIENTO') || h.includes('COLEGIO') || h.includes('NOMBRE'))

            if (rbdIdx === -1 || totalIdx === -1) {
                setError('El archivo debe tener al menos una columna con "RBD" y una columna con "TOTAL" o "MANIPULADORAS".')
                setImportingDotacion(false)
                return
            }

            const filas: Array<{ rbd: number; total: number; establecimiento?: string }> = []
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i] as any[]
                if (!row || row.length === 0) continue
                const rbd = parseInt(row[rbdIdx], 10)
                const total = parseInt(row[totalIdx], 10)
                const establecimiento = estabIdx !== -1 ? String(row[estabIdx] || '').trim() : undefined
                if (!isNaN(rbd) && rbd > 0 && !isNaN(total)) {
                    filas.push({ rbd, total, establecimiento })
                }
            }

            if (filas.length === 0) {
                setError('No se encontraron filas con datos válidos en el archivo.')
                setImportingDotacion(false)
                return
            }

            const res = await importarDotacionMasiva(selectedLicId, dotacionAnio, dotacionMes, filas, file.name)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(`Se importaron ${res.count} dotaciones oficiales exitosamente para ${dotacionMes}/${dotacionAnio}.`)
                await loadDotaciones(selectedLicId, dotacionAnio, dotacionMes)
            }
        } catch (err: any) {
            console.error('Error al procesar archivo Excel:', err)
            setError(err.message || 'Error al procesar archivo Excel.')
        } finally {
            setImportingDotacion(false)
            if (e.target) e.target.value = ''
        }
    }

    const handleSaveSingleDotacion = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedLicId || !nuevoRbdDotacion || nuevoTotalDotacion === '') return
        setLoadingDotacion(true)
        setError(null)
        try {
            const res = await guardarDotacionManipuladora({
                licId: selectedLicId,
                anio: dotacionAnio,
                mes: dotacionMes,
                rbd: Number(nuevoRbdDotacion),
                total: Number(nuevoTotalDotacion),
                establecimiento: nuevoEstablecimientoDotacion.trim() || undefined
            })
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(`Dotación para RBD ${nuevoRbdDotacion} guardada exitosamente.`)
                setShowModalDotacion(false)
                setNuevoRbdDotacion('')
                setNuevoTotalDotacion('')
                setNuevoEstablecimientoDotacion('')
                await loadDotaciones(selectedLicId, dotacionAnio, dotacionMes)
            }
        } catch (err: any) {
            setError(err.message || 'Error al guardar dotación.')
        } finally {
            setLoadingDotacion(false)
        }
    }

    const handleDeleteDotacion = async (id: string, rbd: number) => {
        if (!confirm(`¿Estás seguro de eliminar la dotación oficial del RBD ${rbd}?`)) return
        try {
            const res = await eliminarDotacionManipuladora(id)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(`Dotación de RBD ${rbd} eliminada.`)
                await loadDotaciones(selectedLicId, dotacionAnio, dotacionMes)
            }
        } catch (err: any) {
            setError(err.message || 'Error al eliminar dotación.')
        }
    }

    // Handlers C2.4 Minutas Planificadas
    const handleSyncMinutas = async () => {
        if (!selectedLicId) return
        setSyncingMinuta(true)
        setError(null)
        setSuccessMessage(null)
        try {
            const res = await sincronizarMinutasDesdeSistema(selectedLicId, minutaAnio, minutaMes)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(res.message || 'Minutas sincronizadas exitosamente desde el sistema.')
                await loadMinuta(selectedLicId, minutaAnio, minutaMes, minutaNivel)
            }
        } catch (err: any) {
            setError(err.message || 'Error al sincronizar minutas.')
        } finally {
            setSyncingMinuta(false)
        }
    }

    const handleDeleteMinuta = async () => {
        if (!minutaActual?.id) return
        if (!confirm(`¿Estás seguro de eliminar la minuta planificada de nivel ${minutaNivel} para ${minutaMes}/${minutaAnio}?`)) return
        setLoadingMinuta(true)
        try {
            const res = await eliminarMinutaMes(minutaActual.id)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(`Minuta de nivel ${minutaNivel} eliminada.`)
                await loadMinuta(selectedLicId, minutaAnio, minutaMes, minutaNivel)
            }
        } catch (err: any) {
            setError(err.message || 'Error al eliminar minuta.')
        } finally {
            setLoadingMinuta(false)
        }
    }

    const handleToggleEstrato = async (id: string, activoActual: boolean) => {
        try {
            const res = await toggleEstratoExcluido(id, !activoActual)
            if (res.error) {
                setError(res.error)
            } else {
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al modificar estrato.')
        }
    }

    const handleDeleteEstrato = async (id: string, estrato: string) => {
        if (!confirm(`¿Estás seguro de eliminar el estrato ${estrato}?`)) return
        try {
            const res = await eliminarEstratoExcluido(id)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage(`Estrato ${estrato} eliminado.`)
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al eliminar estrato.')
        }
    }

    const handleCargarEstratosSugeridos = async () => {
        if (!selectedLicId) return
        setSavingEstrato(true)
        setError(null)
        try {
            const res = await cargarEstratosSugeridos(selectedLicId)
            if (res.error) {
                setError(res.error)
            } else {
                setSuccessMessage('Estratos sugeridos (206, 208, 209) cargados exitosamente.')
                loadEstratos(selectedLicId)
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar estratos sugeridos.')
        } finally {
            setSavingEstrato(false)
        }
    }

    // Handlers para tabla AQL
    const handleUpdateAqlRow = (index: number, field: string, val: any) => {
        const next = [...tablaAql]
        next[index] = { ...next[index], [field]: val }
        setTablaAql(next)
    }

    // Handlers para Causas
    const handleAddCausa = () => {
        setCausas(prev => [
            ...prev,
            { terminoClave: '', descripcion: '', imputable: false }
        ])
    }

    const handleUpdateCausa = (index: number, field: string, val: any) => {
        const next = [...causas]
        next[index] = { ...next[index], [field]: val }
        setCausas(next)
    }

    const handleRemoveCausa = (index: number) => {
        setCausas(prev => prev.filter((_, i) => i !== index))
    }

    const currentLic = licitaciones.find(l => l.licId === selectedLicId)

    return (
        <div className="space-y-6">
            {/* Header / Selector Licitación */}
            <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚙️</span>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                Hub de Configuración y Parametrización de Multas
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Control modular (C1 - C11), horarios por servicio, estratos excluidos, tolerancias técnicas y tabla AQL por licitación autorizada.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-600">Licitación:</label>
                        <select
                            value={selectedLicId}
                            onChange={e => setSelectedLicId(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        >
                            {licitaciones.map(l => (
                                <option key={l.licId} value={l.licId}>
                                    {l.licitacionHomologada || `Licitación ${l.licId}`} (ID: {l.licId})
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <span>💾</span>
                            <span>{saving ? 'Guardando...' : 'Guardar Parámetros'}</span>
                        </button>
                    </div>
                </div>

                {/* Subinfo */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <span>Licitación Activa: <strong className="text-cyan-700 font-bold">{currentLic?.licitacionHomologada || selectedLicId}</strong></span>
                        {lastUpdated && (
                            <span>Última actualización: <strong>{lastUpdated}</strong> {usuarioModif ? `por ${usuarioModif}` : ''}</span>
                        )}
                    </div>
                    <button
                        onClick={handleReset}
                        disabled={saving || loading}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors flex items-center gap-1"
                        title="Restablece los parámetros de esta licitación a los valores normativos de la IT"
                    >
                        <span>🔄</span>
                        <span>Restablecer Valores Oficiales</span>
                    </button>
                </div>

                {/* Feedback Messages */}
                {error && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-fadeIn">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}
                {successMessage && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2 animate-fadeIn">
                        <span>✅</span>
                        <span>{successMessage}</span>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('modulos')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'modulos'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>🧩</span>
                    <span>Módulos de Multas (C1 - C11)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {modulos.filter(m => m.activo).length}/{modulos.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('horarios')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'horarios'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>⏰</span>
                    <span>Horarios por Servicio (C2.1)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {horarios.filter(h => h.activo).length}/{horarios.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('estratos')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'estratos'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>🚫</span>
                    <span>Estratos Excluidos (C2.2)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {estratos.filter(e => e.activo).length}/{estratos.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('dotacion')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'dotacion'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>👩‍🍳</span>
                    <span>Dotación Manipuladoras (C2.3)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-white text-[10px]">
                        {dotaciones.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('minutas')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'minutas'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>📋</span>
                    <span>Minutas Planificadas (C2.4)</span>
                    {minutaActual && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px]">
                            Activa
                        </span>
                    )}
                </button>

                <button
                    onClick={() => {
                        setActiveTab('comparacionC4')
                        if (!compData) {
                            handleEjecutarComparacion()
                        }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'comparacionC4'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>📊</span>
                    <span>Comparación C4 (Auditoría)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-600 text-white text-[10px]">
                        Nuevo
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('catalogoReglasC5')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'catalogoReglasC5'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>⚖️</span>
                    <span>Reglas NC y Calibración (C5)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-600 text-white text-[10px]">
                        23
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('parametros')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'parametros'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>📐</span>
                    <span>Parámetros Técnicos (F, H, K y Plazos)</span>
                </button>

                <button
                    onClick={() => setActiveTab('aql')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'aql'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>⚖️</span>
                    <span>Tabla de Muestreo AQL (Aspecto G)</span>
                </button>

                <button
                    onClick={() => setActiveTab('causas')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'causas'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>🛡️</span>
                    <span>Causales No Imputables (Tabla N°1)</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                        {causas.length}
                    </span>
                </button>
            </div>

            {/* TAB 1: MODULOS C1 A C11 */}
            {activeTab === 'modulos' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800">
                                Arquitectura de Módulos Configurables
                            </h3>
                            <p className="text-xs text-slate-500">
                                Enciende o apaga la activación de subcomponentes para esta licitación específica.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modulos.map(m => (
                            <div
                                key={m.codigo}
                                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                                    m.activo
                                        ? 'bg-gradient-to-br from-cyan-50/40 to-sky-50/20 border-cyan-200 shadow-sm'
                                        : 'bg-slate-50/60 border-slate-200 opacity-75'
                                }`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-black">
                                                {m.codigo}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                m.fase === 'Operativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {m.fase}
                                            </span>
                                        </div>

                                        {/* Toggle Switch */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleModulo(m.codigo)}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                m.activo ? 'bg-cyan-600' : 'bg-slate-300'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                    m.activo ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    <h4 className="text-xs font-bold text-slate-800 mt-2.5">
                                        {m.nombre}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                        {m.descripcion}
                                    </p>
                                </div>

                                {/* Acciones rápidas para C2: Horarios y Estratos */}
                                {m.codigo === 'C2' && (
                                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('horarios')}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                                        >
                                            <span>⏰</span>
                                            <span>Configurar Horarios</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('estratos')}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                                        >
                                            <span>🚫</span>
                                            <span>Estratos Excluidos</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('dotacion')}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                                        >
                                            <span>👩‍🍳</span>
                                            <span>Dotación</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('minutas')}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                                        >
                                            <span>📋</span>
                                            <span>Minutas</span>
                                        </button>
                                    </div>
                                )}

                                {/* Sub-reglas granulares para el Módulo C2 */}
                                {m.codigo === 'C2' && m.activo && (
                                    <div className="mt-3 pt-3 border-t border-cyan-200/60 space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-900 flex items-center justify-between">
                                            <span>Funcionalidades de Validación:</span>
                                            <span className="text-[9px] text-cyan-600 font-normal">Granulares</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {[
                                                { key: 'horariosServicio', label: 'Validar Horarios por Servicio (C2.1)' },
                                                { key: 'estratosExcluidos', label: 'Excluir Estratos en Raciones (C2.2)' },
                                                { key: 'dotacionOficial', label: 'Dotación Oficial Manipuladoras (C2.3)' },
                                                { key: 'minutaPlanificada', label: 'Minuta Planificada Aspecto A (C2.4)' }
                                            ].map(sub => {
                                                const currentSub = (m.submodulos as SubModuloCatalogosC2) || { ...SUBMODULOS_C2_DEFAULT }
                                                const isSubActive = currentSub[sub.key as keyof SubModuloCatalogosC2] === true
                                                return (
                                                    <label key={sub.key} className="flex items-center justify-between text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-cyan-900">
                                                        <span>{sub.label}</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSubActive}
                                                            onChange={() => handleToggleSubmoduloC2(sub.key as keyof SubModuloCatalogosC2)}
                                                            className="rounded text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 border-slate-300"
                                                        />
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Sub-reglas granulares para el Módulo C3 (Datos del Folio) */}
                                {m.codigo === 'C3' && m.activo && (
                                    <div className="mt-3 pt-3 border-t border-cyan-200/60 space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-900 flex items-center justify-between">
                                            <span>Capacidades de Folio:</span>
                                            <span className="text-[9px] text-cyan-600 font-normal">Granulares</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {[
                                                { key: 'nivelSupervisado', label: 'Nivel Supervisado T/B/M (C3.1)' },
                                                { key: 'bandejasAql', label: 'Bandejas Evaluadas/Rechazadas (C3.1)' },
                                                { key: 'correccionManual', label: 'Corrección Manual Cantidades (C3.2)' },
                                                { key: 'exigirMotivo', label: 'Exigir Motivo Obligatorio' }
                                            ].map(sub => {
                                                const currentSub = (m.submodulos as SubModuloDatosFolioC3) || { ...SUBMODULOS_C3_DEFAULT }
                                                const isSubActive = currentSub[sub.key as keyof SubModuloDatosFolioC3] !== false
                                                return (
                                                    <label key={sub.key} className="flex items-center justify-between text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-cyan-900">
                                                        <span>{sub.label}</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSubActive}
                                                            onChange={() => handleToggleSubmoduloC3(sub.key as keyof SubModuloDatosFolioC3)}
                                                            className="rounded text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 border-slate-300"
                                                        />
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                 {/* Sub-reglas granulares para el Módulo C4 (Extracción Robusta) */}
                                {m.codigo === 'C4' && m.activo && (
                                    <div className="mt-3 pt-3 border-t border-cyan-200/60 space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-900 flex items-center justify-between">
                                            <span>Capacidades de Extracción:</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab('comparacionC4')
                                                    if (!compData) handleEjecutarComparacion()
                                                }}
                                                className="text-[10px] text-cyan-700 hover:text-cyan-900 font-bold underline cursor-pointer"
                                            >
                                                📊 Ver Comparativa
                                            </button>
                                        </div>
                                        <div className="space-y-1.5">
                                            {[
                                                { key: 'extraccionRobusta', label: 'Aplicar Cantidades Robustas en Cálculo (⚠️)' },
                                                { key: 'alertasSubcontada', label: 'Alertar Subconteo en F y K' },
                                                { key: 'tipoInstrumentoJ', label: 'Tipos de Instrumento J (Máx 2)' }
                                            ].map(sub => {
                                                const currentSub = (m.submodulos as SubModuloExtraccionC4) || { ...SUBMODULOS_C4_DEFAULT }
                                                const isSubActive = currentSub[sub.key as keyof SubModuloExtraccionC4] === true
                                                return (
                                                    <label key={sub.key} className="flex items-center justify-between text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-cyan-900">
                                                        <span>{sub.label}</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSubActive}
                                                            onChange={() => handleToggleSubmoduloC4(sub.key as keyof SubModuloExtraccionC4)}
                                                            className="rounded text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 border-slate-300"
                                                        />
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Sub-reglas granulares para el Módulo C5 */}
                                {m.codigo === 'C5' && m.activo && (
                                    <div className="mt-3 pt-3 border-t border-cyan-200/60 space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-900 flex items-center justify-between">
                                            <span>Sub-reglas Técnicas:</span>
                                            <span className="text-[9px] text-cyan-600 font-normal">Individuales</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {[
                                                { key: 'aqlPesaje', label: 'Control AQL 6,5 (G)' },
                                                { key: 'personalManipulador', label: 'Personal H (1:70)' },
                                                { key: 'temperaturas', label: 'Rangos Térmicos (K)' },
                                                { key: 'calidadFrutasVerduras', label: 'Tolerancias Anexo 2 (F)' },
                                                { key: 'causasNoImputables', label: 'Causales No Imputables (Tabla N°1)' },
                                                { key: 'subsanabilidad', label: 'Subsanabilidad (B, E, J, L)' }
                                            ].map(sub => {
                                                const isSubActive = m.submodulos ? m.submodulos[sub.key as keyof SubModuloReglasC5] !== false : true
                                                return (
                                                    <label key={sub.key} className="flex items-center justify-between text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-cyan-900">
                                                        <span>{sub.label}</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSubActive}
                                                            onChange={() => handleToggleSubmoduloC5(sub.key as keyof SubModuloReglasC5)}
                                                            className="rounded text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 border-slate-300"
                                                        />
                                                    </label>
                                                )
                                            })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('catalogoReglasC5')}
                                            className="w-full mt-2 py-1.5 px-2 bg-gradient-to-r from-cyan-50 to-sky-50 hover:from-cyan-100 hover:to-sky-100 border border-cyan-200 rounded text-[11px] font-bold text-cyan-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <span>⚙️ Calibrar 23 Reglas y Parámetros</span>
                                            <span>&rarr;</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: HORARIOS POR SERVICIO (C2.1) */}
            {activeTab === 'horarios' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-cyan-900 text-white text-[11px] font-black">C2.1</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Catálogo de Horarios por Servicio Oficiales
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Establece la ventana horaria oficial para cada servicio de la licitación. Permite detectar supervisiones fuera de horario.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCargarHorariosSugeridos}
                                disabled={savingHorarios}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <span>📋</span>
                                <span>Cargar Horarios Sugeridos</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveHorarios}
                                disabled={savingHorarios}
                                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1"
                            >
                                <span>💾</span>
                                <span>{savingHorarios ? 'Guardando...' : 'Guardar Horarios'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Servicio</th>
                                    <th className="p-3 text-center">Hora Inicio (HH:MM)</th>
                                    <th className="p-3 text-center">Hora Fin (HH:MM)</th>
                                    <th className="p-3 text-center">Tolerancia (Min)</th>
                                    <th className="p-3 text-center">Habilitado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {horarios.map((h, idx) => (
                                    <tr key={h.servicioCodigo} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-800 text-[11px] font-black flex items-center justify-center shrink-0">
                                                {h.servicioCodigo}
                                            </span>
                                            <span>{h.servicioNombre}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="time"
                                                value={h.horaInicio}
                                                onChange={e => handleUpdateHorario(idx, 'horaInicio', e.target.value)}
                                                className="px-2.5 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="time"
                                                value={h.horaFin}
                                                onChange={e => handleUpdateHorario(idx, 'horaFin', e.target.value)}
                                                className="px-2.5 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="120"
                                                value={h.toleranciaMinutos}
                                                onChange={e => handleUpdateHorario(idx, 'toleranciaMinutos', Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateHorario(idx, 'activo', !h.activo)}
                                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                    h.activo ? 'bg-cyan-600' : 'bg-slate-300'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                        h.activo ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: ESTRATOS EXCLUIDOS (C2.2) */}
            {activeTab === 'estratos' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-900 text-white text-[11px] font-black">C2.2</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Estratos Excluidos de Raciones (PMPA)
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Estratos que no se suman a las raciones evaluadas según norma JUNAEB (ej. 206, 208, 209). Solo se aplican si el módulo C2 está activo.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCargarEstratosSugeridos}
                            disabled={savingEstrato}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 self-start sm:self-auto"
                        >
                            <span>📋</span>
                            <span>Cargar Sugeridos JUNAEB (206, 208, 209)</span>
                        </button>
                    </div>

                    {/* Formulario rápido para agregar estrato */}
                    <form onSubmit={handleAddEstrato} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-end gap-3">
                        <div className="w-full md:w-40">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Código Estrato</label>
                            <input
                                type="text"
                                placeholder="Ej: 206"
                                value={nuevoEstrato}
                                onChange={e => setNuevoEstrato(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div className="w-full md:flex-1">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Descripción / Motivo Exclusión</label>
                            <input
                                type="text"
                                placeholder="Motivo oficial o alcance de la exclusión..."
                                value={descEstrato}
                                onChange={e => setDescEstrato(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={savingEstrato || !nuevoEstrato.trim()}
                            className="w-full md:w-auto px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50 shrink-0"
                        >
                            <span>➕</span>
                            <span>Agregar Estrato</span>
                        </button>
                    </form>

                    {/* Tabla de estratos registrados */}
                    <div className="space-y-2">
                        {estratos.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4">
                                No hay estratos excluidos configurados para esta licitación. Haz clic en &quot;Cargar Sugeridos JUNAEB&quot; para precargar 206, 208 y 209.
                            </p>
                        ) : (
                            estratos.map(est => (
                                <div
                                    key={est.id}
                                    className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-black text-xs">
                                            {est.estrato}
                                        </span>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">
                                                {est.descripcion || 'Sin descripción'}
                                            </p>
                                            <span className="text-[10px] text-slate-400">
                                                {est.activo ? '🟢 Activo en cálculo' : '⚪ Inactivo'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleEstrato(est.id, est.activo)}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                est.activo ? 'bg-cyan-600' : 'bg-slate-300'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                    est.activo ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteEstrato(est.id, est.estrato)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs transition-colors"
                                            title="Eliminar estrato"
                                        >
                                            <span>🗑️</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB: DOTACION OFICIAL DE MANIPULADORAS (C2.3) */}
            {activeTab === 'dotacion' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-black">C2.3</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Dotación Oficial de Manipuladoras por Mes
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Dotación contractual oficial por colegio (RBD). Permite validar el Aspecto H contrastando la dotación real contra la exigencia 1:70.
                            </p>
                        </div>

                        {/* Controles de Periodo */}
                        <div className="flex items-center gap-2">
                            <select
                                value={dotacionMes}
                                onChange={e => setDotacionMes(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mName, mIdx) => (
                                    <option key={mIdx + 1} value={mIdx + 1}>{mName}</option>
                                ))}
                            </select>

                            <select
                                value={dotacionAnio}
                                onChange={e => setDotacionAnio(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                {[2024, 2025, 2026, 2027].map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Métricas Rápidas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Colegios Registrados</span>
                            <span className="text-2xl font-black text-slate-800">{dotaciones.length}</span>
                        </div>
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Total Manipuladoras Oficiales</span>
                            <span className="text-2xl font-black text-amber-900">
                                {dotaciones.reduce((acc, d) => acc + (d.total || 0), 0)}
                            </span>
                        </div>
                        <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
                            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">Promedio Manipuladoras / Colegio</span>
                            <span className="text-2xl font-black text-cyan-900">
                                {dotaciones.length > 0
                                    ? (dotaciones.reduce((acc, d) => acc + (d.total || 0), 0) / dotaciones.length).toFixed(1)
                                    : '0'}
                            </span>
                        </div>
                    </div>

                    {/* Barra de Acciones y Búsqueda */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72">
                            <input
                                type="text"
                                placeholder="Buscar por RBD o Establecimiento..."
                                value={dotacionSearch}
                                onChange={e => setDotacionSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            />
                            <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                <span>📥</span>
                                <span>{importingDotacion ? 'Importando...' : 'Cargar Excel / CSV'}</span>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileUploadDotacion}
                                    disabled={importingDotacion || loadingDotacion}
                                    className="hidden"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => setShowModalDotacion(true)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span>+</span>
                                <span>Agregar Colegio</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Dotaciones */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-2.5">RBD</th>
                                        <th className="px-4 py-2.5">Establecimiento</th>
                                        <th className="px-4 py-2.5 text-center">Dotación Oficial</th>
                                        <th className="px-4 py-2.5">Archivo Origen</th>
                                        <th className="px-4 py-2.5 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                    {dotaciones
                                        .filter(d => {
                                            if (!dotacionSearch.trim()) return true
                                            const term = dotacionSearch.toLowerCase()
                                            return (
                                                String(d.rbd).includes(term) ||
                                                (d.establecimiento || '').toLowerCase().includes(term)
                                            )
                                        })
                                        .map((d, i) => (
                                            <tr key={d.id || i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2.5 font-mono font-bold text-cyan-800">{d.rbd}</td>
                                                <td className="px-4 py-2.5 font-medium">{d.establecimiento || '—'}</td>
                                                <td className="px-4 py-2.5 text-center font-bold text-slate-800">
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                                                        {d.total} manipuladoras
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-400 text-[11px] truncate max-w-xs">{d.filename || 'Ingreso Manual'}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteDotacion(d.id!, d.rbd)}
                                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors"
                                                        title="Eliminar registro"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    {dotaciones.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                                No hay registros de dotación oficial para {dotacionMes}/{dotacionAnio}. Haz clic en <strong>Cargar Excel / CSV</strong> o agrega colegios manualmente.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: MINUTAS PLANIFICADAS POR MES (C2.4) */}
            {activeTab === 'minutas' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[11px] font-black">C2.4</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Minutas Oficiales Planificadas por Mes
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Registro de preparaciones planificadas por jornada y nivel para contrastar el Aspecto A (servicio entregado vs. planificado).
                            </p>
                        </div>

                        {/* Controles de Periodo */}
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={minutaMes}
                                onChange={e => setMinutaMes(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mName, mIdx) => (
                                    <option key={mIdx + 1} value={mIdx + 1}>{mName}</option>
                                ))}
                            </select>

                            <select
                                value={minutaAnio}
                                onChange={e => setMinutaAnio(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                {[2024, 2025, 2026, 2027].map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={handleSyncMinutas}
                                disabled={syncingMinuta || loadingMinuta}
                                className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                                title="Sincroniza automáticamente desde las 188.000+ minutas y preparaciones existentes en el sistema para esta licitación"
                            >
                                <span>🔄</span>
                                <span>{syncingMinuta ? 'Sincronizando...' : 'Sincronizar Minutas del Sistema'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Selector de Nivel */}
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto">
                        <span className="text-xs font-bold text-slate-500 mr-2">Nivel Educacional:</span>
                        {[
                            { key: 'B', label: 'Básica / NMMN' },
                            { key: 'M', label: 'Media' },
                            { key: 'T', label: 'Transición / Parvularia' },
                            { key: 'GENERAL', label: 'General / Todos' }
                        ].map(n => (
                            <button
                                key={n.key}
                                type="button"
                                onClick={() => setMinutaNivel(n.key)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    minutaNivel === n.key
                                        ? 'bg-indigo-900 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {n.label}
                            </button>
                        ))}

                        {minutaActual && (
                            <button
                                type="button"
                                onClick={handleDeleteMinuta}
                                className="ml-auto text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors flex items-center gap-1"
                            >
                                <span>🗑️</span>
                                <span>Limpiar Minuta del Nivel</span>
                            </button>
                        )}
                    </div>

                    {/* Calendario / Grilla Mensual de Días */}
                    {Object.keys(diasMinutaMap).length > 0 ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Días con preparaciones planificadas: <strong>{Object.keys(diasMinutaMap).length} días</strong></span>
                                <span>Origen: <strong>{minutaActual?.filename || 'Sistema'}</strong></span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto p-1">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => {
                                    const preps = diasMinutaMap[dia] || []
                                    const hasData = preps.length > 0
                                    return (
                                        <div
                                            key={dia}
                                            className={`p-3 rounded-xl border transition-all ${
                                                hasData
                                                    ? 'bg-slate-50/80 border-indigo-200 shadow-2xs hover:border-indigo-400'
                                                    : 'bg-white border-slate-100 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5 mb-2">
                                                <span className="text-xs font-black text-indigo-900">Día {dia}</span>
                                                {hasData ? (
                                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">
                                                        {preps.length} prep.
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300">Sin minuta</span>
                                                )}
                                            </div>

                                            {hasData ? (
                                                <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
                                                    {preps.map((p, pIdx) => (
                                                        <div key={pIdx} className="leading-tight">
                                                            <span className="font-bold text-slate-700 text-[10px] block text-indigo-700">{p.servicio}:</span>
                                                            <span className="text-slate-600 truncate block" title={p.preparacion}>{p.preparacion}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-2 text-center text-[10px] text-slate-300 italic">No planificado</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <span className="text-3xl">📋</span>
                            <h4 className="text-sm font-bold text-slate-800">No hay minuta planificada para este nivel y periodo</h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Puedes hacer clic en <strong>Sincronizar Minutas del Sistema</strong> para importar automáticamente las preparaciones de la base de datos de esta licitación.
                            </p>
                            <button
                                type="button"
                                onClick={handleSyncMinutas}
                                disabled={syncingMinuta || loadingMinuta}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
                            >
                                <span>🔄</span>
                                <span>{syncingMinuta ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Agregar Colegio a Dotación */}
            {showModalDotacion && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span>👩‍🍳</span>
                                <span>Registrar Dotación de Manipuladoras</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowModalDotacion(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveSingleDotacion} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">RBD del Colegio *</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="Ej: 1234"
                                    value={nuevoRbdDotacion}
                                    onChange={e => setNuevoRbdDotacion(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Dotación Oficial (Cantidad de Manipuladoras) *</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    placeholder="Ej: 3"
                                    value={nuevoTotalDotacion}
                                    onChange={e => setNuevoTotalDotacion(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Establecimiento (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Escuela República de Chile"
                                    value={nuevoEstablecimientoDotacion}
                                    onChange={e => setNuevoEstablecimientoDotacion(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModalDotacion(false)}
                                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingDotacion}
                                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
                                >
                                    {loadingDotacion ? 'Guardando...' : 'Guardar Dotación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB COMPARACIÓN C4 (AUDITORÍA DE EXTRACCIÓN ROBUSTA) */}
            {activeTab === 'comparacionC4' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <span>📊</span>
                                <span>Modo Comparación de Extracción: Algoritmo Actual vs. Robusto C4</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Audita folio por folio el impacto financiero que tendría la extracción robusta C4 sin modificar ningún registro en base de datos.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-200">
                                Modo Auditoría (Sin riesgo)
                            </span>
                        </div>
                    </div>

                    {/* Filtros de Comparación */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Año de Supervisión:
                                </label>
                                <select
                                    value={compAnho}
                                    onChange={e => setCompAnho(Number(e.target.value))}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
                                >
                                    {[2024, 2025, 2026].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Mes de Supervisión:
                                </label>
                                <select
                                    value={compMes}
                                    onChange={e => setCompMes(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
                                >
                                    <option value="Todos los meses">Todos los meses</option>
                                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={loadingComp}
                            onClick={handleEjecutarComparacion}
                            className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loadingComp ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <span>⚡ Ejecutar Auditoría Comparativa</span>
                            )}
                        </button>
                    </div>

                    {/* Resumen Métricas */}
                    {compData && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Folios Auditados</span>
                                <p className="text-xl font-black text-slate-800 mt-0.5">{compData.totalEvaluados}</p>
                            </div>
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Con Diferencias</span>
                                <p className="text-xl font-black text-amber-600 mt-0.5">{compData.conDiferencia}</p>
                            </div>
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Actual Total</span>
                                <p className="text-base font-black text-slate-700 mt-0.5">${compData.totalMontoActual?.toLocaleString('es-CL')}</p>
                            </div>
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Robusto C4</span>
                                <p className="text-base font-black text-cyan-700 mt-0.5">${compData.totalMontoRobusto?.toLocaleString('es-CL')}</p>
                            </div>
                            <div className={`p-3.5 rounded-xl border ${compData.diferenciaNeta !== 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Diferencia Neta</span>
                                <p className={`text-base font-black mt-0.5 ${compData.diferenciaNeta > 0 ? 'text-amber-700' : compData.diferenciaNeta < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                                    {compData.diferenciaNeta > 0 ? `+$${compData.diferenciaNeta.toLocaleString('es-CL')}` : `$${compData.diferenciaNeta?.toLocaleString('es-CL')}`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Comparación Folio a Folio */}
                    {compData?.data && compData.data.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">Folio</th>
                                        <th className="p-3">RBD</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3 text-center">NCs</th>
                                        <th className="p-3 text-right">Monto Actual</th>
                                        <th className="p-3 text-right">Monto C4</th>
                                        <th className="p-3 text-right">Diferencia</th>
                                        <th className="p-3">Alertas Técnicas</th>
                                        <th className="p-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {compData.data.map((item: any) => (
                                        <tr key={item.folio} className={item.tieneDiferencia ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/60'}>
                                            <td className="p-3 font-mono font-bold text-slate-900">{item.folio}</td>
                                            <td className="p-3 font-bold text-slate-700">{item.rbd}</td>
                                            <td className="p-3 text-slate-600">
                                                {item.fechaSupervision ? new Date(item.fechaSupervision).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-3 text-center font-bold text-rose-600">{item.ncCount}</td>
                                            <td className="p-3 text-right font-mono font-semibold text-slate-800">
                                                ${item.montoActual.toLocaleString('es-CL')}
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-cyan-800">
                                                ${item.montoRobusto.toLocaleString('es-CL')}
                                            </td>
                                            <td className="p-3 text-right">
                                                {item.diferencia !== 0 ? (
                                                    <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                                                        item.diferencia > 0 
                                                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                                    }`}>
                                                        {item.diferencia > 0 ? `+${item.diferencia.toLocaleString('es-CL')}` : item.diferencia.toLocaleString('es-CL')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">$0</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {item.alertas && item.alertas.length > 0 ? (
                                                        item.alertas.map((al: string, alIdx: number) => (
                                                            <span key={alIdx} className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[9px] border border-amber-200">
                                                                {al.includes('SUBCONTADA') ? '⚠️ Subcontada' : '⚠️ Alerta'}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">Sin alertas</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {item.aspectosConDiferencia && item.aspectosConDiferencia.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setCompSelectedFolio(item)}
                                                        className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                    >
                                                        Ver Cambios ({item.aspectosConDiferencia.length})
                                                    </button>
                                                ) : (
                                                    <span className="text-emerald-600 font-bold text-[10px]">Identico</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : compData ? (
                        <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                            No se encontraron folios para los filtros seleccionados.
                        </div>
                    ) : null}

                    {/* Modal Detalle de Diferencias por Aspecto */}
                    {compSelectedFolio && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
                            <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                        <span>🔍</span>
                                        <span>Diferencias Detectadas en Folio {compSelectedFolio.folio}</span>
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setCompSelectedFolio(null)}
                                        className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {compSelectedFolio.aspectosConDiferencia.map((asp: any) => (
                                        <div key={asp.letra} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded border border-cyan-200">
                                                    Aspecto {asp.letra}
                                                </span>
                                                <div className="font-mono font-bold text-xs space-x-2">
                                                    <span className="text-slate-500">Actual: ${asp.montoClasico.toLocaleString('es-CL')}</span>
                                                    <span>→</span>
                                                    <span className="text-cyan-800">C4: ${asp.montoRobusto.toLocaleString('es-CL')}</span>
                                                    <span className={asp.diferencia > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                                                        ({asp.diferencia > 0 ? `+${asp.diferencia}` : asp.diferencia})
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                                                <p className="font-semibold text-slate-700">Comparación de variables:</p>
                                                <p className="font-mono text-slate-500">Clásicas: {JSON.stringify(asp.variablesClasicas)}</p>
                                                <p className="font-mono font-bold text-cyan-800">Robustas C4: {JSON.stringify(asp.variablesRobustas)}</p>
                                                {asp.fuentes && Object.keys(asp.fuentes).length > 0 && (
                                                    <p className="text-[10px] text-slate-500 italic mt-1">
                                                        Fuente: {Object.entries(asp.fuentes).map(([k, v]) => `${k}: ${v}`).join('; ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setCompSelectedFolio(null)}
                                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: CATÁLOGO DE REGLAS NC Y CALIBRACIÓN (C5) */}
            {activeTab === 'catalogoReglasC5' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-cyan-900 text-white text-[11px] font-black">C5</span>
                                <h3 className="text-sm font-black text-slate-800">
                                    Catálogo de Reglas NC y Calibración de Parámetros (IT-DAE-SUP026)
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Calibra los márgenes de tolerancia metrológica y habilita/deshabilita individualmente cada una de las 23 reglas de auditoría para la Licitación {selectedLicId}.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>💾</span>
                                <span>{saving ? 'Guardando...' : 'Guardar Calibración C5'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Parámetros de Calibración Cuantitativa */}
                    <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                                <span>⚙️</span>
                                <span>Parámetros Numéricos de Tolerancia y Umbrales (C5)</span>
                            </h4>
                            <span className="text-[10px] text-slate-500">Configuración por Licitación</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Margen Temperatura */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">Margen Temp. (°C)</span>
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-mono text-[10px] font-bold">K-MARGEN</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Tolerancia metrológica instrumental (EMA). Desviaciones menores califican como marginales.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="5"
                                        value={c5MargenTemp}
                                        onChange={(e) => setC5MargenTemp(parseFloat(e.target.value) || 0)}
                                        className="w-full text-xs font-mono font-bold text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-bold text-slate-500">°C</span>
                                </div>
                            </div>

                            {/* Umbral Inasistencia Dotación */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">Umbral Ausentismo H (%)</span>
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-mono text-[10px] font-bold">H-MANIP</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Porcentaje de manipuladoras faltantes respecto a la dotación oficial C2.3 para alerta severa.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="number"
                                        min="10"
                                        max="100"
                                        value={c5UmbralDotacion}
                                        onChange={(e) => setC5UmbralDotacion(parseInt(e.target.value, 10) || 0)}
                                        className="w-full text-xs font-mono font-bold text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-bold text-slate-500">%</span>
                                </div>
                            </div>

                            {/* Tolerancia Inicio Anticipado */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">Inicio Anticipado (min)</span>
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-mono text-[10px] font-bold">HORARIO-2</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Minutos previos al servicio para considerar que las preparaciones estaban legítimamente en curso.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="number"
                                        min="10"
                                        max="180"
                                        value={c5TolAnticipado}
                                        onChange={(e) => setC5TolAnticipado(parseInt(e.target.value, 10) || 0)}
                                        className="w-full text-xs font-mono font-bold text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-bold text-slate-500">min</span>
                                </div>
                            </div>

                            {/* Tolerancia Pesaje Servicio */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">Tolerancia Pesaje (min)</span>
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-mono text-[10px] font-bold">G-HORARIO</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Minutos de retraso en llegada o retiro anticipado para considerar pesaje continuo incompleto.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={c5TolPesaje}
                                        onChange={(e) => setC5TolPesaje(parseInt(e.target.value, 10) || 0)}
                                        className="w-full text-xs font-mono font-bold text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-bold text-slate-500">min</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Filtros y Búsqueda de Reglas */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-slate-400 text-sm">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar regla por código, nombre, norma o texto..."
                                value={c5FiltroTexto}
                                onChange={(e) => setC5FiltroTexto(e.target.value)}
                                className="w-full text-xs bg-transparent border-0 focus:ring-0 text-slate-800 placeholder-slate-400"
                            />
                        </div>

                        <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
                            <select
                                value={c5FiltroAspecto}
                                onChange={(e) => setC5FiltroAspecto(e.target.value)}
                                className="text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-1 focus:ring-cyan-500"
                            >
                                <option value="ALL">Todos los Aspectos</option>
                                <option value="GENERAL">GENERAL</option>
                                <option value="A">Aspecto A (Minutas)</option>
                                <option value="B">Aspecto B (Manuales)</option>
                                <option value="C">Aspecto C (Materias Primas)</option>
                                <option value="F">Aspecto F (Calidad F&V)</option>
                                <option value="G">Aspecto G (Gramajes AQL)</option>
                                <option value="H">Aspecto H (Personal)</option>
                                <option value="J">Aspecto J (Equipos/Inst.)</option>
                                <option value="K">Aspecto K (Temperaturas)</option>
                                <option value="M">Aspecto M (Residuos)</option>
                            </select>

                            <select
                                value={c5FiltroSeveridad}
                                onChange={(e) => setC5FiltroSeveridad(e.target.value)}
                                className="text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-1 focus:ring-cyan-500"
                            >
                                <option value="ALL">Todas las Severidades</option>
                                <option value="alta">🔴 Alta (Mal Imputado)</option>
                                <option value="media">🟡 Media (Descargo)</option>
                                <option value="info">ℹ️ Info (Verificar)</option>
                            </select>
                        </div>
                    </div>

                    {/* Grilla / Listado de las 23 Reglas */}
                    <div className="space-y-3">
                        {CATALOGO_REGLAS
                            .filter(regla => {
                                if (c5FiltroAspecto !== 'ALL') {
                                    if (c5FiltroAspecto === 'GENERAL' && regla.aspecto !== 'GENERAL') return false
                                    if (c5FiltroAspecto !== 'GENERAL' && !regla.aspecto.includes(c5FiltroAspecto)) return false
                                }
                                if (c5FiltroSeveridad !== 'ALL' && regla.severidadDefault !== c5FiltroSeveridad) return false
                                if (c5FiltroTexto.trim()) {
                                    const q = c5FiltroTexto.toLowerCase()
                                    const match = regla.id.toLowerCase().includes(q) ||
                                        regla.nombre.toLowerCase().includes(q) ||
                                        regla.norma.toLowerCase().includes(q) ||
                                        regla.descripcion.toLowerCase().includes(q)
                                    if (!match) return false
                                }
                                return true
                            })
                            .map(regla => {
                                const isHabilitada = c5ReglasHabilitadas[regla.id] !== false
                                return (
                                    <div
                                        key={regla.id}
                                        className={`p-4 rounded-xl border transition-all ${
                                            isHabilitada
                                                ? 'bg-white border-slate-200 shadow-sm'
                                                : 'bg-slate-50/80 border-slate-200/60 opacity-60'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-cyan-900 text-cyan-50 border border-cyan-800">
                                                    {regla.id}
                                                </span>
                                                <span className="text-xs font-black text-slate-800">
                                                    {regla.nombre}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                    Aspecto {regla.aspecto}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                    regla.severidadDefault === 'alta'
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                        : regla.severidadDefault === 'media'
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            : 'bg-sky-100 text-sky-800 border border-sky-200'
                                                }`}>
                                                    {regla.severidadDefault.toUpperCase()}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                    regla.tipoDefault === 'mal_imputado'
                                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                                        : regla.tipoDefault === 'descargo'
                                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                                }`}>
                                                    {regla.tipoDefault === 'mal_imputado' ? 'Mal Imputado' : regla.tipoDefault === 'descargo' ? 'Descargo' : 'Verificar'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    Ref: {regla.norma}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                                    <span className={isHabilitada ? 'text-emerald-700' : 'text-slate-400'}>
                                                        {isHabilitada ? 'Habilitada' : 'Deshabilitada'}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isHabilitada}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked
                                                            setC5ReglasHabilitadas(prev => ({
                                                                ...prev,
                                                                [regla.id]: checked
                                                            }))
                                                        }}
                                                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                                            {regla.descripcion}
                                        </p>

                                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                                            <span className="font-bold text-slate-700 shrink-0">Descargo Sugerido:</span>
                                            <span className="italic">{regla.sugerenciaBase}</span>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            )}

            {/* TAB 4: PARAMETROS TECNICOS */}
            {activeTab === 'parametros' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div>
                        <h3 className="text-sm font-black text-slate-800">
                            Umbrales Técnicos y Fórmulas
                        </h3>
                        <p className="text-xs text-slate-500">
                            Ajusta los valores de ratio, rangos térmicos y tolerancias que alimentan el motor de cálculo y alertas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Aspecto H */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-cyan-700 text-white text-[11px] font-black">Aspecto H</span>
                                <h4 className="text-xs font-bold text-slate-800">Dotación Manipuladoras</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Raciones por cada manipuladora requerida a nivel de establecimiento educacional.
                            </p>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-600">Ratio (1:N):</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    value={ratioH}
                                    onChange={e => setRatioH(Number(e.target.value))}
                                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                />
                                <span className="text-xs text-slate-500">raciones / manipuladora</span>
                            </div>
                        </div>

                        {/* Plazos de Subsanabilidad */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-black">Plazos IT</span>
                                <h4 className="text-xs font-bold text-slate-800">Periodo de Corrección Subsanable</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Días hábiles para subsanar aspectos con periodo de corrección (B, E, J, L según Anexo 3).
                            </p>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-600">Plazo:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={plazoCorreccion}
                                    onChange={e => setPlazoCorreccion(Number(e.target.value))}
                                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                />
                                <span className="text-xs text-slate-500">días hábiles</span>
                            </div>
                        </div>

                        {/* Aspecto K - Temperaturas */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-sky-700 text-white text-[11px] font-black">Aspecto K</span>
                                <h4 className="text-xs font-bold text-slate-800">Rangos Térmicos Reglamentarios</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Límites máximos y mínimos para equipos de frío en visitas de supervisión.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Refri Mín (°C)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={tempRefriMin}
                                        onChange={e => setTempRefriMin(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Refri Máx (°C)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={tempRefriMax}
                                        onChange={e => setTempRefriMax(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Congelación Máx (°C)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={tempCongelacionMax}
                                        onChange={e => setTempCongelacionMax(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Aspecto F - Tolerancias Frutas y Verduras */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-amber-700 text-white text-[11px] font-black">Aspecto F</span>
                                <h4 className="text-xs font-bold text-slate-800">Tolerancias de Calidad (Anexo 2)</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Porcentajes máximos admisibles de defectos en frutas y hortalizas.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Leves Máx (%)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={tolLeve}
                                        onChange={e => setTolLeve(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Moderados Máx (%)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={tolMod}
                                        onChange={e => setTolMod(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Graves Máx (%)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={tolGrave}
                                        onChange={e => setTolGrave(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: TABLA AQL */}
            {activeTab === 'aql' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800">
                                Tabla de Muestreo Militar Estándar AQL 6,5 (Aspecto G)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Determina la cantidad mínima obligatoria de bandejas a pesar según raciones del nivel supervisado. (Max: &quot;Sin tope&quot; para la última fila).
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Rango de Raciones</th>
                                    <th className="p-3 text-center">Raciones Mín</th>
                                    <th className="p-3 text-center">Raciones Máx</th>
                                    <th className="p-3 text-center">Muestra Exigida (Bandejas)</th>
                                    <th className="p-3 text-center">Aceptación (Ac)</th>
                                    <th className="p-3 text-center">Rechazo (Re)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tablaAql.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3 font-semibold text-slate-700">
                                            {row.rangoTexto || `${row.min} a ${row.max === Infinity || row.max === null || row.max === undefined ? 'más' : row.max} raciones`}
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.min}
                                                onChange={e => handleUpdateAqlRow(idx, 'min', Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="text"
                                                value={row.max === Infinity || row.max === null || row.max === undefined ? 'Sin tope' : row.max}
                                                onChange={e => {
                                                    const v = e.target.value.trim()
                                                    if (v === '' || v.toLowerCase() === 'sin tope' || v === '∞' || Number(v) >= 999999) {
                                                        handleUpdateAqlRow(idx, 'max', Infinity)
                                                    } else {
                                                        handleUpdateAqlRow(idx, 'max', Number(v))
                                                    }
                                                }}
                                                className="w-20 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.muestra}
                                                onChange={e => handleUpdateAqlRow(idx, 'muestra', Number(e.target.value))}
                                                className="w-16 px-2 py-1 text-center bg-cyan-50 border border-cyan-200 text-cyan-800 rounded text-xs font-black"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.ac}
                                                onChange={e => handleUpdateAqlRow(idx, 'ac', Number(e.target.value))}
                                                className="w-14 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                value={row.re}
                                                onChange={e => handleUpdateAqlRow(idx, 're', Number(e.target.value))}
                                                className="w-14 px-2 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 6: CAUSAS NO IMPUTABLES */}
            {activeTab === 'causas' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-black text-slate-800">
                                Términos Clave de Causales No Imputables (Tabla N°1 IT)
                            </h3>
                            <p className="text-xs text-slate-500">
                                El motor analizará las observaciones del acta buscando estos términos con coincidencia exacta de límites de palabra.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddCausa}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                        >
                            <span>➕</span>
                            <span>Agregar Término</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {causas.map((c, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                                <div className="w-full md:w-1/3">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Término Clave (Búsqueda RegExp)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: corte de agua, toma del establecimiento..."
                                        value={c.terminoClave || ''}
                                        onChange={e => handleUpdateCausa(idx, 'terminoClave', e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div className="w-full md:flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Descripción Legal / Causal</label>
                                    <input
                                        type="text"
                                        placeholder="Descripción oficial de la causa..."
                                        value={c.descripcion || ''}
                                        onChange={e => handleUpdateCausa(idx, 'descripcion', e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-3 md:pt-0 self-end md:self-center">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCausa(idx)}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs transition-colors"
                                        title="Eliminar causal"
                                    >
                                        <span>🗑️</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
