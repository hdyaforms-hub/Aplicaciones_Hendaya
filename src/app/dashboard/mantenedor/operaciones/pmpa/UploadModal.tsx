'use client'

import { useState, useRef } from 'react'
import * as xlsx from 'xlsx'
import { uploadPMPAData, checkPMPAExists, PMPAData } from './actions'
import { useRouter } from 'next/navigation'

export default function UploadModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [formatType, setFormatType] = useState<'ESTANDAR' | 'INTEGRA'>('ESTANDAR')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [confirmOverwrite, setConfirmOverwrite] = useState(false)
    const [parsedData, setParsedData] = useState<PMPAData[]>([])
    const router = useRouter()

    const fileInputRef = useRef<HTMLInputElement>(null)

    const expectedColumns = ['anho', 'mes', 'licitacion', 'ute', 'rbd', 'programa', 'estrato', 'nivel', 'serviciolic', 'raceqjunaeb', 'servicio']

    const handleFormatChange = (type: 'ESTANDAR' | 'INTEGRA') => {
        setFormatType(type)
        setError('')
        setSuccess('')
        setConfirmOverwrite(false)
        setFile(null)
        setParsedData([])
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError('')
        setSuccess('')
        setConfirmOverwrite(false)
        if (e.target.files && e.target.files.length > 0) {
            const selectedMatch = e.target.files[0]
            if (
                selectedMatch.name.endsWith('.xlsx') ||
                selectedMatch.name.endsWith('.xls') ||
                selectedMatch.name.endsWith('.csv')
            ) {
                setFile(selectedMatch)
            } else {
                setError('Solo se permiten archivos Excel o CSV (.xlsx, .xls, .csv)')
                setFile(null)
            }
        }
    }

    // 1. Parser Estándar (JUNAEB / JUNJI) - Totalmente intacto
    const validateAndParseExcel = async () => {
        if (!file) return

        setLoading(true)
        setError('')

        try {
            const data = await file.arrayBuffer()
            const workbook = xlsx.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]

            // Leer asumiendo por defecto que la primera fila son las cabeceras
            const rawObjects = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

            if (rawObjects.length === 0) {
                setError('El archivo no contiene datos.')
                setLoading(false)
                return
            }

            // Normalizar cabeceras a minúsculas y sin acentos para evitar problemas
            const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const normalizedData = rawObjects.map(row => {
                const newRow: Record<string, any> = {}
                for (const key in row) {
                    const cleanKey = removeAccents(key.toString().toLowerCase().trim())
                    newRow[cleanKey] = row[key]
                }
                return newRow
            })

            // Las cabeceras detectadas son las llaves del primer objeto
            const headers = Object.keys(normalizedData[0])

            // Validar que tenga las columnas requeridas (se permiten extras pero no que falten)
            const missingCols = expectedColumns.filter(c => !headers.includes(c))

            if (missingCols.length > 0) {
                setError(`Columnas faltantes: ${missingCols.join(', ')}. Estructura esperada: ${expectedColumns.join(', ')}`)
                setLoading(false)
                return
            }

            // Mapear los datos al objeto final
            const isCsv = file?.name.toLowerCase().endsWith('.csv')
            const formattedData: PMPAData[] = normalizedData.map(row => {
                return {
                    ano: Number(row['anho']) || 0,
                    mes: Number(row['mes']) || 0,
                    licitacion: Number(row['licitacion']) || 0,
                    ute: isCsv ? (Number(row['regionute']) || 0) : (Number(row['ute']) || 0),
                    rbd: Number(row['rbd']) || 0,
                    programa: String(row['programa'] || '').substring(0, 50),
                    estrato: String(row['estrato'] || '').substring(0, 20),
                    nivel: String(row['nivel'] || '').substring(0, 50),
                    servicioLic: String(row['serviciolic'] || '').substring(0, 50),
                    raceqJunaeb: Number(row['raceqjunaeb']) || 0,
                    servicio: String(row['servicio'] || '').substring(0, 10),
                }
            })

            // Filter empty or invalid rows
            const cleanData = formattedData.filter(d => d.ano > 0 && d.rbd > 0)

            if (cleanData.length === 0) {
                setError('El archivo no contiene registros válidos.')
                setLoading(false)
                return
            }

            setParsedData(cleanData)

            // Consultar si existen para sobrescribir
            const validation = await checkPMPAExists(cleanData)

            if (validation.error) {
                setError(validation.error)
            } else if (validation.exists) {
                setConfirmOverwrite(true)
            } else {
                // Proceder con el guardado directo
                await executeUpload(cleanData, false)
            }
        } catch (err) {
            console.error(err)
            setError('Error procesando el archivo Excel.')
        }

        setLoading(false)
    }

    // 2. Parser Específico para INTEGRA
    const validateAndParseIntegraExcel = async () => {
        if (!file) return

        setLoading(true)
        setError('')

        try {
            const data = await file.arrayBuffer()
            const workbook = xlsx.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]

            // Leer como matriz para detectar el índice de fila de cabeceras (saltando posibles títulos)
            const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

            if (rows.length === 0) {
                setError('El archivo no contiene datos.')
                setLoading(false)
                return
            }

            const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Buscar la fila de encabezados que contenga 'rbd' y ('mes' o 'programado' o 'territorial')
            let headerRowIndex = -1
            for (let i = 0; i < Math.min(10, rows.length); i++) {
                const rowStr = (rows[i] || []).map(c => removeAccents(String(c).toLowerCase().trim())).join(' ')
                if (rowStr.includes('rbd') && (rowStr.includes('mes') || rowStr.includes('programado') || rowStr.includes('territorial'))) {
                    headerRowIndex = i
                    break
                }
            }

            if (headerRowIndex === -1) {
                setError('No se encontró la fila de encabezados de INTEGRA (debe contener columnas como "Mes Programado", "Número RBD", "Código U. Territorial", etc.).')
                setLoading(false)
                return
            }

            const headerCols = (rows[headerRowIndex] || []).map(h => removeAccents(String(h).toLowerCase().trim()))

            const findColIndex = (keyword: string) => headerCols.findIndex(h => h.includes(keyword))

            const idxMes = findColIndex('mes programado')
            const idxAno = findColIndex('ano programado')
            const idxUte = findColIndex('territorial')
            const idxRbd = findColIndex('rbd')
            const idxLic = findColIndex('tecnica')
            const idxEstrato = findColIndex('estrato')
            const idxProg = findColIndex('prog. alim')
            const idxServ = findColIndex('nombre servicio')
            const idxRac = findColIndex('raciones progr')

            if (idxMes === -1 || idxAno === -1 || idxUte === -1 || idxRbd === -1 || idxServ === -1 || idxRac === -1) {
                setError('El archivo de INTEGRA no contiene todas las columnas requeridas (Mes Programado, Año Programado, Código U. Territorial, Número RBD, Nombre Servicio, Raciones Progr).')
                setLoading(false)
                return
            }

            const formattedData: PMPAData[] = []
            for (let r = headerRowIndex + 1; r < rows.length; r++) {
                const row = rows[r]
                if (!row || row.length === 0) continue

                // Limpieza de RBD (ej: '000998503-4' -> 998503)
                const rbdRaw = String(row[idxRbd] || '').trim()
                if (!rbdRaw) continue
                const withoutDv = rbdRaw.includes('-') ? rbdRaw.split('-')[0] : rbdRaw
                const rbdClean = parseInt(withoutDv.replace(/^0+/, ''), 10) || 0

                // Licitación (ej: '53/23' -> 5323)
                const licRaw = idxLic !== -1 ? String(row[idxLic] || '').trim() : ''
                const licClean = parseInt(licRaw.replace(/\D/g, ''), 10) || 0

                const ano = parseInt(String(row[idxAno] || '0'), 10) || 0
                const mes = parseInt(String(row[idxMes] || '0'), 10) || 0
                const ute = parseInt(String(row[idxUte] || '0'), 10) || 0

                const estrato = idxEstrato !== -1 ? String(row[idxEstrato] || '').trim().substring(0, 50) : ''
                const programa = idxProg !== -1 ? String(row[idxProg] || '').trim().substring(0, 50) : ''

                // Homologación de Servicio
                const servRaw = removeAccents(String(row[idxServ] || '').trim().toUpperCase())
                let servicio = 'D'
                if (servRaw.includes('ALMUERZO')) servicio = 'A'
                else if (servRaw.includes('ONCE')) servicio = 'O'
                else if (servRaw.includes('COLACION')) servicio = 'CO'
                else if (servRaw.includes('A.PERSONAL')) servicio = 'AP'
                else if (servRaw.includes('C.PERSONAL')) servicio = 'CP'
                else if (servRaw.includes('CENA')) servicio = 'C'
                else if (servRaw.includes('DESAYUNO')) servicio = 'D'
                else servicio = servRaw.substring(0, 10)

                // Raciones diarias asignadas
                const raceqJunaeb = parseInt(String(row[idxRac] || '0'), 10) || 0

                if (ano > 0 && rbdClean > 0) {
                    formattedData.push({
                        ano,
                        mes,
                        licitacion: licClean,
                        ute,
                        rbd: rbdClean,
                        programa: programa || 'INTEGRA',
                        estrato: estrato || 'JARDIN INFANTIL',
                        nivel: 'P',
                        servicioLic: programa || 'INTEGRA',
                        raceqJunaeb,
                        servicio,
                        institucion: 'INTEGRA'
                    })
                }
            }

            if (formattedData.length === 0) {
                setError('El archivo no contiene registros válidos para INTEGRA.')
                setLoading(false)
                return
            }

            setParsedData(formattedData)

            // Consultar si existen para confirmar sobrescritura
            const validation = await checkPMPAExists(formattedData)
            if (validation.error) {
                setError(validation.error)
            } else if (validation.exists) {
                setConfirmOverwrite(true)
            } else {
                await executeUpload(formattedData, false)
            }
        } catch (err) {
            console.error(err)
            setError('Error procesando el archivo de INTEGRA.')
        }

        setLoading(false)
    }

    const handleValidate = () => {
        if (formatType === 'INTEGRA') {
            validateAndParseIntegraExcel()
        } else {
            validateAndParseExcel()
        }
    }

    const executeUpload = async (data: PMPAData[], overwrite: boolean) => {
        setLoading(true)
        setError('')
        const result = await uploadPMPAData(data, overwrite)
        if (result.error) {
            setError(result.error)
        } else {
            setSuccess(`Se cargaron ${result.count} registros exitosamente.`)
            setFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            router.refresh()
            setTimeout(() => {
                setIsOpen(false)
                setSuccess('')
            }, 2500)
        }
        setLoading(false)
    }

    const handleDownloadTemplate = () => {
        if (formatType === 'INTEGRA') {
            const worksheet = xlsx.utils.json_to_sheet([])
            xlsx.utils.sheet_add_aoa(worksheet, [[
                'Region', 'Mes Programado', 'Año Programado', 'Código U. Territorial',
                'Número RBD', 'Código Jardín', 'Nombre Jardín', 'Nombre Comuna',
                'Rut Concesionario', 'Nombre Concesionario', 'Código N. Técnica',
                'Nombre Estrato', 'Nombre Prog. Alim', 'Nombre Servicio',
                'N° Días Progr', 'Raciones Progr', 'Total Rac.Prog'
            ]], { origin: 'A1' })
            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Plantilla_INTEGRA')
            xlsx.writeFile(workbook, 'Formato_Carga_Masiva_INTEGRA.xlsx')
        } else {
            const worksheet = xlsx.utils.json_to_sheet([])
            xlsx.utils.sheet_add_aoa(worksheet, [['Anho', 'Mes', 'Licitación', 'UTE', 'RBD', 'Programa', 'Estrato', 'Nivel', 'ServicioLIC', 'RacEqJunaeb', 'servicio']], { origin: 'A1' })
            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Plantilla_PMPA')
            xlsx.writeFile(workbook, 'Formato_Carga_Masiva_PMPA.xlsx')
        }
    }

    if (!isOpen) {
        return (
            <div className="flex gap-2">
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white rounded-xl shadow-md shadow-cyan-500/30 transition-all font-medium flex items-center gap-2"
                >
                    <span>+</span> Adjuntar Registros
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    type="button"
                    className="px-4 py-2 bg-white border-2 border-cyan-100 text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all font-bold flex items-center gap-2 shadow-sm"
                    title="Descargar plantilla Excel vacía"
                >
                    <span>📥</span> Formato Excel
                </button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                    ✕
                </button>

                <h3 className="text-xl font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                    📄 Carga Masiva PMPA
                </h3>

                {/* Selector de Formato de Planilla */}
                <div className="flex bg-gray-100 p-1 rounded-2xl mb-4">
                    <button
                        type="button"
                        onClick={() => handleFormatChange('ESTANDAR')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                            formatType === 'ESTANDAR'
                                ? 'bg-white text-cyan-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        Estándar (JUNAEB / JUNJI)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleFormatChange('INTEGRA')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                            formatType === 'INTEGRA'
                                ? 'bg-white text-cyan-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        INTEGRA
                    </button>
                </div>

                {/* Subtítulo informativo según formato */}
                <div className="mb-4 text-xs text-gray-500 flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span>
                        {formatType === 'ESTANDAR'
                            ? 'Columnas esperadas: Anho, Mes, Licitación, UTE, RBD, etc.'
                            : 'Planilla oficial INTEGRA (RBD con guion, auto-limpieza).'}
                    </span>
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="text-cyan-600 hover:text-cyan-700 font-bold underline ml-2 whitespace-nowrap"
                    >
                        Descargar Formato
                    </button>
                </div>

                <div className="space-y-5">
                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium">{success}</div>}

                    {!confirmOverwrite ? (
                        <>
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-cyan-500 transition-colors bg-gray-50">
                                <label className="cursor-pointer block">
                                    <span className="text-3xl mb-2 block">📊</span>
                                    <span className="block text-sm font-medium text-gray-700 mb-1">
                                        Selecciona un archivo Excel {formatType === 'INTEGRA' ? 'de INTEGRA' : 'Estándar'}
                                    </span>
                                    <span className="block text-xs text-gray-500 mb-4">
                                        Formatos soportados: .xlsx, .xls, .csv
                                    </span>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <span className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
                                        Explorar Archivos
                                    </span>
                                </label>
                                {file && (
                                    <div className="mt-4 p-2 bg-cyan-50 text-cyan-800 rounded-lg text-sm font-medium break-all border border-cyan-100">
                                        Archivo seleccionado:<br /> {file.name}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" onClick={handleValidate} disabled={loading || !file} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 shadow-md shadow-cyan-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                                    {loading ? 'Procesando...' : 'Cargar y Validar'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl animate-in slide-in-from-bottom-4">
                            <h4 className="text-lg font-bold text-yellow-800 flex items-center gap-2 mb-2">
                                ⚠️ Registros Existentes
                            </h4>
                            <p className="text-sm text-yellow-700 mb-6">
                                Hemos detectado que ya existen registros cargados para los UTE, Años y Meses presentes en este archivo {formatType === 'INTEGRA' ? '(INTEGRA)' : ''}.
                                <br /><br />
                                <strong>¿Desea actualizar (sobrescribir) los registros?</strong>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setConfirmOverwrite(false)
                                        setFile(null)
                                        setParsedData([])
                                        if (fileInputRef.current) fileInputRef.current.value = ''
                                    }}
                                    className="px-4 py-2.5 w-full rounded-xl text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium transition-colors text-sm"
                                >
                                    No, cancelar
                                </button>
                                <button
                                    onClick={() => executeUpload(parsedData, true)}
                                    disabled={loading}
                                    className="px-4 py-2.5 w-full rounded-xl text-white bg-yellow-600 hover:bg-yellow-700 font-medium transition-colors text-sm disabled:opacity-70 disabled:pointer-events-none flex justify-center items-center"
                                >
                                    {loading ? 'Actualizando...' : 'Sí, actualizar registros'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
