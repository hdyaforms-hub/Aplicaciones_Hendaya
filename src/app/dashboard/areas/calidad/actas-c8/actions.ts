'use server'

import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { uploadPath } from '@/lib/storage'
import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { ensureCalidadC8Tables } from '@/lib/calidad/calidad-c8-db-init'

export interface ActaC8Item {
    id: string
    folio: string | null
    licitacion: string
    fechaNotificacion: string
    horaNotificacion: string | null
    fechaHallazgo: string
    sucursal: string
    rbd: number
    establecimiento: string
    preparacionProducto: string | null
    hallazgo: string
    motivoGenericoId: string | null
    motivoGenericoTexto: string | null
    proveedor: string | null
    institucion: string
    fechaTrazabilidad: string | null
    horaTrazabilidad: string | null
    fechaRespuestaCausa: string | null
    horaRespuestaCausa: string | null
    enviaReclamoProveedor: boolean
    tipoMulta: string | null
    multaEstimadaUtm: number
    aprobadoInstitucion: boolean
    aprobadorCorreo: string | null
    aprobadorNombre: string | null
    aprobadorFecha: string | null
    aprobadorDocUrl: string | null
    aprobadorDocNombre: string | null
    valorAnualContrato: number
    respaldoAccion1: string | null
    respaldoAccion2: string | null
    respaldoAccion3: string | null
    respaldoAccion4: string | null
    observacion: string | null
    mesNotificacion: number
    anioNotificacion: number
    montoUtmPesos: number
    calculoPesosUtm: number
    aplicaC8: boolean
    calidadOInocuidad: string
    eficacia: string | null
    respuestaInstitucion: string | null
    creadoPor: string
    actualizadoPor: string | null
    createdAt: string
    updatedAt: string
}

export interface FiltrosData {
    licitaciones: { id: string; label: string }[]
    sucursales: string[]
    uts: { codUT: number; licId: number; sucursal: string }[]
    colegios: { rbd: number; nombre: string; sucursal: string; ut: number; institucion: string }[]
    instituciones: string[]
    motivosC8: { id: string; codigo: string; nombre: string; licitacion?: string }[]
    aniosDisponibles: number[]
    valoresContrato: { licitacion: string; anio: number; montoAnualPesos: number }[]
}

/**
 * Consulta el valor oficial de la UTM para un año y mes dado.
 */
export async function obtenerValorUtmAction(anio: number, mes: number): Promise<number> {
    try {
        const record = await prisma.uTM.findFirst({
            where: { anho: anio, mes: mes },
            select: { monto: true }
        })
        return record?.monto || 0
    } catch (e) {
        console.error('Error al consultar UTM:', e)
        return 0
    }
}

/**
 * Sube un archivo adjunto del respaldo de aprobación por la institución.
 */
export async function subirDocumentoAprobacionC8Action(formData: FormData): Promise<{
    success: boolean
    url?: string
    nombreOriginal?: string
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            throw new Error('No autorizado')
        }

        const file = formData.get('file') as File | null
        if (!file) {
            throw new Error('No se recibió ningún archivo')
        }

        const targetFolder = uploadPath('calidad-c8-aprobaciones')
        await mkdir(targetFolder, { recursive: true })

        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const fileName = `aprobacion_${Date.now()}_${cleanFileName}`
        const fullPath = join(targetFolder, fileName)

        const bytes = await file.arrayBuffer()
        await writeFile(fullPath, Buffer.from(bytes))

        const publicUrl = `/uploads/calidad-c8-aprobaciones/${fileName}`

        return {
            success: true,
            url: publicUrl,
            nombreOriginal: file.name
        }
    } catch (e: any) {
        console.error('Error al subir documento de aprobación C8:', e)
        return { success: false, error: e.message || 'Error al guardar archivo' }
    }
}

/**
 * Obtiene los catálogos y opciones de filtrado en cascada,
 * respetando estrictamente los RBDs permitidos del usuario conectado.
 */
