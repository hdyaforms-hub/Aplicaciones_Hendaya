'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { 
    ensureResolucionSanitariaTable, 
    syncColegiosToResolucionSanitaria 
} from '@/lib/calidad/resolucion-sanitaria'
import { uploadPath } from '@/lib/storage'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { existsSync } from 'fs'

export type ResolucionSanitariaFilter = {
    anio?: number
    licitacion?: string
    institucion?: string
    ut?: number
    uts?: number[]
    search?: string
    estadoResolucion?: string
    estadosResolucion?: string[]
    page?: number
    pageSize?: number
    sortField?: string
    sortDirection?: 'asc' | 'desc'
}

/**
 * Consulta registros paginados y con filtros para el módulo de Resolución Sanitaria.
 * Si el usuario no es Administrador, restringe estrictamente a los RBDs de sus sucursales asignadas.
 */
export async function getResolucionSanitariaRecords(params: ResolucionSanitariaFilter) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    if (!isAdmin && !hasCalidadArea && !permissions.includes('view_calidad_resolucion_sanitaria')) {
        throw new Error('Acceso denegado: Se requiere permiso para ver Resolución Sanitaria')
    }

    await ensureResolucionSanitariaTable()

    const anio = params.anio || new Date().getFullYear()
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const skip = (page - 1) * pageSize

    // Verificar si existen registros para este año; si no hay, auto-sincronizar colegios existentes
    const countAnio = await prisma.cal_ResSan_Registro.count({
        where: { anio }
    })

    if (countAnio === 0) {
        await syncColegiosToResolucionSanitaria(anio)
    }

    // Obtener sucursales asociadas al usuario si no es admin
    let userSucursales: string[] = []
    let isFilteredBySucursal = false
    let allowedRbds: number[] = []

    if (!isAdmin) {
        isFilteredBySucursal = true
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        userSucursales = Array.from(new Set([
            ...(session.user.sucursales || []),
            ...(dbUser?.sucursales?.map(s => s.nombre.trim()) || [])
        ])).filter(Boolean)

        if (userSucursales.length > 0) {
            const colegiosEnSucursal = await prisma.colegios.findMany({
                where: {
                    sucursal: {
                        in: userSucursales,
                        mode: 'insensitive'
                    }
                },
                select: { colRBD: true }
            })
            allowedRbds = colegiosEnSucursal
                .map(c => c.colRBD)
                .filter(rbd => ![31, 32, 1101].includes(rbd))
        }
    }

    // Armar condiciones AND omitiendo RBDs ficticios de sucursales (31, 32, 1101 y nombres con 'sucursal')
    const andConditions: any[] = [
        { anio },
        { rbd: { notIn: [31, 32, 1101] } },
        { NOT: { nombreEstablecimiento: { contains: 'sucursal', mode: 'insensitive' } } }
    ]

    // Restricción de seguridad por sucursal
    if (isFilteredBySucursal) {
        if (userSucursales.length === 0 || allowedRbds.length === 0) {
            // Usuario sin sucursales asignadas o sin colegios: no ve nada
            andConditions.push({ rbd: -999999 })
        } else {
            andConditions.push({ rbd: { in: allowedRbds } })
        }
    }

    if (params.licitacion && params.licitacion !== 'ALL') {
        andConditions.push({ licitacion: params.licitacion })
    }

    if (params.institucion && params.institucion !== 'ALL') {
        andConditions.push({ institucion: params.institucion })
    }

    // Filtro UT: múltiple selección o individual
    if (params.uts && params.uts.length > 0) {
        const validUts = params.uts.map(Number).filter(n => !isNaN(n))
        if (validUts.length > 0) {
            andConditions.push({ ut: { in: validUts } })
        }
    } else if (params.ut && !isNaN(Number(params.ut))) {
        andConditions.push({ ut: Number(params.ut) })
    }

    // Filtro Resolución Sanitaria: múltiple selección o individual
    if (params.estadosResolucion && params.estadosResolucion.length > 0) {
        const validEstados = params.estadosResolucion.filter(e => e && e !== 'ALL')
        if (validEstados.length > 0) {
            andConditions.push({ estadoResolucion: { in: validEstados } })
        }
    } else if (params.estadoResolucion && params.estadoResolucion !== 'ALL') {
        andConditions.push({ estadoResolucion: params.estadoResolucion })
    }

    if (params.search && params.search.trim() !== '') {
        const query = params.search.trim()
        const isNum = !isNaN(Number(query))

        andConditions.push({
            OR: [
                { nombreEstablecimiento: { contains: query, mode: 'insensitive' } },
                { comuna: { contains: query, mode: 'insensitive' } },
                { institucion: { contains: query, mode: 'insensitive' } },
                ...(isNum ? [{ rbd: Number(query) }, { ut: Number(query) }] : [])
            ]
        })
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {}

    // Condición base de sucursal para listas de opciones (selects)
    const baseWhereForYear: any = {
        anio,
        rbd: { notIn: [31, 32, 1101] },
        NOT: { nombreEstablecimiento: { contains: 'sucursal', mode: 'insensitive' } }
    }
    if (isFilteredBySucursal) {
        if (userSucursales.length === 0 || allowedRbds.length === 0) {
            baseWhereForYear.rbd = -999999
        } else {
            baseWhereForYear.rbd = { in: allowedRbds }
        }
    }

    // Condiciones dinámicas para las cerámicas (KPIs)
    // Se adaptan en tiempo real a los criterios de selección: Institución, Licitación, UTs y Búsqueda
    const andConditionsForStats: any[] = [
        { anio },
        { rbd: { notIn: [31, 32, 1101] } },
        { NOT: { nombreEstablecimiento: { contains: 'sucursal', mode: 'insensitive' } } }
    ]
    if (isFilteredBySucursal) {
        if (userSucursales.length === 0 || allowedRbds.length === 0) {
            andConditionsForStats.push({ rbd: -999999 })
        } else {
            andConditionsForStats.push({ rbd: { in: allowedRbds } })
        }
    }
    if (params.licitacion && params.licitacion !== 'ALL') {
        andConditionsForStats.push({ licitacion: params.licitacion })
    }
    if (params.institucion && params.institucion !== 'ALL') {
        andConditionsForStats.push({ institucion: params.institucion })
    }
    if (params.uts && params.uts.length > 0) {
        const validUts = params.uts.map(Number).filter(n => !isNaN(n))
        if (validUts.length > 0) {
            andConditionsForStats.push({ ut: { in: validUts } })
        }
    } else if (params.ut && !isNaN(Number(params.ut))) {
        andConditionsForStats.push({ ut: Number(params.ut) })
    }
    if (params.estadosResolucion && params.estadosResolucion.length > 0) {
        const validEstados = params.estadosResolucion.filter(e => e && e !== 'ALL')
        if (validEstados.length > 0) {
            andConditionsForStats.push({ estadoResolucion: { in: validEstados } })
        }
    } else if (params.estadoResolucion && params.estadoResolucion !== 'ALL') {
        andConditionsForStats.push({ estadoResolucion: params.estadoResolucion })
    }
    if (params.search && params.search.trim() !== '') {
        const query = params.search.trim()
        const isNum = !isNaN(Number(query))
        andConditionsForStats.push({
            OR: [
                { nombreEstablecimiento: { contains: query, mode: 'insensitive' } },
                { comuna: { contains: query, mode: 'insensitive' } },
                { institucion: { contains: query, mode: 'insensitive' } },
                ...(isNum ? [{ rbd: Number(query) }, { ut: Number(query) }] : [])
            ]
        })
    }
    const whereForStats: any = { AND: andConditionsForStats }

    // Ordenamiento dinámico
    const sortField = params.sortField || 'rbd'
    const sortDirection = params.sortDirection || 'asc'

    const orderBy: any = {}
    orderBy[sortField] = sortDirection

    const [total, records, statsRaw, licitacionesRaw, utsRaw, institucionesRaw] = await Promise.all([
        prisma.cal_ResSan_Registro.count({ where }),
        prisma.cal_ResSan_Registro.findMany({
            where,
            orderBy,
            skip,
            take: pageSize
        }),
        // Estadísticas dinámicas según los criterios de selección (Institución, Licitación, UT, etc.)
        prisma.cal_ResSan_Registro.findMany({
            where: whereForStats,
            select: {
                estadoResolucion: true,
                documentoUrl: true
            }
        }),
        // Licitaciones disponibles para la sucursal del usuario
        prisma.cal_ResSan_Registro.findMany({
            where: {
                ...baseWhereForYear,
                licitacion: { not: null }
            },
            select: { licitacion: true },
            distinct: ['licitacion']
        }),
        // UTs disponibles para la sucursal del usuario
        prisma.cal_ResSan_Registro.findMany({
            where: baseWhereForYear,
            select: { ut: true },
            distinct: ['ut'],
            orderBy: { ut: 'asc' }
        }),
        // Instituciones disponibles para la sucursal del usuario
        prisma.cal_ResSan_Registro.findMany({
            where: {
                ...baseWhereForYear,
                institucion: { not: '' }
            },
            select: { institucion: true },
            distinct: ['institucion'],
            orderBy: { institucion: 'asc' }
        })
    ])

    // Calcular KPIs
    const totalColegios = statsRaw.length
    const conResolucion = statsRaw.filter(r => r.estadoResolucion === 'Si').length
    const sinResolucion = statsRaw.filter(r => r.estadoResolucion === 'No').length
    const noAplica = statsRaw.filter(r => r.estadoResolucion === 'No Aplica').length
    const conDocumento = statsRaw.filter(r => !!r.documentoUrl).length
    const porcentajeResolucion = totalColegios > 0
        ? Number(((conResolucion / totalColegios) * 100).toFixed(1))
        : 0

    // Años disponibles
    const existingYearsRaw = await prisma.cal_ResSan_Registro.findMany({
        where: isFilteredBySucursal
            ? (userSucursales.length === 0 || allowedRbds.length === 0 ? { rbd: -999999 } : { rbd: { in: allowedRbds } })
            : {},
        select: { anio: true },
        distinct: ['anio'],
        orderBy: { anio: 'desc' }
    })
    const existingYears = existingYearsRaw.map(y => y.anio)
    const currentYear = new Date().getFullYear()
    const allYears = Array.from(new Set([currentYear - 1, currentYear, currentYear + 1, ...existingYears])).sort((a, b) => b - a)

    return {
        records,
        total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
        stats: {
            totalColegios,
            conResolucion,
            sinResolucion,
            noAplica,
            conDocumento,
            porcentajeResolucion
        },
        licitaciones: licitacionesRaw.map(l => l.licitacion as string).filter(Boolean).sort(),
        uts: utsRaw.map(u => u.ut).filter(Boolean),
        instituciones: institucionesRaw.map(i => i.institucion as string).filter(Boolean).sort(),
        anios: allYears,
        userSucursales,
        isFilteredBySucursal,
        isAdmin
    }
}

