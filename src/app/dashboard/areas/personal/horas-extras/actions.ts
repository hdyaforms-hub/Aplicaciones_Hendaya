'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { encryptPersonalText, decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalHextraTables } from '@/lib/personal-hextra-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import * as xlsx from 'xlsx'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const PATH_HORAS_EXTRAS = '/dashboard/areas/personal/horas-extras'
const DEFAULT_TEST_FILE_PATH = 'D:\\Programas\\AplicacionWebDoctos\\Personal\\PLANILLA HORAS EXTRAS, FORMATO.xlsx'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_horas_extras_carga')
}

// Extrae RBD entero y nombre de establecimiento
function parseRbdField(rawRbd: any): { rbd: number | null; establecimiento: string | null; rbdRaw: string } {
    if (rawRbd === undefined || rawRbd === null || rawRbd === '') {
        return { rbd: null, establecimiento: null, rbdRaw: '' }
    }
    const str = String(rawRbd).trim()

    // Caso 1: Con paréntesis, con o sin DV y nombre. Ej: "(10253-9) LICEO ABDON CIFUENTES"
    const matchParenWithName = str.match(/^\(\s*(\d+)(?:-[\dkK])?\s*\)\s*(.*)/)
    if (matchParenWithName) {
        const num = parseInt(matchParenWithName[1], 10)
        const name = matchParenWithName[2]?.trim() || null
        return {
            rbd: isNaN(num) ? null : num,
            establecimiento: name || null,
            rbdRaw: str
        }
    }

    // Caso 2: Paréntesis en cualquier parte. Ej: "(10253-9)" o "(10253)"
    const matchAnyParen = str.match(/\(\s*(\d+)(?:-[\dkK])?\s*\)/)
    if (matchAnyParen) {
        const num = parseInt(matchAnyParen[1], 10)
        const resto = str.replace(matchAnyParen[0], '').trim()
        return {
            rbd: isNaN(num) ? null : num,
            establecimiento: resto || null,
            rbdRaw: str
        }
    }

    // Caso 3: Número directo sin paréntesis, con o sin DV: "10253-9" o "10253"
    const matchDirectNum = str.match(/^(\d+)(?:-[\dkK])?$/)
    if (matchDirectNum) {
        const num = parseInt(matchDirectNum[1], 10)
        return {
            rbd: isNaN(num) ? null : num,
            establecimiento: null,
            rbdRaw: str
        }
    }

    // Caso 4: No numérico
    return {
        rbd: null,
        establecimiento: str,
        rbdRaw: str
    }
}

// Homologa la sede / sucursal a los estándares corporativos Hendaya
function normalizeSede(sedeRaw: any): string {
    if (!sedeRaw) return 'CASA MATRIZ'
    const s = String(sedeRaw).toUpperCase().trim()
    if (s.includes('METRO')) return 'CD METRO'
    if (s.includes('COPIAPO') || s.includes('COPIAPÓ')) return 'CD COPIAPO'
    if (s.includes('COYHAIQUE')) return 'CD COYHAIQUE'
    if (s.includes('VALLENAR')) return 'CD VALLENAR'
    if (s.includes('MATRIZ')) return 'CASA MATRIZ'
    return String(sedeRaw).trim()
}

