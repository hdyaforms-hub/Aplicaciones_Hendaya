'use client'

import { useState, useRef } from 'react'
import * as xlsx from 'xlsx'
import { uploadRacionesData, checkRacionesExists, RacionData } from './actions'
import { useRouter } from 'next/navigation'

export default function UploadModalRaciones() {
    const [isOpen, setIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [confirmOverwrite, setConfirmOverwrite] = useState(false)
    const [existenceMessage, setExistenceMessage] = useState('')
    const [parsedData, setParsedData] = useState<RacionData[]>([])
    const router = useRouter()

    const fileInputRef = useRef<HTMLInputElement>(null)

    const expectedColumns = [
        'licitacion', 
        'numeroservicio', 
        'servicio', 
        'numerococina', 
        'numeroarea', 
        'numeroenlace', 
        'numerolocacion', 
        'locacion', 
        'numeroprograma', 
        'programa', 
        'mes', 
        'año', 
        'fecha', 
        'estadoracion', 
        'numerobeneficiario', 
        'beneficiario', 
        'cantidad', 
        'rbd', 
        'ut'
    ]

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError('')
        setSuccess('')
        setConfirmOverwrite(false)
        if (e.target.files && e.target.files.length > 0) {
            const selectedMatch = e.target.files[0]
            if (
                selectedMatch.name.endsWith('.xlsx') ||
                selectedMatch.name.endsWith('.xls')
            ) {
                setFile(selectedMatch)
            } else {
                setError('Solo se permiten archivos Excel (.xlsx, .xls)')
                setFile(null)
            }
        }
    }

    const excelDateToJSDate = (excelDate: number) => {
        return new Date((excelDate - (25567 + 2)) * 86400 * 1000).toISOString()
    }

    const validateAndParseExcel = async () => {
        if (!file) return

        setLoading(true)
        setError('')

        try {
            const data = await file.arrayBuffer()
            const workbook = xlsx.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]

            const rawObjects = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

            if (rawObjects.length === 0) {
                setError('El archivo no contiene datos.')
                setLoading(false)
                return
            }

            const normalizedData = rawObjects.map(row => {
                const newRow: Record<string, any> = {}
                for (const key in row) {
                    const normalizedKey = key.toString()
                        .toLowerCase()
                        .trim()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "") // remove accents except ñ? wait, AÑO became ano if normalized?
                        
                    // Manually map año to año if normalized removed it, actually normalize("NFD") makes ñ -> n + ~ and then replace removes ~. So 'año' becomes 'ano'.
                    // Wait, expectedColumns has 'año' (año). If normalize converts 'año' to 'ano', we should check for 'ano' or 'año'.
                    // Let's use expectedColumns with 'ano'.
                    
                    const safeKey = normalizedKey === 'ano' ? 'año' : normalizedKey;
                    
                    newRow[safeKey] = row[key]
                }
                return newRow
            })

            const headers = Object.keys(normalizedData[0])
            const missingCols = expectedColumns.filter(c => !headers.includes(c))

            if (missingCols.length > 0) {
                setError(`Faltan columnas obligatorias: ${missingCols.join(', ')}.`)
                setLoading(false)
                return
            }

            const formattedData: RacionData[] = normalizedData.map(row => {
                let fechaIso = new Date().toISOString();
                if (row['fecha']) {
                    if (typeof row['fecha'] === 'number') {
                        fechaIso = excelDateToJSDate(row['fecha'])
                    } else {
                        fechaIso = new Date(row['fecha']).toISOString()
                    }
                }

                return {
                    licitacion: String(row['licitacion'] || '').substring(0, 10),
                    numeroServicio: String(row['numeroservicio'] || '').substring(0, 10),
                    servicio: String(row['servicio'] || '').substring(0, 100),
                    numeroCocina: Number(row['numerococina']) || 0,
                    numeroArea: String(row['numeroarea'] || '').substring(0, 5),
                    numeroEnlace: Number(row['numeroenlace']) || 0,
                    numeroLocacion: String(row['numerolocacion'] || '').substring(0, 5),
                    locacion: String(row['locacion'] || '').substring(0, 150),
                    numeroPrograma: String(row['numeroprograma'] || '').substring(0, 7),
                    programa: String(row['programa'] || '').substring(0, 150),
                    mes: Number(row['mes']) || 0,
                    anio: Number(row['año']) || 0,
                    fecha: fechaIso,
                    estadoRacion: Number(row['estadoracion']) || 0,
                    numeroBeneficiario: Number(row['numerobeneficiario']) || 0,
                    beneficiario: String(row['beneficiario'] || '').substring(0, 50),
                    cantidad: Number(row['cantidad']) || 0,
                    rbd: Number(row['rbd']) || 0,
                    ut: Number(row['ut']) || 0,
                }
            })

            const cleanData = formattedData.filter(d => d.licitacion && d.numeroServicio)

            if (cleanData.length === 0) {
                setError('El archivo no contiene raciones válidas.')
                setLoading(false)
                return
            }

            setParsedData(cleanData)

            const validation = await checkRacionesExists(cleanData)

            if (validation.error) {
                setError(validation.error)
            } else if (validation.exists) {
                setExistenceMessage(validation.message || 'Ya existen registros en la base de datos.')
                setConfirmOverwrite(true)
            } else {
                await executeUpload(cleanData, false)
            }
        } catch (err: any) {
            console.error(err)
            setError(`Error al procesar: ${err.message || 'Error desconocido'}. Verifique el formato del archivo.`)
        }

        setLoading(false)
    }

    const executeUpload = async (data: RacionData[], overwrite: boolean) => {
        setLoading(true)
        setError('')
        const result = await uploadRacionesData(data, overwrite)
        if (result.error) {
            setError(result.error)
        } else {
            setSuccess(`Se cargaron ${result.count} registros de raciones exitosamente.`)
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
        const worksheet = xlsx.utils.json_to_sheet([])
        xlsx.utils.sheet_add_aoa(worksheet, [
            ['Licitacion', 'NumeroServicio', 'Servicio', 'NumeroCocina', 'NumeroArea', 'NumeroEnlace', 'NumeroLocacion', 'Locacion', 'NumeroPrograma', 'Programa', 'MES', 'AÑO', 'Fecha', 'EstadoRacion', 'NumeroBeneficiario', 'Beneficiario', 'Cantidad', 'RBD', 'UT']
        ], { origin: 'A1' })
        const workbook = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Raciones')
        xlsx.writeFile(workbook, 'Formato_Carga_Masiva_Raciones.xlsx')
    }

    if (!isOpen) {
        return (
            <div className="flex gap-2">
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl shadow-md shadow-teal-500/30 transition-all font-medium flex items-center gap-2"
                >
                    <span>+</span> Carga Masiva Raciones
                </button>
                <button
                    onClick={handleDownloadTemplate}
                    type="button"
                    className="px-4 py-2 bg-white border-2 border-teal-100 text-teal-600 hover:bg-teal-50 rounded-xl transition-all font-bold flex items-center gap-2 shadow-sm"
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

                <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight flex items-center gap-2">
                    🍽️ Carga Masiva Raciones
                </h3>

                <div className="space-y-5">
                    {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm border border-green-100 font-medium">{success}</div>}

                    {!confirmOverwrite ? (
                        <>
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-teal-500 transition-colors bg-gray-50">
                                <label className="cursor-pointer block">
                                    <span className="text-3xl mb-2 block">📊</span>
                                    <span className="block text-sm font-medium text-gray-700 mb-1">
                                        Selecciona un archivo Excel
                                    </span>
                                    <span className="block text-xs text-gray-500 mb-4">
                                        Formatos soportados: .xlsx, .xls
                                    </span>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <span className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
                                        Explorar Archivos
                                    </span>
                                </label>
                                {file && (
                                    <div className="mt-4 p-2 bg-teal-50 text-teal-800 rounded-lg text-sm font-medium break-all border border-teal-100">
                                        Archivo seleccionado:<br /> {file.name}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 w-full rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" onClick={validateAndParseExcel} disabled={loading || !file} className="px-5 py-2.5 w-full rounded-xl text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-teal-500/20 font-medium transition-all disabled:opacity-70 disabled:pointer-events-none">
                                    {loading ? 'Procesando...' : 'Cargar y Validar'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl animate-in slide-in-from-bottom-4">
                            <h4 className="text-lg font-bold text-yellow-800 flex items-center gap-2 mb-2">
                                ⚠️ Raciones Existentes
                            </h4>
                            <p className="text-sm text-yellow-700 mb-6 leading-relaxed">
                                {existenceMessage || 'Hemos detectado que ya existen raciones registradas para esta licitación en el sistema.'}
                                <br /><br />
                                <strong>¿Desea actualizar y sobrescribir dichos registros con la información del Excel?</strong>
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
                                    {loading ? 'Sobrescribiendo...' : 'Sí, actualizar raciones'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