/**
 * Actualiza el estado y número de resolución sanitaria de un colegio.
 */
export async function updateResolucionSanitariaRecord(params: {
    id: string
    estadoResolucion: string
    numeroResolucion?: string | null
    observaciones?: string | null
}) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    if (!isAdmin && !hasCalidadArea && !permissions.includes('manage_calidad_resolucion_sanitaria')) {
        throw new Error('No tienes permisos para editar la resolución sanitaria')
    }

    const { id, estadoResolucion, numeroResolucion, observaciones } = params

    if (estadoResolucion === 'Si' && (!numeroResolucion || numeroResolucion.trim() === '')) {
        throw new Error('El N° de Resolución Sanitaria es obligatorio cuando el estado es "Si"')
    }

    const current = await prisma.cal_ResSan_Registro.findUnique({
        where: { id }
    })

    if (!current) {
        throw new Error('Registro de resolución sanitaria no encontrado')
    }

    if (!isAdmin) {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        const userSucursales = Array.from(new Set([
            ...(session.user.sucursales || []),
            ...(dbUser?.sucursales?.map((s: any) => s.nombre.trim()) || [])
        ])).filter(Boolean)

        const col = await prisma.colegios.findFirst({
            where: { colRBD: current.rbd },
            select: { sucursal: true }
        })
        const matchesSucursal = userSucursales.some(s => 
            s.toLowerCase() === col?.sucursal?.toLowerCase()
        )

        if (!matchesSucursal) {
            throw new Error('No tienes permisos para modificar colegios fuera de tus sucursales asignadas')
        }
    }

    const updated = await prisma.cal_ResSan_Registro.update({
        where: { id },
        data: {
            estadoResolucion,
            numeroResolucion: estadoResolucion === 'Si' ? numeroResolucion?.trim() : null,
            observaciones: observaciones ? observaciones.trim() : null,
            updatedBy: session.user.username as string
        }
    })

    // Registrar en auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'EDICION_RESOLUCION_SANITARIA',
        modulo: 'Áreas -> Calidad',
        detalle: `Actualizó Resolución Sanitaria RBD ${current.rbd} (${current.nombreEstablecimiento}) Año ${current.anio}: Estado='${estadoResolucion}', N°='${estadoResolucion === 'Si' ? numeroResolucion?.trim() : 'N/A'}'`
    })

    revalidatePath('/dashboard/areas/calidad/resolucion-sanitaria')
    return { success: true, record: updated }
}