// Parsea fechas de Excel (número serial o cadena) a ISO YYYY-MM-DD
function parseFechaField(fechaRaw: any): { fechaIso: string; fechaSerial: string } {
    if (fechaRaw === undefined || fechaRaw === null || fechaRaw === '') {
        return { fechaIso: '', fechaSerial: '' }
    }

    const serialStr = String(fechaRaw).trim()

    // Si viene como número serial de Excel (ej: 46266)
    if (typeof fechaRaw === 'number' || /^\d{5}$/.test(serialStr)) {
        const serial = Number(fechaRaw)
        if (!isNaN(serial) && serial > 20000 && serial < 80000) {
            const utc_days = Math.floor(serial - 25569)
            const utc_value = utc_days * 86400
            const date_info = new Date(utc_value * 1000)
            const iso = date_info.toISOString().slice(0, 10)
            return { fechaIso: iso, fechaSerial: serialStr }
        }
    }

    // Si viene como texto DD/MM/YYYY o DD-MM-YYYY
    const matchDMY = serialStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (matchDMY) {
        const d = matchDMY[1].padStart(2, '0')
        const m = matchDMY[2].padStart(2, '0')
        const y = matchDMY[3]
        return { fechaIso: `${y}-${m}-${d}`, fechaSerial: serialStr }
    }

    // Si ya viene como YYYY-MM-DD
    const matchYMD = serialStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    if (matchYMD) {
        const y = matchYMD[1]
        const m = matchYMD[2].padStart(2, '0')
        const d = matchYMD[3].padStart(2, '0')
        return { fechaIso: `${y}-${m}-${d}`, fechaSerial: serialStr }
    }

    return { fechaIso: serialStr, fechaSerial: serialStr }
}

export interface HorasExtrasRegistroDTO {
    id: string
    identificador: string // Desencriptado
    apellidos: string // Desencriptado
    nombre: string // Desencriptado
    fecha: string // YYYY-MM-DD
    fechaSerial?: string | null
    rbd: number | null
    rbdRaw?: string | null
    establecimiento?: string | null
    institucion?: string | null
    sedeRaw?: string | null
    sucursal: string
    supervisor?: string | null
    turno?: string | null
    marco?: string | null
    salioTurno?: string | null
    entro?: string | null
    atraso: number
    justificado?: string | null
    salio?: string | null
    hhee: number
    hheeAtraso: number
    hheeRex: number
    montoPagar: number
    cargo?: string | null
    horasTotales?: string | null
}

export interface HorasExtrasResponse {
    success: boolean
    error?: string
    registros: HorasExtrasRegistroDTO[]
    total: number
    resumen: {
        totalRegistros: number
        totalPersonas: number
        totalRbds: number
        totalHorasRex: number
        totalMontoPagar: number
        sucursalesList: string[]
        supervisoresList: string[]
    }
    ultimaCarga: {
        id: string
        nombreArchivo: string
        totalRegistros: number
        nuevos: number
        actualizados: number
        cargadoPor: string
        fechaCarga: string
    } | null
}

/**
 * Consulta registros de Horas Extras con filtros, ordenamiento, desencriptación y paginación
 */
