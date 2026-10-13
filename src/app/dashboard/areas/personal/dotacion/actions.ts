'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { encryptPersonalText, decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalDotacionTables } from '@/lib/personal-dotacion-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import * as xlsx from 'xlsx'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const PATH_DOTACION = '/dashboard/areas/personal/dotacion'
const DEFAULT_TEST_FILE_PATH = 'D:\\Programas\\AplicacionWebDoctos\\Personal\\listado_empleados - 2026-10-08T161258.326.xlsx'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_dotacion_carga')
}

// Extrae RBD entero y nombre de establecimiento
function parseRbdField(rawRbd: any): { rbd: number | null; establecimiento: string | null; rbdRaw: string } {
    if (rawRbd === undefined || rawRbd === null || rawRbd === '') {
        return { rbd: null, establecimiento: null, rbdRaw: '' }
    }
    const str = String(rawRbd).trim()

    // Caso 1: Con paréntesis, con o sin dígito verificador y nombre. Ej: "(10253-9) LICEO ABDON CIFUENTES" o "(10253) LICEO"
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

    // Caso 4: No numérico (ej. "Metro", "Casa Matriz", etc.)
    return {
        rbd: null,
        establecimiento: str,
        rbdRaw: str
    }
}

// Normaliza el centro de distribución a la sucursal correspondiente
function normalizeSucursal(centroDistRaw: any, rbdSucursal?: string | null): string {
    if (rbdSucursal && rbdSucursal.trim()) {
        return rbdSucursal.trim()
    }
    if (!centroDistRaw) return 'CASA MATRIZ'
    const cd = String(centroDistRaw).toUpperCase()
    if (cd.includes('METRO')) return 'CD METRO'
    if (cd.includes('COPIAPO')) return 'CD COPIAPO'
    if (cd.includes('COYHAIQUE')) return 'CD COYHAIQUE'
    if (cd.includes('VALLENAR')) return 'CD VALLENAR'
    if (cd.includes('MATRIZ')) return 'CASA MATRIZ'
    return String(centroDistRaw).trim()
}

// Formatea fechas que vienen como número serial de Excel o texto
function formatExcelDate(val: any): string {
    if (val === undefined || val === null || val === '') return ''
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000))
        if (!isNaN(date.getTime())) {
            const yyyy = date.getUTCFullYear()
            const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
            const dd = String(date.getUTCDate()).padStart(2, '0')
            return `${dd}/${mm}/${yyyy}`
        }
    }
    return String(val).trim()
}

export interface DotacionRegistroDTO {
    id: string
    rut: string
    nombre: string
    sexo: string
    fechaNacimiento: string
    estadoCivil: string
    pais: string
    direccion: string
    comuna: string
    villaPoblacion: string
    bloque: string
    ciudad: string
    codPostal: string
    region: string
    telefono: string
    correoElectronico: string
    banco: string
    cuentaBanco: string
    rbd: number | null
    rbdRaw: string | null
    establecimiento: string | null
    sucursal: string | null
    centroDistribucion: string | null
    cargo: string | null
    area: string | null
    supervisor: string | null
    empresa: string | null
    tipoContrato: string | null
    fechaInicioContrato: string | null
    fechaTerminoContrato: string | null
    estadoContrato: string | null
    horasSemanales: string | null
    situacion: string | null
    afp: string | null
    isapre: string | null
}

export interface DotacionResponse {
    success: boolean
    error?: string
    registros: DotacionRegistroDTO[]
    total: number
    resumen: {
        totalGeneral: number
        totalConRbd: number
        totalCargos: number
        totalSucursales: number
        sucursalesList: string[]
        cargosList: string[]
    }
    ultimaCarga: {
        id: string
        nombreArchivo: string
        totalRegistros: number
        cargadoPor: string
        fechaCarga: string
    } | null
}

/**
 * Consulta los registros de dotación con filtros, paginación y desencriptación de los 17 datos personales.
 */