/**
 * Sube o reemplaza el documento adjunto de resolución sanitaria.
 */
export async function uploadResolucionDocumento(formData: FormData) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    if (!isAdmin && !hasCalidadArea && !permissions.includes('manage_calidad_resolucion_sanitaria')) {
        throw new Error('No tienes permisos para adjuntar documentos')
    }

    const id = formData.get('id') as string
    const file = formData.get('file') as File | null

    if (!id || !file) {
        throw new Error('Datos incompletos: ID y archivo son requeridos')
    }

    const current = await prisma.cal_ResSan_Registro.findUnique({
        where: { id }
    })

    if (!current) {
        throw new Error('Registro no encontrado')
    }

    if (!isAdmin) {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        const userSucursales = Array.from(new Set([
            ...(session.user.sucursales || []),
            ...(dbUser?.sucursales?.map((s: any) => s.nombre.trim()) || [])
        ])).filter(Boolean)

        const col = await prisma.colegios.findFirst({
            where: { colRBD: current.rbd },
            select: { sucursal: true }
        })
        const matchesSucursal = userSucursales.some(s => 
            s.toLowerCase() === col?.sucursal?.toLowerCase()
        )

        if (!matchesSucursal) {
            throw new Error('No tienes permisos para modificar documentos de colegios fuera de tus sucursales asignadas')
        }
    }

    // Carpeta destino dentro del volumen persistente
    const targetFolder = uploadPath('resoluciones-sanitarias')
    await mkdir(targetFolder, { recursive: true })

    // Sanitizar y crear nombre único
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `RBD_${current.rbd}_${current.anio}_${Date.now()}_${cleanFileName}`
    const fullPath = join(targetFolder, fileName)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(fullPath, buffer)

    const publicUrl = `/uploads/resoluciones-sanitarias/${fileName}`

    const updated = await prisma.cal_ResSan_Registro.update({
        where: { id },
        data: {
            documentoUrl: publicUrl,
            documentoNombre: file.name,
            updatedBy: session.user.username as string
        }
    })

    // Registrar en auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ADJUNTAR_RESOLUCION_SANITARIA',
        modulo: 'Áreas -> Calidad',
        detalle: `Adjuntó documento "${file.name}" para Resolución Sanitaria RBD ${current.rbd} (${current.nombreEstablecimiento}) Año ${current.anio}`
    })

    revalidatePath('/dashboard/areas/calidad/resolucion-sanitaria')
    return { success: true, record: updated }
}

