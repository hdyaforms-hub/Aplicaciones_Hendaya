'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveRegistro, saveProductoCatalogo, getRegistroByContext, firmarVerificacionDiaria } from './actions'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts'
import FirmaCanvas from './FirmaCanvas'

interface Props {
    initialData?: any
    camarasCatalog: any[]
    productosCatalog: any[]
    sucursalesList?: { id: string; nombre: string; licitacionesText: string }[]
    canManage: boolean
    canConfig: boolean
    currentUser: string
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface CameraMonthConfig {
    mes: number // 1..12
    numeroCamaraMes: number // 1..N
    idCamara?: number
    nombreCamara?: string
    temperaturaMaxima: number
}

interface RowDetail {
    numeroCorrelativo: number
    dia: number
    tipoProducto: string
    nombreProducto: string
    // mapa de clave "mes_numeroCamara" -> valor temperatura (string/number)
    temperaturas: Record<string, string>
}

export default function VerificadorFormClient({
    initialData,
    camarasCatalog,
    productosCatalog,
    sucursalesList = [],
    canManage,
    canConfig,
    currentUser
}: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Cabecera state
    const sucursales = sucursalesList || []

    const [idRegistro, setIdRegistro] = useState<number | undefined>(initialData?.idRegistro)
    const isEditMode = Boolean(idRegistro)

    const [idEntidad, setIdEntidad] = useState<string>(() => {
        if (initialData?.idEntidad) return initialData.idEntidad
        return sucursales.length > 0 ? sucursales[0].id : ''
    })

    const selectedSucursal = sucursales.find(s => s.id === idEntidad) || sucursales[0]

    const [nombreEntidad, setNombreEntidad] = useState<string>(() => {
        if (initialData?.nombreEntidad) return initialData.nombreEntidad
        return selectedSucursal ? selectedSucursal.nombre : ''
    })

    const [licitacionTexto, setLicitacionTexto] = useState<string>(() => {
        if (initialData?.descripcionCamaras) return initialData.descripcionCamaras
        return selectedSucursal ? selectedSucursal.licitacionesText : ''
    })

    const [fechaRegistro, setFechaRegistro] = useState<string>(() => {
        if (initialData?.fechaRegistro) {
            return new Date(initialData.fechaRegistro).toISOString().slice(0, 10)
        }
        return new Date().toISOString().slice(0, 10)
    })

    const activeMonth = (() => {
        if (!fechaRegistro) return new Date().getMonth() + 1
        const parts = fechaRegistro.split('-')
        if (parts.length === 3) {
            const m = parseInt(parts[1], 10)
            if (!isNaN(m) && m >= 1 && m <= 12) return m
        }
        return new Date().getMonth() + 1
    })()

    const activeMonthName = MESES_NOMBRES[activeMonth - 1]

    const activeDay = (() => {
        if (!fechaRegistro) return new Date().getDate()
        const parts = fechaRegistro.split('-')
        if (parts.length === 3) {
            const d = parseInt(parts[2], 10)
            if (!isNaN(d) && d >= 1 && d <= 31) return d
        }
        return new Date().getDate()
    })()

    const monitorResponsable = currentUser // Monitor Responsable no editable

    const [tipoCamara, setTipoCamara] = useState<'Refrigerado' | 'Congelado'>(
        initialData?.tipoCamara || 'Congelado'
    )

    const congCamara = camarasCatalog.find((c: any) => c.tipoCamara === 'Congelado')
    const refrigCamara = camarasCatalog.find((c: any) => c.tipoCamara === 'Refrigerado')

    const getGlobalTempForType = (tipo: 'Refrigerado' | 'Congelado') => {
        if (tipo === 'Congelado') return congCamara ? congCamara.temperaturaMaxima : -18.0
        return refrigCamara ? refrigCamara.temperaturaMaxima : 5.0
    }

    // Configuración de Cámaras por Mes
    const defaultTempMax = getGlobalTempForType(tipoCamara)

    const sanitizeCameraName = (rawName?: string, defaultNum: number = 1): string => {
        if (!rawName) return `Cámara ${defaultNum.toString().padStart(2, '0')}`
        const cleaned = rawName.replace(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s*-\s*/i, '').trim()
        return cleaned || `Cámara ${defaultNum.toString().padStart(2, '0')}`
    }

    const [camarasPorMesCount, setCamarasPorMesCount] = useState<Record<number, number>>(() => {
        const counts: Record<number, number> = {}
        for (let m = 1; m <= 12; m++) {
            counts[m] = 1
        }
        if (initialData?.configuraciones && initialData.configuraciones.length > 0) {
            initialData.configuraciones.forEach((c: any) => {
                counts[c.mes] = Math.max(counts[c.mes] || 1, c.numeroCamaraMes)
            })
        }
        return counts
    })

    const [monthConfigs, setMonthConfigs] = useState<CameraMonthConfig[]>(() => {
        if (initialData?.configuraciones && initialData.configuraciones.length > 0) {
            return initialData.configuraciones.map((c: any) => ({
                mes: c.mes,
                numeroCamaraMes: c.numeroCamaraMes,
                idCamara: c.idCamara,
                nombreCamara: sanitizeCameraName(c.nombreCamara || c.camara?.nombreCamara, c.numeroCamaraMes),
                temperaturaMaxima: c.temperaturaMaxima ?? getGlobalTempForType(initialData.tipoCamara || 'Congelado')
            }))
        }
        // Por defecto 1 cámara por mes
        const initConfigs: CameraMonthConfig[] = []
        for (let m = 1; m <= 12; m++) {
            initConfigs.push({
                mes: m,
                numeroCamaraMes: 1,
                nombreCamara: 'Cámara 01',
                temperaturaMaxima: getGlobalTempForType('Congelado')
            })
        }
        return initConfigs
    })

    const [showConfigModal, setShowConfigModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'grilla' | 'resumen' | 'grafico'>('grilla')

    // Filas de datos
    const [rows, setRows] = useState<RowDetail[]>(() => {
        if (initialData?.detalles && initialData.detalles.length > 0) {
            const activeDetalles = initialData.detalles.filter((d: any) => d.mes === activeMonth)
            if (activeDetalles.length > 0) {
                const rowsMap = new Map<number, RowDetail>()
                activeDetalles.forEach((d: any) => {
                    let r = rowsMap.get(d.numeroCorrelativo)
                    if (!r) {
                        r = {
                            numeroCorrelativo: d.numeroCorrelativo,
                            dia: d.dia || 1,
                            tipoProducto: d.tipoProducto || `Producto ${d.numeroCorrelativo}`,
                            nombreProducto: d.nombreProducto || '',
                            temperaturas: {}
                        }
                        rowsMap.set(d.numeroCorrelativo, r)
                    }
                    if (d.temperatura !== null && d.temperatura !== undefined) {
                        r.temperaturas[`${d.mes}_${d.numeroCamara}`] = String(d.temperatura).replace('.', ',')
                    }
                })
                const sorted = Array.from(rowsMap.values()).sort((a, b) => a.numeroCorrelativo - b.numeroCorrelativo)
                return sorted.map((r, idx) => ({ ...r, numeroCorrelativo: idx + 1 }))
            }
        }
        // Mostrar inicialmente 2 filas (para el Día seleccionado en fechaRegistro)
        return Array.from({ length: 2 }, (_, i) => ({
            numeroCorrelativo: i + 1,
            dia: activeDay,
            tipoProducto: `Producto ${i + 1}`,
            nombreProducto: '',
            temperaturas: {}
        }))
    })

    const [productosList, setProductosList] = useState<any[]>(productosCatalog)
    const [saving, setSaving] = useState(false)
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null)
    const isInitializedRef = useRef(false)
    const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const [verificacionesDiarias, setVerificacionesDiarias] = useState<any[]>(
        initialData?.verificacionesDiarias || []
    )
    const [signingDay, setSigningDay] = useState<number | null>(null)
    const [firmaInputText, setFirmaInputText] = useState<Record<number, string>>({})

    const isDayVerified = (dia: number) => {
        return verificacionesDiarias.some(v => v.mes === activeMonth && v.dia === dia && v.firmado)
    }

    const draftsRef = useRef<Record<string, { rows: RowDetail[]; configs: CameraMonthConfig[]; idRegistro?: number }>>({})
    const activeContextKeyRef = useRef<string>('')
    const [showAddDayModal, setShowAddDayModal] = useState(false)
    const [dayToInsert, setDayToInsert] = useState<number>(1)
    const [chartScope, setChartScope] = useState<'dia' | 'mes' | 'semestre' | 'ano'>('mes')
    const [dailyNotes, setDailyNotes] = useState<Record<number, { obs: string; act: string }>>(() => {
        const notes: Record<number, { obs: string; act: string }> = {}
        if (initialData?.verificacionesDiarias) {
            initialData.verificacionesDiarias.forEach((v: any) => {
                notes[v.dia] = {
                    obs: v.observaciones || '',
                    act: v.accionesCorrectivas || ''
                }
            })
        }
        return notes
    })

    const executeSave = useCallback(async (isManualRedirect = false) => {
        if (!nombreEntidad || !fechaRegistro) return null

        setAutoSaveStatus('saving')
        setSaving(true)

        const detallesFormatted: any[] = []
        const activeMonthConfigs = monthConfigs.filter(c => c.mes === activeMonth)
        const numCamarasMes = activeMonthConfigs.length > 0 ? activeMonthConfigs.length : 1

        rows.forEach(r => {
            for (let numCam = 1; numCam <= numCamarasMes; numCam++) {
                const key = `${activeMonth}_${numCam}`
                const valStr = r.temperaturas[key]
                let numVal: number | null = null
                if (valStr !== undefined && valStr.trim() !== '') {
                    const parsed = parseFloat(valStr.replace(',', '.'))
                    if (!isNaN(parsed)) numVal = parsed
                }

                detallesFormatted.push({
                    numeroCorrelativo: r.numeroCorrelativo,
                    dia: r.dia || 1,
                    tipoProducto: r.tipoProducto,
                    nombreProducto: r.nombreProducto?.trim() || null,
                    mes: activeMonth,
                    numeroCamara: numCam,
                    temperatura: numVal
                })

                if (r.nombreProducto && r.nombreProducto.trim().length > 2) {
                    saveProductoCatalogo(r.nombreProducto.trim())
                }
            }
        })

        const dateYear = new Date(fechaRegistro + 'T12:00:00').getFullYear()

        const res = await saveRegistro({
            idRegistro,
            idEntidad,
            nombreEntidad,
            licitacionTexto,
            fechaRegistro,
            anio: dateYear,
            mesActivo: activeMonth,
            monitorResponsable,
            tipoCamara,
            configs: monthConfigs.map(c => ({
                idCamara: c.idCamara,
                nombreCamara: c.nombreCamara,
                mes: c.mes,
                numeroCamaraMes: c.numeroCamaraMes,
                temperaturaMaxima: c.temperaturaMaxima
            })),
            detalles: detallesFormatted
        })

        setSaving(false)

        if (res.success && res.idRegistro) {
            setIdRegistro(res.idRegistro)
            setAutoSaveStatus('saved')
            const nowStr = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            setLastSavedTime(nowStr)

            if (activeContextKeyRef.current) {
                draftsRef.current[activeContextKeyRef.current] = { rows, configs: monthConfigs, idRegistro: res.idRegistro }
            }

            if (isManualRedirect) {
                alert(`✅ Registro de temperaturas guardado exitosamente para "${nombreEntidad}".`)
                router.push('/dashboard/areas/calidad/verificador-temperaturas')
                router.refresh()
            }
            return res.idRegistro
        } else {
            setAutoSaveStatus('error')
            if (isManualRedirect) {
                alert(`⚠️ Error al guardar: ${res.error}`)
            }
            return null
        }
    }, [idRegistro, idEntidad, nombreEntidad, licitacionTexto, fechaRegistro, activeMonth, monitorResponsable, tipoCamara, monthConfigs, rows, router])

    const handleFirmarDiario = async (dia: number) => {
        let currentId = idRegistro
        if (!currentId) {
            currentId = await executeSave(false) || undefined
        }
        if (!currentId) {
            alert('No se pudo guardar el registro antes de firmar. Revisa los datos ingresados.')
            return
        }

        const firmaTexto = firmaInputText[dia] || `Firmado por ${currentUser}`
        const note = dailyNotes[dia] || { obs: '', act: '' }
        setSigningDay(dia)
        const res = await firmarVerificacionDiaria(currentId, activeMonth, dia, firmaTexto, note.obs, note.act)
        setSigningDay(null)

        if (res.success && res.verificacion) {
            alert(`✅ Verificación del Día ${dia} firmada exitosamente. Las mediciones de este día han sido bloqueadas.`)
            setVerificacionesDiarias(prev => {
                const filtered = prev.filter(v => !(v.mes === activeMonth && v.dia === dia))
                return [...filtered, res.verificacion]
            })
            router.refresh()
        } else {
            alert(`⚠️ ${res.error || 'Error al firmar la verificación'}`)
        }
    }

    // Sincronizar borrador activo en memoria solo para el contexto cargado actualmente
    useEffect(() => {
        if (!activeContextKeyRef.current) return
        draftsRef.current[activeContextKeyRef.current] = { rows, configs: monthConfigs, idRegistro }
    }, [rows, monthConfigs, idRegistro])

    useEffect(() => {
        isInitializedRef.current = false
        if (!idEntidad || !tipoCamara || !fechaRegistro) return
        const anio = parseInt(fechaRegistro.split('-')[0], 10)
        if (isNaN(anio)) return

        const draftKey = `${idEntidad}_${tipoCamara}_${anio}_${activeMonth}`
        let isMounted = true

        // 1. Si ya existe borrador en memoria para esta Entidad + Tipo + Año + Mes, restaurarlo intacto
        if (draftsRef.current[draftKey]) {
            const draft = draftsRef.current[draftKey]
            activeContextKeyRef.current = draftKey
            setIdRegistro(draft.idRegistro)
            setMonthConfigs(draft.configs)
            setRows(draft.rows)
            const counts: Record<number, number> = {}
            draft.configs.forEach(c => {
                counts[c.mes] = Math.max(counts[c.mes] || 1, c.numeroCamaraMes)
            })
            setCamarasPorMesCount(counts)
            setTimeout(() => { isInitializedRef.current = true }, 300)
            return
        }

        // 2. Si no hay borrador, cargar desde el servidor buscando por mes activo
        getRegistroByContext(idEntidad, tipoCamara, anio, activeMonth).then((data) => {
            if (!isMounted) return
            activeContextKeyRef.current = draftKey

            if (data) {
                setIdRegistro(data.idRegistro)
                if (data.verificacionesDiarias) {
                    setVerificacionesDiarias(data.verificacionesDiarias)
                }
                const newCounts: Record<number, number> = {}
                for (let m = 1; m <= 12; m++) newCounts[m] = 1
                
                const newConfigs: CameraMonthConfig[] = []
                if (data.configuraciones && data.configuraciones.length > 0) {
                    data.configuraciones.forEach((c: any) => {
                        newCounts[c.mes] = Math.max(newCounts[c.mes] || 1, c.numeroCamaraMes)
                        newConfigs.push({
                            mes: c.mes,
                            numeroCamaraMes: c.numeroCamaraMes,
                            idCamara: c.idCamara,
                            nombreCamara: sanitizeCameraName(c.nombreCamara || c.camara?.nombreCamara, c.numeroCamaraMes),
                            temperaturaMaxima: c.temperaturaMaxima ?? getGlobalTempForType(tipoCamara)
                        })
                    })
                } else {
                    for (let m = 1; m <= 12; m++) {
                        newConfigs.push({ mes: m, numeroCamaraMes: 1, nombreCamara: 'Cámara 01', temperaturaMaxima: getGlobalTempForType(tipoCamara) })
                    }
                }
                
                const activeDetalles = data.detalles ? data.detalles.filter((d: any) => d.mes === activeMonth) : []
                const rowsMap = new Map<number, RowDetail>()
                if (activeDetalles.length > 0) {
                    activeDetalles.forEach((d: any) => {
                        let r = rowsMap.get(d.numeroCorrelativo)
                        if (!r) {
                            r = { numeroCorrelativo: d.numeroCorrelativo, dia: d.dia || 1, tipoProducto: d.tipoProducto || `Producto ${d.numeroCorrelativo}`, nombreProducto: d.nombreProducto || '', temperaturas: {} }
                            rowsMap.set(d.numeroCorrelativo, r)
                        }
                        if (d.temperatura !== null && d.temperatura !== undefined) {
                            r.temperaturas[`${d.mes}_${d.numeroCamara}`] = String(d.temperatura).replace('.', ',')
                        }
                    })
                } else {
                    const currentDay = (() => {
                        if (!fechaRegistro) return new Date().getDate()
                        const parts = fechaRegistro.split('-')
                        if (parts.length === 3) return parseInt(parts[2], 10) || 1
                        return new Date().getDate()
                    })()
                    
                    for (let i = 1; i <= 2; i++) {
                        rowsMap.set(i, { numeroCorrelativo: i, dia: currentDay, tipoProducto: `Producto ${i}`, nombreProducto: '', temperaturas: {} })
                    }
                }
                const sorted = Array.from(rowsMap.values()).sort((a, b) => a.numeroCorrelativo - b.numeroCorrelativo)
                const newRows = sorted.map((r, idx) => ({ ...r, numeroCorrelativo: idx + 1 }))

                setCamarasPorMesCount(newCounts)
                setMonthConfigs(newConfigs)
                setRows(newRows)
                draftsRef.current[draftKey] = { rows: newRows, configs: newConfigs, idRegistro: data.idRegistro }
            } else {
                setIdRegistro(undefined)
                setVerificacionesDiarias([])
                const defConfigs: CameraMonthConfig[] = []
                for (let m = 1; m <= 12; m++) {
                    defConfigs.push({ mes: m, numeroCamaraMes: 1, nombreCamara: 'Cámara 01', temperaturaMaxima: getGlobalTempForType(tipoCamara) })
                }
                const currentDay = (() => {
                    if (!fechaRegistro) return new Date().getDate()
                    const parts = fechaRegistro.split('-')
                    if (parts.length === 3) return parseInt(parts[2], 10) || 1
                    return new Date().getDate()
                })()
                const defRows: RowDetail[] = [
                    { numeroCorrelativo: 1, dia: currentDay, tipoProducto: 'Producto 1', nombreProducto: '', temperaturas: {} },
                    { numeroCorrelativo: 2, dia: currentDay, tipoProducto: 'Producto 2', nombreProducto: '', temperaturas: {} }
                ]
                setMonthConfigs(defConfigs)
                setRows(defRows)
                const counts: Record<number, number> = {}
                for (let m = 1; m <= 12; m++) counts[m] = 1
                setCamarasPorMesCount(counts)
                draftsRef.current[draftKey] = { rows: defRows, configs: defConfigs, idRegistro: undefined }
            }
            setTimeout(() => { isInitializedRef.current = true }, 300)
        })

        return () => { isMounted = false }
    }, [idEntidad, tipoCamara, fechaRegistro, activeMonth])

    // Efecto Debounced de Guardado Automático al modificar rows o monthConfigs
    useEffect(() => {
        if (!isInitializedRef.current) return

        setAutoSaveStatus('saving')
        if (saveDebounceTimerRef.current) {
            clearTimeout(saveDebounceTimerRef.current)
        }

        saveDebounceTimerRef.current = setTimeout(() => {
            executeSave(false)
        }, 1200)

        return () => {
            if (saveDebounceTimerRef.current) {
                clearTimeout(saveDebounceTimerRef.current)
            }
        }
    }, [rows, monthConfigs, executeSave])

    // Manejar selección de sucursal
    const handleSucursalSelect = (sucId: string) => {
        setIdEntidad(sucId)
        const found = sucursales.find(s => s.id === sucId)
        if (found) {
            setNombreEntidad(found.nombre)
            setLicitacionTexto(found.licitacionesText)
        }
    }

    // Cambiar entre Congelado / Refrigerado sin perder datos
    const handleTipoCamaraChange = (nuevoTipo: 'Refrigerado' | 'Congelado') => {
        if (nuevoTipo === tipoCamara) return
        setTipoCamara(nuevoTipo)
    }

    // Actualización de configuración por mes (Agregar una cámara o reefer nueva)
    const updateCamarasForMonth = (mes: number, forceCount?: number) => {
        if (forceCount !== undefined) {
            // Lógica del modal: configurar directamente una cantidad específica
            const newCount = Math.max(1, forceCount)
            setCamarasPorMesCount(prev => ({ ...prev, [mes]: newCount }))
            
            setMonthConfigs(prev => {
                const defTemp = getGlobalTempForType(tipoCamara)
                const filtered = prev.filter(c => c.mes !== mes)
                for (let i = 1; i <= newCount; i++) {
                    const existing = prev.find(c => c.mes === mes && c.numeroCamaraMes === i)
                    filtered.push(existing || {
                        mes,
                        numeroCamaraMes: i,
                        nombreCamara: `Cámara ${i.toString().padStart(2, '0')}`,
                        temperaturaMaxima: defTemp
                    })
                }
                return filtered.sort((a, b) => a.mes - b.mes || a.numeroCamaraMes - b.numeroCamaraMes)
            })
            return
        }

        // Lógica del botón principal: preguntar y autoincrementar
        const isCamara = window.confirm("¿El nuevo elemento a auditar es una Cámara?\n\n[ Aceptar ] = Sí, es Cámara\n[ Cancelar ] = No, es Reefer")
        const typeName = isCamara ? 'Cámara' : 'Reefer'

        setMonthConfigs(prev => {
            const currentMonthCols = prev.filter(c => c.mes === mes)
            
            // Contar cuántas existen de este tipo
            let count = 0
            currentMonthCols.forEach(c => {
                if (c.nombreCamara && c.nombreCamara.toLowerCase().startsWith(typeName.toLowerCase())) {
                    count++
                } else if (!c.nombreCamara && isCamara) {
                    count++ // Por defecto las viejas eran Cámara
                }
            })
            
            const nextNumber = (count + 1).toString().padStart(2, '0')
            const newName = `${typeName} ${nextNumber}`
            
            const newIndex = currentMonthCols.length > 0 ? Math.max(...currentMonthCols.map(c => c.numeroCamaraMes)) + 1 : 1
            const defTemp = getGlobalTempForType(tipoCamara)
            
            const newConfig: CameraMonthConfig = {
                mes,
                numeroCamaraMes: newIndex,
                nombreCamara: newName,
                temperaturaMaxima: defTemp
            }
            
            return [...prev, newConfig].sort((a, b) => a.mes - b.mes || a.numeroCamaraMes - b.numeroCamaraMes)
        })

        setCamarasPorMesCount(prev => ({ ...prev, [mes]: (prev[mes] || 1) + 1 }))
    }

    const updateTempMaxForColumn = (mes: number, numCamara: number, tempMax: number) => {
        setMonthConfigs(prev => prev.map(c => {
            if (c.mes === mes && c.numeroCamaraMes === numCamara) {
                return { ...c, temperaturaMaxima: tempMax }
            }
            return c
        }))
    }

    const updateNombreCamara = (mes: number, numCamara: number, nombre: string) => {
        setMonthConfigs(prev => prev.map(c => {
            if (c.mes === mes && c.numeroCamaraMes === numCamara) {
                return { ...c, nombreCamara: nombre }
            }
            return c
        }))
    }

    // Agregar filas de producto
    const addRow = () => {
        setRows(prev => {
            const newRows = [...prev]
            const lastDia = newRows.length > 0 ? newRows[newRows.length - 1].dia || 1 : 1
            const rowsForLastDia = newRows.filter(r => r.dia === lastDia).length
            
            newRows.push({
                numeroCorrelativo: newRows.length + 1,
                dia: lastDia,
                tipoProducto: `Producto ${rowsForLastDia + 1}`,
                nombreProducto: '',
                temperaturas: {}
            })
            return newRows
        })
    }

    const openAddDayModal = () => {
        let defaultDay = new Date().getDate()
        if (fechaRegistro) {
            const parts = fechaRegistro.split('-')
            if (parts.length === 3) {
                defaultDay = parseInt(parts[2], 10) || defaultDay
            }
        }
        const existing = Array.from(new Set(rows.map(r => r.dia)))
        let candidate = defaultDay
        if (existing.includes(candidate)) {
            const freeDay = Array.from({ length: 31 }, (_, i) => i + 1).find(d => !existing.includes(d))
            if (freeDay) candidate = freeDay
        }
        setDayToInsert(candidate)
        setShowAddDayModal(true)
    }

    const confirmAddDay = (dayNum: number) => {
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return

        const existing = Array.from(new Set(rows.map(r => r.dia)))
        if (existing.includes(dayNum)) {
            alert(`⚠️ El día ${dayNum} ya existe en el registro. No puedes seleccionar un día ya existente.`)
            return
        }

        setRows(prev => {
            const newRows = [...prev]
            for (let i = 1; i <= 2; i++) {
                newRows.push({
                    numeroCorrelativo: newRows.length + 1,
                    dia: dayNum,
                    tipoProducto: `Producto ${i}`,
                    nombreProducto: '',
                    temperaturas: {}
                })
            }
            return newRows
        })
        setShowAddDayModal(false)
    }

    const removeRow = (index: number) => {
        if (rows.length <= 1) return
        setRows(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, numeroCorrelativo: i + 1 })))
    }

    const removeColumn = (mes: number, numCamara: number) => {
        if (!confirm(`¿Estás seguro de eliminar esta columna? Se borrarán sus mediciones.`)) return

        setMonthConfigs(prev => {
            const remainingForMonth = prev
                .filter(c => !(c.mes === mes && c.numeroCamaraMes === numCamara))
                .filter(c => c.mes === mes)
                .map((c, idx) => ({ ...c, numeroCamaraMes: idx + 1 }))

            const otherMonths = prev.filter(c => c.mes !== mes)
            return [...otherMonths, ...remainingForMonth].sort((a, b) => a.mes - b.mes || a.numeroCamaraMes - b.numeroCamaraMes)
        })

        setCamarasPorMesCount(prev => ({
            ...prev,
            [mes]: Math.max(1, (prev[mes] || 1) - 1)
        }))

        setRows(prev => prev.map(r => {
            const newTemps: Record<string, string> = {}
            Object.entries(r.temperaturas).forEach(([key, val]) => {
                const [mStr, cStr] = key.split('_')
                const m = parseInt(mStr, 10)
                const c = parseInt(cStr, 10)
                if (m === mes) {
                    if (c < numCamara) {
                        newTemps[`${m}_${c}`] = val
                    } else if (c > numCamara) {
                        newTemps[`${m}_${c - 1}`] = val
                    }
                } else {
                    newTemps[key] = val
                }
            })
            return { ...r, temperaturas: newTemps }
        }))
    }

    const updateRowField = (index: number, field: keyof RowDetail, value: any) => {
        setRows(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }
            return updated
        })
    }

    const updateTempCell = (rowIndex: number, colKey: string, value: string) => {
        setRows(prev => {
            const updated = [...prev]
            const temps = { ...updated[rowIndex].temperaturas }
            temps[colKey] = value
            updated[rowIndex] = { ...updated[rowIndex], temperaturas: temps }
            return updated
        })
    }

    // Estadísticas y Cumplimiento por columna (Cámara / Reefer)
    const getColumnStats = (mes: number, numCamara: number, targetDay?: number) => {
        const key = `${mes}_${numCamara}`
        const config = monthConfigs.find(c => c.mes === mes && c.numeroCamaraMes === numCamara)
        const maxTemp = config ? config.temperaturaMaxima : defaultTempMax
        const nombreCamara = config?.nombreCamara || `Cámara ${numCamara.toString().padStart(2, '0')}`

        let total = 0
        let fueraDeRango = 0
        let sumTemp = 0

        rows.forEach(r => {
            if (targetDay !== undefined && r.dia !== targetDay) return

            const valStr = r.temperaturas[key]
            if (valStr !== undefined && valStr.trim() !== '') {
                const val = parseFloat(valStr.replace(',', '.'))
                if (!isNaN(val)) {
                    total++
                    sumTemp += val
                    if (val > maxTemp) {
                        fueraDeRango++
                    }
                }
            }
        })

        const porcentaje = total > 0 ? ((total - fueraDeRango) / total) * 100 : 100
        const promedioTemp = total > 0 ? Math.round((sumTemp / total) * 10) / 10 : null

        return {
            mes,
            numCamara,
            nombreCamara,
            total,
            fueraDeRango,
            porcentaje: Math.round(porcentaje * 10) / 10,
            promedioTemp,
            maxTemp
        }
    }

    // Promedio de % de Cumplimiento de todas las columnas con datos del año
    const activeColumnsStats = monthConfigs.map(c => getColumnStats(c.mes, c.numeroCamaraMes))
    const colsWithData = activeColumnsStats.filter(s => s.total > 0)
    const promedioAnualCumplimiento = colsWithData.length > 0
        ? Math.round((colsWithData.reduce((acc, curr) => acc + curr.porcentaje, 0) / colsWithData.length) * 10) / 10
        : 100

    // Cálculos semestrales
    const colsSem1 = activeColumnsStats.filter((_, idx) => monthConfigs[idx].mes <= 6 && activeColumnsStats[idx].total > 0)
    const promSem1 = colsSem1.length > 0
        ? Math.round((colsSem1.reduce((a, c) => a + c.porcentaje, 0) / colsSem1.length) * 10) / 10
        : 100

    const colsSem2 = activeColumnsStats.filter((_, idx) => monthConfigs[idx].mes >= 7 && activeColumnsStats[idx].total > 0)
    const promSem2 = colsSem2.length > 0
        ? Math.round((colsSem2.reduce((a, c) => a + c.porcentaje, 0) / colsSem2.length) * 10) / 10
        : 100

    // Guardar formulario
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!nombreEntidad) {
            alert('Por favor selecciona una Sucursal válida.')
            return
        }

        await executeSave(true)
    }

    const isCongelado = tipoCamara === 'Congelado'

    return (
        <div className="max-w-[1700px] mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
            {/* Header del Módulo */}
            <div className={`p-6 sm:p-8 rounded-3xl shadow-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden transition-all ${
                isCongelado 
                    ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-indigo-800 text-white'
                    : 'bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border-cyan-800 text-white'
            }`}>
                <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider text-cyan-300 border border-white/10">
                            Área &gt; Calidad
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                            isCongelado ? 'bg-purple-500/20 text-purple-300 border-purple-400/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
                        }`}>
                            {isCongelado ? '❄️ Cámara Congelado' : '🧊 Cámara Refrigerado'}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        Verificador de Temperaturas
                        {idRegistro && (
                            <span className="text-xs bg-white/10 px-3 py-1 rounded-full border border-white/20 font-bold text-cyan-200">
                                Registro #{idRegistro}
                            </span>
                        )}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
                        Control y monitoreo continuo de temperaturas de cámaras de almacenamiento por sucursal.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    {/* Status de Guardado Automático */}
                    {autoSaveStatus === 'saving' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-950/90 text-cyan-300 text-xs font-black rounded-xl border border-cyan-700/60 shadow-inner animate-pulse">
                            <span className="animate-spin text-sm">⏳</span> Guardando autom...
                        </span>
                    )}
                    {autoSaveStatus === 'saved' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-950/90 text-emerald-300 text-xs font-black rounded-xl border border-emerald-700/60 shadow-inner">
                            <span>✅</span> Guardado autom. {lastSavedTime ? `(${lastSavedTime})` : ''}
                        </span>
                    )}
                    {autoSaveStatus === 'error' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-950/90 text-rose-300 text-xs font-black rounded-xl border border-rose-700/60 shadow-inner">
                            <span>⚠️</span> Error al auto-guardar
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowConfigModal(true)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                        <span>⚙️</span> Configurar Cámaras por Período
                    </button>
                    <Link
                        href="/dashboard/areas/calidad/verificador-temperaturas"
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
                    >
                        ⬅ Volver
                    </Link>
                </div>
            </div>

            {/* Panel de Resumen Superior con Semáforo Global */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 pr-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                        promedioAnualCumplimiento >= 95 ? 'bg-emerald-100 text-emerald-600' :
                        promedioAnualCumplimiento >= 80 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                        {promedioAnualCumplimiento >= 95 ? '🟢' : promedioAnualCumplimiento >= 80 ? '🟡' : '🔴'}
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Promedio Anual Cumplimiento</span>
                        <h3 className="text-2xl font-black text-slate-900">{promedioAnualCumplimiento}%</h3>
                        <p className="text-[11px] text-slate-500 font-medium">Meta deseada: ≥ 95%</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 pr-4">
                    <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-2xl flex items-center justify-center text-xl font-bold">
                        📅
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">1er Semestre (Ene - Jun)</span>
                        <h4 className="text-xl font-black text-slate-800">{promSem1}%</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Promedio de cumplimiento</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-xl font-bold">
                        📅
                    </div>
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">2do Semestre (Jul - Dic)</span>
                        <h4 className="text-xl font-black text-slate-800">{promSem2}%</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Promedio de cumplimiento</p>
                    </div>
                </div>
            </div>

            {/* Cabecera / Filtros de Contexto */}
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                    <h2 className="text-base font-black text-cyan-600 border-b border-gray-100 pb-3 flex items-center gap-2">
                        <span>📋</span> Sección de Cabecera y Filtros de Contexto
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                        {/* 1. Seleccionar Sucursal / Bodega */}
                        <div className="md:col-span-3 min-w-0">
                            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2 truncate">
                                Sucursal / Bodega <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={idEntidad}
                                disabled={isEditMode || sucursales.length <= 1}
                                onChange={(e) => handleSucursalSelect(e.target.value)}
                                className={`w-full px-4 py-3 rounded-xl border border-gray-300 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-cyan-500 ${
                                    isEditMode || sucursales.length <= 1 ? 'bg-gray-100 cursor-not-allowed text-slate-700' : 'bg-slate-50'
                                }`}
                            >
                                {sucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Licitación(es) asociada(s) (Automático / Solo Lectura) */}
                        <div className="md:col-span-4 min-w-0">
                            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2 truncate">
                                Licitaciones Asociadas
                            </label>
                            <input
                                type="text"
                                value={licitacionTexto}
                                readOnly
                                disabled
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 font-bold text-slate-700 text-xs outline-none bg-gray-100 cursor-not-allowed"
                            />
                        </div>

                        {/* 3. Fecha del Registro (Día, Mes, Año) */}
                        <div className="md:col-span-2 min-w-0">
                            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2 truncate">
                                Fecha Registro <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={fechaRegistro}
                                readOnly={isEditMode}
                                disabled={isEditMode}
                                onChange={(e) => setFechaRegistro(e.target.value)}
                                className={`w-full px-3 py-3 rounded-xl border border-gray-300 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-cyan-500 ${
                                    isEditMode ? 'bg-gray-100 cursor-not-allowed text-slate-700' : 'bg-slate-50'
                                }`}
                            />
                        </div>

                        {/* 4. Monitor Responsable (Bloqueado) */}
                        <div className="md:col-span-3 min-w-0">
                            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2 truncate">
                                Monitor Responsable
                            </label>
                            <input
                                type="text"
                                value={monitorResponsable}
                                readOnly
                                disabled
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 font-bold text-slate-700 text-xs outline-none bg-gray-100 cursor-not-allowed"
                            />
                        </div>

                        {isEditMode && (
                            <div className="md:col-span-12 -mt-1">
                                <span className="text-[11px] text-slate-500 font-extrabold flex items-center gap-1.5 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 w-fit">
                                    <span>🔒</span> Registro guardado. Para evaluar otro período o sucursal, usa la opción <strong>"Nuevo Registro"</strong>.
                                </span>
                            </div>
                        )}

                        {/* 5. Tipo de Cámara con Selector Destacado */}
                        <div className="md:col-span-12 pt-2">
                            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                                Tipo de Cámara <span className="text-rose-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    disabled={isEditMode}
                                    onClick={() => handleTipoCamaraChange('Congelado')}
                                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                        isEditMode ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                    } ${
                                        tipoCamara === 'Congelado'
                                            ? 'bg-purple-900 text-white border-purple-600 shadow-md ring-2 ring-purple-500/50'
                                            : 'bg-slate-50 text-slate-700 border-gray-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">❄️</span>
                                        <div className="text-left">
                                            <div className="font-black text-sm">Cámara de Congelado</div>
                                            <div className={`text-xs ${tipoCamara === 'Congelado' ? 'text-purple-200' : 'text-slate-500'}`}>
                                                Temperatura Ref Máxima: -18.0 °C
                                            </div>
                                        </div>
                                    </div>
                                    {tipoCamara === 'Congelado' && (
                                        <span className="px-2.5 py-1 bg-purple-500 text-white font-black text-[10px] uppercase rounded-full">
                                            {isEditMode ? '🔒 Registrado' : 'Seleccionado'}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    disabled={isEditMode}
                                    onClick={() => handleTipoCamaraChange('Refrigerado')}
                                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                        isEditMode ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                                    } ${
                                        tipoCamara === 'Refrigerado'
                                            ? 'bg-cyan-900 text-white border-cyan-600 shadow-md ring-2 ring-cyan-500/50'
                                            : 'bg-slate-50 text-slate-700 border-gray-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🧊</span>
                                        <div className="text-left">
                                            <div className="font-black text-sm">Cámara de Refrigerado</div>
                                            <div className={`text-xs ${tipoCamara === 'Refrigerado' ? 'text-cyan-200' : 'text-slate-500'}`}>
                                                Temperatura Ref Máxima: 5.0 °C
                                            </div>
                                        </div>
                                    </div>
                                    {tipoCamara === 'Refrigerado' && (
                                        <span className="px-2.5 py-1 bg-cyan-500 text-white font-black text-[10px] uppercase rounded-full">
                                            {isEditMode ? '🔒 Registrado' : 'Seleccionado'}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Banner de Modo de Cámara e Indicador del Mes Habilitado */}
                <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-bold text-xs shadow-sm transition-all ${
                    isCongelado 
                        ? 'bg-purple-950 text-purple-100 border-purple-800' 
                        : 'bg-cyan-950 text-cyan-100 border-cyan-800'
                }`}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{isCongelado ? '❄️' : '🧊'}</span>
                        <div>
                            <span className="uppercase font-black tracking-wider text-[11px] block flex flex-wrap items-center gap-2">
                                <span>MODO ACTIVO: TEMPERATURAS DE {isCongelado ? 'CÁMARA CONGELADO' : 'CÁMARA REFRIGERADO'}</span>
                                <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded-md text-[10px] uppercase shadow">
                                    📍 MES REGISTRO: {activeMonthName.toUpperCase()}
                                </span>
                            </span>
                            <span className="text-[11px] opacity-80 font-medium block mt-0.5">
                                La Fecha del Registro ({fechaRegistro}) habilita únicamente la columna de <strong>{activeMonthName}</strong>. Los demás meses quedan bloqueados 🔒.
                            </span>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-[10px] uppercase font-black tracking-wider shrink-0 ${
                        isCongelado ? 'bg-purple-800 text-purple-200 border border-purple-600' : 'bg-cyan-800 text-cyan-200 border border-cyan-600'
                    }`}>
                        {isCongelado ? '❄️ -18.0 °C Ref' : '🧊 5.0 °C Ref'}
                    </span>
                </div>

                {/* Tabs de Navegación de Vistas */}
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('grilla')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'grilla'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                        }`}
                    >
                        <span>📊</span> Grilla de Registro de Temperaturas
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('resumen')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'resumen'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                        }`}
                    >
                        <span>📈</span> Resumen Anual de Cumplimiento
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('grafico')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'grafico'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                        }`}
                    >
                        <span>📉</span> Gráfico
                    </button>
                </div>

                {/* TAB 1: GRILLA PRINCIPAL */}
                {activeTab === 'grilla' && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-3">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <span>🌡️</span> Ingreso de Mediciones — Mes Habilitado: <span className="text-amber-600 font-extrabold">{activeMonthName}</span>
                                </h3>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">
                                    T° Referencia Máxima: <strong className={isCongelado ? 'text-purple-700' : 'text-cyan-700'}>{defaultTempMax}°C</strong>. Las mediciones en <strong className="text-slate-800">{activeMonthName}</strong> que superen el límite se destacarán en <span className="text-rose-600 font-bold">rojo/naranja</span>.
                                </p>
                            </div>

                            {/* Controles para agregar de 1 a N líneas de producto */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500">Filas ({rows.length}):</span>
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className={`px-3 py-2 ${isCongelado ? 'bg-purple-600 hover:bg-purple-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer`}
                                    >
                                        <span>➕</span> Fila
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openAddDayModal}
                                        className={`px-3 py-2 ${isCongelado ? 'bg-purple-800 hover:bg-purple-700' : 'bg-cyan-800 hover:bg-cyan-700'} text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer ml-1`}
                                    >
                                        <span>📅</span> Otro Día
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                                    <button
                                        type="button"
                                        onClick={() => updateCamarasForMonth(activeMonth)}
                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                                    >
                                        <span>➕</span> Agregar Cámara / Reefer
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Grilla Dinámica con Scroll Horizontal y Tematizado por Cámara */}
                        <div className="overflow-x-auto rounded-2xl border border-gray-200 max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className={`text-white font-black text-[11px] sticky top-0 z-20 shadow-md ${
                                    isCongelado ? 'bg-purple-950' : 'bg-slate-900'
                                }`}>
                                    <tr>
                                        <th className={`p-3 border-r border-slate-800 w-12 text-center sticky left-0 z-30 ${
                                            isCongelado ? 'bg-purple-950' : 'bg-slate-900'
                                        }`}>N°</th>
                                        <th className={`p-3 border-r border-slate-800 w-20 text-center sticky left-12 z-30 ${
                                            isCongelado ? 'bg-purple-950' : 'bg-slate-900'
                                        }`}>Día</th>
                                        <th className={`p-3 border-r border-slate-800 min-w-[240px] sticky left-32 z-30 ${
                                            isCongelado ? 'bg-purple-950' : 'bg-slate-900'
                                        }`}>Producto / Categoría</th>
                                        
                                        {/* Encabezados Dinámicos de Columnas por Mes y Cámara */}
                                        {monthConfigs.filter(c => c.mes === activeMonth).map((col) => {
                                            const stats = getColumnStats(col.mes, col.numeroCamaraMes)
                                            let semaforo = '🟢'
                                            if (stats.total > 0) {
                                                if (stats.porcentaje < 80) semaforo = '🔴'
                                                else if (stats.porcentaje < 95) semaforo = '🟡'
                                            }
                                            const isColActiveMonth = col.mes === activeMonth

                                            return (
                                                <th
                                                    key={`${col.mes}_${col.numeroCamaraMes}`}
                                                    className={`p-2 border-r border-slate-800 min-w-[180px] text-center transition-all relative group z-30 shadow-lg ${
                                                        isCongelado ? 'bg-purple-900 ring-2 ring-purple-400' : 'bg-cyan-900 ring-2 ring-cyan-400'
                                                    }`}
                                                >
                                                    {canConfig && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeColumn(col.mes, col.numeroCamaraMes)}
                                                            className="absolute top-1 right-1 p-0.5 text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity z-40 bg-slate-900 rounded-md"
                                                            title="Eliminar esta columna"
                                                        >
                                                            ❌
                                                        </button>
                                                    )}
                                                    <div className="flex flex-col items-center w-full px-1">
                                                        <div className="flex items-center w-full justify-center text-[11px] text-white font-extrabold uppercase mb-1">
                                                            <span className="whitespace-nowrap shrink-0">{MESES_NOMBRES[col.mes - 1].slice(0, 3)} - </span>
                                                            <input
                                                                type="text"
                                                                value={col.nombreCamara || `Cámara ${col.numeroCamaraMes.toString().padStart(2, '0')}`}
                                                                onChange={(e) => updateNombreCamara(col.mes, col.numeroCamaraMes, e.target.value)}
                                                                className="bg-transparent border-none outline-none !text-white font-extrabold text-[11px] uppercase w-full flex-1 min-w-0 text-left pl-1 focus:ring-1 focus:ring-white/50 rounded"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[9px] text-slate-300">
                                                            <span>{semaforo}</span>
                                                            <span>Máx: {col.temperaturaMaxima}°</span>
                                                        </div>
                                                    </div>
                                                </th>
                                            )
                                        })}

                                        <th className="p-3 w-12 text-center">Acción</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200 font-medium">
                                    {rows.map((row, rIdx) => {
                                        const rowIsLocked = isDayVerified(row.dia)

                                        return (
                                            <tr key={rIdx} className={`transition-all ${rowIsLocked ? 'bg-slate-100/70' : 'hover:bg-slate-50'}`}>
                                                <td className="p-2 border-r border-gray-200 text-center font-bold text-slate-900 bg-slate-50/80 sticky left-0 z-10">
                                                    {row.numeroCorrelativo}
                                                </td>

                                                <td className="p-2 border-r border-gray-200 text-center sticky left-12 bg-white z-10">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="31"
                                                        value={row.dia || 1}
                                                        disabled={rowIsLocked}
                                                        readOnly={rowIsLocked}
                                                        onChange={(e) => updateRowField(rIdx, 'dia', parseInt(e.target.value) || 1)}
                                                        className={`w-14 px-2 py-2 text-center rounded-lg border border-gray-300 font-black text-slate-900 text-sm outline-none focus:ring-2 focus:ring-cyan-500 ${
                                                            rowIsLocked ? 'bg-gray-100 cursor-not-allowed text-slate-500' : ''
                                                        }`}
                                                    />
                                                </td>

                                                <td className="p-2 border-r border-gray-200 sticky left-32 bg-white z-10">
                                                    <div className="space-y-1">
                                                        <input
                                                            type="text"
                                                            list="tipo-productos-list"
                                                            value={row.tipoProducto}
                                                            disabled={rowIsLocked}
                                                            readOnly={rowIsLocked}
                                                            onChange={(e) => updateRowField(rIdx, 'tipoProducto', e.target.value)}
                                                            placeholder="Tipo de Producto..."
                                                            className={`w-full px-2 py-1.5 rounded-lg border border-gray-300 font-bold text-slate-900 text-[10px] outline-none focus:ring-2 focus:ring-cyan-500 ${
                                                                rowIsLocked ? 'bg-gray-100 cursor-not-allowed text-slate-500' : ''
                                                            }`}
                                                        />
                                                        <datalist id="tipo-productos-list">
                                                            {Array.from({ length: 3 }, (_, i) => (
                                                                <option key={i} value={`Producto ${i + 1}`}>Producto {i + 1}</option>
                                                            ))}
                                                        </datalist>
                                                        <input
                                                            type="text"
                                                            list="productos-list"
                                                            value={row.nombreProducto}
                                                            disabled={rowIsLocked}
                                                            readOnly={rowIsLocked}
                                                            onChange={(e) => updateRowField(rIdx, 'nombreProducto', e.target.value)}
                                                            placeholder="Nombre del producto..."
                                                            className={`w-full px-2 py-1.5 rounded-lg border border-gray-300 font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-cyan-500 ${
                                                                rowIsLocked ? 'bg-gray-100 cursor-not-allowed text-slate-500' : ''
                                                            }`}
                                                        />
                                                    </div>
                                                </td>

                                                {/* Celdas de Temperatura por Cámara (Solo Mes Activo) */}
                                                {monthConfigs.filter(c => c.mes === activeMonth).map((col) => {
                                                    const cellKey = `${col.mes}_${col.numeroCamaraMes}`
                                                    const rawVal = row.temperaturas[cellKey] || ''
                                                    const numVal = parseFloat(rawVal.replace(',', '.'))
                                                    const isOutOfRange = !isNaN(numVal) && (
                                                        tipoCamara === 'Refrigerado'
                                                            ? (numVal < 0.0 || numVal > col.temperaturaMaxima)
                                                            : (numVal > col.temperaturaMaxima)
                                                    )

                                                    return (
                                                        <td
                                                            key={cellKey}
                                                            className={`p-1 border-r border-gray-200 text-center transition-all ${
                                                                isOutOfRange
                                                                    ? 'bg-rose-100/90 border-rose-300'
                                                                    : isCongelado
                                                                    ? 'bg-purple-50/60'
                                                                    : 'bg-cyan-50/60'
                                                            }`}
                                                        >
                                                            <div className="relative flex flex-col items-center">
                                                                <input
                                                                    type="text"
                                                                    value={rawVal}
                                                                    disabled={rowIsLocked}
                                                                    readOnly={rowIsLocked}
                                                                    onChange={(e) => updateTempCell(rIdx, cellKey, e.target.value)}
                                                                    placeholder="--"
                                                                    className={`w-full text-center py-2 px-1 rounded-lg font-black text-xs outline-none border transition-all ${
                                                                        rowIsLocked
                                                                            ? 'bg-gray-100 text-slate-500 border-gray-200 cursor-not-allowed'
                                                                            : isOutOfRange
                                                                            ? 'bg-rose-500 text-white border-rose-600 shadow-sm font-black'
                                                                            : rawVal.trim() !== ''
                                                                            ? 'bg-emerald-50 text-slate-900 border-emerald-300'
                                                                            : isCongelado
                                                                            ? 'bg-white text-slate-700 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                                                                            : 'bg-white text-slate-700 border-cyan-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200'
                                                                    }`}
                                                                />
                                                                {isOutOfRange && (
                                                                    <span className="text-[9px] font-black text-rose-700 bg-rose-200 px-1 py-0.2 rounded mt-0.5 block whitespace-nowrap">
                                                                        ⚠️ Fuera de rango
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )
                                                })}

                                                <td className="p-2 text-center">
                                                    {!rowIsLocked && (canConfig || Object.keys(row.temperaturas).length === 0) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(rIdx)}
                                                            disabled={rows.length <= 1}
                                                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
                                                            title="Eliminar fila"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                    {rowIsLocked && (
                                                        <span className="text-xs text-slate-400 font-bold" title="Bloqueado por Verificación Diaria">
                                                            🔒
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>

                                {/* Footer con Totales y Promedios en Vivo */}
                                <tfoot className="bg-slate-900 text-white font-black text-[10px] sticky bottom-0 z-20 shadow-inner">
                                    <tr>
                                        <td colSpan={3} className="p-3 border-r border-slate-800 uppercase tracking-wider text-cyan-300 sticky left-0 bg-slate-900 z-30">
                                            Estadísticas del Período
                                        </td>
                                        {monthConfigs.filter(c => c.mes === activeMonth).map((col) => {
                                            const stats = getColumnStats(col.mes, col.numeroCamaraMes)
                                            return (
                                                <td key={`stat_${col.mes}_${col.numeroCamaraMes}`} className="p-2 border-r border-slate-800 text-center">
                                                    <div className="space-y-0.5">
                                                        <div className="text-[9px] text-slate-400">Datos: {stats.total}</div>
                                                        <div className={`text-[10px] ${stats.fueraDeRango > 0 ? 'text-rose-400 font-extrabold' : 'text-emerald-400'}`}>
                                                            {stats.fueraDeRango} fuera
                                                        </div>
                                                        <div className={`px-1 py-0.5 rounded text-[10px] font-black ${
                                                            stats.total === 0 ? 'bg-slate-800 text-slate-400' :
                                                            stats.porcentaje >= 95 ? 'bg-emerald-950 text-emerald-300' :
                                                            stats.porcentaje >= 80 ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300'
                                                        }`}>
                                                            {stats.total > 0 ? `${stats.porcentaje}%` : '--'}
                                                        </div>
                                                    </div>
                                                </td>
                                            )
                                        })}
                                        <td className="p-2"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Sección de Verificación y Firma Diaria (Nivel 1 - Monitor) */}
                        <div className="mt-8 bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-xl">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl p-2.5 bg-cyan-950 text-cyan-400 rounded-2xl border border-cyan-800/50">
                                        ✍️
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-black text-white">Verificación y Firma Diaria (Nivel 1 - Monitor)</h3>
                                        <p className="text-xs text-slate-400 font-medium">
                                            Firma la verificación diaria de los registros ingresados. Al firmar, se registrará tu nombre y fecha, bloqueando las mediciones de ese día.
                                        </p>
                                    </div>
                                </div>
                                {!idRegistro && (
                                    <span className="text-xs font-extrabold text-cyan-400 bg-cyan-950/80 px-3 py-1.5 rounded-xl border border-cyan-700/50">
                                        ⚡ El registro se guarda automáticamente al tipear o firmar
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                                {Array.from(new Set(rows.map(r => r.dia))).sort((a, b) => b - a).map(dayNum => {
                                    const verifiedEntry = verificacionesDiarias.find(v => v.mes === activeMonth && v.dia === dayNum && v.firmado)
                                    const isVerified = Boolean(verifiedEntry)

                                    return (
                                        <div key={dayNum} className={`p-5 rounded-2xl border transition-all space-y-3 ${
                                            isVerified
                                                ? 'bg-slate-800/90 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                                : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                                        }`}>
                                            <div className="flex items-center justify-between">
                                                <span className="font-extrabold text-sm text-cyan-300">
                                                    Día {dayNum} de {activeMonthName}
                                                </span>
                                                {isVerified ? (
                                                    <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-300 font-black text-[10px] uppercase rounded-full border border-emerald-700/50">
                                                        🔒 Verificado y Bloqueado
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 bg-slate-700 text-slate-300 font-black text-[10px] uppercase rounded-full">
                                                        ✏️ Pendiente
                                                    </span>
                                                )}
                                            </div>

                                            {isVerified ? (
                                                <div className="space-y-2 pt-1 text-slate-300">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                                        <span>✅</span>
                                                        <span>Verificado por: {verifiedEntry.firmadoPor}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        📅 Fecha: {new Date(verifiedEntry.fechaVerificacion).toLocaleString('es-CL')}
                                                    </div>

                                                    {(verifiedEntry?.observaciones || verifiedEntry?.accionesCorrectivas) && (
                                                        <div className="space-y-1.5 pt-1.5 border-t border-slate-700/80 text-[11px]">
                                                            {verifiedEntry.observaciones && (
                                                                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60 text-slate-300">
                                                                    <span className="font-extrabold text-cyan-300 block mb-0.5">📝 Observaciones:</span>
                                                                    <p className="font-medium text-slate-200">{verifiedEntry.observaciones}</p>
                                                                </div>
                                                            )}
                                                            {verifiedEntry.accionesCorrectivas && (
                                                                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60 text-slate-300">
                                                                    <span className="font-extrabold text-amber-300 block mb-0.5">🛠️ Acciones Correctivas:</span>
                                                                    <p className="font-medium text-slate-200">{verifiedEntry.accionesCorrectivas}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="pt-1">
                                                        <FirmaCanvas
                                                            value={verifiedEntry.firma || ''}
                                                            onChange={() => {}}
                                                            readOnly={true}
                                                            height={90}
                                                            label="Firma Digital Registrada"
                                                            darkTheme={true}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 pt-1">
                                                    {/* Campos de Observaciones y Acciones Correctivas */}
                                                    <div className="space-y-2 text-xs">
                                                        <div>
                                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                                📝 Observaciones (Opcional):
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={dailyNotes[dayNum]?.obs || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value
                                                                    setDailyNotes(prev => ({
                                                                        ...prev,
                                                                        [dayNum]: { obs: val, act: prev[dayNum]?.act || '' }
                                                                    }))
                                                                }}
                                                                placeholder="Ej. Sin novedades en la jornada"
                                                                className="dark-input w-full px-3 py-2 bg-slate-950/90 border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:ring-2 focus:ring-cyan-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                                🛠️ Acciones Correctivas (Si aplica):
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={dailyNotes[dayNum]?.act || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value
                                                                    setDailyNotes(prev => ({
                                                                        ...prev,
                                                                        [dayNum]: { obs: prev[dayNum]?.obs || '', act: val }
                                                                    }))
                                                                }}
                                                                placeholder="Ej. Se ajustó termostato de Cámara 01"
                                                                className="dark-input w-full px-3 py-2 bg-slate-950/90 border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:ring-2 focus:ring-cyan-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <FirmaCanvas
                                                        value={firmaInputText[dayNum] || ''}
                                                        onChange={(val) => setFirmaInputText(prev => ({ ...prev, [dayNum]: val }))}
                                                        height={110}
                                                        label="Dibuja tu firma digital"
                                                        darkTheme={true}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleFirmarDiario(dayNum)}
                                                        disabled={!idRegistro || signingDay === dayNum || !firmaInputText[dayNum]}
                                                        className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {signingDay === dayNum ? '⏳ Firmando...' : '🖊️ Firmar y Verificar Día'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Datalist para Autocompletado de Productos */}
                        <datalist id="productos-list">
                            {productosList.map((p, idx) => (
                                <option key={idx} value={p.nombreProducto} />
                            ))}
                        </datalist>

                        {/* Botón de Guardado del Formulario */}
                        <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                            <Link
                                href="/dashboard/areas/calidad/verificador-temperaturas"
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all"
                            >
                                Cancelar
                            </Link>

                            <button
                                type="submit"
                                disabled={saving}
                                className={`px-8 py-3 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg cursor-pointer disabled:opacity-50 ${
                                    isCongelado 
                                        ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600'
                                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
                                }`}
                            >
                                {saving ? '⏳ Guardando Registro...' : '💾 Guardar Registro de Temperatura'}
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: RESUMEN DE CUMPLIMIENTO */}
                {activeTab === 'resumen' && (
                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <span>📈</span> Resumen de Cumplimiento Térmico
                                </h3>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">
                                    Indicadores clave y desglose por Cámara / Reefer para <strong className="text-slate-800">{nombreEntidad || 'Sucursal Seleccionada'}</strong> ({tipoCamara})
                                </p>
                            </div>

                            {/* Badges de Resumen Global */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-center">
                                    <span className="text-[10px] text-gray-500 font-bold block uppercase">Mediciones Totales</span>
                                    <span className="text-sm font-black text-slate-800">{activeColumnsStats.reduce((a, c) => a + c.total, 0)}</span>
                                </div>
                                <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
                                    <span className="text-[10px] text-rose-600 font-bold block uppercase">Fuera de Límite</span>
                                    <span className="text-sm font-black text-rose-700">{activeColumnsStats.reduce((a, c) => a + c.fueraDeRango, 0)}</span>
                                </div>
                                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                    <span className="text-[10px] text-emerald-600 font-bold block uppercase">Cumplimiento Global</span>
                                    <span className="text-sm font-black text-emerald-700">{promedioAnualCumplimiento}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Desglose Agrupado por Mes */}
                        <div className="space-y-6">
                            {MESES_NOMBRES.map((nombreMes, mIdx) => {
                                const mesNum = mIdx + 1
                                const colsMes = monthConfigs.filter(c => c.mes === mesNum)
                                const statsMes = colsMes.map(c => getColumnStats(c.mes, c.numeroCamaraMes))
                                const hasData = statsMes.some(s => s.total > 0)
                                const isMonthActive = mesNum === activeMonth

                                if (!hasData && !isMonthActive) return null

                                return (
                                    <div key={mesNum} className={`p-5 rounded-2xl border transition-all ${
                                        isMonthActive
                                            ? 'bg-slate-50/80 border-cyan-300 ring-2 ring-cyan-400/30'
                                            : 'bg-white border-gray-200'
                                    }`}>
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                                    📅 {nombreMes}
                                                </span>
                                                {isMonthActive && (
                                                    <span className="text-[10px] bg-cyan-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
                                                        Mes Activo
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-bold text-gray-500">
                                                {colsMes.length} {colsMes.length === 1 ? 'Equipo' : 'Equipos auditados'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {statsMes.map((st) => (
                                                <div key={`${st.mes}_${st.numCamara}`} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-extrabold text-xs text-slate-900 uppercase">
                                                            {st.nombreCamara}
                                                        </span>
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                                            st.total === 0 ? 'bg-slate-100 text-slate-500' :
                                                            st.porcentaje >= 95 ? 'bg-emerald-100 text-emerald-800' :
                                                            st.porcentaje >= 80 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {st.total > 0 ? `${st.porcentaje}%` : 'Sin registros'}
                                                        </span>
                                                    </div>

                                                    {/* Barra de Progreso de Cumplimiento */}
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                st.porcentaje >= 95 ? 'bg-emerald-500' :
                                                                st.porcentaje >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                                                            }`}
                                                            style={{ width: `${st.total > 0 ? st.porcentaje : 0}%` }}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1 border-t border-gray-100">
                                                        <div className="bg-slate-50 p-1.5 rounded-lg">
                                                            <span className="text-gray-400 block font-bold">Evaluaciones</span>
                                                            <span className="font-black text-slate-800">{st.total}</span>
                                                        </div>
                                                        <div className="bg-rose-50 p-1.5 rounded-lg">
                                                            <span className="text-rose-400 block font-bold">Fuera Límite</span>
                                                            <span className="font-black text-rose-700">{st.fueraDeRango}</span>
                                                        </div>
                                                        <div className="bg-cyan-50 p-1.5 rounded-lg">
                                                            <span className="text-cyan-600 block font-bold">T° Promedio</span>
                                                            <span className="font-black text-cyan-800">{st.promedioTemp !== null ? `${st.promedioTemp}°C` : '--'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
                {/* TAB 3: GRÁFICO */}
                {activeTab === 'grafico' && (
                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl p-2 bg-cyan-50 text-cyan-600 rounded-2xl">📊</span>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Gráfico de Cumplimiento por Cámara / Reefer</h3>
                                    <p className="text-xs text-gray-500 max-w-md">
                                        {chartScope === 'dia'
                                            ? `Evolución y porcentaje de cumplimiento diario en ${activeMonthName}.`
                                            : chartScope === 'mes'
                                            ? `Porcentaje de cumplimiento por cada equipo auditado en ${activeMonthName}.`
                                            : chartScope === 'semestre'
                                            ? `Porcentaje de cumplimiento acumulado por equipo en el ${activeMonth <= 6 ? '1° Semestre (Ene - Jun)' : '2° Semestre (Jul - Dic)'}.`
                                            : `Porcentaje de cumplimiento acumulado de todos los equipos en el año.`}
                                    </p>
                                </div>
                            </div>

                            {/* Filtro de Alcance del Gráfico */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setChartScope('dia')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                            chartScope === 'dia'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Vista Diaria ({activeMonthName})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartScope('mes')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                            chartScope === 'mes'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Mes Activo ({activeMonthName})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartScope('semestre')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                            chartScope === 'semestre'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Vista Semestral ({activeMonth <= 6 ? '1° Sem' : '2° Sem'})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartScope('ano')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                            chartScope === 'ano'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Ver Todo el Año
                                    </button>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            let chartData: any[] = []
                            const CAMERA_COLORS = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0284c7', '#14b8a6', '#f97316', '#84cc16']
                            const cameraColorMap = new Map<string, string>()
                            let colorIdx = 0

                            const getCameraColor = (nombre: string) => {
                                if (!cameraColorMap.has(nombre)) {
                                    cameraColorMap.set(nombre, CAMERA_COLORS[colorIdx % CAMERA_COLORS.length])
                                    colorIdx++
                                }
                                return cameraColorMap.get(nombre)!
                            }

                            if (chartScope === 'dia') {
                                const activeConfigs = monthConfigs.filter(c => c.mes === activeMonth)
                                const registeredDays = Array.from(new Set(rows.map(r => r.dia))).sort((a, b) => a - b)

                                registeredDays.forEach(dayNum => {
                                    activeConfigs.forEach(c => {
                                        const st = getColumnStats(c.mes, c.numeroCamaraMes, dayNum)
                                        if (st.total > 0) {
                                            chartData.push({
                                                name: `Día ${dayNum} - ${st.nombreCamara}`,
                                                cumplimiento: st.porcentaje,
                                                total: st.total,
                                                fueraDeRango: st.fueraDeRango,
                                                promedioTemp: st.promedioTemp,
                                                maxTemp: st.maxTemp,
                                                nombreCamara: st.nombreCamara,
                                                mesNombre: activeMonthName,
                                                colorCamara: getCameraColor(st.nombreCamara)
                                            })
                                        }
                                    })
                                })
                            } else if (chartScope === 'mes') {
                                const rawData = monthConfigs.filter(c => c.mes === activeMonth).map(c => getColumnStats(c.mes, c.numeroCamaraMes))
                                chartData = rawData
                                    .filter(s => s.total > 0)
                                    .map(s => ({
                                        name: `${MESES_NOMBRES[s.mes - 1].slice(0, 3)} - ${s.nombreCamara}`,
                                        cumplimiento: s.porcentaje,
                                        total: s.total,
                                        fueraDeRango: s.fueraDeRango,
                                        promedioTemp: s.promedioTemp,
                                        maxTemp: s.maxTemp,
                                        nombreCamara: s.nombreCamara,
                                        mesNombre: MESES_NOMBRES[s.mes - 1],
                                        colorCamara: getCameraColor(s.nombreCamara)
                                    }))
                            } else if (chartScope === 'semestre') {
                                const startM = activeMonth <= 6 ? 1 : 7
                                const endM = activeMonth <= 6 ? 6 : 12
                                chartData = activeColumnsStats
                                    .filter(s => s.mes >= startM && s.mes <= endM && s.total > 0)
                                    .map(s => ({
                                        name: `${MESES_NOMBRES[s.mes - 1].slice(0, 3)} - ${s.nombreCamara}`,
                                        cumplimiento: s.porcentaje,
                                        total: s.total,
                                        fueraDeRango: s.fueraDeRango,
                                        promedioTemp: s.promedioTemp,
                                        maxTemp: s.maxTemp,
                                        nombreCamara: s.nombreCamara,
                                        mesNombre: MESES_NOMBRES[s.mes - 1],
                                        colorCamara: getCameraColor(s.nombreCamara)
                                    }))
                            } else {
                                chartData = activeColumnsStats
                                    .filter(s => s.total > 0)
                                    .map(s => ({
                                        name: `${MESES_NOMBRES[s.mes - 1].slice(0, 3)} - ${s.nombreCamara}`,
                                        cumplimiento: s.porcentaje,
                                        total: s.total,
                                        fueraDeRango: s.fueraDeRango,
                                        promedioTemp: s.promedioTemp,
                                        maxTemp: s.maxTemp,
                                        nombreCamara: s.nombreCamara,
                                        mesNombre: MESES_NOMBRES[s.mes - 1],
                                        colorCamara: getCameraColor(s.nombreCamara)
                                    }))
                            }

                            if (chartData.length === 0) {
                                return (
                                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-gray-200">
                                        <div className="text-4xl mb-3 opacity-40">📉</div>
                                        <h4 className="text-sm font-bold text-slate-700">Sin datos registrados para graficar</h4>
                                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                            {chartScope === 'dia'
                                                ? `No hay lecturas registradas en ningún día del mes de ${activeMonthName}.`
                                                : chartScope === 'mes'
                                                ? `Ingresa temperaturas en la Grilla de Registro para el mes de ${activeMonthName}.`
                                                : chartScope === 'semestre'
                                                ? `No hay lecturas registradas en el ${activeMonth <= 6 ? '1° Semestre (Enero a Junio)' : '2° Semestre (Julio a Diciembre)'}.`
                                                : 'Ingresa temperaturas en cualquier mes del año.'}
                                        </p>
                                    </div>
                                )
                            }

                            const uniqueCamerasInChart = Array.from(
                                new Map(chartData.map(item => [item.nombreCamara, { nombre: item.nombreCamara, color: item.colorCamara }])).values()
                            )

                            return (
                                <div className="space-y-4">
                                    <div className="h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 25 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="name"
                                                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 'bold' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    domain={[0, 100]}
                                                    unit="%"
                                                />
                                                <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Meta 95%', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload
                                                            return (
                                                                <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1.5">
                                                                    <div className="font-black border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
                                                                        <span className="text-cyan-300">{d.mesNombre}</span>
                                                                        <span className="uppercase flex items-center gap-1.5" style={{ color: d.colorCamara }}>
                                                                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.colorCamara }} />
                                                                            {d.nombreCamara}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                                                                        <span className="text-slate-400">Cumplimiento:</span>
                                                                        <span className="font-bold text-right text-emerald-400">{d.cumplimiento}%</span>
                                                                        <span className="text-slate-400">Evaluaciones:</span>
                                                                        <span className="font-bold text-right">{d.total}</span>
                                                                        <span className="text-slate-400">Fuera de Límite:</span>
                                                                        <span className={`font-bold text-right ${d.fueraDeRango > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{d.fueraDeRango}</span>
                                                                        <span className="text-slate-400">T° Promedio:</span>
                                                                        <span className="font-bold text-right text-cyan-300">{d.promedioTemp !== null ? `${d.promedioTemp}°C` : '--'}</span>
                                                                        <span className="text-slate-400">Límite Permitido:</span>
                                                                        <span className="font-bold text-right text-amber-300">{d.maxTemp}°C</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    }}
                                                />
                                                <Bar dataKey="cumplimiento" radius={[8, 8, 0, 0]}>
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={
                                                            entry.cumplimiento < 80 ? '#ef4444' : entry.colorCamara
                                                        } />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Leyenda Explicativa de Equipos */}
                                    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-gray-100 text-xs font-bold text-slate-600">
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">Equipos:</span>
                                            {uniqueCamerasInChart.map(cam => (
                                                <div key={cam.nombre} className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-gray-200">
                                                    <span className="w-3 h-3 rounded-full shadow-xs" style={{ backgroundColor: cam.color }} />
                                                    <span className="text-slate-800 font-extrabold">{cam.nombre}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-2 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 text-rose-700">
                                            <span className="w-3 h-3 rounded-full bg-rose-500" />
                                            <span>Alerta Crítica (&lt; 80%)</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                )}
            </form>

            {/* Modal para Configuración de Cámaras por Período */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl p-2 bg-cyan-50 text-cyan-600 rounded-2xl">⚙️</span>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Configuración de Cámaras por Período</h3>
                                    <p className="text-xs text-gray-500">Define cuántas cámaras operaron en cada mes y sus límites de temperatura</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowConfigModal(false)}
                                className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {MESES_NOMBRES.map((nombreMes, idx) => {
                                    const mesNum = idx + 1
                                    const count = camarasPorMesCount[mesNum] || 1
                                    const mesConfigs = monthConfigs.filter(c => c.mes === mesNum)

                                    return (
                                        <div key={mesNum} className="p-3 bg-slate-50 border border-gray-200 rounded-2xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-900">{nombreMes}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-gray-500 font-bold">Cámaras:</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        value={count}
                                                        onChange={(e) => updateCamarasForMonth(mesNum, parseInt(e.target.value, 10) || 1)}
                                                        className="w-12 text-center py-1 rounded-lg border border-gray-300 font-bold text-slate-900 bg-white"
                                                    />
                                                </div>
                                            </div>

                                            {/* Temperatura máxima por cada cámara del mes */}
                                            <div className="space-y-1 pt-1 border-t border-gray-200">
                                                {mesConfigs.map((cfg) => (
                                                    <div key={cfg.numeroCamaraMes} className="flex items-center justify-between text-[11px]">
                                                        <span className="text-slate-600 font-bold">{cfg.nombreCamara || `Cámara ${cfg.numeroCamaraMes.toString().padStart(2, '0')}`}:</span>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={cfg.temperaturaMaxima}
                                                                onChange={(e) => updateTempMaxForColumn(mesNum, cfg.numeroCamaraMes, parseFloat(e.target.value) || defaultTempMax)}
                                                                className="w-16 text-center py-0.5 rounded border border-gray-300 font-extrabold text-cyan-800 bg-white"
                                                            />
                                                            <span className="text-[10px] text-gray-500 font-bold">°C</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowConfigModal(false)}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Agregar un Nuevo Día con Selector Visual */}
            {showAddDayModal && (() => {
                const existingDays = Array.from(new Set(rows.map(r => r.dia)))
                const isDayAlreadyExisting = existingDays.includes(dayToInsert)

                return (
                    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <span className={`text-2xl p-2.5 rounded-2xl ${isCongelado ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                        📅
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Agregar Día de Evaluación</h3>
                                        <p className="text-xs text-gray-500 font-medium">Selecciona el día del mes para agregar 2 productos</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAddDayModal(false)}
                                    className="text-gray-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg transition-all"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                {isDayAlreadyExisting && (
                                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                                        <span className="text-base shrink-0">⚠️</span>
                                        <span>El día <strong>{dayToInsert}</strong> ya existe en el registro. No puedes seleccionar un día ya existente.</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-gray-200">
                                    <span className="text-xs font-extrabold text-slate-700">Día Seleccionado:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-500">Día N°</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={dayToInsert}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value, 10)
                                                if (!isNaN(v) && v >= 1 && v <= 31) setDayToInsert(v)
                                            }}
                                            className="w-16 text-center py-1 rounded-xl border border-gray-300 font-black text-slate-900 text-base bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Selector Visual de Días en Rejilla (Calendario) */}
                                <div>
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">
                                        Calendario del Mes ({activeMonthName}):
                                    </label>
                                    
                                    {/* Cabecera de días de la semana con iniciales */}
                                    <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
                                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letra, idx) => (
                                            <span key={idx} className="text-xs font-black text-slate-400 py-1 bg-slate-100 rounded-lg">
                                                {letra}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1.5">
                                        {(() => {
                                            const currentYear = fechaRegistro ? parseInt(fechaRegistro.split('-')[0], 10) || new Date().getFullYear() : new Date().getFullYear()
                                            const firstDayOfWeek = new Date(currentYear, activeMonth - 1, 1).getDay()
                                            const offset = (firstDayOfWeek + 6) % 7
                                            const daysInMonthCount = new Date(currentYear, activeMonth, 0).getDate()

                                            const offsetElements = Array.from({ length: offset }, (_, idx) => (
                                                <div key={`offset_${idx}`} className="py-2" />
                                            ))

                                            const dayElements = Array.from({ length: daysInMonthCount }, (_, idx) => {
                                                const d = idx + 1
                                                const isSelected = dayToInsert === d
                                                const isAlreadyAdded = existingDays.includes(d)
                                                return (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => setDayToInsert(d)}
                                                        className={`py-2 text-xs font-black rounded-xl transition-all border relative ${
                                                            isSelected
                                                                ? isAlreadyAdded
                                                                    ? 'bg-rose-600 text-white border-rose-700 shadow-md scale-105 ring-2 ring-rose-400/50'
                                                                    : isCongelado
                                                                    ? 'bg-purple-600 text-white border-purple-700 shadow-md scale-105 ring-2 ring-purple-400/50'
                                                                    : 'bg-cyan-600 text-white border-cyan-700 shadow-md scale-105 ring-2 ring-cyan-400/50'
                                                                : isAlreadyAdded
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 font-extrabold'
                                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-gray-200'
                                                        }`}
                                                        title={isAlreadyAdded ? `Día ${d} ya existe` : `Seleccionar día ${d}`}
                                                    >
                                                        {d}
                                                        {isAlreadyAdded && (
                                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                                                        )}
                                                    </button>
                                                )
                                            })

                                            return [...offsetElements, ...dayElements]
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAddDayModal(false)}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-extrabold rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmAddDay(dayToInsert)}
                                    disabled={isDayAlreadyExisting}
                                    className={`flex-1 py-3 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                                        isDayAlreadyExisting
                                            ? 'bg-rose-600'
                                            : isCongelado ? 'bg-purple-600 hover:bg-purple-500' : 'bg-cyan-600 hover:bg-cyan-500'
                                    }`}
                                >
                                    <span>{isDayAlreadyExisting ? '⛔ Día Ya Existente' : `➕ Agregar Día ${dayToInsert} (2 Filas)`}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
