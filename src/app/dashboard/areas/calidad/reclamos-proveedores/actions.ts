'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { uploadPath } from '@/lib/storage'
import { ensureReclamosProveedoresTables } from '@/lib/calidad/reclamos-proveedores-db-init'
import { sendGenericaNotification } from '@/lib/notifications'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface ArchivoEvidencia {
    url: string
    nombre: string
    tipo: string
    size: number
}

export interface ReclamoProveedorItem {
    id: string
    numeroReclamo: string
    correlativo: number
    anio: number
    licitacionId: string
    licitacionNombre: string
    zonal: string
    origenReclamo: 'RECLAMO_ZONAL' | 'RECLAMO_CLIENTE' | 'RECLAMO_CLIENTE_C8'
    fechaDesviacion: string // YYYY-MM-DD
    lugar: string
    tipoReclamo: 'CALIDAD' | 'INOCUIDAD'
    producto: string
    proveedor: string
    marca?: string | null
    fechaElaboracion?: string | null
    fechaVencimiento?: string | null
    lote?: string | null
    formato?: string | null
    cantidad?: number | null
    formatoCantidad?: 'Kilo' | 'Unidad' | 'Otro' | string | null
    observacion?: string | null
    evidencias: ArchivoEvidencia[]
    fechaRecepcionReclamo?: string | null
    fechaEnvioProveedor?: string | null
    fechaRecepcionRespuesta?: string | null
    archivoRespuesta?: ArchivoEvidencia | null
    destinoCompras?: string | null
    estado: 'ABIERTO' | 'ENVIADO_PROVEEDOR' | 'RESPONDIDO' | 'CERRADO'
    creadoPor: string
    creadoPorNombre?: string | null
    actualizadoPor?: string | null
    createdAt: string
    updatedAt: string
}

export interface FiltrosReclamos {
    licitacionId?: string
    anio?: number
    mes?: number
    busqueda?: string
}

export interface LicitacionOption {
    id: string
    nombre: string
    sucursales: string[]
}

export interface ReclamosDataResponse {
    success: boolean
    items: ReclamoProveedorItem[]
    licitaciones: LicitacionOption[]
    siguienteNumeroReclamo: string
    esAdmin: boolean
    puedeGestionar: boolean
    privilegiosUsuario: {
        puedeEditar: boolean
        puedeFechasSeguimiento: boolean
        puedeAdjuntarRespuesta: boolean
    }
    error?: string
}

/**
 * Obtiene la lista de licitaciones y zonales permitidos para el usuario actual
 */
async function obtenerLicitacionesPermitidasUsuario(session: any): Promise<{
    licitaciones: LicitacionOption[]
    esAdmin: boolean
}> {
    const roleName = (session.user.role?.name || '').toLowerCase()
    const perms: string[] = session.user.role?.permissions || []
    const esAdmin = roleName.includes('admin') || perms.includes('*')

    // 1. Obtener todas las licitaciones activas y sus sucursales
    const licitacionesDb = await rawPrisma.licitacion.findMany({
        where: { estado: 1 },
        select: {
            licId: true,
            licitacionHomologada: true,
            uts: {
                select: {
                    sucursal: {
                        select: {
                            nombre: true
                        }
                    }
                }
            }
        },
        orderBy: { licId: 'asc' }
    })

    const todasLicitaciones: LicitacionOption[] = licitacionesDb.map(l => {
        const sucursalesSet = new Set<string>()
        l.uts.forEach(u => {
            if (u.sucursal?.nombre) sucursalesSet.add(u.sucursal.nombre.trim())
        })
        return {
            id: String(l.licId),
            nombre: l.licitacionHomologada ? `Licitación ${l.licId} - ${l.licitacionHomologada}` : `Licitación ${l.licId}`,
            sucursales: Array.from(sucursalesSet).sort()
        }
    })

    if (esAdmin) {
        return { licitaciones: todasLicitaciones, esAdmin: true }
    }

    // Si el usuario no es admin, filtramos por los RBDs / licitaciones asignadas en su perfil
    const userColegios: number[] = (session.user.colegios || []).map((c: any) => Number(c.rbd || c)).filter(Boolean)
    const userLicitacionesIds: string[] = (session.user.licitaciones || []).map((l: any) => String(l.licId || l.id || l))

    if (userColegios.length > 0) {
        const colegiosLics = await rawPrisma.colegios.findMany({
            where: { colRBD: { in: userColegios } },
            select: { colut: true }
        })
        const coluts = colegiosLics.map((c: { colut: number }) => c.colut).filter(Boolean)
        const uts = await rawPrisma.uT.findMany({
            where: { codUT: { in: coluts } },
            select: { licId: true }
        })
        const licIdsFromColegios = uts.map((u: { licId: number }) => String(u.licId)).filter(Boolean)
        const allowedIdsSet = new Set([...userLicitacionesIds, ...licIdsFromColegios])

        const filtered = todasLicitaciones.filter(l => allowedIdsSet.has(l.id))
        return {
            licitaciones: filtered.length > 0 ? filtered : todasLicitaciones,
            esAdmin: false
        }
    }

    if (userLicitacionesIds.length > 0) {
        const allowedIdsSet = new Set(userLicitacionesIds)
        const filtered = todasLicitaciones.filter(l => allowedIdsSet.has(l.id))
        return {
            licitaciones: filtered.length > 0 ? filtered : todasLicitaciones,
            esAdmin: false
        }
    }

    return { licitaciones: todasLicitaciones, esAdmin: false }
}