/**
 * Elimina el documento adjunto de un registro de resolución sanitaria.
 */
export async function deleteResolucionDocumento(id: string) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    const permissions = session.user.role?.permissions || []
    const hasCalidadArea = (session.user as any)?.areas?.some((a: any) => a.nombre?.toLowerCase().includes('calidad'))

    if (!isAdmin && !hasCalidadArea && !permissions.includes('manage_calidad_resolucion_sanitaria')) {
        throw new Error('No tienes permisos para eliminar documentos')
    }

    const current = await prisma.cal_ResSan_Registro.findUnique({
        where: { id }
    })

    if (!current) {
        throw new Error('Registro no encontrado')
    }

    if (!isAdmin) {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        const userSucursales = Array.from(new Set([
            ...(session.user.sucursales || []),
            ...(dbUser?.sucursales?.map((s: any) => s.nombre.trim()) || [])
        ])).filter(Boolean)

        const col = await prisma.colegios.findFirst({
            where: { colRBD: current.rbd },
            select: { sucursal: true }
        })
        const matchesSucursal = userSucursales.some(s => 
            s.toLowerCase() === col?.sucursal?.toLowerCase()
        )

        if (!matchesSucursal) {
            throw new Error('No tienes permisos para eliminar documentos de colegios fuera de tus sucursales asignadas')
        }
    }

    const prevDoc = current.documentoNombre || 'Documento adjunto'

    const updated = await prisma.cal_ResSan_Registro.update({
        where: { id },
        data: {
            documentoUrl: null,
            documentoNombre: null,
            updatedBy: session.user.username as string
        }
    })

    // Registrar en auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'ELIMINAR_DOCUMENTO_RESOLUCION',
        modulo: 'Áreas -> Calidad',
        detalle: `Eliminó documento "${prevDoc}" de Resolución Sanitaria RBD ${current.rbd} (${current.nombreEstablecimiento}) Año ${current.anio}`
    })

    revalidatePath('/dashboard/areas/calidad/resolucion-sanitaria')
    return { success: true, record: updated }
}