export async function getHorasExtrasDataAction(filtros?: {
    search?: string
    rbd?: number
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
    page?: number
    pageSize?: number
    sortField?: string
    sortOrder?: 'asc' | 'desc'
}): Promise<HorasExtrasResponse> {
    if (!await checkPermission()) {
        return {
            success: false,
            error: 'No tienes permisos para visualizar horas extras de personal',
            registros: [],
            total: 0,
            resumen: { totalRegistros: 0, totalPersonas: 0, totalRbds: 0, totalHorasRex: 0, totalMontoPagar: 0, sucursalesList: [], supervisoresList: [] },
            ultimaCarga: null
        }
    }

    await ensurePersonalHextraTables()

    const session = await getSession()
    if (!session || !session.user) {
        return {
            success: false,
            error: 'No autorizado',
            registros: [],
            total: 0,
            resumen: { totalRegistros: 0, totalPersonas: 0, totalRbds: 0, totalHorasRex: 0, totalMontoPagar: 0, sucursalesList: [], supervisoresList: [] },
            ultimaCarga: null
        }
    }

    const authorizedRbds = await getUserEffectiveRbds()
    const page = Math.max(1, filtros?.page || 1)
    const pageSize = Math.min(100, Math.max(5, filtros?.pageSize || 10))
    const offset = (page - 1) * pageSize
    const sortField = filtros?.sortField || 'fecha'
    const sortOrder = filtros?.sortOrder === 'asc' ? 'asc' : 'desc'

    try {
        // Metadatos de la última carga procesada
        let ultimaCargaRow: any = null
        try {
            const ultimasCargas: any[] = await rawPrisma.$queryRawUnsafe(`
                SELECT id, "nombreArchivo", "totalRegistros", nuevos, actualizados, "cargadoPor", "fechaCarga"
                FROM "Pers_Hextra_Carga"
                ORDER BY "fechaCarga" DESC
                LIMIT 1;
            `)
            if (ultimasCargas && ultimasCargas.length > 0) {
                ultimaCargaRow = ultimasCargas[0]
            }
        } catch (e) {
            console.error('Error consultando última carga en Pers_Hextra_Carga:', e)
        }

        const ultimaCarga = ultimaCargaRow ? {
            id: ultimaCargaRow.id,
            nombreArchivo: ultimaCargaRow.nombreArchivo,
            totalRegistros: ultimaCargaRow.totalRegistros,
            nuevos: ultimaCargaRow.nuevos || 0,
            actualizados: ultimaCargaRow.actualizados || 0,
            cargadoPor: ultimaCargaRow.cargadoPor,
            fechaCarga: new Date(ultimaCargaRow.fechaCarga).toLocaleString('es-CL')
        } : null

        // Construir condiciones SQL de filtrado
        const whereConditions: string[] = ['1=1']
        const queryParams: any[] = []
        let paramIndex = 1

        // 1. Privilegios por RBD efectivo del usuario
        if (authorizedRbds !== null) {
            if (authorizedRbds.length === 0) {
                whereConditions.push(`rbd = -999999`)
            } else if (filtros?.rbd) {
                if (authorizedRbds.includes(filtros.rbd)) {
                    whereConditions.push(`rbd = $${paramIndex++}`)
                    queryParams.push(filtros.rbd)
                } else {
                    whereConditions.push(`rbd = -999999`)
                }
            } else {
                whereConditions.push(`rbd = ANY($${paramIndex++})`)
                queryParams.push(authorizedRbds)
            }
        } else if (filtros?.rbd) {
            whereConditions.push(`rbd = $${paramIndex++}`)
            queryParams.push(filtros.rbd)
        }

        // 2. Filtro por Sucursal
        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            whereConditions.push(`sucursal = $${paramIndex++}`)
            queryParams.push(filtros.sucursal)
        }

        // 3. Filtro por Supervisor
        if (filtros?.supervisor && filtros.supervisor !== 'TODOS') {
            whereConditions.push(`supervisor = $${paramIndex++}`)
            queryParams.push(filtros.supervisor)
        }

        // 4. Rango de Fechas
        if (filtros?.fechaDesde) {
            whereConditions.push(`fecha >= $${paramIndex++}`)
            queryParams.push(filtros.fechaDesde)
        }
        if (filtros?.fechaHasta) {
            whereConditions.push(`fecha <= $${paramIndex++}`)
            queryParams.push(filtros.fechaHasta)
        }

        // 5. Búsqueda por RUT directo con hash
        let searchIsRutHash = false
        if (filtros?.search && filtros.search.trim()) {
            const cleanSearch = filtros.search.trim()
            const rutCleaned = cleanRut(cleanSearch)
            if (rutCleaned && rutCleaned.length >= 7) {
                const rHash = hashRut(rutCleaned)
                whereConditions.push(`"identificadorHash" = $${paramIndex++}`)
                queryParams.push(rHash)
                searchIsRutHash = true
            }
        }

        const whereSql = whereConditions.join(' AND ')

        // Listas distintas para filtros
        const sucursalesResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT sucursal FROM "Pers_Hextra_Registro" WHERE sucursal IS NOT NULL AND sucursal != '' ORDER BY sucursal ASC;`
        )
        const supervisoresResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT supervisor FROM "Pers_Hextra_Registro" WHERE supervisor IS NOT NULL AND supervisor != '' ORDER BY supervisor ASC;`
        )

        const sucursalesList = sucursalesResult.map(r => r.sucursal).filter(Boolean)
        const supervisoresList = supervisoresResult.map(r => r.supervisor).filter(Boolean)

        // Traer filas que cumplen los filtros base
        const rowsQuery = `
            SELECT * FROM "Pers_Hextra_Registro"
            WHERE ${whereSql}
        `
        const dbRows: any[] = await rawPrisma.$queryRawUnsafe(rowsQuery, ...queryParams)

        // Desencriptar datos personales (Identificador, Apellidos, Nombre)
        const registros: HorasExtrasRegistroDTO[] = dbRows.map(row => {
            const decryptedId = decryptPersonalText(row.identificadorEnc || '')
            const decryptedApellidos = decryptPersonalText(row.apellidosEnc || '')
            const decryptedNombre = decryptPersonalText(row.nombreEnc || '')

            return {
                id: row.id,
                identificador: decryptedId,
                apellidos: decryptedApellidos,
                nombre: decryptedNombre,
                fecha: row.fecha,
                fechaSerial: row.fechaSerial,
                rbd: row.rbd,
                rbdRaw: row.rbdRaw,
                establecimiento: row.establecimiento,
                institucion: row.institucion,
                sedeRaw: row.sedeRaw,
                sucursal: row.sucursal,
                supervisor: row.supervisor,
                turno: row.turno,
                marco: row.marco,
                salioTurno: row.salioTurno,
                entro: row.entro,
                atraso: Number(row.atraso || 0),
                justificado: row.justificado,
                salio: row.salio,
                hhee: Number(row.hhee || 0),
                hheeAtraso: Number(row.hheeAtraso || 0),
                hheeRex: Number(row.hheeRex || 0),
                montoPagar: Number(row.montoPagar || 0),
                cargo: row.cargo,
                horasTotales: row.horasTotales
            }
        })

        // Búsqueda en memoria por nombre, apellido, establecimiento o cargo si no fue por hash exacto
        let registrosFiltrados = registros
        if (filtros?.search && !searchIsRutHash && filtros.search.trim()) {
            const q = filtros.search.toLowerCase().trim()
            registrosFiltrados = registros.filter(r =>
                r.nombre.toLowerCase().includes(q) ||
                r.apellidos.toLowerCase().includes(q) ||
                r.identificador.toLowerCase().includes(q) ||
                (r.establecimiento && r.establecimiento.toLowerCase().includes(q)) ||
                (r.supervisor && r.supervisor.toLowerCase().includes(q)) ||
                (r.cargo && r.cargo.toLowerCase().includes(q))
            )
        }

        // Ordenamiento por columna seleccionada
        registrosFiltrados.sort((a, b) => {
            let valA: any = (a as any)[sortField]
            let valB: any = (b as any)[sortField]

            if (valA === undefined || valA === null) valA = ''
            if (valB === undefined || valB === null) valB = ''

            let comp = 0
            if (typeof valA === 'number' && typeof valB === 'number') {
                comp = valA - valB
            } else {
                comp = String(valA).localeCompare(String(valB), 'es', { numeric: true, sensitivity: 'base' })
            }

            return sortOrder === 'desc' ? -comp : comp
        })

        // Métricas de resumen calculadas sobre el conjunto filtrado
        const uniquePersons = new Set(registrosFiltrados.map(r => r.identificador)).size
        const uniqueRbds = new Set(registrosFiltrados.map(r => r.rbd).filter(Boolean)).size
        const totalHorasRex = Math.round(registrosFiltrados.reduce((acc, r) => acc + (r.hheeRex || 0), 0) * 100) / 100
        const totalMontoPagar = Math.round(registrosFiltrados.reduce((acc, r) => acc + (r.montoPagar || 0), 0))

        const total = registrosFiltrados.length
        const pagedRegistros = registrosFiltrados.slice(offset, offset + pageSize)

        return {
            success: true,
            registros: pagedRegistros,
            total,
            resumen: {
                totalRegistros: total,
                totalPersonas: uniquePersons,
                totalRbds: uniqueRbds,
                totalHorasRex,
                totalMontoPagar,
                sucursalesList,
                supervisoresList
            },
            ultimaCarga
        }
    } catch (error: any) {
        console.error('Error en getHorasExtrasDataAction:', error)
        return {
            success: false,
            error: error.message || 'Error al consultar las horas extras',
            registros: [],
            total: 0,
            resumen: { totalRegistros: 0, totalPersonas: 0, totalRbds: 0, totalHorasRex: 0, totalMontoPagar: 0, sucursalesList: [], supervisoresList: [] },
            ultimaCarga: null
        }
    }
}