/**
 * Obtiene la lista de reclamos según filtros y el estimado del siguiente número correlativo
 */
export async function obtenerReclamosDataAction(filtros?: FiltrosReclamos): Promise<ReclamosDataResponse> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return {
                success: false,
                items: [],
                licitaciones: [],
                siguienteNumeroReclamo: '0001/' + new Date().getFullYear(),
                esAdmin: false,
                puedeGestionar: false,
                privilegiosUsuario: {
                    puedeEditar: false,
                    puedeFechasSeguimiento: false,
                    puedeAdjuntarRespuesta: false
                },
                error: 'Sesión no válida o expirada'
            }
        }

        await ensureReclamosProveedoresTables()

        const { licitaciones, esAdmin } = await obtenerLicitacionesPermitidasUsuario(session)
        const perms: string[] = session.user.role?.permissions || []
        const puedeGestionar = esAdmin || perms.includes('manage_calidad_reclamos_proveedores')

        const allowedLicIds = licitaciones.map(l => l.id)

        // Calcular siguiente número correlativo para el año en curso
        const anioActual = new Date().getFullYear()
        const corrRows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COALESCE(MAX("correlativo"), 0) + 1 as "siguiente"
            FROM "calidad_reclamos_proveedores"
            WHERE "anio" = $1;
        `, anioActual)
        const siguienteCorr = Number(corrRows[0]?.siguiente || 1)
        const siguienteNumeroReclamo = `${String(siguienteCorr).padStart(4, '0')}/${anioActual}`

        // Construir condiciones WHERE
        const conditions: string[] = []
        const params: any[] = []
        let pIdx = 1

        // Si no es admin y tiene licitaciones restringidas
        if (!esAdmin && allowedLicIds.length > 0) {
            conditions.push(`"licitacionId" = ANY($${pIdx})`)
            params.push(allowedLicIds)
            pIdx++
        }

        if (filtros?.licitacionId && filtros.licitacionId !== 'TODAS') {
            conditions.push(`"licitacionId" = $${pIdx}`)
            params.push(filtros.licitacionId)
            pIdx++
        }

        if (filtros?.anio && filtros.anio > 0) {
            conditions.push(`EXTRACT(YEAR FROM "fechaDesviacion") = $${pIdx}`)
            params.push(filtros.anio)
            pIdx++
        }

        if (filtros?.mes && filtros.mes > 0 && filtros.mes <= 12) {
            conditions.push(`EXTRACT(MONTH FROM "fechaDesviacion") = $${pIdx}`)
            params.push(filtros.mes)
            pIdx++
        }

        if (filtros?.busqueda && filtros.busqueda.trim()) {
            const term = `%${filtros.busqueda.trim().toLowerCase()}%`
            conditions.push(`(
                LOWER("numeroReclamo") LIKE $${pIdx} OR
                LOWER("producto") LIKE $${pIdx} OR
                LOWER("proveedor") LIKE $${pIdx} OR
                LOWER(COALESCE("lote", '')) LIKE $${pIdx} OR
                LOWER(COALESCE("marca", '')) LIKE $${pIdx} OR
                LOWER("zonal") LIKE $${pIdx}
            )`)
            params.push(term)
            pIdx++
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT 
                "id", "numeroReclamo", "correlativo", "anio",
                "licitacionId", "licitacionNombre", "zonal",
                "origenReclamo",
                "fechaDesviacion"::text as "fechaDesviacion",
                "lugar", "tipoReclamo",
                "producto", "proveedor", "marca",
                "fechaElaboracion"::text as "fechaElaboracion",
                "fechaVencimiento"::text as "fechaVencimiento",
                "lote", "formato",
                "cantidad"::float as "cantidad",
                "formatoCantidad",
                "observacion",
                "evidencias",
                "fechaRecepcionReclamo"::text as "fechaRecepcionReclamo",
                "fechaEnvioProveedor"::text as "fechaEnvioProveedor",
                "fechaRecepcionRespuesta"::text as "fechaRecepcionRespuesta",
                "archivoRespuesta",
                "destinoCompras",
                "estado",
                "creadoPor", "creadoPorNombre", "actualizadoPor",
                "createdAt"::text as "createdAt",
                "updatedAt"::text as "updatedAt"
            FROM "calidad_reclamos_proveedores"
            ${whereClause}
            ORDER BY "anio" DESC, "correlativo" DESC;
        `, ...params)

        // Consultar privilegios específicos del usuario en calidad_reclamos_privilegios_usuarios
        let userPrivs = {
            puedeEditar: false,
            puedeFechasSeguimiento: false,
            puedeAdjuntarRespuesta: false
        }

        if (esAdmin) {
            userPrivs = {
                puedeEditar: true,
                puedeFechasSeguimiento: true,
                puedeAdjuntarRespuesta: true
            }
        } else if (session.user.id) {
            const pRows: any[] = await rawPrisma.$queryRawUnsafe(`
                SELECT "puedeEditar", "puedeFechasSeguimiento", "puedeAdjuntarRespuesta"
                FROM "calidad_reclamos_privilegios_usuarios"
                WHERE "userId" = $1 LIMIT 1;
            `, session.user.id)

            if (pRows.length > 0) {
                userPrivs = {
                    puedeEditar: Boolean(pRows[0].puedeEditar),
                    puedeFechasSeguimiento: Boolean(pRows[0].puedeFechasSeguimiento),
                    puedeAdjuntarRespuesta: Boolean(pRows[0].puedeAdjuntarRespuesta)
                }
            }
        }

        const items: ReclamoProveedorItem[] = rows.map(r => {
            let evidenciasParsed: ArchivoEvidencia[] = []
            try {
                evidenciasParsed = JSON.parse(r.evidencias || '[]')
            } catch {
                evidenciasParsed = []
            }

            let archivoRespuestaParsed: ArchivoEvidencia | null = null
            if (r.archivoRespuesta) {
                try {
                    archivoRespuestaParsed = JSON.parse(r.archivoRespuesta)
                } catch {
                    archivoRespuestaParsed = null
                }
            }

            return {
                id: r.id,
                numeroReclamo: r.numeroReclamo,
                correlativo: Number(r.correlativo || 0),
                anio: Number(r.anio || anioActual),
                licitacionId: r.licitacionId,
                licitacionNombre: r.licitacionNombre,
                zonal: r.zonal,
                origenReclamo: r.origenReclamo as any,
                fechaDesviacion: r.fechaDesviacion ? r.fechaDesviacion.slice(0, 10) : '',
                lugar: r.lugar,
                tipoReclamo: r.tipoReclamo as any,
                producto: r.producto,
                proveedor: r.proveedor,
                marca: r.marca || null,
                fechaElaboracion: r.fechaElaboracion ? r.fechaElaboracion.slice(0, 10) : null,
                fechaVencimiento: r.fechaVencimiento ? r.fechaVencimiento.slice(0, 10) : null,
                lote: r.lote || null,
                formato: r.formato || null,
                cantidad: r.cantidad !== null ? Number(r.cantidad) : null,
                formatoCantidad: r.formatoCantidad || null,
                observacion: r.observacion || null,
                evidencias: evidenciasParsed,
                fechaRecepcionReclamo: r.fechaRecepcionReclamo ? r.fechaRecepcionReclamo.slice(0, 10) : null,
                fechaEnvioProveedor: r.fechaEnvioProveedor ? r.fechaEnvioProveedor.slice(0, 10) : null,
                fechaRecepcionRespuesta: r.fechaRecepcionRespuesta ? r.fechaRecepcionRespuesta.slice(0, 10) : null,
                archivoRespuesta: archivoRespuestaParsed,
                destinoCompras: r.destinoCompras || null,
                estado: r.estado as any,
                creadoPor: r.creadoPor,
                creadoPorNombre: r.creadoPorNombre || null,
                actualizadoPor: r.actualizadoPor || null,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt
            }
        })

        return {
            success: true,
            items,
            licitaciones,
            siguienteNumeroReclamo,
            esAdmin,
            puedeGestionar,
            privilegiosUsuario: userPrivs
        }
    } catch (error: any) {
        console.error('[obtenerReclamosDataAction] Error:', error)
        return {
            success: false,
            items: [],
            licitaciones: [],
            siguienteNumeroReclamo: '0001/' + new Date().getFullYear(),
            esAdmin: false,
            puedeGestionar: false,
            privilegiosUsuario: {
                puedeEditar: false,
                puedeFechasSeguimiento: false,
                puedeAdjuntarRespuesta: false
            },
            error: error.message || 'Error al obtener registros de reclamos a proveedores'
        }
    }
}