export async function obtenerFiltrosActasC8Action(): Promise<{ success: boolean; data?: FiltrosData; error?: string }> {
    try {
        await ensureCalidadC8Tables()
        const allowedRbds = await getUserEffectiveRbds()

        // 1. Colegios permitidos para el usuario
        const colegiosQuery = allowedRbds !== null
            ? { colRBD: { in: allowedRbds }, activo: true }
            : { activo: true }

        const colegiosDb = await prisma.colegios.findMany({
            where: colegiosQuery,
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                sucursal: true,
                institucion: true,
                colut: true
            },
            orderBy: { colRBD: 'asc' }
        })

        const colegios = colegiosDb.map(c => ({
            rbd: c.colRBD,
            nombre: c.nombreEstablecimiento.trim(),
            sucursal: c.sucursal.trim(),
            ut: c.colut,
            institucion: c.institucion.trim()
        }))

        // 2. UTs
        const utsDb = await prisma.uT.findMany({
            select: {
                codUT: true,
                licId: true,
                sucursal: { select: { nombre: true } }
            }
        })
        const uts = utsDb.map(u => ({
            codUT: u.codUT,
            licId: u.licId,
            sucursal: u.sucursal?.nombre?.trim() || ''
        }))

        // 3. Licitaciones
        const licitacionesDb = await prisma.licitacion.findMany({
            select: { licId: true, licitacionHomologada: true },
            orderBy: { licId: 'asc' }
        })
        const licitaciones = licitacionesDb.map(l => ({
            id: String(l.licId),
            label: l.licitacionHomologada 
                ? `Licitación ${l.licId} - ${l.licitacionHomologada}` 
                : `Licitación ${l.licId}`
        }))

        // 4. Sucursales
        const sucursalesDb = await prisma.sucursal.findMany({
            select: { nombre: true },
            orderBy: { nombre: 'asc' }
        })
        const sucursales = Array.from(new Set(sucursalesDb.map(s => s.nombre.trim()))).filter(Boolean)

        // 5. Instituciones únicas
        const institucionesSet = new Set<string>()
        colegios.forEach(c => {
            if (c.institucion) institucionesSet.add(c.institucion)
        })
        institucionesSet.add('JUNAEB')
        institucionesSet.add('INTEGRA')
        institucionesSet.add('JUNJI')
        const instituciones = Array.from(institucionesSet).sort()

        // 6. Motivos C8 activos de Registros Globales
        const motivosDb = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "id", "codigo", "nombre", COALESCE("licitacion", 'TODAS') as "licitacion"
            FROM "Calidad_Motivo_C8"
            WHERE "activo" = TRUE
            ORDER BY "codigo" ASC;
        `)
        const motivosC8 = motivosDb.map(m => ({
            id: m.id,
            codigo: m.codigo,
            nombre: m.nombre,
            licitacion: m.licitacion || 'TODAS'
        }))

        // 7. Años disponibles
        const anioActual = new Date().getFullYear()
        const aniosDisponibles = [anioActual + 1, anioActual, anioActual - 1, anioActual - 2, anioActual - 3]

        // 8. Valores de contrato activos
        const contratosDb = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "licitacion", "anio", "montoAnualPesos"
            FROM "Calidad_Valor_Contrato"
            WHERE "activo" = TRUE;
        `)
        const valoresContrato = contratosDb.map(c => ({
            licitacion: c.licitacion,
            anio: Number(c.anio),
            montoAnualPesos: Number(c.montoAnualPesos || 0)
        }))

        return {
            success: true,
            data: {
                licitaciones,
                sucursales,
                uts,
                colegios,
                instituciones,
                motivosC8,
                aniosDisponibles,
                valoresContrato
            }
        }
    } catch (error: any) {
        console.error('Error al obtener filtros para Actas C8:', error)
        return { success: false, error: error.message || 'Error al cargar filtros' }
    }
}

/**
 * Obtiene el listado de Actas C8 aplicando filtros y restricción de perfil (RBDs permitidos).
 */