/**
 * Procesa e inserta/actualiza una planilla de Horas Extras.
 * Regla: No permite registros duplicados; upserta por (identificadorHash, fecha).
 */
async function procesarPlanillaHextraBuffer(
    buffer: Buffer,
    nombreArchivo: string,
    usuarioNombre: string,
    usuarioId?: string
): Promise<{ success: boolean; total?: number; nuevos?: number; actualizados?: number; error?: string }> {
    await ensurePersonalHextraTables()

    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        return { success: false, error: 'El archivo Excel no contiene hojas de cálculo' }
    }

    const sheet = workbook.Sheets[sheetName]
    let rows: any[] = xlsx.utils.sheet_to_json(sheet, { range: 0, defval: '' })
    if (rows.length > 0 && !('Identificador' in rows[0]) && !('IDENTIFICADOR' in rows[0]) && !('Rut' in rows[0])) {
        rows = xlsx.utils.sheet_to_json(sheet, { range: 1, defval: '' })
    }

    if (rows.length === 0) {
        return { success: false, error: 'No se encontraron filas con datos de horas extras en la planilla' }
    }

    // Mapa de colegios para enriquecer nombres de establecimientos según RBD
    const colegiosMap = new Map<number, { nombre: string; sucursal: string }>()
    try {
        const colegios = await rawPrisma.colegios.findMany({
            select: { colRBD: true, nombreEstablecimiento: true, sucursal: true }
        })
        for (const col of colegios) {
            if (col.colRBD) {
                colegiosMap.set(Number(col.colRBD), {
                    nombre: col.nombreEstablecimiento,
                    sucursal: col.sucursal
                })
            }
        }
    } catch (e) {
        console.error('Error cargando colegios en Horas Extras:', e)
    }

    const cargaId = uuidv4()
    const ahora = new Date()

    // Registrar inicio del lote de carga
    await rawPrisma.$executeRawUnsafe(`
        INSERT INTO "Pers_Hextra_Carga" (id, "nombreArchivo", "totalRegistros", nuevos, actualizados, "cargadoPor", "cargadoPorId", "fechaCarga", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $6, $6);
    `, cargaId, nombreArchivo, rows.length, usuarioNombre, usuarioId || null, ahora)

    // Pre-cargar los registros existentes para identificar nuevos vs actualizados
    const existentesMap = new Map<string, string>() // key: `${rutHash}_${fecha}` -> id
    try {
        const existentes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT id, "identificadorHash", fecha FROM "Pers_Hextra_Registro";
        `)
        for (const e of existentes) {
            existentesMap.set(`${e.identificadorHash}_${e.fecha}`, e.id)
        }
    } catch (err) {
        console.error('Error consultando existentes en Pers_Hextra_Registro:', err)
    }

    let nuevosCount = 0
    let actualizadosCount = 0
    const batchSize = 100

    for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize)

        for (const row of chunk) {
            const rawId = String(row['Identificador'] || row['IDENTIFICADOR'] || row['Rut'] || row['RUT'] || '').trim()
            if (!rawId) continue

            const cleanedId = cleanRut(rawId)
            const idHash = hashRut(cleanedId)

            const rawFecha = row['Fecha'] || row['FECHA']
            const { fechaIso, fechaSerial } = parseFechaField(rawFecha)
            if (!fechaIso) continue

            const rawApellidos = String(row['Apellidos'] || row['APELLIDOS'] || '').trim()
            const rawNombre = String(row['Nombre'] || row['NOMBRE'] || '').trim()

            // 3 campos personales encriptados con AES-256-GCM
            const idEnc = encryptPersonalText(cleanedId || rawId)
            const apellidosEnc = encryptPersonalText(rawApellidos)
            const nombreEnc = encryptPersonalText(rawNombre)

            // RBD y establecimiento
            const rawRbdVal = row['RBD'] || row['Rbd'] || row['rbd']
            const parsedRbd = parseRbdField(rawRbdVal)
            const rbdNum = parsedRbd.rbd
            const colLookup = rbdNum ? colegiosMap.get(rbdNum) : null
            const establecimiento = colLookup?.nombre || parsedRbd.establecimiento || (rbdNum ? `RBD ${rbdNum}` : parsedRbd.rbdRaw)

            // Sede y homologación
            const rawSede = String(row['SEDE'] || row['Sede'] || row['sede'] || '').trim()
            const sucursal = normalizeSede(rawSede)

            const institucion = String(row['Institución'] || row['Institucion'] || row['INSTITUCION'] || '').trim() || null
            const supervisor = String(row['Supervisor'] || row['SUPERVISOR'] || '').trim() || null
            const turno = String(row['Turno'] || row['TURNO'] || '').trim() || null
            const marco = String(row['Marcó '] || row['Marco'] || row['MARCO'] || '').trim() || null
            const salioTurno = String(row['Salió turno'] || row['Salio turno'] || row['SALIO TURNO'] || '').trim() || null
            const entro = String(row['Entró'] || row['Entro'] || row['ENTRO'] || '').trim() || null
            const atraso = parseFloat(String(row['Atraso'] || 0)) || 0
            const justificado = String(row['Justificado'] || '').trim() || null
            const salio = String(row['Salió'] || row['Salio'] || row['SALIO'] || '').trim() || null
            const hhee = parseFloat(String(row['HHEE'] || 0)) || 0
            const hheeAtraso = parseFloat(String(row['HHEE atraso'] || 0)) || 0
            const hheeRex = parseFloat(String(row['HHEE rex'] || row['hhee rex'] || 0)) || 0
            const montoPagar = parseFloat(String(row[' $4,613 '] || row['$4,613'] || row['Monto'] || 0)) || 0
            const cargo = String(row['Justificado_1'] || row['Cargo'] || row['CARGO'] || '').trim() || null
            const horasTotales = String(row['Horas Totales'] || '').trim() || null

            const key = `${idHash}_${fechaIso}`
            const existeId = existentesMap.get(key)

            if (existeId) {
                // UPDATE existente: actualiza turnos, horas, montos, sucursal, etc., pero PRESERVA su cargaId original
                await rawPrisma.$executeRawUnsafe(`
                    UPDATE "Pers_Hextra_Registro"
                    SET "identificadorEnc" = $1,
                        "apellidosEnc" = $2,
                        "nombreEnc" = $3,
                        "fechaSerial" = $4,
                        rbd = $5,
                        "rbdRaw" = $6,
                        establecimiento = $7,
                        institucion = $8,
                        "sedeRaw" = $9,
                        sucursal = $10,
                        supervisor = $11,
                        turno = $12,
                        marco = $13,
                        "salioTurno" = $14,
                        entro = $15,
                        atraso = $16,
                        justificado = $17,
                        salio = $18,
                        hhee = $19,
                        "hheeAtraso" = $20,
                        "hheeRex" = $21,
                        "montoPagar" = $22,
                        cargo = $23,
                        "horasTotales" = $24,
                        "updatedAt" = $25
                    WHERE id = $26;
                `,
                    idEnc, apellidosEnc, nombreEnc, fechaSerial,
                    rbdNum, parsedRbd.rbdRaw || null, establecimiento, institucion, rawSede || null,
                    sucursal, supervisor, turno, marco, salioTurno,
                    entro, atraso, justificado, salio, hhee,
                    hheeAtraso, hheeRex, montoPagar, cargo, horasTotales,
                    ahora, existeId
                )
                actualizadosCount++
            } else {
                // INSERT nuevo: únicamente los registros nuevos se vinculan a esta nueva carga
                const newId = uuidv4()
                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "Pers_Hextra_Registro" (
                        id, "cargaId", "identificadorEnc", "identificadorHash", "apellidosEnc", "nombreEnc",
                        fecha, "fechaSerial", rbd, "rbdRaw", establecimiento, institucion,
                        "sedeRaw", sucursal, supervisor, turno, marco, "salioTurno",
                        entro, atraso, justificado, salio, hhee, "hheeAtraso",
                        "hheeRex", "montoPagar", cargo, "horasTotales", "createdAt", "updatedAt"
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6,
                        $7, $8, $9, $10, $11, $12,
                        $13, $14, $15, $16, $17, $18,
                        $19, $20, $21, $22, $23, $24,
                        $25, $26, $27, $28, $29, $29
                    );
                `,
                    newId, cargaId, idEnc, idHash, apellidosEnc, nombreEnc,
                    fechaIso, fechaSerial, rbdNum, parsedRbd.rbdRaw || null, establecimiento, institucion,
                    rawSede || null, sucursal, supervisor, turno, marco, salioTurno,
                    entro, atraso, justificado, salio, hhee, hheeAtraso,
                    hheeRex, montoPagar, cargo, horasTotales, ahora
                )
                existentesMap.set(key, newId)
                nuevosCount++
            }
        }
    }

    // Si no hubo registros nuevos (re-carga del mismo archivo con 0 registros nuevos), no crear período duplicado
    if (nuevosCount === 0) {
        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Hextra_Carga" WHERE id = $1;`, cargaId)
        return {
            success: true,
            total: rows.length,
            nuevos: 0,
            actualizados: actualizadosCount,
            error: `Esta planilla ya fue cargada anteriormente. No contiene registros nuevos (se conservó el archivo original).`
        }
    }

    // Actualizar resumen en la tabla de control (el total corresponde a los registros nuevos vinculados a este archivo)
    await rawPrisma.$executeRawUnsafe(`
        UPDATE "Pers_Hextra_Carga"
        SET "totalRegistros" = $1, nuevos = $1, actualizados = $2
        WHERE id = $3;
    `, nuevosCount, actualizadosCount, cargaId)

    // Registrar Auditoría
    await logAuditAction({
        username: usuarioNombre,
        userId: usuarioId || null,
        action: 'CARGA_HORAS_EXTRAS',
        modulo: 'Recursos Humanos',
        detalle: `Carga de Horas Extras procesada (${nombreArchivo}): ${nuevosCount} registros nuevos ingresados, ${actualizadosCount} registros existentes actualizados por identificador y fecha.`
    })

    revalidatePath(PATH_HORAS_EXTRAS)
    return { success: true, total: rows.length, nuevos: nuevosCount, actualizados: actualizadosCount }
}

