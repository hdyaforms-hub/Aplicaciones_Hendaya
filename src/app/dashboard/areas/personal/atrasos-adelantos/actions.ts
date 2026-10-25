'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import * as xlsx from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import {
    encryptPersonalText,
    decryptPersonalText,
    cleanRut,
    hashRut
} from '@/lib/personal-crypto'
import { ensurePersonalAtrasosTables } from '@/lib/personal-atrasos-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

const PATH_ATRASOS_CARGA = '/dashboard/areas/personal/atrasos-adelantos'
const PATH_ATRASOS_ASISTENCIA = '/dashboard/areas/personal/asistencia/atrasos-adelantos'
const PATH_ATRASOS_ADM = '/dashboard/areas/personal/administracion/atrasos-adelantos'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_atrasos_carga')
}

// Parsea el RBD y el nombre de establecimiento soportando formatos como "(10522-8) SAN JUAN DE PIRQUE", "(10638) LICEO A131 BASICA", "10187 MADRE ANA EUGENIA", etc.
function extractRbdAndEstablecimiento(grupoRaw: any, ccRaw: any, grupoMarcacionRaw: any, rbdRaw?: any): { rbd: number | null; establecimiento: string | null; rbdRaw: string } {
    const candidates = [grupoRaw, ccRaw, grupoMarcacionRaw, rbdRaw].filter(Boolean).map(x => String(x).trim())
    for (const str of candidates) {
        // Formato (10522-8) SAN JUAN DE PIRQUE o (10522) SAN JUAN DE PIRQUE
        const matchParen = str.match(/^\((\d{3,7})(?:-[\w\d])?\)\s*(.*)$/)
        if (matchParen) {
            return {
                rbd: parseInt(matchParen[1], 10),
                establecimiento: matchParen[2].trim() || null,
                rbdRaw: str
            }
        }
        // Formato 10187 MADRE ANA EUGENIA o 7683 - LICEO BICENTENARIO
        const matchNumPrefix = str.match(/^(\d{3,7})\s*(?:[-–—]\s*)?(.*)$/)
        if (matchNumPrefix) {
            return {
                rbd: parseInt(matchNumPrefix[1], 10),
                establecimiento: matchNumPrefix[2].trim() || null,
                rbdRaw: str
            }
        }
        // Formato tipo "RBD 7683" o "RBD: 7683"
        const matchPrefix = str.match(/^(?:RBD|rbd)[:\s]*(\d{3,7})\b(.*)$/i)
        if (matchPrefix) {
            return {
                rbd: parseInt(matchPrefix[1], 10),
                establecimiento: matchPrefix[2].trim() || null,
                rbdRaw: str
            }
        }
        // Numérico puro
        if (/^\d{3,7}$/.test(str)) {
            const num = parseInt(str, 10)
            return {
                rbd: isNaN(num) ? null : num,
                establecimiento: null,
                rbdRaw: str
            }
        }
    }

    const fallbackEst = ccRaw || grupoRaw || grupoMarcacionRaw || rbdRaw || null
    return {
        rbd: null,
        establecimiento: fallbackEst ? String(fallbackEst).trim() : null,
        rbdRaw: candidates[0] || ''
    }
}

// Homologa la sede / sucursal a los estándares corporativos Hendaya
function normalizeSede(sedeRaw: any, ccRaw?: any, grupoRaw?: any, grupoMarcacionRaw?: any): string {
    const combined = `${sedeRaw || ''} ${ccRaw || ''} ${grupoRaw || ''} ${grupoMarcacionRaw || ''}`.toUpperCase().trim()
    if (combined.includes('METRO') || combined.includes('METROPOLITANA')) return 'CD METRO'
    if (combined.includes('COPIAPO') || combined.includes('COPIAPÓ')) return 'CD COPIAPO'
    if (combined.includes('COYHAIQUE')) return 'CD COYHAIQUE'
    if (combined.includes('VALLENAR')) return 'CD VALLENAR'
    if (combined.includes('MATRIZ')) return 'CASA MATRIZ'
    return 'CASA MATRIZ'
}

// Formatea horas de Excel (fracción de día como 0.6875 -> "16:30", o cadena)
function formatExcelTime(val: any): string | null {
    if (val === undefined || val === null || val === '') return null
    if (typeof val === 'number') {
        const timeFraction = val >= 1 ? val % 1 : val
        if (timeFraction >= 0 && timeFraction <= 1) {
            const totalSeconds = Math.round(timeFraction * 86400)
            const hours = Math.floor(totalSeconds / 3600) % 24
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        }
    }
    const s = String(val).trim()
    const matchTime = s.match(/^(\d{1,2}):(\d{2})/)
    if (matchTime) {
        return `${matchTime[1].padStart(2, '0')}:${matchTime[2]}`
    }
    return s || null
}

