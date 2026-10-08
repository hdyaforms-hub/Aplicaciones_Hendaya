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

// Extrae RBD y Establecimiento desde la columna "Grupo", ej: "(10516) EL LLANO DE PIRQUE"
export function parseGrupoRBD(grupoRaw: string | number | null | undefined): { rbd: number; establecimiento: string } {
    if (!grupoRaw) return { rbd: 0, establecimiento: 'Sin Establecimiento' }
    const str = String(grupoRaw).trim()
    const match = str.match(/\((\d+)\)\s*(.*)/)
    if (match) {
        return {
            rbd: parseInt(match[1], 10),
            establecimiento: match[2]?.trim() || `RBD ${match[1]}`
        }
    }
    const matchNumber = str.match(/^(\d+)\s*(.*)/)
    if (matchNumber) {
        return {
            rbd: parseInt(matchNumber[1], 10),
            establecimiento: matchNumber[2]?.trim() || `RBD ${matchNumber[1]}`
        }
    }
    return { rbd: 0, establecimiento: str }
}

// Normaliza fecha del excel a formato 'YYYY-MM-DD'
export function parseExcelFecha(rawFecha: any): { dateStr: string } | null {
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

    // 1. Crear cabecera Pers_Asis_Carga
    const cargaCabecera = await (rawPrisma as any).pers_Asis_Carga.create({
        data: {
            nombreArchivo: archivoNombre,
            totalRegistros: rows.length,
            nuevosRegistros: 0,
            actualizadosRegistros: 0,
            erroresRegistros: 0,
            cargadoPor: usuarioNombre,
            cargadoPorId: usuarioId || null,
            observaciones: rutaOrigen ? `Origen: ${rutaOrigen}` : null
        }
    })

    let nuevosCount = 0
    let actualizadosCount = 0
    let sinCambiosCount = 0
    let erroresCount = 0
    const detallesErrores: string[] = []
    const ahora = new Date()

    // 2. Procesar filas
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
            continue
        }

        const cleanRutVal = cleanRut(rawRut)
        if (!cleanRutVal) {
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: Formato de RUT inválido (${rawRut})`)
            continue
        }

        const rutHash = hashRut(cleanRutVal)
        const parsedFecha = parseExcelFecha(rawFecha)
        if (!parsedFecha) {
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: Formato de Fecha no reconocible (${rawFecha})`)
            continue
        }

        const { rbd, establecimiento } = parseGrupoRBD(rawGrupo)

        const rutEnc = encryptPersonalText(rawRut)
        const apellidosEnc = encryptPersonalText(rawApellidos)
        const nombreEnc = encryptPersonalText(rawNombre)

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
                await (rawPrisma as any).pers_Asis_Registro.create({
                    data: {
                        cargaId: cargaCabecera.id,
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
                nuevosCount++
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
                        cargaId: cargaCabecera.id,
                        cambios: {
                            cargoAnterior: existente.cargo,
                            cargoNuevo: rawCargo,
                            permisoAnterior: existente.permisoParcial,
                            permisoNuevo: rawPermiso
                        }
                    })

                    await (rawPrisma as any).pers_Asis_Registro.update({
                        where: { id: existente.id },
                        data: {
                            cargaId: cargaCabecera.id,
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
                    actualizadosCount++
                } else {
                    sinCambiosCount++
                }
            }
        } catch (errRow: any) {
            console.error(`Error procesando fila ${i + 2}:`, errRow)
            erroresCount++
            detallesErrores.push(`Fila ${i + 2}: ${errRow.message || 'Error en base de datos'}`)
        }
    }

    // 3. Actualizar conteos en cabecera
    await (rawPrisma as any).pers_Asis_Carga.update({
        where: { id: cargaCabecera.id },
        data: {
            nuevosRegistros: nuevosCount,
            actualizadosRegistros: actualizadosCount,
            erroresRegistros: erroresCount
        }
    })

    revalidatePath(PATH_CARGA)
    revalidatePath(PATH_ASISTENCIA)

    return {
        success: true,
        cargaId: cargaCabecera.id,
        totalFilas: rows.length,
        nuevos: nuevosCount,
        actualizados: actualizadosCount,
        sinCambios: sinCambiosCount,
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