/**
 * Server Action: Carga masiva desde archivo Excel subido por el cliente
 */
export async function cargarHorasExtrasAction(formData: FormData): Promise<{ success: boolean; total?: number; nuevos?: number; actualizados?: number; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para realizar cargas de horas extras' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File) || file.size === 0) {
        return { success: false, error: 'Debes seleccionar un archivo Excel (.xlsx) válido' }
    }

    try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return await procesarPlanillaHextraBuffer(buffer, file.name, usuarioNombre, usuarioId)
    } catch (error: any) {
        console.error('Error en cargarHorasExtrasAction:', error)
        return { success: false, error: error.message || 'Error al procesar el archivo Excel' }
    }
}

/**
 * Server Action: Carga directa desde la ruta local del servidor
 */
export async function cargarHorasExtrasDesdeArchivoLocalAction(): Promise<{ success: boolean; total?: number; nuevos?: number; actualizados?: number; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para realizar esta acción' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    if (!fs.existsSync(DEFAULT_TEST_FILE_PATH)) {
        return { success: false, error: `El archivo oficial no se encuentra en la ruta: ${DEFAULT_TEST_FILE_PATH}` }
    }

    try {
        const buffer = fs.readFileSync(DEFAULT_TEST_FILE_PATH)
        const nombreArchivo = path.basename(DEFAULT_TEST_FILE_PATH)
        return await procesarPlanillaHextraBuffer(buffer, nombreArchivo, usuarioNombre, usuarioId)
    } catch (error: any) {
        console.error('Error cargando archivo local de horas extras:', error)
        return { success: false, error: error.message || 'Error al leer el archivo local' }
    }
}