export async function obtenerActasC8Action(filtros?: {
    licitacion?: string
    sucursal?: string
    rbd?: number
    anio?: number
    mes?: number
    folio?: string
}): Promise<{ success: boolean; data?: ActaC8Item[]; error?: string }> {
    try {
        await ensureCalidadC8Tables()
        const allowedRbds = await getUserEffectiveRbds()

        const conditions: string[] = []
        const params: any[] = []
        let paramIdx = 1

        // 1. Restricción por RBDs
        if (allowedRbds !== null) {
            if (allowedRbds.length === 0) {
                return { success: true, data: [] }
            }
            conditions.push(`"rbd" = ANY($${paramIdx}::int[])`)
            params.push(allowedRbds)
            paramIdx++
        }

        // 2. Filtros dinámicos
        if (filtros?.licitacion && filtros.licitacion.trim()) {
            conditions.push(`"licitacion" = $${paramIdx}`)
            params.push(filtros.licitacion.trim())
            paramIdx++
        }

        if (filtros?.sucursal && filtros.sucursal.trim()) {
            conditions.push(`"sucursal" = $${paramIdx}`)
            params.push(filtros.sucursal.trim())
            paramIdx++
        }

        if (filtros?.rbd && !isNaN(Number(filtros.rbd))) {
            conditions.push(`"rbd" = $${paramIdx}`)
            params.push(Number(filtros.rbd))
            paramIdx++
        }

        if (filtros?.anio && !isNaN(Number(filtros.anio))) {
            conditions.push(`"anioNotificacion" = $${paramIdx}`)
            params.push(Number(filtros.anio))
            paramIdx++
        }

        if (filtros?.mes && !isNaN(Number(filtros.mes))) {
            conditions.push(`"mesNotificacion" = $${paramIdx}`)
            params.push(Number(filtros.mes))
            paramIdx++
        }

        if (filtros?.folio && filtros.folio.trim()) {
            conditions.push(`"folio" ILIKE $${paramIdx}`)
            params.push(`%${filtros.folio.trim()}%`)
            paramIdx++
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const sql = `
            SELECT 
                "id", "folio", "licitacion", 
                "fechaNotificacion"::text as "fechaNotificacion",
                "horaNotificacion",
                "fechaHallazgo"::text as "fechaHallazgo",
                "sucursal", "rbd", "establecimiento",
                "preparacionProducto", "hallazgo",
                "motivoGenericoId", "motivoGenericoTexto",
                "proveedor", "institucion",
                "fechaTrazabilidad"::text as "fechaTrazabilidad",
                "horaTrazabilidad",
                "fechaRespuestaCausa"::text as "fechaRespuestaCausa",
                "horaRespuestaCausa",
                "enviaReclamoProveedor",
                "tipoMulta",
                "multaEstimadaUtm",
                "aprobadoInstitucion",
                "aprobadorCorreo",
                "aprobadorNombre",
                "aprobadorFecha"::text as "aprobadorFecha",
                "aprobadorDocUrl",
                "aprobadorDocNombre",
                "valorAnualContrato",
                "respaldoAccion1", "respaldoAccion2", "respaldoAccion3", "respaldoAccion4",
                "observacion",
                "mesNotificacion", "anioNotificacion",
                "montoUtmPesos", "calculoPesosUtm",
                "aplicaC8", "calidadOInocuidad", "eficacia", "respuestaInstitucion",
                "creadoPor", "actualizadoPor",
                "createdAt"::text as "createdAt",
                "updatedAt"::text as "updatedAt"
            FROM "Calidad_Acta_C8"
            ${whereClause}
            ORDER BY "fechaNotificacion" DESC, "createdAt" DESC;
        `

        const rows = await rawPrisma.$queryRawUnsafe<any[]>(sql, ...params)

        const data: ActaC8Item[] = rows.map(r => ({
            id: r.id,
            folio: r.folio || null,
            licitacion: r.licitacion,
            fechaNotificacion: r.fechaNotificacion,
            horaNotificacion: r.horaNotificacion,
            fechaHallazgo: r.fechaHallazgo,
            sucursal: r.sucursal,
            rbd: Number(r.rbd),
            establecimiento: r.establecimiento,
            preparacionProducto: r.preparacionProducto,
            hallazgo: r.hallazgo,
            motivoGenericoId: r.motivoGenericoId,
            motivoGenericoTexto: r.motivoGenericoTexto,
            proveedor: r.proveedor,
            institucion: r.institucion,
            fechaTrazabilidad: r.fechaTrazabilidad,
            horaTrazabilidad: r.horaTrazabilidad,
            fechaRespuestaCausa: r.fechaRespuestaCausa,
            horaRespuestaCausa: r.horaRespuestaCausa,
            enviaReclamoProveedor: Boolean(r.enviaReclamoProveedor),
            tipoMulta: r.tipoMulta || 'Tipo 1',
            multaEstimadaUtm: Number(r.multaEstimadaUtm || 0),
            aprobadoInstitucion: Boolean(r.aprobadoInstitucion),
            aprobadorCorreo: r.aprobadorCorreo || null,
            aprobadorNombre: r.aprobadorNombre || null,
            aprobadorFecha: r.aprobadorFecha || null,
            aprobadorDocUrl: r.aprobadorDocUrl || null,
            aprobadorDocNombre: r.aprobadorDocNombre || null,
            valorAnualContrato: Number(r.valorAnualContrato || 0),
            respaldoAccion1: r.respaldoAccion1,
            respaldoAccion2: r.respaldoAccion2,
            respaldoAccion3: r.respaldoAccion3,
            respaldoAccion4: r.respaldoAccion4,
            observacion: r.observacion,
            mesNotificacion: Number(r.mesNotificacion),
            anioNotificacion: Number(r.anioNotificacion),
            montoUtmPesos: Number(r.montoUtmPesos || 0),
            calculoPesosUtm: Number(r.calculoPesosUtm || 0),
            aplicaC8: Boolean(r.aplicaC8),
            calidadOInocuidad: r.calidadOInocuidad || 'Calidad',
            eficacia: r.eficacia,
            respuestaInstitucion: r.respuestaInstitucion,
            creadoPor: r.creadoPor,
            actualizadoPor: r.actualizadoPor,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al obtener Actas C8:', error)
        return { success: false, error: error.message || 'Error al obtener Actas C8' }
    }
}

/**
 * Guarda o actualiza un Acta C8 con cálculo automático de mes, año, valor UTM y monto pesos.
 */
export async function guardarActaC8Action(data: {
    id?: string
    folio?: string
    licitacion: string
    fechaNotificacion: string
    horaNotificacion?: string
    fechaHallazgo: string
    sucursal: string
    rbd: number
    establecimiento: string
    preparacionProducto?: string
    hallazgo: string
    motivoGenericoId?: string
    motivoGenericoTexto?: string
    proveedor?: string
    institucion: string
    fechaTrazabilidad?: string
    horaTrazabilidad?: string
    fechaRespuestaCausa?: string
    horaRespuestaCausa?: string
    enviaReclamoProveedor: boolean
    tipoMulta?: string
    multaEstimadaUtm: number
    aprobadoInstitucion?: boolean
    aprobadorCorreo?: string
    aprobadorNombre?: string
    aprobadorFecha?: string
    aprobadorDocUrl?: string
    aprobadorDocNombre?: string
    valorAnualContrato?: number
    calculoPesosUtm?: number
    respaldoAccion1?: string
    respaldoAccion2?: string
    respaldoAccion3?: string
    respaldoAccion4?: string
    observacion?: string
    aplicaC8: boolean
    calidadOInocuidad: string
    eficacia?: string
    respuestaInstitucion?: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const session = await getSession()
        if (!session || !session.user) {
            throw new Error('No autorizado: Sesión no válida')
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const perms: string[] = session.user.role?.permissions || []
        const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
        const canManage = isAdmin || perms.includes('manage_calidad_actas_c8')

        if (!canManage) {
            throw new Error('No tiene permisos para registrar o modificar Actas C8')
        }

        const usuario = session.user.name || session.user.username || session.user.email || 'Usuario'
        const allowedRbds = await getUserEffectiveRbds()

        if (allowedRbds !== null && !allowedRbds.includes(data.rbd)) {
            throw new Error(`No tiene autorización para registrar actas en el RBD ${data.rbd}`)
        }

        await ensureCalidadC8Tables()

        // 1. Extraer mes y año de fecha de notificación
        const fNotif = new Date(data.fechaNotificacion)
        if (isNaN(fNotif.getTime())) {
            throw new Error('La Fecha de Notificación no es válida')
        }

        const anioNotificacion = fNotif.getUTCFullYear()
        const mesNotificacion = fNotif.getUTCMonth() + 1

        // 2. Obtener valor histórico de la UTM
        const valorUtm = await obtenerValorUtmAction(anioNotificacion, mesNotificacion)
        const multaUtm = Number(data.multaEstimadaUtm) || 0

        // Si se especificó calculoPesosUtm directamente (por ejemplo en ETA 1% del valor contrato), usarlo;
        // de lo contrario, calcular multaUtm * valorUtm
        let calculoPesos = data.calculoPesosUtm !== undefined && data.calculoPesosUtm !== null
            ? Math.round(Number(data.calculoPesosUtm))
            : Math.round(multaUtm * valorUtm)

        const folio = data.folio?.trim() || null
        const tipoMulta = data.tipoMulta || 'Tipo 1'
        const aprobadoInstitucion = Boolean(data.aprobadoInstitucion)
        const aprobadorCorreo = data.aprobadorCorreo?.trim() || null
        const aprobadorNombre = data.aprobadorNombre?.trim() || null
        const aprobadorFecha = data.aprobadorFecha ? new Date(data.aprobadorFecha).toISOString() : null
        const aprobadorDocUrl = data.aprobadorDocUrl || null
        const aprobadorDocNombre = data.aprobadorDocNombre || null
        const valorAnualContrato = Number(data.valorAnualContrato || 0)

        if (data.id) {
            // Actualizar registro existente
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Calidad_Acta_C8"
                SET 
                    "licitacion" = $1,
                    "fechaNotificacion" = $2::timestamp,
                    "horaNotificacion" = $3,
                    "fechaHallazgo" = $4::timestamp,
                    "sucursal" = $5,
                    "rbd" = $6,
                    "establecimiento" = $7,
                    "preparacionProducto" = $8,
                    "hallazgo" = $9,
                    "motivoGenericoId" = $10,
                    "motivoGenericoTexto" = $11,
                    "proveedor" = $12,
                    "institucion" = $13,
                    "fechaTrazabilidad" = $14::timestamp,
                    "horaTrazabilidad" = $15,
                    "fechaRespuestaCausa" = $16::timestamp,
                    "horaRespuestaCausa" = $17,
                    "enviaReclamoProveedor" = $18,
                    "multaEstimadaUtm" = $19,
                    "respaldoAccion1" = $20,
                    "respaldoAccion2" = $21,
                    "respaldoAccion3" = $22,
                    "respaldoAccion4" = $23,
                    "observacion" = $24,
                    "mesNotificacion" = $25,
                    "anioNotificacion" = $26,
                    "montoUtmPesos" = $27,
                    "calculoPesosUtm" = $28,
                    "aplicaC8" = $29,
                    "calidadOInocuidad" = $30,
                    "eficacia" = $31,
                    "respuestaInstitucion" = $32,
                    "actualizadoPor" = $33,
                    "folio" = $34,
                    "tipoMulta" = $35,
                    "aprobadoInstitucion" = $36,
                    "aprobadorCorreo" = $37,
                    "aprobadorNombre" = $38,
                    "aprobadorFecha" = $39::timestamp,
                    "aprobadorDocUrl" = $40,
                    "aprobadorDocNombre" = $41,
                    "valorAnualContrato" = $42,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $43;
            `,
                data.licitacion,
                data.fechaNotificacion,
                data.horaNotificacion || null,
                data.fechaHallazgo,
                data.sucursal,
                data.rbd,
                data.establecimiento,
                data.preparacionProducto || null,
                data.hallazgo,
                data.motivoGenericoId || null,
                data.motivoGenericoTexto || null,
                data.proveedor || null,
                data.institucion,
                data.fechaTrazabilidad ? data.fechaTrazabilidad : null,
                data.horaTrazabilidad || null,
                data.fechaRespuestaCausa ? data.fechaRespuestaCausa : null,
                data.horaRespuestaCausa || null,
                data.enviaReclamoProveedor,
                multaUtm,
                data.respaldoAccion1 || null,
                data.respaldoAccion2 || null,
                data.respaldoAccion3 || null,
                data.respaldoAccion4 || null,
                data.observacion || null,
                mesNotificacion,
                anioNotificacion,
                valorUtm,
                calculoPesos,
                data.aplicaC8,
                data.calidadOInocuidad || 'Calidad',
                data.eficacia || null,
                data.respuestaInstitucion || null,
                usuario,
                folio,
                tipoMulta,
                aprobadoInstitucion,
                aprobadorCorreo,
                aprobadorNombre,
                aprobadorFecha,
                aprobadorDocUrl,
                aprobadorDocNombre,
                valorAnualContrato,
                data.id
            )

            await logAuditAction({
                username: usuario,
                modulo: 'Áreas -> Calidad',
                action: 'EDICION',
                detalle: `Actualizó Acta C8 para RBD ${data.rbd} (${data.establecimiento}) - Folio: ${folio || 'S/F'} - Multa: ${multaUtm} UTM`
            })

            return { success: true, id: data.id }
        } else {
            // Crear nuevo registro
            const id = crypto.randomUUID()
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Calidad_Acta_C8" (
                    "id", "licitacion", "fechaNotificacion", "horaNotificacion", "fechaHallazgo",
                    "sucursal", "rbd", "establecimiento", "preparacionProducto", "hallazgo",
                    "motivoGenericoId", "motivoGenericoTexto", "proveedor", "institucion",
                    "fechaTrazabilidad", "horaTrazabilidad", "fechaRespuestaCausa", "horaRespuestaCausa",
                    "enviaReclamoProveedor", "multaEstimadaUtm", "respaldoAccion1", "respaldoAccion2",
                    "respaldoAccion3", "respaldoAccion4", "observacion", "mesNotificacion", "anioNotificacion",
                    "montoUtmPesos", "calculoPesosUtm", "aplicaC8", "calidadOInocuidad", "eficacia",
                    "respuestaInstitucion", "creadoPor", "folio", "tipoMulta", "aprobadoInstitucion",
                    "aprobadorCorreo", "aprobadorNombre", "aprobadorFecha", "aprobadorDocUrl",
                    "aprobadorDocNombre", "valorAnualContrato"
                ) VALUES (
                    $1, $2, $3::timestamp, $4, $5::timestamp,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14,
                    $15::timestamp, $16, $17::timestamp, $18,
                    $19, $20, $21, $22,
                    $23, $24, $25, $26, $27,
                    $28, $29, $30, $31, $32,
                    $33, $34, $35, $36, $37,
                    $38, $39, $40::timestamp, $41,
                    $42, $43
                );
            `,
                id,
                data.licitacion,
                data.fechaNotificacion,
                data.horaNotificacion || null,
                data.fechaHallazgo,
                data.sucursal,
                data.rbd,
                data.establecimiento,
                data.preparacionProducto || null,
                data.hallazgo,
                data.motivoGenericoId || null,
                data.motivoGenericoTexto || null,
                data.proveedor || null,
                data.institucion,
                data.fechaTrazabilidad ? data.fechaTrazabilidad : null,
                data.horaTrazabilidad || null,
                data.fechaRespuestaCausa ? data.fechaRespuestaCausa : null,
                data.horaRespuestaCausa || null,
                data.enviaReclamoProveedor,
                multaUtm,
                data.respaldoAccion1 || null,
                data.respaldoAccion2 || null,
                data.respaldoAccion3 || null,
                data.respaldoAccion4 || null,
                data.observacion || null,
                mesNotificacion,
                anioNotificacion,
                valorUtm,
                calculoPesos,
                data.aplicaC8,
                data.calidadOInocuidad || 'Calidad',
                data.eficacia || null,
                data.respuestaInstitucion || null,
                usuario,
                folio,
                tipoMulta,
                aprobadoInstitucion,
                aprobadorCorreo,
                aprobadorNombre,
                aprobadorFecha,
                aprobadorDocUrl,
                aprobadorDocNombre,
                valorAnualContrato
            )

            await logAuditAction({
                username: usuario,
                modulo: 'Áreas -> Calidad',
                action: 'CREACION',
                detalle: `Registró nueva Acta C8 para RBD ${data.rbd} (${data.establecimiento}) - Folio: ${folio || 'S/F'} - Multa: ${multaUtm} UTM`
            })

            return { success: true, id }
        }
    } catch (error: any) {
        console.error('Error al guardar Acta C8:', error)
        return { success: false, error: error.message || 'Error al guardar Acta C8' }
    }
}

/**
 * Elimina un Acta C8 verificando permisos y pertenencia de RBD.
 */
export async function eliminarActaC8Action(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session || !session.user) {
            throw new Error('No autorizado')
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const perms: string[] = session.user.role?.permissions || []
        const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
        const canManage = isAdmin || perms.includes('manage_calidad_actas_c8')

        if (!canManage) {
            throw new Error('No tiene permisos para eliminar Actas C8')
        }

        const usuario = session.user.name || session.user.username || session.user.email || 'Usuario'
        await ensureCalidadC8Tables()

        const existing = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "rbd", "establecimiento", "multaEstimadaUtm" FROM "Calidad_Acta_C8" WHERE "id" = $1;
        `, id)

        if (existing.length === 0) {
            return { success: true }
        }

        const rbd = Number(existing[0].rbd)
        const allowedRbds = await getUserEffectiveRbds()
        if (allowedRbds !== null && !allowedRbds.includes(rbd)) {
            throw new Error(`No tiene autorización sobre el RBD ${rbd}`)
        }

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Calidad_Acta_C8" WHERE "id" = $1;`, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Áreas -> Calidad',
            action: 'ELIMINACION',
            detalle: `Eliminó Acta C8 (ID: ${id}) de RBD ${rbd} (${existing[0].establecimiento})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar Acta C8:', error)
        return { success: false, error: error.message || 'Error al eliminar registro' }
    }
}

/**
 * Carga masiva de Actas C8 desde planilla Excel.
 */
export async function importarActasC8MasivoAction(filas: any[]): Promise<{
    success: boolean
    insertados?: number
    errores?: string[]
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session || !session.user) {
            throw new Error('No autorizado: Sesión expirada')
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const perms: string[] = session.user.role?.permissions || []
        const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
        const canImport = isAdmin || perms.includes('import_calidad_actas_c8') || perms.includes('manage_calidad_actas_c8')

        if (!canImport) {
            throw new Error('No tiene permisos para importar Actas C8 de forma masiva')
        }

        const usuario = session.user.name || session.user.username || session.user.email || 'Usuario'
        const allowedRbds = await getUserEffectiveRbds()
        await ensureCalidadC8Tables()

        if (!Array.isArray(filas) || filas.length === 0) {
            return { success: false, error: 'El archivo Excel no contiene filas válidas para procesar' }
        }

        const utmCache = new Map<string, number>()
        const obtenerUtmLocal = async (anio: number, mes: number): Promise<number> => {
            const key = `${anio}-${mes}`
            if (utmCache.has(key)) return utmCache.get(key)!
            const val = await obtenerValorUtmAction(anio, mes)
            utmCache.set(key, val)
            return val
        }

        let insertados = 0
        const errores: string[] = []

        for (let i = 0; i < filas.length; i++) {
            const f = filas[i]
            const filaNum = i + 2

            try {
                const rbd = Number(f.rbd || f.RBD)
                if (isNaN(rbd) || rbd <= 0) {
                    errores.push(`Fila ${filaNum}: RBD inválido (${f.rbd})`)
                    continue
                }

                if (allowedRbds !== null && !allowedRbds.includes(rbd)) {
                    errores.push(`Fila ${filaNum}: RBD ${rbd} no autorizado para su perfil`)
                    continue
                }

                const fechaNotifStr = String(f.fechaNotificacion || f['Fecha Notificación'] || f['Fecha Notificacion'] || '').trim()
                const fNotif = new Date(fechaNotifStr)
                if (isNaN(fNotif.getTime())) {
                    errores.push(`Fila ${filaNum}: Fecha de Notificación inválida (${fechaNotifStr})`)
                    continue
                }

                const anioNotificacion = fNotif.getUTCFullYear()
                const mesNotificacion = fNotif.getUTCMonth() + 1
                const valorUtm = await obtenerUtmLocal(anioNotificacion, mesNotificacion)

                const fechaHallazgoStr = String(f.fechaHallazgo || f['Fecha Hallazgo'] || fechaNotifStr).trim()
                const fHallazgo = new Date(fechaHallazgoStr)
                const fechaHallazgoValida = !isNaN(fHallazgo.getTime()) ? fHallazgo.toISOString() : fNotif.toISOString()

                const hallazgo = String(f.hallazgo || f.Hallazgo || '').trim()
                if (!hallazgo) {
                    errores.push(`Fila ${filaNum}: El campo Hallazgo es obligatorio`)
                    continue
                }

                const folio = String(f.folio || f.Folio || '').trim() || null
                const licitacion = String(f.licitacion || f.Licitacion || f.Licitación || 'S/I').trim()
                const sucursal = String(f.sucursal || f.Sucursal || 'S/I').trim()
                const establecimiento = String(f.establecimiento || f.Establecimiento || `RBD ${rbd}`).trim()
                const institucion = String(f.institucion || f.Institución || f.Institucion || 'JUNAEB').trim()
                const prepProd = String(f.preparacionProducto || f['Preparación / Producto'] || f['Preparacion Producto'] || '').trim() || null
                const motivoTexto = String(f.motivoGenerico || f['Motivo Genérico'] || f['Motivo Generico'] || '').trim() || null
                const proveedor = String(f.proveedor || f.Proveedor || '').trim() || null

                const reclamoStr = String(f.enviaReclamoProveedor || f['Se envía reclamo a proveedor'] || f['Reclamo Proveedor'] || '').toLowerCase().trim()
                const enviaReclamo = reclamoStr === 'si' || reclamoStr === 'sí' || reclamoStr === 'true' || reclamoStr === '1'

                const multaUtm = Number(f.multaEstimadaUtm || f['Multa Estimada UTM'] || f['Multa Estimada'] || 0) || 0
                const calculoPesos = Math.round(multaUtm * valorUtm)

                const id = crypto.randomUUID()

                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "Calidad_Acta_C8" (
                        "id", "folio", "licitacion", "fechaNotificacion", "horaNotificacion", "fechaHallazgo",
                        "sucursal", "rbd", "establecimiento", "preparacionProducto", "hallazgo",
                        "motivoGenericoTexto", "proveedor", "institucion",
                        "fechaTrazabilidad", "horaTrazabilidad", "fechaRespuestaCausa", "horaRespuestaCausa",
                        "enviaReclamoProveedor", "multaEstimadaUtm", "respaldoAccion1", "respaldoAccion2",
                        "respaldoAccion3", "respaldoAccion4", "observacion", "mesNotificacion", "anioNotificacion",
                        "montoUtmPesos", "calculoPesosUtm", "aplicaC8", "calidadOInocuidad", "eficacia",
                        "respuestaInstitucion", "creadoPor"
                    ) VALUES (
                        $1, $2, $3, $4::timestamp, $5, $6::timestamp,
                        $7, $8, $9, $10, $11,
                        $12, $13, $14,
                        $15, $16, $17, $18,
                        $19, $20, $21, $22,
                        $23, $24, $25, $26, $27,
                        $28, $29, $30, $31, $32,
                        $33, $34
                    );
                `,
                    id,
                    folio,
                    licitacion,
                    fNotif.toISOString(),
                    f.horaNotificacion || f['Hora Notificación'] || null,
                    fechaHallazgoValida,
                    sucursal,
                    rbd,
                    establecimiento,
                    prepProd,
                    hallazgo,
                    motivoTexto,
                    proveedor,
                    institucion,
                    f.fechaTrazabilidad ? new Date(f.fechaTrazabilidad).toISOString() : null,
                    f.horaTrazabilidad || null,
                    f.fechaRespuestaCausa ? new Date(f.fechaRespuestaCausa).toISOString() : null,
                    f.horaRespuestaCausa || null,
                    enviaReclamo,
                    multaUtm,
                    f.respaldoAccion1 || f['Respaldo Acción 1'] || null,
                    f.respaldoAccion2 || f['Respaldo Acción 2'] || null,
                    f.respaldoAccion3 || f['Respaldo Acción 3'] || null,
                    f.respaldoAccion4 || f['Respaldo Acción 4'] || null,
                    f.observacion || f.Observación || f.Observacion || null,
                    mesNotificacion,
                    anioNotificacion,
                    valorUtm,
                    calculoPesos,
                    true,
                    f.calidadOInocuidad || f['Calidad o Inocuidad'] || 'Calidad',
                    f.eficacia || f.Eficacia || null,
                    f.respuestaInstitucion || f['Respuesta Institución'] || null,
                    usuario
                )

                insertados++
            } catch (errFila: any) {
                errores.push(`Fila ${filaNum}: ${errFila.message}`)
            }
        }

        if (insertados > 0) {
            await logAuditAction({
                username: usuario,
                modulo: 'Áreas -> Calidad',
                action: 'CARGA_MASIVA',
                detalle: `Importó masivamente ${insertados} Acta(s) C8 desde Excel (${errores.length} errores)`
            })
        }

        return {
            success: insertados > 0 || errores.length === 0,
            insertados,
            errores
        }
    } catch (error: any) {
        console.error('Error en importarActasC8MasivoAction:', error)
        return { success: false, error: error.message || 'Error en carga masiva' }
    }
}