/**
 * Obtiene las sucursales/zonales vinculadas a una licitación
 */
export async function obtenerSucursalesDeLicitacionAction(licitacionId: string): Promise<{ success: boolean; sucursales: string[] }> {
    try {
        const licIdNum = Number(licitacionId)
        if (!licIdNum) return { success: true, sucursales: [] }

        const uts = await rawPrisma.uT.findMany({
            where: { licId: licIdNum },
            select: {
                sucursal: {
                    select: { nombre: true }
                }
            }
        })

        const set = new Set<string>()
        uts.forEach(u => {
            if (u.sucursal?.nombre) set.add(u.sucursal.nombre.trim())
        })

        return { success: true, sucursales: Array.from(set).sort() }
    } catch (error: any) {
        console.error('[obtenerSucursalesDeLicitacionAction] Error:', error)
        return { success: false, sucursales: [] }
    }
}

/**
 * Crea un nuevo Reclamo a Proveedor con soporte para hasta 6 archivos multimedia
 */
export async function crearReclamoProveedorAction(formData: FormData): Promise<{
    success: boolean
    id?: string
    numeroReclamo?: string
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no válida o expirada' }
        }

        await ensureReclamosProveedoresTables()

        const licitacionId = String(formData.get('licitacionId') || '').trim()
        const licitacionNombre = String(formData.get('licitacionNombre') || '').trim()
        const zonal = String(formData.get('zonal') || '').trim()
        const origenReclamo = String(formData.get('origenReclamo') || 'RECLAMO_ZONAL').trim()
        const fechaDesviacion = String(formData.get('fechaDesviacion') || '').trim()
        const lugar = String(formData.get('lugar') || '').trim()
        const tipoReclamo = String(formData.get('tipoReclamo') || 'CALIDAD').trim()
        const producto = String(formData.get('producto') || '').trim()
        const proveedor = String(formData.get('proveedor') || '').trim()
        const marca = String(formData.get('marca') || '').trim() || null
        const fechaElaboracion = String(formData.get('fechaElaboracion') || '').trim() || null
        const fechaVencimiento = String(formData.get('fechaVencimiento') || '').trim() || null
        const lote = String(formData.get('lote') || '').trim() || null
        const formato = String(formData.get('formato') || '').trim() || null
        const cantidadStr = String(formData.get('cantidad') || '').trim()
        const cantidad = cantidadStr ? parseFloat(cantidadStr) : null
        const formatoCantidad = String(formData.get('formatoCantidad') || 'Kilo').trim() || null
        const observacion = String(formData.get('observacion') || '').trim() || null

        // Seguimiento
        const fechaRecepcionReclamo = String(formData.get('fechaRecepcionReclamo') || '').trim() || null
        const fechaEnvioProveedor = String(formData.get('fechaEnvioProveedor') || '').trim() || null
        const fechaRecepcionRespuesta = String(formData.get('fechaRecepcionRespuesta') || '').trim() || null

        // Validaciones obligatorias
        if (!licitacionId) return { success: false, error: 'Debes seleccionar una licitación.' }
        if (!zonal) return { success: false, error: 'Debes seleccionar la sucursal/zonal.' }
        if (!fechaDesviacion) return { success: false, error: 'Debes indicar la fecha de ocurrencia de la desviación.' }
        if (!lugar) return { success: false, error: 'El campo Lugar es obligatorio.' }
        if (!producto) return { success: false, error: 'El nombre del Producto es obligatorio.' }
        if (!proveedor) return { success: false, error: 'El nombre del Proveedor es obligatorio.' }

        // Procesar archivos adjuntos (máximo 6)
        const files = formData.getAll('archivos') as File[]
        const evidencias: ArchivoEvidencia[] = []

        if (files && files.length > 0) {
            const validFiles = files.filter(f => f && f.size > 0 && typeof f.arrayBuffer === 'function')
            if (validFiles.length > 6) {
                return { success: false, error: 'Se permite adjuntar un máximo de 6 archivos de evidencia.' }
            }

            const UPLOAD_DIR = uploadPath('calidad', 'reclamos-proveedores')
            await fs.mkdir(UPLOAD_DIR, { recursive: true })

            for (const file of validFiles) {
                const ext = path.extname(file.name) || '.bin'
                const safeName = `rec-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
                const destPath = path.join(UPLOAD_DIR, safeName)
                const buffer = Buffer.from(await file.arrayBuffer())
                await fs.writeFile(destPath, buffer)

                evidencias.push({
                    url: `/uploads/calidad/reclamos-proveedores/${safeName}`,
                    nombre: file.name,
                    tipo: file.type || 'application/octet-stream',
                    size: file.size
                })
            }
        }

        // Determinar año y correlativo atómico
        const fechaDesvDate = new Date(fechaDesviacion)
        const anio = isNaN(fechaDesvDate.getFullYear()) ? new Date().getFullYear() : fechaDesvDate.getFullYear()

        const corrRows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COALESCE(MAX("correlativo"), 0) + 1 as "siguiente"
            FROM "calidad_reclamos_proveedores"
            WHERE "anio" = $1;
        `, anio)
        const correlativo = Number(corrRows[0]?.siguiente || 1)
        const numeroReclamo = `${String(correlativo).padStart(4, '0')}/${anio}`

        // Determinar estado según fechas de seguimiento
        let estado = 'ABIERTO'
        if (fechaRecepcionRespuesta) {
            estado = 'RESPONDIDO'
        } else if (fechaEnvioProveedor) {
            estado = 'ENVIADO_PROVEEDOR'
        }

        const id = crypto.randomUUID()
        const username = session.user.username || session.user.name || 'Usuario'
        const userFullName = session.user.name || username

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "calidad_reclamos_proveedores" (
                "id", "numeroReclamo", "correlativo", "anio",
                "licitacionId", "licitacionNombre", "zonal",
                "origenReclamo", "fechaDesviacion", "lugar", "tipoReclamo",
                "producto", "proveedor", "marca",
                "fechaElaboracion", "fechaVencimiento", "lote", "formato",
                "cantidad", "formatoCantidad", "observacion",
                "evidencias",
                "fechaRecepcionReclamo", "fechaEnvioProveedor", "fechaRecepcionRespuesta",
                "estado", "creadoPor", "creadoPorNombre",
                "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9::date, $10, $11,
                $12, $13, $14,
                $15::date, $16::date, $17, $18,
                $19, $20, $21,
                $22,
                $23::date, $24::date, $25::date,
                $26, $27, $28,
                NOW(), NOW()
            );
        `,
            id, numeroReclamo, correlativo, anio,
            licitacionId, licitacionNombre, zonal,
            origenReclamo, fechaDesviacion, lugar, tipoReclamo,
            producto, proveedor, marca,
            fechaElaboracion, fechaVencimiento, lote, formato,
            cantidad, formatoCantidad, observacion,
            JSON.stringify(evidencias),
            fechaRecepcionReclamo, fechaEnvioProveedor, fechaRecepcionRespuesta,
            estado, username, userFullName
        )

        // Registrar en Auditoría
        await logAuditAction({
            username,
            modulo: 'Calidad -> Reclamos a Proveedores',
            action: 'CREACION',
            detalle: `Creó reclamo a proveedor N° ${numeroReclamo} (Producto: ${producto}, Proveedor: ${proveedor}, Zonal: ${zonal})`
        })

        // Notificación Paso 1 (Ingreso de Reclamo)
        try {
            await sendGenericaNotification({
                codigoPantalla: 'calidad-reclamos-paso-1',
                subject: `Nuevo Reclamo a Proveedor N° ${numeroReclamo} - ${producto}`,
                bodyHtml: `
                    <p>Se ha ingresado un nuevo reclamo a proveedor en el sistema con los siguientes antecedentes:</p>
                    <ul>
                        <li><b>N° Reclamo:</b> ${numeroReclamo}</li>
                        <li><b>Licitación:</b> ${licitacionNombre}</li>
                        <li><b>Sucursal / Zonal:</b> ${zonal}</li>
                        <li><b>Origen:</b> ${origenReclamo === 'RECLAMO_CLIENTE_C8' ? 'Reclamo cliente por C8' : origenReclamo === 'RECLAMO_CLIENTE' ? 'Reclamo Cliente' : 'Reclamo Zonal'}</li>
                        <li><b>Tipo:</b> ${tipoReclamo}</li>
                        <li><b>Producto:</b> ${producto}</li>
                        <li><b>Proveedor:</b> ${proveedor}</li>
                        <li><b>Fecha Ocurrencia:</b> ${fechaDesviacion}</li>
                        <li><b>Lugar:</b> ${lugar}</li>
                        <li><b>Observación:</b> ${observacion || 'Sin observaciones adicionales'}</li>
                        <li><b>Registrado por:</b> ${userFullName} (@${username})</li>
                    </ul>
                `,
                tags: {
                    NumeroReclamo: numeroReclamo,
                    Licitacion: licitacionNombre,
                    Sucursal: zonal,
                    Zonal: zonal,
                    OrigenReclamo: origenReclamo === 'RECLAMO_CLIENTE_C8' ? 'Reclamo cliente por C8' : origenReclamo === 'RECLAMO_CLIENTE' ? 'Reclamo Cliente' : 'Reclamo Zonal',
                    TipoReclamo: tipoReclamo,
                    Producto: producto,
                    Proveedor: proveedor,
                    Marca: marca || 'S/I',
                    Lote: lote || 'S/I',
                    Cantidad: cantidad !== null ? `${cantidad} ${formatoCantidad || ''}` : 'S/I',
                    FechaDesviacion: fechaDesviacion,
                    FechaElaboracion: fechaElaboracion || 'S/I',
                    FechaVencimiento: fechaVencimiento || 'S/I',
                    Lugar: lugar,
                    Observacion: observacion || 'Sin observación',
                    Usuario: userFullName,
                    Estado: estado
                }
            })
        } catch (mailErr) {
            console.error('[crearReclamoProveedorAction] Error enviando notificación Paso 1:', mailErr)
        }

        return { success: true, id, numeroReclamo }
    } catch (error: any) {
        console.error('[crearReclamoProveedorAction] Error:', error)
        return { success: false, error: error.message || 'Error al guardar el reclamo a proveedor' }
    }
}

/**
 * Actualiza un reclamo existente (datos, seguimiento y evidencias)
 */
export async function actualizarReclamoProveedorAction(formData: FormData): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no válida o expirada' }
        }

        const id = String(formData.get('id') || '').trim()
        if (!id) return { success: false, error: 'ID de reclamo requerido' }

        await ensureReclamosProveedoresTables()

        const licitacionId = String(formData.get('licitacionId') || '').trim()
        const licitacionNombre = String(formData.get('licitacionNombre') || '').trim()
        const zonal = String(formData.get('zonal') || '').trim()
        const origenReclamo = String(formData.get('origenReclamo') || 'RECLAMO_ZONAL').trim()
        const fechaDesviacion = String(formData.get('fechaDesviacion') || '').trim()
        const lugar = String(formData.get('lugar') || '').trim()
        const tipoReclamo = String(formData.get('tipoReclamo') || 'CALIDAD').trim()
        const producto = String(formData.get('producto') || '').trim()
        const proveedor = String(formData.get('proveedor') || '').trim()
        const marca = String(formData.get('marca') || '').trim() || null
        const fechaElaboracion = String(formData.get('fechaElaboracion') || '').trim() || null
        const fechaVencimiento = String(formData.get('fechaVencimiento') || '').trim() || null
        const lote = String(formData.get('lote') || '').trim() || null
        const formato = String(formData.get('formato') || '').trim() || null
        const cantidadStr = String(formData.get('cantidad') || '').trim()
        const cantidad = cantidadStr ? parseFloat(cantidadStr) : null
        const formatoCantidad = String(formData.get('formatoCantidad') || 'Kilo').trim() || null
        const observacion = String(formData.get('observacion') || '').trim() || null

        // Seguimiento
        const fechaRecepcionReclamo = String(formData.get('fechaRecepcionReclamo') || '').trim() || null
        const fechaEnvioProveedor = String(formData.get('fechaEnvioProveedor') || '').trim() || null
        const fechaRecepcionRespuesta = String(formData.get('fechaRecepcionRespuesta') || '').trim() || null
        const destinoCompras = String(formData.get('destinoCompras') || '').trim() || null

        // Consultar registro actual previo para determinar si entra a Paso 2 o Paso 3
        const reclamoPrevioRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "numeroReclamo", "fechaEnvioProveedor"::text, "fechaRecepcionRespuesta"::text, "archivoRespuesta"
            FROM "calidad_reclamos_proveedores" WHERE "id" = $1 LIMIT 1;
        `, id)
        const reclamoPrevio = reclamoPrevioRows[0] || null

        // Evidencias previas preservadas
        let evidenciasExistentes: ArchivoEvidencia[] = []
        try {
            evidenciasExistentes = JSON.parse(String(formData.get('evidenciasExistentes') || '[]'))
        } catch {
            evidenciasExistentes = []
        }

        // Archivo de Respuesta (Paso 3)
        let archivoRespuestaFinal: ArchivoEvidencia | null = null
        if (reclamoPrevio?.archivoRespuesta) {
            try {
                archivoRespuestaFinal = JSON.parse(reclamoPrevio.archivoRespuesta)
            } catch {
                archivoRespuestaFinal = null
            }
        }

        const fileRespuesta = formData.get('archivoRespuesta') as File | null
        if (fileRespuesta && fileRespuesta.size > 0 && typeof fileRespuesta.arrayBuffer === 'function') {
            const UPLOAD_DIR = uploadPath('calidad', 'reclamos-proveedores')
            await fs.mkdir(UPLOAD_DIR, { recursive: true })
            const ext = path.extname(fileRespuesta.name) || '.pdf'
            const safeName = `resp-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
            const destPath = path.join(UPLOAD_DIR, safeName)
            const buffer = Buffer.from(await fileRespuesta.arrayBuffer())
            await fs.writeFile(destPath, buffer)

            archivoRespuestaFinal = {
                url: `/uploads/calidad/reclamos-proveedores/${safeName}`,
                nombre: fileRespuesta.name,
                tipo: fileRespuesta.type || 'application/pdf',
                size: fileRespuesta.size
            }
        }

        // Nuevos archivos adjuntos de evidencia
        const newFiles = formData.getAll('archivos') as File[]
        const validNewFiles = newFiles.filter(f => f && f.size > 0 && typeof f.arrayBuffer === 'function')

        if (evidenciasExistentes.length + validNewFiles.length > 6) {
            return { success: false, error: 'El total de evidencias no puede exceder los 6 archivos.' }
        }

        if (validNewFiles.length > 0) {
            const UPLOAD_DIR = uploadPath('calidad', 'reclamos-proveedores')
            await fs.mkdir(UPLOAD_DIR, { recursive: true })

            for (const file of validNewFiles) {
                const ext = path.extname(file.name) || '.bin'
                const safeName = `rec-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
                const destPath = path.join(UPLOAD_DIR, safeName)
                const buffer = Buffer.from(await file.arrayBuffer())
                await fs.writeFile(destPath, buffer)

                evidenciasExistentes.push({
                    url: `/uploads/calidad/reclamos-proveedores/${safeName}`,
                    nombre: file.name,
                    tipo: file.type || 'application/octet-stream',
                    size: file.size
                })
            }
        }

        let estado = 'ABIERTO'
        if (fechaRecepcionRespuesta) {
            estado = 'RESPONDIDO'
        } else if (fechaEnvioProveedor) {
            estado = 'ENVIADO_PROVEEDOR'
        }

        const username = session.user.username || session.user.name || 'Usuario'
        const userFullName = session.user.name || session.user.username || 'Usuario'

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "calidad_reclamos_proveedores" SET
                "licitacionId" = $1,
                "licitacionNombre" = $2,
                "zonal" = $3,
                "origenReclamo" = $4,
                "fechaDesviacion" = $5::date,
                "lugar" = $6,
                "tipoReclamo" = $7,
                "producto" = $8,
                "proveedor" = $9,
                "marca" = $10,
                "fechaElaboracion" = $11::date,
                "fechaVencimiento" = $12::date,
                "lote" = $13,
                "formato" = $14,
                "cantidad" = $15,
                "formatoCantidad" = $16,
                "observacion" = $17,
                "evidencias" = $18,
                "fechaRecepcionReclamo" = $19::date,
                "fechaEnvioProveedor" = $20::date,
                "fechaRecepcionRespuesta" = $21::date,
                "archivoRespuesta" = $22,
                "destinoCompras" = $23,
                "estado" = $24,
                "actualizadoPor" = $25,
                "updatedAt" = NOW()
            WHERE "id" = $26;
        `,
            licitacionId, licitacionNombre, zonal,
            origenReclamo, fechaDesviacion, lugar, tipoReclamo,
            producto, proveedor, marca,
            fechaElaboracion, fechaVencimiento, lote, formato,
            cantidad, formatoCantidad, observacion,
            JSON.stringify(evidenciasExistentes),
            fechaRecepcionReclamo, fechaEnvioProveedor, fechaRecepcionRespuesta,
            archivoRespuestaFinal ? JSON.stringify(archivoRespuestaFinal) : null,
            destinoCompras,
            estado, username, id
        )

        await logAuditAction({
            username,
            modulo: 'Calidad -> Reclamos a Proveedores',
            action: 'MODIFICACION',
            detalle: `Modificó reclamo a proveedor ID: ${id} (Producto: ${producto}, Proveedor: ${proveedor}, DestinoCompras: ${destinoCompras || 'N/A'})`
        })

        const numeroReclamo = reclamoPrevio?.numeroReclamo || 'S/N'

        // Evaluar disparador de notificación Paso 2 o Paso 3
        const esNuevoPaso3 = fechaRecepcionRespuesta && (!reclamoPrevio?.fechaRecepcionRespuesta || fileRespuesta)
        const esNuevoPaso2 = fechaEnvioProveedor && !reclamoPrevio?.fechaEnvioProveedor

        if (esNuevoPaso3) {
            // Notificación Paso 3 (Recepción de Respuesta del Proveedor)
            try {
                await sendGenericaNotification({
                    codigoPantalla: 'calidad-reclamos-paso-3',
                    subject: `Recepción de Respuesta - Reclamo N° ${numeroReclamo} - ${proveedor}`,
                    bodyHtml: `
                        <p>Se ha registrado la recepción de respuesta para el reclamo a proveedor:</p>
                        <ul>
                            <li><b>N° Reclamo:</b> ${numeroReclamo}</li>
                            <li><b>Proveedor:</b> ${proveedor}</li>
                            <li><b>Producto:</b> ${producto}</li>
                            <li><b>Licitación:</b> ${licitacionNombre}</li>
                            <li><b>Sucursal / Zonal:</b> ${zonal}</li>
                            <li><b>Fecha Recepción Respuesta:</b> ${fechaRecepcionRespuesta}</li>
                            <li><b>Documento Adjunto:</b> ${archivoRespuestaFinal ? archivoRespuestaFinal.nombre : 'No adjuntado'}</li>
                            <li><b>Actualizado por:</b> ${userFullName} (@${username})</li>
                        </ul>
                    `,
                    tags: {
                        NumeroReclamo: numeroReclamo,
                        Licitacion: licitacionNombre,
                        Sucursal: zonal,
                        Zonal: zonal,
                        Proveedor: proveedor,
                        Producto: producto,
                        FechaRecepcionRespuesta: fechaRecepcionRespuesta,
                        FechaEnvioProveedor: fechaEnvioProveedor || 'S/I',
                        DestinoCompras: destinoCompras || 'Matriz',
                        ArchivoRespuesta: archivoRespuestaFinal ? archivoRespuestaFinal.nombre : 'S/I',
                        Usuario: userFullName,
                        Estado: estado
                    }
                })
            } catch (p3Err) {
                console.error('[actualizarReclamoProveedorAction] Error notificación Paso 3:', p3Err)
            }
        } else if (esNuevoPaso2) {
            // Notificación Paso 2 (Envío a Compras: Matriz o Sucursal)
            try {
                await sendGenericaNotification({
                    codigoPantalla: 'calidad-reclamos-paso-2',
                    subject: `Envío a Compras (${destinoCompras === 'SUCURSAL' ? 'Sucursal ' + zonal : 'Matriz'}) - Reclamo N° ${numeroReclamo}`,
                    bodyHtml: `
                        <p>Se ha gestionado el envío a Compras del reclamo a proveedor:</p>
                        <ul>
                            <li><b>N° Reclamo:</b> ${numeroReclamo}</li>
                            <li><b>Destino de Compras:</b> ${destinoCompras === 'SUCURSAL' ? 'Compras Sucursal (' + zonal + ')' : 'Compras Casa Matriz'}</li>
                            <li><b>Licitación:</b> ${licitacionNombre}</li>
                            <li><b>Sucursal:</b> ${zonal}</li>
                            <li><b>Proveedor:</b> ${proveedor}</li>
                            <li><b>Producto:</b> ${producto}</li>
                            <li><b>Fecha Envío a Proveedor:</b> ${fechaEnvioProveedor}</li>
                            <li><b>Gestionado por:</b> ${userFullName} (@${username})</li>
                        </ul>
                    `,
                    tags: {
                        NumeroReclamo: numeroReclamo,
                        Licitacion: licitacionNombre,
                        Sucursal: zonal,
                        Zonal: zonal,
                        Proveedor: proveedor,
                        Producto: producto,
                        FechaEnvioProveedor: fechaEnvioProveedor,
                        DestinoCompras: destinoCompras === 'SUCURSAL' ? 'Sucursal' : 'Matriz',
                        Usuario: userFullName,
                        Estado: estado
                    }
                })
            } catch (p2Err) {
                console.error('[actualizarReclamoProveedorAction] Error notificación Paso 2:', p2Err)
            }
        }

        return { success: true }
    } catch (error: any) {
        console.error('[actualizarReclamoProveedorAction] Error:', error)
        return { success: false, error: error.message || 'Error al actualizar reclamo' }
    }
}

/**
 * Elimina un reclamo a proveedor
 */
export async function eliminarReclamoProveedorAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no válida o expirada' }
        }

        const roleName = (session.user.role?.name || '').toLowerCase()
        const perms: string[] = session.user.role?.permissions || []
        const puedeEliminar = roleName.includes('admin') || perms.includes('manage_calidad_reclamos_proveedores')

        if (!puedeEliminar) {
            return { success: false, error: 'No tienes privilegios para eliminar este reclamo.' }
        }

        await ensureReclamosProveedoresTables()

        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "numeroReclamo", "producto", "proveedor"
            FROM "calidad_reclamos_proveedores"
            WHERE "id" = $1;
        `, id)

        if (rows.length === 0) {
            return { success: false, error: 'El registro no fue encontrado' }
        }

        const reclamo = rows[0]

        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "calidad_reclamos_proveedores" WHERE "id" = $1;
        `, id)

        const username = session.user.username || session.user.name || 'Usuario'
        await logAuditAction({
            username,
            modulo: 'Calidad -> Reclamos a Proveedores',
            action: 'ELIMINACION',
            detalle: `Eliminó reclamo a proveedor N° ${reclamo.numeroReclamo} (Producto: ${reclamo.producto}, Proveedor: ${reclamo.proveedor})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('[eliminarReclamoProveedorAction] Error:', error)
        return { success: false, error: error.message || 'Error al eliminar el registro' }
    }
}