export async function getDotacionDataAction(filtros?: {
    search?: string
    rbd?: number
    sucursal?: string
    cargo?: string
    page?: number
    pageSize?: number
    sortField?: string
    sortOrder?: 'asc' | 'desc'
}): Promise<DotacionResponse> {
    if (!await checkPermission()) {
        return {
            success: false,
            error: 'No tienes permisos para visualizar dotación de personal',
            registros: [],
            total: 0,
            resumen: { totalGeneral: 0, totalConRbd: 0, totalCargos: 0, totalSucursales: 0, sucursalesList: [], cargosList: [] },
            ultimaCarga: null
        }
    }

    await ensurePersonalDotacionTables()

    const session = await getSession()
    if (!session || !session.user) {
        return {
            success: false,
            error: 'No autorizado',
            registros: [],
            total: 0,
            resumen: { totalGeneral: 0, totalConRbd: 0, totalCargos: 0, totalSucursales: 0, sucursalesList: [], cargosList: [] },
            ultimaCarga: null
        }
    }

    const authorizedRbds = await getUserEffectiveRbds()
    const page = Math.max(1, filtros?.page || 1)
    const pageSize = Math.min(100, Math.max(5, filtros?.pageSize || 10))
    const offset = (page - 1) * pageSize
    const sortField = filtros?.sortField || 'sucursal'
    const sortOrder = filtros?.sortOrder === 'desc' ? 'desc' : 'asc'

    try {
        // Metadatos de última carga
        let ultimaCargaRow: any = null
        try {
            const ultimasCargas: any[] = await rawPrisma.$queryRawUnsafe(`
                SELECT id, "nombreArchivo", "totalRegistros", "cargadoPor", "fechaCarga"
                FROM "Pers_Dota_Carga"
                ORDER BY "fechaCarga" DESC
                LIMIT 1;
            `)
            if (ultimasCargas && ultimasCargas.length > 0) {
                ultimaCargaRow = ultimasCargas[0]
            }
        } catch (e) {
            console.error('Error consultando última carga en Pers_Dota_Carga:', e)
        }

        const ultimaCarga = ultimaCargaRow ? {
            id: ultimaCargaRow.id,
            nombreArchivo: ultimaCargaRow.nombreArchivo,
            totalRegistros: ultimaCargaRow.totalRegistros,
            cargadoPor: ultimaCargaRow.cargadoPor,
            fechaCarga: new Date(ultimaCargaRow.fechaCarga).toLocaleString('es-CL')
        } : null

        // Construir condiciones de WHERE
        const whereConditions: string[] = ['1=1']
        const queryParams: any[] = []
        let paramIndex = 1

        // 1. Privilegios de RBD autorizados (módulo Asociar RBD a usuarios)
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

        // 2. Filtro Sucursal
        if (filtros?.sucursal && filtros.sucursal !== 'TODAS') {
            whereConditions.push(`sucursal = $${paramIndex++}`)
            queryParams.push(filtros.sucursal)
        }

        // 3. Filtro Cargo
        if (filtros?.cargo && filtros.cargo !== 'TODOS') {
            whereConditions.push(`cargo = $${paramIndex++}`)
            queryParams.push(filtros.cargo)
        }

        // 4. Filtro de búsqueda por RUT (usando hash si es exacto) o texto
        let searchIsRutHash = false
        if (filtros?.search && filtros.search.trim()) {
            const cleanSearch = filtros.search.trim()
            const rutCleaned = cleanRut(cleanSearch)
            if (rutCleaned && rutCleaned.length >= 7) {
                const rHash = hashRut(rutCleaned)
                whereConditions.push(`"rutHash" = $${paramIndex++}`)
                queryParams.push(rHash)
                searchIsRutHash = true
            }
        }

        const whereSql = whereConditions.join(' AND ')

        // Resumen general y listas para filtros (cached/distinct)
        const sucursalesResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT sucursal FROM "Pers_Dota_Registro" WHERE sucursal IS NOT NULL AND sucursal != '' ORDER BY sucursal ASC`
        )
        const cargosResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT DISTINCT cargo FROM "Pers_Dota_Registro" WHERE cargo IS NOT NULL AND cargo != '' ORDER BY cargo ASC`
        )
        const rbdStatsResult: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT COUNT(DISTINCT rbd)::integer as total_rbds FROM "Pers_Dota_Registro" WHERE rbd IS NOT NULL AND rbd > 0`
        )

        const sucursalesList = sucursalesResult.map(r => r.sucursal).filter(Boolean)
        const cargosList = cargosResult.map(r => r.cargo).filter(Boolean)
        const totalConRbd = rbdStatsResult[0]?.total_rbds || 0

        // Consulta de filas base
        const rowsQuery = `
            SELECT * FROM "Pers_Dota_Registro"
            WHERE ${whereSql}
        `
        const dbRows: any[] = await rawPrisma.$queryRawUnsafe(rowsQuery, ...queryParams)

        // Desencriptar los 17 campos sensibles requeridos
        const registros: DotacionRegistroDTO[] = dbRows.map(row => {
            const decryptedRut = decryptPersonalText(row.rutEnc || '')
            const decryptedNombre = decryptPersonalText(row.nombreEnc || '')

            return {
                id: row.id,
                rut: decryptedRut,
                nombre: decryptedNombre,
                sexo: decryptPersonalText(row.sexoEnc || ''),
                fechaNacimiento: decryptPersonalText(row.fechaNacimientoEnc || ''),
                estadoCivil: decryptPersonalText(row.estadoCivilEnc || ''),
                pais: decryptPersonalText(row.paisEnc || ''),
                direccion: decryptPersonalText(row.direccionEnc || ''),
                comuna: decryptPersonalText(row.comunaEnc || ''),
                villaPoblacion: decryptPersonalText(row.villaPoblacionEnc || ''),
                bloque: decryptPersonalText(row.bloqueEnc || ''),
                ciudad: decryptPersonalText(row.ciudadEnc || ''),
                codPostal: decryptPersonalText(row.codPostalEnc || ''),
                region: decryptPersonalText(row.regionEnc || ''),
                telefono: decryptPersonalText(row.telefonoEnc || ''),
                correoElectronico: decryptPersonalText(row.correoElectronicoEnc || ''),
                banco: decryptPersonalText(row.bancoEnc || ''),
                cuentaBanco: decryptPersonalText(row.cuentaBancoEnc || ''),
                rbd: row.rbd,
                rbdRaw: row.rbdRaw,
                establecimiento: row.establecimiento,
                sucursal: row.sucursal,
                centroDistribucion: row.centroDistribucion,
                cargo: row.cargo,
                area: row.area,
                supervisor: row.supervisor,
                empresa: row.empresa,
                tipoContrato: row.tipoContrato,
                fechaInicioContrato: row.fechaInicioContrato,
                fechaTerminoContrato: row.fechaTerminoContrato,
                estadoContrato: row.estadoContrato,
                horasSemanales: row.horasSemanales,
                situacion: row.situacion,
                afp: row.afp,
                isapre: row.isapre
            }
        })

        // Filtrar por texto en memoria si no fue por hash exacto
        let registrosFiltrados = registros
        if (filtros?.search && !searchIsRutHash && filtros.search.trim()) {
            const q = filtros.search.toLowerCase().trim()
            registrosFiltrados = registros.filter(r =>
                r.nombre.toLowerCase().includes(q) ||
                r.rut.toLowerCase().includes(q) ||
                (r.establecimiento && r.establecimiento.toLowerCase().includes(q)) ||
                (r.cargo && r.cargo.toLowerCase().includes(q))
            )
        }

        // Ordenar según el campo y dirección seleccionados
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

        const total = registrosFiltrados.length
        const pagedRegistros = registrosFiltrados.slice(offset, offset + pageSize)

        return {
            success: true,
            registros: pagedRegistros,
            total,
            resumen: {
                totalGeneral: total,
                totalConRbd,
                totalCargos: cargosList.length,
                totalSucursales: sucursalesList.length,
                sucursalesList,
                cargosList
            },
            ultimaCarga
        }
    } catch (error: any) {
        console.error('Error al obtener datos de dotación:', error)
        return {
            success: false,
            error: error.message || 'Error al consultar la dotación de personal',
            registros: [],
            total: 0,
            resumen: { totalGeneral: 0, totalConRbd: 0, totalCargos: 0, totalSucursales: 0, sucursalesList: [], cargosList: [] },
            ultimaCarga: null
        }
    }
}

/**
 * Procesa e inserta una planilla de Dotación completa, reemplazando cualquier carga previa.
 */
async function procesarPlanillaBuffer(
    buffer: Buffer,
    nombreArchivo: string,
    usuarioNombre: string,
    usuarioId?: string
): Promise<{ success: boolean; total?: number; error?: string }> {
    await ensurePersonalDotacionTables()

    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        return { success: false, error: 'El archivo Excel no contiene hojas de cálculo' }
    }

    const sheet = workbook.Sheets[sheetName]
    // Detectar si la fila de encabezados está en el índice 0 o 1
    let rows: any[] = xlsx.utils.sheet_to_json(sheet, { range: 0, defval: '' })
    if (rows.length > 0 && !('Rut' in rows[0]) && !('RUT' in rows[0])) {
        rows = xlsx.utils.sheet_to_json(sheet, { range: 1, defval: '' })
    }

    if (rows.length === 0) {
        return { success: false, error: 'No se encontraron filas con datos de colaboradores en la planilla' }
    }

    // Cargar mapa de colegios para enriquecer nombres y sucursales según RBD
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
        console.error('Error cargando mapa de colegios para dotación:', e)
    }

    const cargaId = uuidv4()
    const ahora = new Date()

    // 1. ELIMINAR CARGA ANTERIOR (Regla estricta: reemplazo total, en ningún caso cargar duplicados o anexos)
    await rawPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Pers_Dota_Registro";`)
    await rawPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Pers_Dota_Carga";`)

    // 2. Registrar la nueva carga
    await rawPrisma.$executeRawUnsafe(`
        INSERT INTO "Pers_Dota_Carga" (id, "nombreArchivo", "totalRegistros", "cargadoPor", "cargadoPorId", "fechaCarga", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $6, $6);
    `, cargaId, nombreArchivo, rows.length, usuarioNombre, usuarioId || null, ahora)

    // 3. Preparar filas y encriptar los 17 datos personales
    const batchSize = 100
    let totalInsertados = 0

    for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize)
        const valueClauses: string[] = []
        const params: any[] = []
        let pIdx = 1

        for (const row of chunk) {
            const rawRut = String(row['Rut'] || row['RUT'] || row['rut'] || '').trim()
            const rawNombre = String(row['Nombre'] || row['NOMBRE'] || row['nombre'] || '').trim()
            if (!rawRut && !rawNombre) continue

            const cleanedRut = cleanRut(rawRut)
            const rHash = hashRut(cleanedRut)

            // Los 17 campos sensibles encriptados con AES-256-GCM
            const rutEnc = encryptPersonalText(cleanedRut || rawRut)
            const nombreEnc = encryptPersonalText(rawNombre)
            const sexoEnc = encryptPersonalText(String(row['Sexo'] || row['SEXO'] || '').trim())
            const fechaNacimientoEnc = encryptPersonalText(formatExcelDate(row['Fecha Nacimiento'] || row['FECHA NACIMIENTO']))
            const estadoCivilEnc = encryptPersonalText(String(row['Estado civil'] || row['ESTADO CIVIL'] || '').trim())
            const paisEnc = encryptPersonalText(String(row['País'] || row['PAIS'] || row['Pais'] || '').trim())
            const direccionEnc = encryptPersonalText(String(row['Dirección'] || row['DIRECCION'] || row['Direccion'] || '').trim())
            const comunaEnc = encryptPersonalText(String(row['Comuna'] || row['COMUNA'] || '').trim())
            const villaPoblacionEnc = encryptPersonalText(String(row['Villa/Población'] || row['Villa/Poblacion'] || row['VILLA/POBLACION'] || '').trim())
            const bloqueEnc = encryptPersonalText(String(row['Bloque'] || row['BLOQUE'] || '').trim())
            const ciudadEnc = encryptPersonalText(String(row['Ciudad'] || row['CIUDAD'] || '').trim())
            const codPostalEnc = encryptPersonalText(String(row['Cod. Postal'] || row['COD. POSTAL'] || row['Cod Postal'] || '').trim())
            const regionEnc = encryptPersonalText(String(row['Región'] || row['REGION'] || row['Region'] || '').trim())
            const telefonoEnc = encryptPersonalText(String(row['Teléfono'] || row['TELEFONO'] || row['Telefono'] || '').trim())
            const correoElectronicoEnc = encryptPersonalText(String(row['Correo electrónico'] || row['Correo electronico'] || row['CORREO ELECTRONICO'] || '').trim())
            const bancoEnc = encryptPersonalText(String(row['Banco'] || row['BANCO'] || '').trim())
            const cuentaBancoEnc = encryptPersonalText(String(row['Cuenta Banco'] || row['CUENTA BANCO'] || '').trim())

            // Manejo de RBD y Establecimiento
            const rawRbdVal = row['RBD'] || row['Rbd'] || row['rbd']
            const parsedRbd = parseRbdField(rawRbdVal)
            const rbdNum = parsedRbd.rbd
            const colegioLookup = rbdNum ? colegiosMap.get(rbdNum) : null
            const establecimiento = colegioLookup?.nombre || parsedRbd.establecimiento || (rbdNum ? `RBD ${rbdNum}` : parsedRbd.rbdRaw)

            // Centro de Distribución y Sucursal
            const centroDistRaw = String(row['Centro de Distribución'] || row['Centro de Distribucion'] || row['CENTRO DE DISTRIBUCION'] || '').trim()
            const sucursal = normalizeSucursal(centroDistRaw, colegioLookup?.sucursal)

            // Otros campos operativos
            const cargo = String(row['Cargo'] || row['CARGO'] || '').trim() || null
            const area = String(row['Área'] || row['Area'] || row['AREA'] || '').trim() || null
            const supervisor = String(row['Supervisor'] || row['SUPERVISOR'] || '').trim() || null
            const empresa = String(row['Empresa'] || row['EMPRESA'] || '').trim() || null
            const tipoContrato = String(row['Tipo contr.'] || row['Tipo Contrato'] || row['TIPO CONTR.'] || '').trim() || null
            const fechaInicioContrato = formatExcelDate(row['Fecha Inicio contrato'] || row['Fecha Inicio Contrato']) || null
            const fechaTerminoContrato = formatExcelDate(row['Fecha término contrato'] || row['Fecha Termino Contrato']) || null
            const estadoContrato = String(row['Estado'] || row['ESTADO'] || '').trim() || null
            const horasSemanales = String(row['Horas Semanales'] || row['HORAS SEMANALES'] || '').trim() || null
            const situacion = String(row['Situación'] || row['Situacion'] || row['SITUACION'] || '').trim() || null
            const afp = String(row['AFP'] || row['Afp'] || '').trim() || null
            const isapre = String(row['Isapre'] || row['ISAPRE'] || '').trim() || null

            const regId = uuidv4()

            valueClauses.push(`(
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
                $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}
            )`)

            params.push(
                regId, cargaId, rutEnc, rHash, nombreEnc,
                sexoEnc, fechaNacimientoEnc, estadoCivilEnc, paisEnc, direccionEnc,
                comunaEnc, villaPoblacionEnc, bloqueEnc, ciudadEnc, codPostalEnc,
                regionEnc, telefonoEnc, correoElectronicoEnc, bancoEnc, cuentaBancoEnc,
                rbdNum, parsedRbd.rbdRaw || null, establecimiento, sucursal, centroDistRaw || null,
                cargo, area, supervisor, empresa, tipoContrato,
                fechaInicioContrato, fechaTerminoContrato, estadoContrato, horasSemanales, situacion,
                afp, isapre, ahora, ahora
            )
            totalInsertados++
        }

        if (valueClauses.length > 0) {
            const sqlInsert = `
                INSERT INTO "Pers_Dota_Registro" (
                    id, "cargaId", "rutEnc", "rutHash", "nombreEnc",
                    "sexoEnc", "fechaNacimientoEnc", "estadoCivilEnc", "paisEnc", "direccionEnc",
                    "comunaEnc", "villaPoblacionEnc", "bloqueEnc", "ciudadEnc", "codPostalEnc",
                    "regionEnc", "telefonoEnc", "correoElectronicoEnc", "bancoEnc", "cuentaBancoEnc",
                    rbd, "rbdRaw", establecimiento, sucursal, "centroDistribucion",
                    cargo, area, supervisor, empresa, "tipoContrato",
                    "fechaInicioContrato", "fechaTerminoContrato", "estadoContrato", "horasSemanales", situacion,
                    afp, isapre, "createdAt", "updatedAt"
                ) VALUES ${valueClauses.join(', ')};
            `
            await rawPrisma.$executeRawUnsafe(sqlInsert, ...params)
        }
    }

    // Actualizar total exacto en el lote
    await rawPrisma.$executeRawUnsafe(
        `UPDATE "Pers_Dota_Carga" SET "totalRegistros" = $1 WHERE id = $2;`,
        totalInsertados, cargaId
    )

    // Auditoría
    await logAuditAction({
        username: usuarioNombre,
        userId: usuarioId || null,
        action: 'CARGA_DOTACION_MASIVA',
        modulo: 'Recursos Humanos',
        detalle: `Carga masiva de dotación completada: ${totalInsertados} empleados reemplazando planilla previa (${nombreArchivo})`
    })

    revalidatePath(PATH_DOTACION)
    return { success: true, total: totalInsertados }
}

