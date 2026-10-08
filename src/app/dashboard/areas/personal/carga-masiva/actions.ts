'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import * as xlsx from 'xlsx'
import * as fs from 'fs'
import path from 'path'
import { encryptPersonalText, decryptPersonalText, hashRut, cleanRut } from '@/lib/personal-crypto'
import { ensurePersonalAsistenciaTables } from '@/lib/personal-db-init'

const PATH_CARGA = '/dashboard/areas/personal/carga-masiva'
const PATH_ASISTENCIA = '/dashboard/areas/personal/asistencia'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_asistencia_carga')
}

// Extrae RBD y Establecimiento desde la columna "Grupo", ej: "(10516) EL LLANO DE PIRQUE", "(888197-9) JORGE QUEVEDO", "888197-9 JORGE QUEVEDO"
function parseGrupoRBD(grupoRaw: string | number | null | undefined): { rbd: number; establecimiento: string } {
    if (!grupoRaw) return { rbd: 0, establecimiento: 'Sin Establecimiento' }
    const str = String(grupoRaw).trim()

    // 1. Con paréntesis: ej "(888197-9) JORGE QUEVEDO" o "(10516) EL LLANO DE PIRQUE"
    // Omite guion y dígito verificador (-0..9, -k, -K) dentro del paréntesis
    const matchParen = str.match(/^\(\s*(\d+)(?:-[\dkK])?\s*\)\s*(.*)/)
    if (matchParen) {
        const rbdNum = parseInt(matchParen[1], 10)
        return {
            rbd: rbdNum,
            establecimiento: matchParen[2]?.trim() || `RBD ${rbdNum}`
        }
    }

    // 2. Sin paréntesis al inicio: ej "888197-9 JORGE QUEVEDO" o "10516 EL LLANO"
    const matchNumber = str.match(/^(\d+)(?:-[\dkK])?\s*(.*)/)
    if (matchNumber) {
        const rbdNum = parseInt(matchNumber[1], 10)
        return {
            rbd: rbdNum,
            establecimiento: matchNumber[2]?.trim() || `RBD ${rbdNum}`
        }
    }

    // 3. Fallback: buscar cualquier patrón con paréntesis en cualquier posición del texto
    const matchAnyParen = str.match(/\(\s*(\d+)(?:-[\dkK])?\s*\)/)
    if (matchAnyParen) {
        const rbdNum = parseInt(matchAnyParen[1], 10)
        const resto = str.replace(matchAnyParen[0], '').trim()
        return {
            rbd: rbdNum,
            establecimiento: resto || `RBD ${rbdNum}`
        }
    }

    return { rbd: 0, establecimiento: str }
}