/**
 * Sincronización manual de colegios para el año actual o especificado.
 */
export async function syncColegiosManualAction(anio: number) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const result = await syncColegiosToResolucionSanitaria(anio)

    // Auditoría
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'SINCRONIZAR_COLEGIOS_RESOLUCION',
        modulo: 'Áreas -> Calidad',
        detalle: `Sincronizó colegios del sistema hacia Resolución Sanitaria Año ${anio}: ${result.added} nuevos, ${result.updated} actualizados de ${result.total} total`
    })

    revalidatePath('/dashboard/areas/calidad/resolucion-sanitaria')
    return { success: true, ...result }
}

/**
 * Carga masiva de Resolución Sanitaria desde archivo Excel seleccionado o maestro.
 * Solo accesible por Administradores.
 * Actualiza la información de la columna Resolución Sanitaria (Si, No, No Aplica) de forma inteligente:
 * Si el archivo Excel contiene una columna de Año/Vigencia, la respeta por fila; de lo contrario, aplica al año objetivo seleccionado.
 */
export async function ejecutarCargaMasivaResolucionSanitariaAction(formData: FormData) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    if (!isAdmin) {
        throw new Error('Acceso denegado: Solo el Administrador puede ejecutar la carga masiva')
    }

    await ensureResolucionSanitariaTable()

    const targetAnioRaw = formData.get('targetAnio')
    const defaultYear = targetAnioRaw && !isNaN(Number(targetAnioRaw)) ? Number(targetAnioRaw) : 2025

    const file = formData.get('file') as File | null
    let wb: XLSX.WorkBook
    let sourceDescription = ''

    if (file && file.size > 0) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        wb = XLSX.read(buffer, { type: 'buffer' })
        sourceDescription = `archivo subido "${file.name}"`
    } else {
        const defaultPath = 'D:\\Programas\\AplicacionWebDoctos\\Calidad\\Resolucion sanitaria Carga Masiva.xlsx'
        if (existsSync(defaultPath)) {
            wb = XLSX.readFile(defaultPath)
            sourceDescription = `archivo maestro servidor "${defaultPath}"`
        } else {
            throw new Error('Debes seleccionar un archivo Excel válido (.xlsx o .xls)')
        }
    }

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas de cálculo válidas')
    }

    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any>(sheet)

    if (!rows || rows.length === 0) {
        throw new Error('El archivo Excel no contiene filas de datos')
    }

    // 1. Detectar inteligentemente los años involucrados en las filas
    const detectedYears = new Set<number>()
    for (const r of rows) {
        const rowYearRaw = r['AÑO'] || r['Año'] || r['ANIO'] || r['Anio'] || r['YEAR'] || r['Year'] || r['Vigencia']
        if (rowYearRaw && !isNaN(Number(rowYearRaw)) && Number(rowYearRaw) >= 2020 && Number(rowYearRaw) <= 2040) {
            detectedYears.add(Number(rowYearRaw))
        }
    }
    if (detectedYears.size === 0) {
        detectedYears.add(defaultYear)
    }

    // 2. Asegurar que los colegios de cada año detectado estén inicializados
    for (const y of detectedYears) {
        const countY = await prisma.cal_ResSan_Registro.count({ where: { anio: y } })
        if (countY === 0) {
            await syncColegiosToResolucionSanitaria(y)
        }
    }

    let updatedCount = 0
    let skippedCount = 0

    // 3. Procesar filas
    for (const r of rows) {
        const rbd = Number(r['RBD'])
        if (!rbd || isNaN(rbd)) {
            skippedCount++
            continue
        }

        const rawEstado = String(r['Resolución \r\nSanitaria'] || r['Resolución Sanitaria'] || r['Resolucion Sanitaria'] || '').trim().toUpperCase()
        let estadoResolucion: 'Si' | 'No' | 'No Aplica' = 'No Aplica'
        if (rawEstado.startsWith('SI')) {
            estadoResolucion = 'Si'
        } else if (rawEstado.startsWith('NO')) {
            estadoResolucion = 'No'
        } else {
            estadoResolucion = 'No Aplica'
        }

        const rawNumero = r['N° Resolucion sanitaria'] || r['N° Resolución Sanitaria'] || r['N° Resolucion Sanitaria']

        // Determinar año de la fila
        const rowYearRaw = r['AÑO'] || r['Año'] || r['ANIO'] || r['Anio'] || r['YEAR'] || r['Year'] || r['Vigencia']
        const anioToApply = (rowYearRaw && !isNaN(Number(rowYearRaw)) && Number(rowYearRaw) >= 2020 && Number(rowYearRaw) <= 2040)
            ? Number(rowYearRaw)
            : defaultYear

        const updateData: any = {
            estadoResolucion,
            updatedBy: `Carga Masiva (${session.user.username})`
        }

        if (estadoResolucion === 'Si' && rawNumero && String(rawNumero).trim() !== '') {
            updateData.numeroResolucion = String(rawNumero).trim()
        }

        const res = await prisma.cal_ResSan_Registro.updateMany({
            where: {
                rbd,
                anio: anioToApply
            },
            data: updateData
        })

        if (res.count > 0) {
            updatedCount += res.count
        }
    }

    // Auditoría
    const yearsList = Array.from(detectedYears).sort().join(', ')
    await logAuditAction({
        username: session.user.username as string,
        userId: session.user.id || null,
        action: 'CARGA_MASIVA_RESOLUCION_SANITARIA',
        modulo: 'Áreas -> Calidad',
        detalle: `Carga masiva ejecutada para año(s) [${yearsList}] desde ${sourceDescription}. Se actualizaron ${updatedCount} registros de ${rows.length} filas analizadas.`
    })

    revalidatePath('/dashboard/areas/calidad/resolucion-sanitaria')

    return {
        success: true,
        updatedCount,
        skippedCount,
        totalRows: rows.length,
        anios: Array.from(detectedYears).sort(),
        targetAnio: defaultYear
    }
}