/**
 * Procesa la carga masiva enviada desde el formulario web (archivo adjunto .xlsx)
 */
export async function cargarDotacionAction(formData: FormData): Promise<{ success: boolean; total?: number; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para realizar cargas masivas de dotación' }
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
        return await procesarPlanillaBuffer(buffer, file.name, usuarioNombre, usuarioId)
    } catch (error: any) {
        console.error('Error en cargarDotacionAction:', error)
        return { success: false, error: error.message || 'Error al procesar el archivo Excel' }
    }
}

/**
 * Carga directa desde la ruta del servidor local para pruebas y sincronización inicial
 */
export async function cargarDotacionDesdeArchivoLocalAction(): Promise<{ success: boolean; total?: number; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para realizar esta acción' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    if (!fs.existsSync(DEFAULT_TEST_FILE_PATH)) {
        return { success: false, error: `El archivo de prueba no existe en la ruta: ${DEFAULT_TEST_FILE_PATH}` }
    }

    try {
        const buffer = fs.readFileSync(DEFAULT_TEST_FILE_PATH)
        const nombreArchivo = path.basename(DEFAULT_TEST_FILE_PATH)
        return await procesarPlanillaBuffer(buffer, nombreArchivo, usuarioNombre, usuarioId)
    } catch (error: any) {
        console.error('Error cargando archivo local de dotación:', error)
        return { success: false, error: error.message || 'Error al leer el archivo local' }
    }
}