/**
 * Server Action: Vacía todos los registros de Horas Extras
 */
export async function eliminarHorasExtrasAction(): Promise<{ success: boolean; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para eliminar las horas extras' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    try {
        await ensurePersonalHextraTables()
        await rawPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Pers_Hextra_Registro";`)
        await rawPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Pers_Hextra_Carga";`)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId || null,
            action: 'ELIMINAR_HORAS_EXTRAS_MASIVA',
            modulo: 'Recursos Humanos',
            detalle: 'Eliminación total y limpieza de registros de horas extras de personal'
        })

        revalidatePath(PATH_HORAS_EXTRAS)
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar horas extras:', error)
        return { success: false, error: error.message || 'Error al eliminar horas extras' }
    }
}

/**
 * Server Action: Exporta registros filtrados a una planilla Excel con datos desencriptados
 */
export async function exportarHorasExtrasExcelAction(filtros?: {
    search?: string
    rbd?: number
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
}): Promise<{ success: boolean; dataBase64?: string; filename?: string; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para exportar horas extras' }
    }

    const res = await getHorasExtrasDataAction({
        ...filtros,
        page: 1,
        pageSize: 100000 // Todos los registros
    })

    if (!res.success || !res.registros) {
        return { success: false, error: res.error || 'No se pudieron obtener registros para exportar' }
    }

    try {
        const rowsExport = res.registros.map(r => ({
            'Fecha': r.fecha,
            'Identificador (RUT)': r.identificador,
            'Apellidos': r.apellidos,
            'Nombre': r.nombre,
            'RBD': r.rbd || '',
            'Establecimiento': r.establecimiento || '',
            'Institución': r.institucion || '',
            'Sucursal': r.sucursal,
            'Supervisor': r.supervisor || '',
            'Cargo': r.cargo || '',
            'Turno': r.turno || '',
            'Marcó': r.marco || '',
            'Entró': r.entro || '',
            'Salió': r.salio || '',
            'Atraso': r.atraso,
            'Justificado': r.justificado || '',
            'HHEE': r.hhee,
            'HHEE atraso': r.hheeAtraso,
            'HHEE Rex': r.hheeRex,
            'Monto a Pagar ($)': r.montoPagar
        }))

        const ws = xlsx.utils.json_to_sheet(rowsExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Horas Extras')
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
        const base64 = buffer.toString('base64')
        const filename = `Horas_Extras_${new Date().toISOString().slice(0, 10)}.xlsx`

        return { success: true, dataBase64: base64, filename }
    } catch (error: any) {
        console.error('Error generando exportación Excel de horas extras:', error)
        return { success: false, error: error.message || 'Error al generar planilla Excel' }
    }
}