// Parsea fechas de Excel (número serial o cadena) a ISO YYYY-MM-DD
function parseFechaField(fechaRaw: any): { fechaIso: string; fechaSerial: string } {
    if (fechaRaw === undefined || fechaRaw === null || fechaRaw === '') {
        return { fechaIso: '', fechaSerial: '' }
    }

    const serialStr = String(fechaRaw).trim()

    // Si viene como número serial de Excel (ej: 46314)
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

// Parsea minutos u horas (ej: fracción de día 0.208333 -> 300 min, "00:15:00" -> 15 min, 15 -> 15 min)
function parseMinutes(val: any): { minutes: number; text: string } {
    if (val === undefined || val === null || val === '') {
        return { minutes: 0, text: '0 min' }
    }
    if (typeof val === 'number') {
        // En Excel, fracciones de día como 0.208333 (5 hrs = 300 min) o 0.0125 (18 min)
        if (val > 0 && val <= 1) {
            const mins = Math.round(val * 1440)
            return { minutes: mins, text: `${mins} min` }
        }
        const rounded = Math.round(val * 100) / 100
        return { minutes: rounded, text: `${rounded} min` }
    }
    const s = String(val).trim()
    const matchTime = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (matchTime) {
        const h = parseInt(matchTime[1], 10)
        const m = parseInt(matchTime[2], 10)
        const total = h * 60 + m
        return { minutes: total, text: `${total} min` }
    }
    const cleanNum = parseFloat(s.replace(/[^0-9.]/g, ''))
    if (!isNaN(cleanNum)) {
        return { minutes: cleanNum, text: `${cleanNum} min` }
    }
    return { minutes: 0, text: '0 min' }
}

export interface AtrasosRegistroDTO {
    id: string
    tipo: 'ADELANTO' | 'ATRASO'
    cargaId: string | null
    identificador: string // Desencriptado
    apellidos: string // Desencriptado
    nombre: string // Desencriptado
    nombreCompleto: string
    fecha: string // YYYY-MM-DD
    fechaSerial?: string | null
    rbd: number | null
    rbdRaw?: string | null
    establecimiento?: string | null
    institucion?: string | null
    sedeRaw?: string | null
    sucursal: string
    supervisor?: string | null
    cargo?: string | null
    turno?: string | null
    marco?: string | null
    entro?: string | null
    salio?: string | null
    salioTurno?: string | null
    horaFinTurno?: string | null
    horaInicioTurno?: string | null
    horaLlegada?: string | null
    holguraMin?: number
    grupoMarcacion?: string | null
    minutosAtraso: number
    minutosAdelanto: number
    minutosJustificados: number
    horasAtraso?: string | null
    horasAdelanto?: string | null
    justificado?: string | null
    justificadoPor?: string | null
    centroCostos?: string | null
    grupoUsuario?: string | null
    aplicaDescuento: boolean
    aplicaModificadoPor?: string | null
    aplicaModificadoAt?: string | null
    observacion?: string | null
    estado: string
    cerradoPor?: string | null
    cerradoAt?: string | null
}

export interface AtrasosResponse {
    success: boolean
    error?: string
    tipoActual: 'ADELANTO' | 'ATRASO'
    registros: AtrasosRegistroDTO[]
    total: number
    resumen: {
        totalRegistros: number
        totalPersonas: number
        totalRbds: number
        totalMinutosAtraso: number
        totalMinutosAdelanto: number
        totalMinutosJustificados: number
        totalAplicaDescuento: number
        totalJustificados: number
        sucursalesList: string[]
        supervisoresList: string[]
    }
    ultimaCarga: {
        id: string
        tipo: 'ADELANTO' | 'ATRASO'
        nombreArchivo: string
        totalRegistros: number
        nuevos: number
        actualizados: number
        cargadoPor: string
        fechaCarga: string
    } | null
}

/**
 * Consulta registros de Atrasos y Adelantos con filtros, ordenamiento, desencriptación y paginación
 */
export async function getAtrasosDataAction(filtros?: {
    tipo?: 'ADELANTO' | 'ATRASO'
    search?: string
    rbd?: number
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
    aplicaDescuento?: 'TODOS' | 'APLICA' | 'NO_APLICA'
    estado?: 'TODOS' | 'ABIERTO' | 'CERRADO'
    page?: number
    pageSize?: number
    sortField?: string
    sortOrder?: 'asc' | 'desc'
}): Promise<AtrasosResponse> {
    const tipoActual: 'ADELANTO' | 'ATRASO' = filtros?.tipo || 'ADELANTO'

    if (!await checkPermission()) {
        return {
            success: false,
            error: 'No tienes permisos para visualizar atrasos y adelantos',
            tipoActual,
            registros: [],
            total: 0,
            resumen: { totalRegistros: 0, totalPersonas: 0, totalRbds: 0, totalMinutosAtraso: 0, totalMinutosAdelanto: 0, totalMinutosJustificados: 0, totalAplicaDescuento: 0, totalJustificados: 0, sucursalesList: [], supervisoresList: [] },
            ultimaCarga: null
        }
    }

    await ensurePersonalAtrasosTables()

    const session = await getSession()
    if (!session || !session.user) {
        return {
            success: false,
            error: 'No autorizado',
            tipoActual,
            registros: [],
            total: 0,
            resumen: { totalRegistros: 0, totalPersonas: 0, totalRbds: 0, totalMinutosAtraso: 0, totalMinutosAdelanto: 0, totalMinutosJustificados: 0, totalAplicaDescuento: 0, totalJustificados: 0, sucursalesList: [], supervisoresList: [] },
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
        // Metadatos de la última carga procesada para este tipo
        let ultimaCargaRow: any = null
        try {
            const rows: any[] = await rawPrisma.$queryRawUnsafe(`
                SELECT id, tipo, "nombreArchivo", "totalRegistros", nuevos, actualizados, "cargadoPor", "fechaCarga"
                FROM "Pers_Atrasos_Carga"
                WHERE tipo = $1
                ORDER BY "fechaCarga" DESC
                LIMIT 1;
            `, tipoActual)
            if (rows && rows.length > 0) ultimaCargaRow = rows[0]
        } catch {}

        const ultimaCarga = ultimaCargaRow ? {
            id: ultimaCargaRow.id,
            tipo: (ultimaCargaRow.tipo || tipoActual) as 'ADELANTO' | 'ATRASO',
            nombreArchivo: ultimaCargaRow.nombreArchivo,
            totalRegistros: Number(ultimaCargaRow.totalRegistros || 0),
            nuevos: Number(ultimaCargaRow.nuevos || 0),
            actualizados: Number(ultimaCargaRow.actualizados || 0),
            cargadoPor: ultimaCargaRow.cargadoPor,
            fechaCarga: ultimaCargaRow.fechaCarga ? new Date(ultimaCargaRow.fechaCarga).toISOString() : ''
        } : null

        // Construir condiciones SQL
        const whereConditions: string[] = []
        const queryParams: any[] = []
        let paramIndex = 1

        // Filtro estricto por tipo ('ADELANTO' o 'ATRASO')
        whereConditions.push(`tipo = $${paramIndex++}`)
        queryParams.push(tipoActual)

        // Restricción por RBD asignado
        if (authorizedRbds !== null) {
            if (authorizedRbds.length === 0) {
                whereConditions.push('1 = 0')
            } else if (filtros?.rbd) {
                if (authorizedRbds.includes(filtros.rbd)) {
                    whereConditions.push(`rbd = $${paramIndex++}`)
                    queryParams.push(filtros.rbd)
                } else {
                    whereConditions.push('1 = 0')
                }
            } else {
                whereConditions.push(`rbd = ANY($${paramIndex++}::int[])`)
                queryParams.push(authorizedRbds)
            }
        } else if (filtros?.rbd) {
            whereConditions.push(`rbd = $${paramIndex++}`)
            queryParams.push(filtros.rbd)
        }

        // Filtro por Sucursal
        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            whereConditions.push(`sucursal = $${paramIndex++}`)
            queryParams.push(filtros.sucursal)
        }

        // Filtro por Supervisor
        if (filtros?.supervisor && filtros.supervisor !== 'TODOS') {
            whereConditions.push(`supervisor = $${paramIndex++}`)
            queryParams.push(filtros.supervisor)
        }

        // Rango de Fechas
        if (filtros?.fechaDesde) {
            whereConditions.push(`fecha >= $${paramIndex++}`)
            queryParams.push(filtros.fechaDesde)
        }
        if (filtros?.fechaHasta) {
            whereConditions.push(`fecha <= $${paramIndex++}`)
            queryParams.push(filtros.fechaHasta)
        }

        // Filtro Aplica Descuento
        if (filtros?.aplicaDescuento && filtros.aplicaDescuento !== 'TODOS') {
            if (filtros.aplicaDescuento === 'APLICA') {
                whereConditions.push(`"aplicaDescuento" IS TRUE`)
            } else if (filtros.aplicaDescuento === 'NO_APLICA') {
                whereConditions.push(`("aplicaDescuento" IS FALSE OR "aplicaDescuento" IS NULL)`)
            }
        }

        // Filtro Estado
        if (filtros?.estado && filtros.estado !== 'TODOS') {
            whereConditions.push(`estado = $${paramIndex++}`)
            queryParams.push(filtros.estado)
        }

        // Búsqueda por RUT directo con hash
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

        const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

        // Consultar sucursales y supervisores disponibles para este tipo
        const sucursalesRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT sucursal FROM "Pers_Atrasos_Registro"
            WHERE tipo = $1 AND sucursal IS NOT NULL AND sucursal <> ''
            ORDER BY sucursal ASC;
        `, tipoActual)
        const sucursalesList = sucursalesRows.map(r => r.sucursal)

        const supervisoresRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT supervisor FROM "Pers_Atrasos_Registro"
            WHERE tipo = $1 AND supervisor IS NOT NULL AND supervisor <> ''
            ORDER BY supervisor ASC;
        `, tipoActual)
        const supervisoresList = supervisoresRows.map(r => r.supervisor)

        // Traer registros coincidentes
        const rawRegistros: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT * FROM "Pers_Atrasos_Registro"
            ${whereSql}
            ORDER BY fecha DESC, rbd ASC, id ASC;
        `, ...queryParams)

        // Desencriptar datos sensibles
        let registrosDesencriptados: AtrasosRegistroDTO[] = rawRegistros.map(r => {
            const identificador = decryptPersonalText(r.identificadorEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)
            const nombreCompleto = `${nombre} ${apellidos}`.trim()

            return {
                id: r.id,
                tipo: (r.tipo || 'ADELANTO') as 'ADELANTO' | 'ATRASO',
                cargaId: r.cargaId,
                identificador,
                apellidos,
                nombre,
                nombreCompleto,
                fecha: r.fecha,
                fechaSerial: r.fechaSerial,
                rbd: r.rbd,
                rbdRaw: r.rbdRaw,
                establecimiento: r.establecimiento,
                institucion: r.institucion,
                sedeRaw: r.sedeRaw,
                sucursal: r.sucursal || 'CASA MATRIZ',
                supervisor: r.supervisor,
                cargo: r.cargo,
                turno: r.turno,
                marco: r.marco,
                entro: r.entro,
                salio: r.salio,
                salioTurno: r.salioTurno,
                horaFinTurno: r.horaFinTurno || r.salioTurno || null,
                horaInicioTurno: r.horaInicioTurno || null,
                horaLlegada: r.horaLlegada || null,
                holguraMin: Number(r.holguraMin || 0),
                grupoMarcacion: r.grupoMarcacion || null,
                minutosAtraso: Number(r.minutosAtraso || 0),
                minutosAdelanto: Number(r.minutosAdelanto || 0),
                minutosJustificados: Number(r.minutosJustificados || 0),
                horasAtraso: r.horasAtraso,
                horasAdelanto: r.horasAdelanto,
                justificado: r.justificado,
                justificadoPor: r.justificadoPor || null,
                centroCostos: r.centroCostos || null,
                grupoUsuario: r.grupoUsuario || null,
                aplicaDescuento: Boolean(r.aplicaDescuento),
                aplicaModificadoPor: r.aplicaModificadoPor,
                aplicaModificadoAt: r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toISOString() : null,
                observacion: r.observacion,
                estado: r.estado || 'ABIERTO',
                cerradoPor: r.cerradoPor,
                cerradoAt: r.cerradoAt ? new Date(r.cerradoAt).toISOString() : null
            }
        })

        // Si la búsqueda era texto libre (nombre, apellidos o colegio)
        if (filtros?.search && filtros.search.trim() && !searchIsRutHash) {
            const term = filtros.search.toLowerCase().trim()
            registrosDesencriptados = registrosDesencriptados.filter(r =>
                r.nombreCompleto.toLowerCase().includes(term) ||
                r.identificador.toLowerCase().includes(term) ||
                (r.establecimiento && r.establecimiento.toLowerCase().includes(term)) ||
                (r.supervisor && r.supervisor.toLowerCase().includes(term))
            )
        }

        // Ordenamiento
        registrosDesencriptados.sort((a, b) => {
            let valA: any = a[sortField as keyof AtrasosRegistroDTO] ?? ''
            let valB: any = b[sortField as keyof AtrasosRegistroDTO] ?? ''
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()
            const comp = valA < valB ? -1 : valA > valB ? 1 : 0
            return sortOrder === 'desc' ? -comp : comp
        })

        // Métricas
        const uniquePersons = new Set(registrosDesencriptados.map(r => r.identificador)).size
        const uniqueRbds = new Set(registrosDesencriptados.map(r => r.rbd).filter(Boolean)).size
        const totalMinutosAtraso = Math.round(registrosDesencriptados.reduce((acc, r) => acc + (r.minutosAtraso || 0), 0))
        const totalMinutosAdelanto = Math.round(registrosDesencriptados.reduce((acc, r) => acc + (r.minutosAdelanto || 0), 0))
        const totalMinutosJustificados = Math.round(registrosDesencriptados.reduce((acc, r) => acc + (r.minutosJustificados || 0), 0))
        const totalAplicaDescuento = registrosDesencriptados.filter(r => r.aplicaDescuento).length
        const totalJustificados = registrosDesencriptados.filter(r => r.justificado && r.justificado.toLowerCase() !== 'no').length

        const total = registrosDesencriptados.length
        const pagedRegistros = registrosDesencriptados.slice(offset, offset + pageSize)

        return {
            success: true,
            tipoActual,
            registros: pagedRegistros,
            total,
            resumen: {
                totalRegistros: total,
                totalPersonas: uniquePersons,
                totalRbds: uniqueRbds,
                totalMinutosAtraso,
                totalMinutosAdelanto,
                totalMinutosJustificados,
                totalAplicaDescuento,
                totalJustificados,
                sucursalesList,
                supervisoresList
            },
            ultimaCarga
        }
    } catch (error: any) {
        console.error('Error en getAtrasosDataAction:', error)
        return {
            success: false,
            error: error.message || 'Error al consultar los atrasos y adelantos',
            tipoActual,
            registros: [],
            total: 0,
            resumen: { totalRegistros: 0, totalPersonas: 0, totalRbds: 0, totalMinutosAtraso: 0, totalMinutosAdelanto: 0, totalMinutosJustificados: 0, totalAplicaDescuento: 0, totalJustificados: 0, sucursalesList: [], supervisoresList: [] },
            ultimaCarga: null
        }
    }
}

/**
 * Procesa e inserta/actualiza una planilla de Atrasos o Adelantos.
 * Regla: No permite registros duplicados; upserta por (identificadorHash, fecha, tipo).
 * Auto-detecta si el archivo es de Atrasos o Adelantos en base al contenido.
 */
export async function procesarPlanillaAtrasosBuffer(
    buffer: Buffer,
    nombreArchivo: string,
    usuarioNombre: string,
    usuarioId?: string,
    tipoHint?: 'ADELANTO' | 'ATRASO'
): Promise<{ success: boolean; tipo?: 'ADELANTO' | 'ATRASO'; total?: number; nuevos?: number; actualizados?: number; error?: string }> {
    await ensurePersonalAtrasosTables()

    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        return { success: false, error: 'El archivo Excel no contiene hojas de cálculo' }
    }

    const sheet = workbook.Sheets[sheetName]
    let rows: any[] = xlsx.utils.sheet_to_json(sheet, { range: 0, defval: '' })
    if (rows.length > 0 && !('Identificador' in rows[0]) && !('IDENTIFICADOR' in rows[0]) && !('Rut' in rows[0]) && !('RUT' in rows[0]) && !('Apellidos' in rows[0])) {
        rows = xlsx.utils.sheet_to_json(sheet, { range: 1, defval: '' })
    }

    if (rows.length === 0) {
        return { success: false, error: 'No se encontraron filas con datos en la planilla seleccionada' }
    }

    // Auto-detección inteligente del tipo de planilla (Atraso vs Adelanto)
    const firstRowKeys = Object.keys(rows[0] || {})
    const isAtraso = sheetName.toLowerCase().includes('atraso') || 
        firstRowKeys.some(k => /minutos de atraso|hora llegada|holgura|marcaci[oó]n|reporte atraso/i.test(k))
    const isAdelanto = firstRowKeys.some(k => /minutos adelanto|hora fin turno|hora salida|salida anticipada/i.test(k))

    const tipoFinal: 'ADELANTO' | 'ATRASO' = isAtraso ? 'ATRASO' : (isAdelanto ? 'ADELANTO' : (tipoHint || 'ADELANTO'))

    // 1. Verificación preventiva contra archivos duplicados por nombre y tipo
    const cargaMismoNombre: any[] = await rawPrisma.$queryRawUnsafe(`
        SELECT id, "nombreArchivo", "totalRegistros", "cargadoPor", "fechaCarga", estado, tipo
        FROM "Pers_Atrasos_Carga"
        WHERE LOWER(TRIM("nombreArchivo")) = LOWER(TRIM($1)) AND tipo = $2
        ORDER BY "fechaCarga" DESC
        LIMIT 1;
    `, nombreArchivo.trim(), tipoFinal)

    if (cargaMismoNombre && cargaMismoNombre.length > 0) {
        const previa = cargaMismoNombre[0]
        const fechaStr = previa.fechaCarga ? new Date(previa.fechaCarga).toLocaleString('es-CL') : 'anteriormente'
        return {
            success: false,
            tipo: tipoFinal,
            error: `La planilla "${nombreArchivo}" (${tipoFinal}) ya fue cargada en el sistema el ${fechaStr} por ${previa.cargadoPor} (${previa.totalRegistros} filas). No se permite cargar la misma planilla repetida.`
        }
    }

    // 2. Pre-cargar los registros existentes en Pers_Atrasos_Registro para este tipo
    const existentesMap = new Map<string, string>() // key: `${rutHash}_${fecha}_${tipo}` -> id
    try {
        const existentes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT id, "identificadorHash", fecha, tipo FROM "Pers_Atrasos_Registro" WHERE tipo = $1;
        `, tipoFinal)
        for (const e of existentes) {
            existentesMap.set(`${e.identificadorHash}_${e.fecha}_${e.tipo}`, e.id)
        }
    } catch (err) {
        console.error('Error consultando existentes en Pers_Atrasos_Registro:', err)
    }

    // 3. Pre-análisis de filas para verificar si hay información nueva
    let filasValidas = 0
    let filasNuevas = 0
    for (const row of rows) {
        const rawId = String(row['Identificador'] || row['IDENTIFICADOR'] || row['Rut'] || row['RUT'] || row['rut'] || '').trim()
        if (!rawId) continue
        const cleanedId = cleanRut(rawId)
        const idHash = hashRut(cleanedId)

        const rawFecha = row['Fecha'] || row['FECHA'] || row['fecha'] || row['Dia'] || row['DIA']
        const { fechaIso } = parseFechaField(rawFecha)
        if (!fechaIso) continue

        filasValidas++
        const uniqueKey = `${idHash}_${fechaIso}_${tipoFinal}`
        if (!existentesMap.has(uniqueKey)) {
            filasNuevas++
        }
    }

    if (filasValidas === 0) {
        return { success: false, tipo: tipoFinal, error: 'No se encontraron registros válidos con RUT y Fecha en el archivo seleccionado' }
    }

    // Si todas las filas ya existen en la base de datos (0 filas nuevas), se bloquea la carga repetida
    if (filasNuevas === 0) {
        return {
            success: false,
            tipo: tipoFinal,
            error: `Todos los registros de esta planilla de ${tipoFinal} (${filasValidas} filas) ya existen en el sistema para sus respectivas fechas. No se permite cargar información repetida.`
        }
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
        console.error('Error cargando colegios en Atrasos/Adelantos:', e)
    }

    const cargaId = uuidv4()
    const ahora = new Date()

    // Registrar inicio del lote de carga
    await rawPrisma.$executeRawUnsafe(`
        INSERT INTO "Pers_Atrasos_Carga" (id, tipo, "nombreArchivo", "totalRegistros", nuevos, actualizados, "cargadoPor", "cargadoPorId", "fechaCarga", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, $7, $7);
    `, cargaId, tipoFinal, nombreArchivo, rows.length, usuarioNombre, usuarioId || null, ahora)

    let nuevosCount = 0
    let actualizadosCount = 0
    const batchSize = 100

    for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize)

        for (const row of chunk) {
            const rawId = String(row['Identificador'] || row['IDENTIFICADOR'] || row['Rut'] || row['RUT'] || row['rut'] || '').trim()
            if (!rawId) continue

            const cleanedId = cleanRut(rawId)
            const idHash = hashRut(cleanedId)

            const rawFecha = row['Fecha'] || row['FECHA'] || row['fecha'] || row['Dia'] || row['DIA']
            const { fechaIso, fechaSerial } = parseFechaField(rawFecha)
            if (!fechaIso) continue

            const rawApellidos = String(row['Apellidos'] || row['APELLIDOS'] || row['Apellido'] || '').trim()
            const rawNombre = String(row['Nombre'] || row['NOMBRE'] || row['Nombres'] || '').trim()

            // 3 campos personales encriptados con AES-256-GCM
            const idEnc = encryptPersonalText(cleanedId || rawId)
            const apellidosEnc = encryptPersonalText(rawApellidos)
            const nombreEnc = encryptPersonalText(rawNombre)

            const grupoUsuario = String(row['Grupo Usuario'] || row['GRUPO USUARIO'] || row['grupoUsuario'] || '').trim() || null
            const centroCostos = String(row['Centro de Costos'] || row['CENTRO DE COSTOS'] || row['centroCostos'] || row['Centro Costos'] || '').trim() || null
            const grupoMarcacion = String(row['Grupo marcación'] || row['Grupo marcacion'] || row['GRUPO MARCACIÓN'] || row['Grupo Marcación'] || '').trim() || null

            // RBD y establecimiento
            const rawRbdVal = row['RBD'] || row['Rbd'] || row['rbd'] || row['Colegio'] || row['Establecimiento']
            const parsedRbd = extractRbdAndEstablecimiento(grupoUsuario, centroCostos, grupoMarcacion, rawRbdVal)
            const rbdNum = parsedRbd.rbd
            const colLookup = rbdNum ? colegiosMap.get(rbdNum) : null
            const establecimiento = colLookup?.nombre || parsedRbd.establecimiento || (rbdNum ? `RBD ${rbdNum}` : parsedRbd.rbdRaw)

            // Sede y homologación
            const rawSede = String(row['SEDE'] || row['Sede'] || row['sede'] || row['Sucursal'] || '').trim()
            const sucursal = colLookup?.sucursal || normalizeSede(rawSede, centroCostos, grupoUsuario, grupoMarcacion)

            const institucion = String(row['Institución'] || row['Institucion'] || row['INSTITUCION'] || '').trim() || null
            const supervisor = String(row['Supervisor'] || row['SUPERVISOR'] || '').trim() || null
            const cargo = String(row['Cargo'] || row['CARGO'] || row['Rol'] || '').trim() || null
            const turno = String(row['Turno'] || row['TURNO'] || '').trim() || null
            const marco = String(row['Marcó '] || row['Marcó'] || row['Marco'] || row['MARCO'] || '').trim() || null

            let horaInicioTurno: string | null = null
            let horaLlegada: string | null = null
            let holguraMin = 0
            let horaFinTurno: string | null = null
            let salio: string | null = null
            let salioTurno: string | null = null
            let entro: string | null = null
            let minutosAtraso = 0
            let minutosAdelanto = 0
            let horasAtraso: string | null = null
            let horasAdelanto: string | null = null

            if (tipoFinal === 'ATRASO') {
                horaInicioTurno = formatExcelTime(row['Hora Inicio Turno'] || row['Hora inicio turno'] || row['Turno'])
                horaLlegada = formatExcelTime(row['Hora Llegada'] || row['Hora llegada'] || row['Llegada'])
                holguraMin = parseInt(String(row['Holgura (min)'] || row['Holgura'] || 0), 10) || 0
                const rawAtraso = row['Minutos de Atraso'] || row['Minutos de atraso'] || row['Minutos Atraso'] || row['MINUTOS ATRASO'] || row['Atraso'] || row['ATRASO'] || 0
                const parsedAtraso = parseMinutes(rawAtraso)
                minutosAtraso = parsedAtraso.minutes
                horasAtraso = parsedAtraso.text
                entro = horaLlegada
            } else {
                horaFinTurno = formatExcelTime(row['Hora Fin Turno'] || row['HORA FIN TURNO'] || row['Salio turno'] || row['Salió turno'])
                salio = formatExcelTime(row['Hora Salida'] || row['HORA SALIDA'] || row['Salió'] || row['Salio'])
                salioTurno = horaFinTurno
                const rawAdelanto = row['Minutos Adelanto'] || row['MINUTOS ADELANTO'] || row['Minutos adelanto'] || row['Adelanto'] || row['ADELANTO'] || row['Salida Anticipada'] || 0
                const parsedAdelanto = parseMinutes(rawAdelanto)
                minutosAdelanto = parsedAdelanto.minutes
                horasAdelanto = parsedAdelanto.text
            }

            const rawJustificados = row['Minutos Justificados'] || row['MINUTOS JUSTIFICADOS'] || row['Justificados'] || row['justificados'] || 0
            const parsedMinJustificados = parseMinutes(rawJustificados)
            const minutosJustificados = parsedMinJustificados.minutes

            const justificadoPor = String(row['Justificado por'] || row['JUSTIFICADO POR'] || row['Justificado Por'] || '').trim() || null
            const comentario = String(row['Comentario'] || row['COMENTARIO'] || row['Observación'] || row['Observacion'] || row['OBSERVACION'] || row['Motivo'] || '').trim() || null

            let justificado = String(row['Justificado'] || row['JUSTIFICADO'] || row['Justificación'] || row['justificado'] || '').trim() || null
            if (!justificado) {
                if (justificadoPor) justificado = `Justificado por ${justificadoPor}`
                else if (minutosJustificados > 0) justificado = `${minutosJustificados} min justificados`
            }
            const observacion = comentario

            const uniqueKey = `${idHash}_${fechaIso}_${tipoFinal}`
            const existingId = existentesMap.get(uniqueKey)

            if (existingId) {
                // Actualizar registro existente
                await rawPrisma.$executeRawUnsafe(`
                    UPDATE "Pers_Atrasos_Registro"
                    SET "cargaId" = $1,
                        "identificadorEnc" = $2,
                        "apellidosEnc" = $3,
                        "nombreEnc" = $4,
                        "fechaSerial" = $5,
                        rbd = $6,
                        "rbdRaw" = $7,
                        establecimiento = $8,
                        institucion = $9,
                        "sedeRaw" = $10,
                        sucursal = $11,
                        supervisor = $12,
                        cargo = $13,
                        turno = $14,
                        marco = $15,
                        entro = $16,
                        salio = $17,
                        "salioTurno" = $18,
                        "horaFinTurno" = $19,
                        "horaInicioTurno" = $20,
                        "horaLlegada" = $21,
                        "holguraMin" = $22,
                        "grupoMarcacion" = $23,
                        "minutosAtraso" = $24,
                        "minutosAdelanto" = $25,
                        "minutosJustificados" = $26,
                        "horasAtraso" = $27,
                        "horasAdelanto" = $28,
                        justificado = COALESCE($29, justificado),
                        "justificadoPor" = COALESCE($30, "justificadoPor"),
                        "centroCostos" = COALESCE($31, "centroCostos"),
                        "grupoUsuario" = COALESCE($32, "grupoUsuario"),
                        observacion = COALESCE($33, observacion),
                        "updatedAt" = $34
                    WHERE id = $35;
                `,
                    cargaId, idEnc, apellidosEnc, nombreEnc, fechaSerial,
                    rbdNum, parsedRbd.rbdRaw, establecimiento, institucion, rawSede, sucursal,
                    supervisor, cargo, turno, marco, entro, salio, salioTurno, horaFinTurno,
                    horaInicioTurno, horaLlegada, holguraMin, grupoMarcacion,
                    minutosAtraso, minutosAdelanto, minutosJustificados,
                    horasAtraso, horasAdelanto,
                    justificado, justificadoPor, centroCostos, grupoUsuario, observacion, ahora, existingId
                )
                actualizadosCount++
            } else {
                // Insertar nuevo registro
                const regId = uuidv4()
                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "Pers_Atrasos_Registro" (
                        id, tipo, "cargaId", "identificadorEnc", "identificadorHash",
                        "apellidosEnc", "nombreEnc", fecha, "fechaSerial",
                        rbd, "rbdRaw", establecimiento, institucion, "sedeRaw",
                        sucursal, supervisor, cargo, turno, marco, entro, salio, "salioTurno",
                        "horaFinTurno", "horaInicioTurno", "horaLlegada", "holguraMin", "grupoMarcacion",
                        "minutosAtraso", "minutosAdelanto", "minutosJustificados",
                        "horasAtraso", "horasAdelanto", justificado, "justificadoPor", "centroCostos",
                        "grupoUsuario", "aplicaDescuento", observacion, estado, "createdAt", "updatedAt"
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
                        $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
                        false, $37, 'ABIERTO', $38, $38
                    );
                `,
                    regId, tipoFinal, cargaId, idEnc, idHash,
                    apellidosEnc, nombreEnc, fechaIso, fechaSerial,
                    rbdNum, parsedRbd.rbdRaw, establecimiento, institucion, rawSede,
                    sucursal, supervisor, cargo, turno, marco, entro, salio, salioTurno,
                    horaFinTurno, horaInicioTurno, horaLlegada, holguraMin, grupoMarcacion,
                    minutosAtraso, minutosAdelanto, minutosJustificados,
                    horasAtraso, horasAdelanto, justificado, justificadoPor, centroCostos,
                    grupoUsuario, observacion, ahora
                )
                existentesMap.set(uniqueKey, regId)
                nuevosCount++
            }
        }
    }

    // Actualizar resumen en la tabla de control
    await rawPrisma.$executeRawUnsafe(`
        UPDATE "Pers_Atrasos_Carga"
        SET "totalRegistros" = $1, nuevos = $2, actualizados = $3
        WHERE id = $4;
    `, nuevosCount + actualizadosCount, nuevosCount, actualizadosCount, cargaId)

    // Registrar en Auditoría
    await logAuditAction({
        username: usuarioNombre,
        userId: usuarioId || null,
        action: 'CARGA_ATRASOS_ADELANTOS',
        modulo: 'Recursos Humanos',
        detalle: `Carga de ${tipoFinal} procesada (${nombreArchivo}): ${nuevosCount} registros nuevos ingresados, ${actualizadosCount} registros existentes actualizados por identificador y fecha.`
    })

    try {
        revalidatePath(PATH_ATRASOS_CARGA)
        revalidatePath(PATH_ATRASOS_ASISTENCIA)
        revalidatePath(PATH_ATRASOS_ADM)
    } catch {}

    return {
        success: true,
        tipo: tipoFinal,
        total: nuevosCount + actualizadosCount,
        nuevos: nuevosCount,
        actualizados: actualizadosCount
    }
}

/**
 * Server Action: Carga masiva desde archivo Excel subido por el cliente
 */
export async function cargarAtrasosAction(formData: FormData): Promise<{ success: boolean; tipo?: 'ADELANTO' | 'ATRASO'; total?: number; nuevos?: number; actualizados?: number; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para realizar cargas de atrasos y adelantos' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File) || file.size === 0) {
        return { success: false, error: 'Debes seleccionar un archivo Excel (.xlsx o .xls) válido' }
    }

    const tipoForm = (formData.get('tipo') as 'ADELANTO' | 'ATRASO') || undefined

    try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return await procesarPlanillaAtrasosBuffer(buffer, file.name, usuarioNombre, usuarioId, tipoForm)
    } catch (error: any) {
        console.error('Error en cargarAtrasosAction:', error)
        return { success: false, error: error.message || 'Error al procesar el archivo Excel' }
    }
}

/**
 * Server Action: Elimina una carga específica y sus registros vinculados
 */
export async function eliminarCargaAtrasosAction(cargaId: string): Promise<{ success: boolean; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para realizar esta acción' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    try {
        await ensurePersonalAtrasosTables()

        // Contar registros a eliminar
        const countRes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int AS count FROM "Pers_Atrasos_Registro" WHERE "cargaId" = $1;
        `, cargaId)
        const deletedCount = countRes[0]?.count || 0

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Atrasos_Registro" WHERE "cargaId" = $1;`, cargaId)
        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Atrasos_Carga" WHERE id = $1;`, cargaId)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId || null,
            action: 'ELIMINAR_CARGA_ATRASOS',
            modulo: 'Recursos Humanos',
            detalle: `Eliminación de lote de atrasos (ID ${cargaId}): se borraron ${deletedCount} registros.`
        })

        try {
            revalidatePath(PATH_ATRASOS_CARGA)
            revalidatePath(PATH_ATRASOS_ASISTENCIA)
            revalidatePath(PATH_ATRASOS_ADM)
        } catch {}

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar carga de atrasos:', error)
        return { success: false, error: error.message || 'Error al eliminar la carga' }
    }
}