/**
 * Elimina toda la dotación cargada (para reiniciar o limpiar la base de datos)
 */
export async function eliminarDotacionAction(): Promise<{ success: boolean; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para eliminar la dotación' }
    }

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id

    try {
        await ensurePersonalDotacionTables()
        await rawPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Pers_Dota_Registro";`)
        await rawPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Pers_Dota_Carga";`)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId || null,
            action: 'ELIMINAR_DOTACION_MASIVA',
            modulo: 'Recursos Humanos',
            detalle: 'Eliminación total y limpieza de registros de dotación de personal'
        })

        revalidatePath(PATH_DOTACION)
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar dotación:', error)
        return { success: false, error: error.message || 'Error al eliminar dotación' }
    }
}

/**
 * Exporta todos los registros filtrados a una planilla Excel con datos desencriptados
 */
export async function exportarDotacionExcelAction(filtros?: {
    search?: string
    rbd?: number
    sucursal?: string
    cargo?: string
}): Promise<{ success: boolean; dataBase64?: string; filename?: string; error?: string }> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para exportar la dotación' }
    }

    const res = await getDotacionDataAction({
        ...filtros,
        page: 1,
        pageSize: 100000 // Todos los registros
    })

    if (!res.success || !res.registros) {
        return { success: false, error: res.error || 'No se pudieron obtener registros para exportar' }
    }

    try {
        const rowsExport = res.registros.map(r => ({
            'RBD': r.rbd || '',
            'Establecimiento': r.establecimiento || '',
            'Sucursal': r.sucursal || '',
            'Centro Distribución': r.centroDistribucion || '',
            'RUT': r.rut,
            'Nombre': r.nombre,
            'Cargo': r.cargo || '',
            'Área': r.area || '',
            'Supervisor': r.supervisor || '',
            'Sexo': r.sexo || '',
            'Fecha Nacimiento': r.fechaNacimiento || '',
            'Estado Civil': r.estadoCivil || '',
            'País': r.pais || '',
            'Dirección': r.direccion || '',
            'Comuna': r.comuna || '',
            'Villa / Población': r.villaPoblacion || '',
            'Bloque': r.bloque || '',
            'Ciudad': r.ciudad || '',
            'Cód. Postal': r.codPostal || '',
            'Región': r.region || '',
            'Teléfono': r.telefono || '',
            'Correo Electrónico': r.correoElectronico || '',
            'Banco': r.banco || '',
            'Cuenta Banco': r.cuentaBanco || '',
            'Empresa': r.empresa || '',
            'Tipo Contrato': r.tipoContrato || '',
            'Fecha Inicio': r.fechaInicioContrato || '',
            'Fecha Término': r.fechaTerminoContrato || '',
            'Estado': r.estadoContrato || '',
            'Horas Semanales': r.horasSemanales || '',
            'Situación': r.situacion || '',
            'AFP': r.afp || '',
            'Salud': r.isapre || ''
        }))

        const ws = xlsx.utils.json_to_sheet(rowsExport)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Dotación')
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
        const base64 = buffer.toString('base64')
        const filename = `Dotacion_Personal_${new Date().toISOString().slice(0, 10)}.xlsx`

        return { success: true, dataBase64: base64, filename }
    } catch (error: any) {
        console.error('Error generando exportación Excel:', error)
        return { success: false, error: error.message || 'Error al generar planilla Excel' }
    }
}