// Normaliza fecha del excel a formato 'YYYY-MM-DD'
function parseExcelFecha(rawFecha: any): { dateStr: string } | null {
    if (!rawFecha) return null

    if (rawFecha instanceof Date && !isNaN(rawFecha.getTime())) {
        const y = rawFecha.getUTCFullYear()
        const m = String(rawFecha.getUTCMonth() + 1).padStart(2, '0')
        const d = String(rawFecha.getUTCDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${d}`
        return { dateStr }
    }

    if (typeof rawFecha === 'number') {
        const parsed = xlsx.SSF.parse_date_code(rawFecha)
        if (parsed) {
            const y = parsed.y
            const m = String(parsed.m).padStart(2, '0')
            const d = String(parsed.d).padStart(2, '0')
            const dateStr = `${y}-${m}-${d}`
            return { dateStr }
        }
    }

    if (typeof rawFecha === 'string') {
        const clean = rawFecha.trim()
        const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
        if (dmyMatch) {
            const d = dmyMatch[1].padStart(2, '0')
            const m = dmyMatch[2].padStart(2, '0')
            const y = dmyMatch[3]
            return { dateStr: `${y}-${m}-${d}` }
        }
        const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (ymdMatch) {
            const y = ymdMatch[1]
            const m = ymdMatch[2].padStart(2, '0')
            const d = ymdMatch[3].padStart(2, '0')
            return { dateStr: `${y}-${m}-${d}` }
        }
    }

    return null
}

export interface ResultadoProcesamiento {
    success: boolean
    cargaId?: string
    totalFilas: number
    nuevos: number
    actualizados: number
    sinCambios: number
    errores: number
    detallesErrores?: string[]
    error?: string
}

async function procesarBufferWorkbook(
    workbook: xlsx.WorkBook,
    archivoNombre: string,
    rutaOrigen: string,
    usuarioNombre: string,
    usuarioId?: string
): Promise<ResultadoProcesamiento> {
    await ensurePersonalAsistenciaTables()

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: 'La planilla no contiene hojas de cálculo' }
    }

    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: 'La hoja de cálculo no contiene filas con datos' }
    }

    // 1. Verificación preventiva contra cargas duplicadas
    const cargaPrevia = await (rawPrisma as any).pers_Asis_Carga.findFirst({
        where: { nombreArchivo: archivoNombre },
        orderBy: { createdAt: 'desc' }
    })

    // 2. Pre-análisis de filas para determinar si hay registros nuevos o cambios
    interface OperacionFila {
        tipo: 'NUEVO' | 'ACTUALIZAR' | 'SIN_CAMBIOS' | 'ERROR'
        errorMsg?: string
        existenteId?: string
        dataNuevo?: any
        dataActualizar?: any
    }

    const operaciones: OperacionFila[] = []
    let potencialesNuevos = 0
    let potencialesActualizados = 0
    let potencialesSinCambios = 0
    let erroresCount = 0
    const detallesErrores: string[] = []
    const ahora = new Date()

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        const rawApellidos = String(row['Apellidos'] || row['APELLIDOS'] || row['apellidos'] || '').trim()
        const rawNombre = String(row['Nombre'] || row['NOMBRE'] || row['nombre'] || '').trim()
        const rawRut = String(row['Rut'] || row['RUT'] || row['rut'] || '').trim()
        const rawFecha = row['Fecha'] || row['FECHA'] || row['fecha']
        const rawGrupo = row['Grupo'] || row['GRUPO'] || row['grupo']
        const rawCargo = String(row['Cargo'] || row['CARGO'] || row['cargo'] || '').trim()
        const rawPermiso = String(row['Permiso Parcial'] || row['PERMISO PARCIAL'] || row['permiso parcial'] || row['Permiso'] || '').trim()

        if (!rawRut || !rawFecha) {
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: Rut o Fecha vacíos`)
            operaciones.push({ tipo: 'ERROR', errorMsg: `Fila ${i + 2}: Rut o Fecha vacíos` })
            continue
        }

        const cleanRutVal = cleanRut(rawRut)
        if (!cleanRutVal) {
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: Formato de RUT inválido (${rawRut})`)
            operaciones.push({ tipo: 'ERROR', errorMsg: `Fila ${i + 2}: Formato de RUT inválido` })
            continue
        }

        const rutHash = hashRut(cleanRutVal)
        const parsedFecha = parseExcelFecha(rawFecha)
        if (!parsedFecha) {
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: Formato de Fecha no reconocible (${rawFecha})`)
            operaciones.push({ tipo: 'ERROR', errorMsg: `Fila ${i + 2}: Fecha no reconocible` })
            continue
        }

        const { rbd, establecimiento } = parseGrupoRBD(rawGrupo)

        try {
            const existente = await (rawPrisma as any).pers_Asis_Registro.findUnique({
                where: {
                    rutHash_fecha_rbd: {
                        rutHash,
                        fecha: parsedFecha.dateStr,
                        rbd
                    }
                }
            })

            if (!existente) {
                potencialesNuevos++
                const rutEnc = encryptPersonalText(rawRut)
                const apellidosEnc = encryptPersonalText(rawApellidos)
                const nombreEnc = encryptPersonalText(rawNombre)

                operaciones.push({
                    tipo: 'NUEVO',
                    dataNuevo: {
                        rutEnc,
                        rutHash,
                        apellidosEnc,
                        nombreEnc,
                        fecha: parsedFecha.dateStr,
                        rbd,
                        establecimiento,
                        grupoOriginal: String(rawGrupo || '').trim(),
                        cargo: rawCargo || null,
                        permisoParcial: rawPermiso || null,
                        creadoPor: usuarioNombre,
                        creadoPorId: usuarioId || null,
                        fechaCreacion: ahora,
                        numActualizaciones: 0
                    }
                })
            } else {
                const prevApellidos = decryptPersonalText(existente.apellidosEnc)
                const prevNombre = decryptPersonalText(existente.nombreEnc)

                const hayDiferencias =
                    prevApellidos.trim().toLowerCase() !== rawApellidos.trim().toLowerCase() ||
                    prevNombre.trim().toLowerCase() !== rawNombre.trim().toLowerCase() ||
                    (existente.cargo || '').trim() !== rawCargo ||
                    (existente.permisoParcial || '').trim() !== rawPermiso ||
                    (existente.establecimiento || '').trim() !== establecimiento.trim() ||
                    (existente.grupoOriginal || '').trim() !== String(rawGrupo || '').trim()

                if (hayDiferencias) {
                    potencialesActualizados++
                    const rutEnc = encryptPersonalText(rawRut)
                    const apellidosEnc = encryptPersonalText(rawApellidos)
                    const nombreEnc = encryptPersonalText(rawNombre)

                    let historial = []
                    try {
                        if (existente.historialActualizaciones) {
                            historial = JSON.parse(existente.historialActualizaciones)
                        }
                    } catch {
                        historial = []
                    }

                    historial.push({
                        fecha: ahora.toISOString(),
                        actualizadoPor: usuarioNombre,
                        cambios: {
                            cargoAnterior: existente.cargo,
                            cargoNuevo: rawCargo,
                            permisoAnterior: existente.permisoParcial,
                            permisoNuevo: rawPermiso
                        }
                    })

                    operaciones.push({
                        tipo: 'ACTUALIZAR',
                        existenteId: existente.id,
                        dataActualizar: {
                            rutEnc,
                            apellidosEnc,
                            nombreEnc,
                            establecimiento,
                            grupoOriginal: String(rawGrupo || '').trim(),
                            cargo: rawCargo || null,
                            permisoParcial: rawPermiso || null,
                            actualizadoPor: usuarioNombre,
                            actualizadoPorId: usuarioId || null,
                            fechaActualizacion: ahora,
                            numActualizaciones: { increment: 1 },
                            historialActualizaciones: JSON.stringify(historial)
                        }
                    })
                } else {
                    potencialesSinCambios++
                    operaciones.push({ tipo: 'SIN_CAMBIOS' })
                }
            }
        } catch (errRow: any) {
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: ${errRow.message || 'Error al validar registro'}`)
            operaciones.push({ tipo: 'ERROR', errorMsg: errRow.message })
        }
    }

    // 3. Validación estricta: Si no hay registros nuevos ni actualizados, BLOQUEAR LA CARGA
    if (potencialesNuevos === 0 && potencialesActualizados === 0) {
        if (cargaPrevia) {
            const fechaStr = new Date(cargaPrevia.createdAt).toLocaleString('es-CL')
            return {
                success: false,
                totalFilas: rows.length,
                nuevos: 0,
                actualizados: 0,
                sinCambios: potencialesSinCambios,
                errores: erroresCount,
                error: `Esta planilla ya fue cargada anteriormente el ${fechaStr} por ${cargaPrevia.cargadoPor}. No se permite cargar la misma planilla más de una vez ya que no contiene registros nuevos ni modificaciones pendientes.`
            }
        } else {
            return {
                success: false,
                totalFilas: rows.length,
                nuevos: 0,
                actualizados: 0,
                sinCambios: potencialesSinCambios,
                errores: erroresCount,
                error: `Todos los registros (${potencialesSinCambios}) de esta planilla ya se encuentran registrados en el sistema sin diferencias pendientes. No se realizó ninguna carga redundante.`
            }
        }
    }

    // 4. Si hay cambios o registros nuevos legítimos, crear la cabecera Pers_Asis_Carga
    const cargaCabecera = await (rawPrisma as any).pers_Asis_Carga.create({
        data: {
            nombreArchivo: archivoNombre,
            totalRegistros: rows.length,
            nuevosRegistros: potencialesNuevos,
            actualizadosRegistros: potencialesActualizados,
            erroresRegistros: erroresCount,
            cargadoPor: usuarioNombre,
            cargadoPorId: usuarioId || null,
            observaciones: rutaOrigen ? `Origen: ${rutaOrigen}` : null
        }
    })

    // 5. Aplicar operaciones en lote
    for (const op of operaciones) {
        if (op.tipo === 'NUEVO' && op.dataNuevo) {
            await (rawPrisma as any).pers_Asis_Registro.create({
                data: {
                    ...op.dataNuevo,
                    cargaId: cargaCabecera.id
                }
            })
        } else if (op.tipo === 'ACTUALIZAR' && op.dataActualizar && op.existenteId) {
            await (rawPrisma as any).pers_Asis_Registro.update({
                where: { id: op.existenteId },
                data: {
                    ...op.dataActualizar,
                    cargaId: cargaCabecera.id
                }
            })
        }
    }

    revalidatePath(PATH_CARGA)
    revalidatePath(PATH_ASISTENCIA)

    return {
        success: true,
        cargaId: cargaCabecera.id,
        totalFilas: rows.length,
        nuevos: potencialesNuevos,
        actualizados: potencialesActualizados,
        sinCambios: potencialesSinCambios,
        errores: erroresCount,
        detallesErrores: detallesErrores.slice(0, 15)
    }
}

export async function procesarArchivoExcelSubidoAction(formData: {
    base64Data: string
    nombreArchivo: string
}): Promise<ResultadoProcesamiento> {
    if (!await checkPermission()) {
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: 'No tienes permisos para realizar cargas masivas' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario Sistema'
    const usuarioId = session?.user?.id ? String(session.user.id) : undefined

    try {
        const buffer = Buffer.from(formData.base64Data, 'base64')
        const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true })
        return await procesarBufferWorkbook(workbook, formData.nombreArchivo, 'Subida interactiva web', usuarioNombre, usuarioId)
    } catch (error: any) {
        console.error('Error procesando archivo subido:', error)
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: error.message || 'Error al procesar el archivo Excel' }
    }
}

export async function procesarDesdeRutaServidorAction(rutaServidor: string): Promise<ResultadoProcesamiento> {
    if (!await checkPermission()) {
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: 'No tienes permisos para realizar cargas masivas' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario Sistema'
    const usuarioId = session?.user?.id ? String(session.user.id) : undefined

    const rutaNormalizada = rutaServidor.trim()
    if (!rutaNormalizada) {
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: 'La ruta del archivo en el servidor es requerida' }
    }

    try {
        if (!fs.existsSync(rutaNormalizada)) {
            return {
                success: false,
                totalFilas: 0,
                nuevos: 0,
                actualizados: 0,
                sinCambios: 0,
                errores: 0,
                error: `El archivo no existe en la ruta indicada: "${rutaNormalizada}"`
            }
        }

        const buffer = fs.readFileSync(rutaNormalizada)
        const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true })
        const archivoNombre = path.basename(rutaNormalizada)

        return await procesarBufferWorkbook(workbook, archivoNombre, rutaNormalizada, usuarioNombre, usuarioId)
    } catch (error: any) {
        console.error('Error procesando archivo desde servidor:', error)
        return { success: false, totalFilas: 0, nuevos: 0, actualizados: 0, sinCambios: 0, errores: 0, error: error.message || 'Error al leer el archivo en el servidor' }
    }
}

export async function getHistorialCargasAction() {
    await ensurePersonalAsistenciaTables()
    try {
        const cargas = await (rawPrisma as any).pers_Asis_Carga.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        })
        return {
            success: true,
            data: cargas.map((c: any) => ({
                id: c.id,
                archivoNombre: c.nombreArchivo,
                rutaOrigen: c.observaciones,
                totalRegistros: c.totalRegistros,
                nuevosRegistros: c.nuevosRegistros,
                actualizadosRegistros: c.actualizadosRegistros,
                subidoPorNombre: c.cargadoPor,
                createdAt: c.createdAt
            }))
        }
    } catch (error: any) {
        console.error('Error fetching Pers_Asis_Carga:', error)
        return { success: false, error: error.message || 'Error al obtener historial de cargas' }
    }
}

export async function eliminarCargaMasivaAction(cargaId: string): Promise<{ success: boolean; error?: string; eliminados?: number }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para eliminar cargas de asistencia' }
    }
    await ensurePersonalAsistenciaTables()

    try {
        // 1. Eliminar todos los registros de Pers_Asis_Registro asociados a esta cargaId
        const delRegistros = await (rawPrisma as any).pers_Asis_Registro.deleteMany({
            where: { cargaId }
        })

        // 2. Eliminar la cabecera en Pers_Asis_Carga
        await (rawPrisma as any).pers_Asis_Carga.delete({
            where: { id: cargaId }
        })

        revalidatePath(PATH_CARGA)
        revalidatePath(PATH_ASISTENCIA)

        return { success: true, eliminados: delRegistros.count }
    } catch (error: any) {
        console.error('Error al eliminar carga masiva:', error)
        return { success: false, error: error.message || 'Error al eliminar la carga' }
    }
}
