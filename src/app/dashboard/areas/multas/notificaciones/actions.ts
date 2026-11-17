'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureNotificacionesJunaebTables } from '@/lib/multas/notificaciones-db-init'
import { checkMultasPermission } from '@/lib/multas/permisos'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import * as xlsx from 'xlsx'

export interface NotificacionRexItemDTO {
    id: string
    notificacionId: string
    folio: string
    rbd: number | null
    establecimiento: string | null
    sucursal: string | null
    fechaSupervision: string | null
    aspecto: string
    infraccionDetalle: string | null
    montoNotificado: number
    montoNotificadoPesos?: number | null
    montoCalculado: number
    montoCalculadoPesos?: number | null
    diferenciaMonto: number
    diferenciaPesos?: number | null
    estadoConciliacion: 'COINCIDE' | 'DIFERENCIA_MONTO' | 'SOLO_JUNAEB' | 'NO_INCLUIDO' | 'FOLIO_REPETIDO' | 'PENDIENTE'
    clasificacionError: 'ERROR_JUNAEB' | 'ERROR_INTERNO' | 'EN_REVISION' | 'ACEPTADO' | null
    motivoClasificacion: string | null
    resolucionAnterior: string | null
    clasificadoPor: string | null
    clasificadoEn: string | null
}

export interface NotificacionRexCabDTO {
    id: string
    numeroResolucion: string
    fechaResolucion: string | null
    periodoMes: number
    periodoAnio: number
    licitacionId: number | null
    licitacionNombre: string | null
    nombreArchivo: string
    totalFilasNotif: number
    totalFoliosNotif: number
    montoTotalNotificado: number
    montoTotalNotificadoPesos?: number | null
    montoTotalCalculado: number
    montoTotalCalculadoPesos?: number | null
    montoTotalDiferencia: number
    montoTotalDiferenciaPesos?: number | null
    estado: 'BORRADOR' | 'CONCILIADO' | 'EN_DESCARGO' | 'CERRADO'
    cargadoPor: string
    observaciones: string | null
    createdAt: string
    updatedAt: string
}

export interface ResumenEstadisticoConciliacion {
    totalItems: number
    coinciden: number
    diferenciasMonto: number
    soloJunaeb: number
    noIncluidos: number
    foliosRepetidos: number
    clasificados: number
    pendientesClasificar: number
    montoTotalNotificado: number
    montoTotalCalculado: number
    montoTotalDiferencia: number
}

// Utility para verificar permisos con lectura fresca de base de datos usando el validador central
async function checkNotificacionesPermission(perm: string | string[]): Promise<{ authorized: boolean; user: any }> {
    const res = await checkMultasPermission(perm)
    return { authorized: res.authorized, user: res.user }
}

/**
 * Obtiene el listado de resoluciones exentas (REX) registradas
 */
export async function getNotificacionesListAction(): Promise<{ success: boolean; data?: NotificacionRexCabDTO[]; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized } = await checkNotificacionesPermission(['view_notificaciones_junaeb', 'manage_notificaciones_junaeb'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para consultar las notificaciones de JUNAEB.' }
        }

        const list = await prisma.multas_Notificacion_REX.findMany({
            orderBy: [
                { periodoAnio: 'desc' },
                { periodoMes: 'desc' },
                { createdAt: 'desc' }
            ]
        })

        return {
            success: true,
            data: list.map(r => ({
                id: r.id,
                numeroResolucion: r.numeroResolucion,
                fechaResolucion: r.fechaResolucion ? r.fechaResolucion.toISOString().split('T')[0] : null,
                periodoMes: r.periodoMes,
                periodoAnio: r.periodoAnio,
                licitacionId: r.licitacionId,
                licitacionNombre: r.licitacionNombre,
                nombreArchivo: r.nombreArchivo,
                totalFilasNotif: r.totalFilasNotif,
                totalFoliosNotif: r.totalFoliosNotif,
                montoTotalNotificado: r.montoTotalNotificado,
                montoTotalCalculado: r.montoTotalCalculado,
                montoTotalDiferencia: r.montoTotalDiferencia,
                estado: r.estado as any,
                cargadoPor: r.cargadoPor,
                observaciones: r.observaciones,
                createdAt: r.createdAt.toISOString(),
                updatedAt: r.updatedAt.toISOString()
            }))
        }
    } catch (e: any) {
        console.error('Error al obtener lista de notificaciones:', e)
        return { success: false, error: e.message || 'Error al obtener notificaciones.' }
    }
}

/**
 * Obtiene el detalle de una resolución REX, sus items y resumen de conciliación
 */
export async function getNotificacionDetalleAction(id: string): Promise<{
    success: boolean
    cabecera?: NotificacionRexCabDTO
    items?: NotificacionRexItemDTO[]
    resumen?: ResumenEstadisticoConciliacion
    error?: string
}> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized } = await checkNotificacionesPermission(['view_notificaciones_junaeb', 'manage_notificaciones_junaeb'])
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ver el detalle de la resolución.' }
        }

        const rex = await prisma.multas_Notificacion_REX.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: [
                        { folio: 'asc' },
                        { aspecto: 'asc' }
                    ]
                }
            }
        })

        if (!rex) {
            return { success: false, error: 'Resolución no encontrada.' }
        }

        const itemsDto: NotificacionRexItemDTO[] = rex.items.map(i => ({
            id: i.id,
            notificacionId: i.notificacionId,
            folio: i.folio,
            rbd: i.rbd,
            establecimiento: i.establecimiento,
            sucursal: i.sucursal,
            fechaSupervision: i.fechaSupervision ? i.fechaSupervision.toISOString().split('T')[0] : null,
            aspecto: i.aspecto,
            infraccionDetalle: i.infraccionDetalle,
            montoNotificado: i.montoNotificado,
            montoCalculado: i.montoCalculado,
            diferenciaMonto: i.diferenciaMonto,
            estadoConciliacion: i.estadoConciliacion as any,
            clasificacionError: i.clasificacionError as any,
            motivoClasificacion: i.motivoClasificacion,
            resolucionAnterior: i.resolucionAnterior,
            clasificadoPor: i.clasificadoPor,
            clasificadoEn: i.clasificadoEn ? i.clasificadoEn.toISOString() : null
        }))

        // Calcular resumen estadístico
        let coinciden = 0
        let diferenciasMonto = 0
        let soloJunaeb = 0
        let noIncluidos = 0
        let foliosRepetidos = 0
        let clasificados = 0

        for (const item of itemsDto) {
            if (item.estadoConciliacion === 'COINCIDE') coinciden++
            else if (item.estadoConciliacion === 'DIFERENCIA_MONTO') diferenciasMonto++
            else if (item.estadoConciliacion === 'SOLO_JUNAEB') soloJunaeb++
            else if (item.estadoConciliacion === 'NO_INCLUIDO') noIncluidos++
            else if (item.estadoConciliacion === 'FOLIO_REPETIDO') foliosRepetidos++

            if (item.clasificacionError) clasificados++
        }

        const resumen: ResumenEstadisticoConciliacion = {
            totalItems: itemsDto.length,
            coinciden,
            diferenciasMonto,
            soloJunaeb,
            noIncluidos,
            foliosRepetidos,
            clasificados,
            pendientesClasificar: itemsDto.length - coinciden - clasificados,
            montoTotalNotificado: rex.montoTotalNotificado,
            montoTotalCalculado: rex.montoTotalCalculado,
            montoTotalDiferencia: rex.montoTotalDiferencia
        }

        const cabeceraDto: NotificacionRexCabDTO = {
            id: rex.id,
            numeroResolucion: rex.numeroResolucion,
            fechaResolucion: rex.fechaResolucion ? rex.fechaResolucion.toISOString().split('T')[0] : null,
            periodoMes: rex.periodoMes,
            periodoAnio: rex.periodoAnio,
            licitacionId: rex.licitacionId,
            licitacionNombre: rex.licitacionNombre,
            nombreArchivo: rex.nombreArchivo,
            totalFilasNotif: rex.totalFilasNotif,
            totalFoliosNotif: rex.totalFoliosNotif,
            montoTotalNotificado: rex.montoTotalNotificado,
            montoTotalCalculado: rex.montoTotalCalculado,
            montoTotalDiferencia: rex.montoTotalDiferencia,
            estado: rex.estado as any,
            cargadoPor: rex.cargadoPor,
            observaciones: rex.observaciones,
            createdAt: rex.createdAt.toISOString(),
            updatedAt: rex.updatedAt.toISOString()
        }

        return {
            success: true,
            cabecera: cabeceraDto,
            items: itemsDto,
            resumen
        }
    } catch (e: any) {
        console.error('Error al obtener detalle de resolución:', e)
        return { success: false, error: e.message || 'Error al obtener detalle.' }
    }
}

/**
 * Carga una nueva resolución REX a partir del archivo Excel del Anexo 1
 */
export async function cargarNotificacionRexAction(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para cargar resoluciones REX de JUNAEB.' }
        }

        const file = formData.get('file') as File | null
        const numeroResolucion = (formData.get('numeroResolucion') as string || '').trim()
        const fechaResolucionStr = (formData.get('fechaResolucion') as string || '').trim()
        const periodoMes = parseInt(formData.get('periodoMes') as string || '0', 10)
        const periodoAnio = parseInt(formData.get('periodoAnio') as string || '0', 10)
        const licitacionIdStr = formData.get('licitacionId') as string || ''
        const licitacionId = licitacionIdStr ? parseInt(licitacionIdStr, 10) : null
        const licitacionNombre = (formData.get('licitacionNombre') as string || '').trim() || null
        const observaciones = (formData.get('observaciones') as string || '').trim() || null

        if (!file || file.size === 0) {
            return { success: false, error: 'Debes seleccionar un archivo Excel válido.' }
        }
        if (!numeroResolucion) {
            return { success: false, error: 'El número de resolución es obligatorio.' }
        }
        if (periodoMes < 1 || periodoMes > 12 || periodoAnio < 2020 || periodoAnio > 2035) {
            return { success: false, error: 'El período (mes y año) ingresado no es válido.' }
        }

        // Leer archivo Excel
        const arrayBuffer = await file.arrayBuffer()
        const workbook = xlsx.read(Buffer.from(arrayBuffer), { type: 'buffer' })
        
        // Buscar estrictamente la hoja "Cálculo de multa" o "Anexo 1"
        const targetSheetName = workbook.SheetNames.find(n => {
            const clean = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            return clean.includes("calculo de multa") || clean.includes("calculo") || clean.includes("anexo 1")
        })

        if (!targetSheetName) {
            return {
                success: false,
                error: `No se encontró la hoja de cálculo requerida ("Cálculo de multa" o "Anexo 1") en el archivo Excel. Hojas disponibles: [${workbook.SheetNames.join(', ')}].`
            }
        }

        const sheet = workbook.Sheets[targetSheetName]
        const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (rawRows.length === 0) {
            return { success: false, error: 'La hoja seleccionada está vacía.' }
        }

        // En el Anexo 1 real, la fila 0 contiene metadatos del período y la fila 1 contiene los encabezados.
        let headerRowIdx = 0
        for (let r = 0; r < Math.min(5, rawRows.length); r++) {
            const rowStr = rawRows[r].map(c => String(c).toLowerCase()).join(' ')
            if (rowStr.includes('acta') || rowStr.includes('folio') || rowStr.includes('aspecto') || rowStr.includes('id_acta')) {
                headerRowIdx = r
                break
            }
        }

        const headerRow = rawRows[headerRowIdx] || []
        // Posiciones estándar sigs por defecto si no están presentes por texto explícito:
        // col 2 (ID_ACTA/folio), col 10 (ASPECTO), col 19 (MULTA_UTM), col 20 (MONTO_PESOS)
        let colFolio = -1
        let colAspecto = -1
        let colUtm = -1
        let colClp = -1
        let colRbd = -1
        let colEstablecimiento = -1
        let colSucursal = -1
        let colFecha = -1

        // Detectar columnas priorizando nombres canónicos de Anexo 1 para evitar falsos positivos
        headerRow.forEach((cellVal, idx) => {
            const raw = String(cellVal).toLowerCase().trim()
            const clean = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_\-]/g, "")
            
            // Folio / ID Acta
            if (clean === 'idacta' || clean === 'folio' || clean === 'nacta' || clean === 'numacta' || clean === 'numeroacta' || clean === 'acta') {
                colFolio = idx
            } else if (colFolio === -1 && (clean.includes('idacta') || clean.includes('folioacta'))) {
                colFolio = idx
            }

            // Aspecto: Debe ser código/letra, NUNCA descripción ni glosa
            const isAspectoDesc = clean.includes('desc') || clean.includes('glosa') || clean.includes('nombre') || clean.includes('det') || clean.includes('infraccion')
            if (!isAspectoDesc) {
                if (clean === 'aspecto' || clean === 'codaspecto' || clean === 'codigoaspecto' || clean === 'letra' || clean === 'letraaspecto' || clean === 'idaspecto') {
                    colAspecto = idx
                } else if (colAspecto === -1 && (clean.startsWith('aspecto') || clean.endsWith('aspecto'))) {
                    colAspecto = idx
                }
            }

            // Multa UTM
            if (clean === 'multautm' || clean === 'montoutm' || clean === 'totalutm' || clean === 'utm' || clean === 'valorutm') {
                colUtm = idx
            } else if (colUtm === -1 && clean.includes('utm')) {
                colUtm = idx
            }

            // Monto Pesos (CLP): descartar monto base, monto gravedad, etc.
            if (clean === 'montopesos' || clean === 'multapesos' || clean === 'totalpesos' || clean === 'pesos' || clean === 'valorpesos' || clean === 'clp' || clean === 'montoclp') {
                colClp = idx
            } else if (colClp === -1 && (clean.includes('pesos') || clean.includes('clp') || (clean.includes('monto') && !clean.includes('utm') && !clean.includes('base') && !clean.includes('gravedad')))) {
                colClp = idx
            }

            // RBD
            if (clean === 'rbd' || clean === 'codrbd' || clean === 'rbdestablecimiento') {
                colRbd = idx
            } else if (colRbd === -1 && clean.includes('rbd')) {
                colRbd = idx
            }

            // Establecimiento
            if (clean === 'establecimiento' || clean === 'colegio' || clean === 'nombreestablecimiento' || clean === 'nomestablecimiento') {
                colEstablecimiento = idx
            } else if (colEstablecimiento === -1 && (clean.includes('establecimiento') || clean.includes('colegio'))) {
                colEstablecimiento = idx
            }

            // Sucursal / Sede
            if (clean === 'sucursal' || clean === 'sede' || clean === 'zona' || clean === 'comuna') {
                colSucursal = idx
            } else if (colSucursal === -1 && (clean.includes('sucursal') || clean.includes('zona'))) {
                colSucursal = idx
            }

            // Fecha
            if (clean === 'fecha' || clean === 'fechasupervision' || clean === 'fechavisita' || clean === 'fechafiscalizacion') {
                colFecha = idx
            } else if (colFecha === -1 && clean.includes('fecha')) {
                colFecha = idx
            }
        })

        // Respaldo de orden posicional estándar de SIGS (hoja Anexo 1 tradicional) si no se encontró por cabecera
        if (colFolio === -1) colFolio = 2
        if (colAspecto === -1) colAspecto = 10
        if (colUtm === -1) colUtm = 19
        if (colClp === -1) colClp = 20
        if (colRbd === -1) colRbd = 0
        if (colEstablecimiento === -1) colEstablecimiento = 1
        if (colSucursal === -1) colSucursal = 3
        if (colFecha === -1) colFecha = 5

        // Validar unicidad previa considerando licitacionId nulo
        const existingRex = await prisma.multas_Notificacion_REX.findFirst({
            where: {
                numeroResolucion,
                licitacionId: licitacionId ?? null
            }
        })
        if (existingRex) {
            return { success: false, error: 'Ya existe una resolución registrada con ese mismo número y licitación.' }
        }

        const itemsToInsert: Array<{
            folio: string
            rbd: number | null
            establecimiento: string | null
            sucursal: string | null
            fechaSupervision: Date | null
            aspecto: string
            infraccionDetalle: string | null
            montoNotificadoUtm: number
            montoNotificadoPesos: number
        }> = []

        const foliosSet = new Set<string>()
        let totalMontoNotificadoUtm = 0
        let totalMontoNotificadoPesos = 0

        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r]
            if (!row || row.length === 0) continue

            const folioRaw = row[colFolio]
            if (!folioRaw) continue
            const folio = String(folioRaw).trim().replace(/^['"\s]+|['"\s]+$/g, '')
            if (!folio) continue

            const aspecto = parseAspecto(row[colAspecto])
            const montoUtm = parseNumeroChileno(row[colUtm])
            const montoPesos = parseNumeroChileno(row[colClp])

            const rbdRaw = row[colRbd]
            const rbdNum = rbdRaw ? parseInt(String(rbdRaw).replace(/\D/g, ''), 10) : null
            const rbd = rbdNum && !isNaN(rbdNum) ? rbdNum : null

            const estabVal = row[colEstablecimiento]
            const establecimiento = estabVal ? String(estabVal).trim() : null

            const sucVal = row[colSucursal]
            const sucursal = sucVal ? String(sucVal).trim() : null

            const fechaVal = row[colFecha]
            let fechaSupervision: Date | null = null
            if (fechaVal) {
                const parsedDate = parseExcelDate(fechaVal)
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    fechaSupervision = parsedDate
                }
            }

            itemsToInsert.push({
                folio,
                rbd,
                establecimiento,
                sucursal,
                fechaSupervision,
                aspecto,
                infraccionDetalle: null,
                montoNotificadoUtm: montoUtm,
                montoNotificadoPesos: Math.round(montoPesos)
            })

            foliosSet.add(folio)
            totalMontoNotificadoUtm += montoUtm
            totalMontoNotificadoPesos += Math.round(montoPesos)
        }

        if (itemsToInsert.length === 0) {
            return { success: false, error: 'No se encontraron filas con número de folio válido en el archivo Excel.' }
        }

        // Crear registro en base de datos
        const fechaResolucion = fechaResolucionStr ? new Date(fechaResolucionStr) : null
        const userName = user.name || user.username || 'Usuario'

        const createdRex = await prisma.multas_Notificacion_REX.create({
            data: {
                numeroResolucion,
                fechaResolucion,
                periodoMes,
                periodoAnio,
                licitacionId,
                licitacionNombre,
                nombreArchivo: file.name,
                totalFilasNotif: itemsToInsert.length,
                totalFoliosNotif: foliosSet.size,
                montoTotalNotificado: Math.round(totalMontoNotificadoUtm * 1000) / 1000,
                montoTotalNotificadoPesos: Math.round(totalMontoNotificadoPesos),
                estado: 'BORRADOR',
                cargadoPor: userName,
                observaciones,
                items: {
                    create: itemsToInsert.map(i => ({
                        folio: i.folio,
                        rbd: i.rbd,
                        establecimiento: i.establecimiento,
                        sucursal: i.sucursal,
                        fechaSupervision: i.fechaSupervision,
                        aspecto: i.aspecto,
                        infraccionDetalle: i.infraccionDetalle,
                        montoNotificado: i.montoNotificadoUtm,
                        montoNotificadoPesos: i.montoNotificadoPesos,
                        montoCalculado: 0.0,
                        montoCalculadoPesos: 0.0,
                        diferenciaMonto: i.montoNotificadoUtm,
                        diferenciaPesos: i.montoNotificadoPesos,
                        estadoConciliacion: 'PENDIENTE'
                    }))
                }
            }
        })

        // Registrar auditoría
        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CARGA_NOTIFICACION_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Carga de REX N° ${numeroResolucion}: ${itemsToInsert.length} filas, ${foliosSet.size} folios, total ${totalMontoNotificadoUtm.toFixed(2)} UTM.`
        })

        revalidatePath('/dashboard/areas/multas/notificaciones')
        return { success: true, id: createdRex.id }
    } catch (e: any) {
        console.error('Error al cargar REX:', e)
        if (e.code === 'P2002') {
            return { success: false, error: 'Ya existe una resolución registrada con ese mismo número y licitación.' }
        }
        return { success: false, error: e.message || 'Error al procesar el archivo Excel.' }
    }
}

/**
 * Ejecuta la conciliación automática entre la REX cargada y los cálculos internos
 */
export async function conciliarNotificacionRexAction(notificacionId: string): Promise<{ success: boolean; resumen?: ResumenEstadisticoConciliacion; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ejecutar la conciliación de la resolución.' }
        }

        const rex = await prisma.multas_Notificacion_REX.findUnique({
            where: { id: notificacionId },
            include: { items: true }
        })
        if (!rex) {
            return { success: false, error: 'Resolución no encontrada.' }
        }

        // Excluir registros previos NO_INCLUIDO antes del loop para no inflar cálculos ni perder filas
        const items = rex.items.filter(i => i.estadoConciliacion !== 'NO_INCLUIDO')
        const foliosNotif = Array.from(new Set(items.map(i => i.folio)))

        // 1. Consultar cálculos internos en Multas_Elementos_Esenciales
        const cabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where: { folioOriginal: { in: foliosNotif } },
            include: { detalles: true }
        })

        // Mapa de cálculo interno: folio -> aspecto -> montoMulta (en CLP)
        const calcMapClp = new Map<string, Map<string, number>>()
        for (const cab of cabs) {
            const aspMap = new Map<string, number>()
            for (const det of cab.detalles) {
                const letra = parseAspecto(det.letraAspecto)
                aspMap.set(letra, (aspMap.get(letra) || 0) + (det.montoMulta || 0))
            }
            calcMapClp.set(cab.folioOriginal, aspMap)
        }

        // 2. Buscar si los folios/aspectos ya fueron imputados en resoluciones ANTERIORES
        // Scoped strictly to prior REX (prior year/month/created) with montoNotificado > 0
        const prevItems = await prisma.multas_Notificacion_Item.findMany({
            where: {
                folio: { in: foliosNotif },
                notificacionId: { not: notificacionId },
                montoNotificado: { gt: 0 },
                estadoConciliacion: { notIn: ['NO_INCLUIDO', 'SOLO_JUNAEB'] },
                notificacion: {
                    OR: [
                        { periodoAnio: { lt: rex.periodoAnio } },
                        {
                            periodoAnio: rex.periodoAnio,
                            periodoMes: { lt: rex.periodoMes }
                        },
                        {
                            periodoAnio: rex.periodoAnio,
                            periodoMes: rex.periodoMes,
                            createdAt: { lt: rex.createdAt }
                        }
                    ]
                }
            },
            include: {
                notificacion: {
                    select: { numeroResolucion: true }
                }
            }
        })

        const prevMap = new Map<string, string>() // key: `${folio}_${aspecto}` -> numeroResolucion
        for (const pi of prevItems) {
            const key = `${pi.folio}_${parseAspecto(pi.aspecto)}`
            if (!prevMap.has(key)) {
                prevMap.set(key, pi.notificacion.numeroResolucion)
            }
        }

        // Eliminar antiguos 'NO_INCLUIDO' de esta conciliación previa si existían antes de procesar
        await prisma.multas_Notificacion_Item.deleteMany({
            where: {
                notificacionId,
                estadoConciliacion: 'NO_INCLUIDO'
            }
        })

        // 3. Procesar y actualizar cada item de la notificación
        let montoTotalCalculadoPesos = 0
        let montoTotalCalculadoUtm = 0
        const notifiedKeys = new Set<string>()
        const updateOperations: any[] = []

        for (const item of items) {
            const aspClean = parseAspecto(item.aspecto)
            const key = `${item.folio}_${aspClean}`
            notifiedKeys.add(key)

            const aspMap = calcMapClp.get(item.folio)
            const montoCalculadoPesos = aspMap && aspMap.has(aspClean) ? aspMap.get(aspClean)! : 0
            const notificadoPesos = item.montoNotificadoPesos || 0

            const diffPesos = Math.round(notificadoPesos - montoCalculadoPesos)
            const diffUtm = Math.round((item.montoNotificado - (montoCalculadoPesos > 0 ? item.montoNotificado : 0)) * 1000) / 1000

            let estadoConciliacion: 'COINCIDE' | 'DIFERENCIA_MONTO' | 'SOLO_JUNAEB' | 'FOLIO_REPETIDO' = 'COINCIDE'
            let resolucionAnterior: string | null = null

            if (prevMap.has(key)) {
                estadoConciliacion = 'FOLIO_REPETIDO'
                resolucionAnterior = prevMap.get(key)!
            } else if (!aspMap || !aspMap.has(aspClean) || (montoCalculadoPesos === 0 && (item.montoNotificado > 0 || notificadoPesos > 0))) {
                estadoConciliacion = 'SOLO_JUNAEB'
            } else if (Math.abs(diffPesos) < 100) {
                estadoConciliacion = 'COINCIDE'
            } else {
                estadoConciliacion = 'DIFERENCIA_MONTO'
            }

            montoTotalCalculadoPesos += montoCalculadoPesos
            if (montoCalculadoPesos > 0) {
                montoTotalCalculadoUtm += item.montoNotificado
            }

            updateOperations.push(
                prisma.multas_Notificacion_Item.update({
                    where: { id: item.id },
                    data: {
                        montoCalculado: montoCalculadoPesos > 0 ? item.montoNotificado : 0.0,
                        montoCalculadoPesos,
                        diferenciaMonto: diffUtm,
                        diferenciaPesos: diffPesos,
                        estadoConciliacion,
                        resolucionAnterior
                    }
                })
            )
        }

        // Ejecutar actualizaciones en lotes usando transacciones
        for (let i = 0; i < updateOperations.length; i += 50) {
            await prisma.$transaction(updateOperations.slice(i, i + 50))
        }

        // 4. Identificar actas del mismo período calculadas en Hendaya pero OMITIDAS por JUNAEB ('NO_INCLUIDO')
        const startOfMonth = new Date(rex.periodoAnio, rex.periodoMes - 1, 1)
        const endOfMonth = new Date(rex.periodoAnio, rex.periodoMes, 0, 23, 59, 59)

        const omittedCabs = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where: {
                fechaSupervision: {
                    gte: startOfMonth,
                    lte: endOfMonth
                },
                ...(rex.licitacionNombre ? { licitacion: { contains: rex.licitacionNombre, mode: 'insensitive' } } : {})
            },
            include: { detalles: true }
        })

        const omittedItemsToCreate = []
        for (const oc of omittedCabs) {
            for (const od of oc.detalles) {
                const letra = parseAspecto(od.letraAspecto)
                const key = `${oc.folioOriginal}_${letra}`
                if (od.montoMulta > 0 && !notifiedKeys.has(key)) {
                    omittedItemsToCreate.push({
                        notificacionId,
                        folio: oc.folioOriginal,
                        rbd: oc.rbd,
                        fechaSupervision: oc.fechaSupervision,
                        aspecto: letra,
                        infraccionDetalle: od.descripcion || `Infracción aspecto ${letra} calculada internamente no notificada por JUNAEB`,
                        montoNotificado: 0.0,
                        montoNotificadoPesos: 0.0,
                        montoCalculado: 0.0,
                        montoCalculadoPesos: od.montoMulta,
                        diferenciaMonto: 0.0,
                        diferenciaPesos: -od.montoMulta,
                        estadoConciliacion: 'NO_INCLUIDO',
                        clasificacionError: 'ERROR_JUNAEB',
                        motivoClasificacion: 'Infracción no consignada en Anexo 1 por JUNAEB'
                    })
                    montoTotalCalculadoPesos += od.montoMulta
                }
            }
        }

        if (omittedItemsToCreate.length > 0) {
            await prisma.multas_Notificacion_Item.createMany({
                data: omittedItemsToCreate
            })
        }

        // 5. Actualizar totales y estado de la resolución
        const totalItemsCount = items.length + omittedItemsToCreate.length
        const totalDiffUtm = Math.round((rex.montoTotalNotificado - montoTotalCalculadoUtm) * 1000) / 1000
        const notificadoPesosTotal = rex.montoTotalNotificadoPesos || 0
        const totalDiffPesos = Math.round(notificadoPesosTotal - montoTotalCalculadoPesos)

        await prisma.multas_Notificacion_REX.update({
            where: { id: notificacionId },
            data: {
                montoTotalCalculado: Math.round(montoTotalCalculadoUtm * 1000) / 1000,
                montoTotalCalculadoPesos,
                montoTotalDiferencia: totalDiffUtm,
                montoTotalDiferenciaPesos: totalDiffPesos,
                totalFilasNotif: totalItemsCount,
                estado: 'CONCILIADO'
            }
        })

        const userName = user.name || user.username || 'Usuario'
        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CONCILIACION_NOTIFICACION_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Conciliación ejecutada para REX N° ${rex.numeroResolucion}: ${totalItemsCount} items evaluados. Total Notificado: ${rex.montoTotalNotificado} UTM vs Calculado: ${montoTotalCalculadoUtm.toFixed(2)} UTM.`
        })

        revalidatePath(`/dashboard/areas/multas/notificaciones/${notificacionId}`)
        revalidatePath('/dashboard/areas/multas/notificaciones')

        const freshDetalle = await getNotificacionDetalleAction(notificacionId)
        return { success: true, resumen: freshDetalle.resumen }
    } catch (e: any) {
        console.error('Error al conciliar REX:', e)
        return { success: false, error: e.message || 'Error al ejecutar conciliación.' }
    }
}

/**
 * Clasifica una discrepancia asignando 'ERROR_JUNAEB' o 'ERROR_INTERNO' con motivo obligatorio
 */
export async function updateClasificacionItemAction(params: {
    itemId: string
    clasificacionError: 'ERROR_JUNAEB' | 'ERROR_INTERNO' | 'EN_REVISION' | 'ACEPTADO'
    motivoClasificacion: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para clasificar discrepancias.' }
        }

        const { itemId, clasificacionError, motivoClasificacion } = params
        if (!itemId) {
            return { success: false, error: 'ID de item no proporcionado.' }
        }
        if (!motivoClasificacion || motivoClasificacion.trim().length < 5) {
            return { success: false, error: 'Debes proporcionar un motivo detallado (mínimo 5 caracteres).' }
        }

        const userName = user.name || user.username || 'Usuario'

        const updated = await prisma.multas_Notificacion_Item.update({
            where: { id: itemId },
            data: {
                clasificacionError,
                motivoClasificacion: motivoClasificacion.trim(),
                clasificadoPor: userName,
                clasificadoEn: new Date()
            }
        })

        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'CLASIFICAR_DIFERENCIA_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Item Folio ${updated.folio} Aspecto ${updated.aspecto} clasificado como '${clasificacionError}': ${motivoClasificacion.trim()}`
        })

        revalidatePath(`/dashboard/areas/multas/notificaciones/${updated.notificacionId}`)
        return { success: true }
    } catch (e: any) {
        console.error('Error al clasificar item:', e)
        return { success: false, error: e.message || 'Error al clasificar la discrepancia.' }
    }
}

/**
 * Elimina una resolución REX y todos sus items asociados si no tiene descargos
 */
export async function eliminarNotificacionRexAction(notificacionId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureNotificacionesJunaebTables()
        const { authorized, user } = await checkNotificacionesPermission('manage_notificaciones_junaeb')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para eliminar resoluciones REX.' }
        }

        const rex = await prisma.multas_Notificacion_REX.findUnique({
            where: { id: notificacionId }
        })
        if (!rex) {
            return { success: false, error: 'Resolución no encontrada.' }
        }

        // Bloquear eliminación si tiene descargos formales asociados
        const descargosAsociados = await prisma.multas_Descargo_Formal.count({
            where: { notificacionId }
        })
        if (descargosAsociados > 0) {
            return {
                success: false,
                error: `No se puede eliminar la REX porque tiene ${descargosAsociados} descargo(s) formal(es) asociado(s). Elimina o desvincula los descargos primero.`
            }
        }

        await prisma.multas_Notificacion_REX.delete({
            where: { id: notificacionId }
        })

        const userName = user.name || user.username || 'Usuario'
        await logAuditAction({
            username: userName,
            userId: user.id,
            action: 'ELIMINAR_NOTIFICACION_REX',
            modulo: 'Multas · Notificaciones JUNAEB',
            detalle: `Eliminación de REX N° ${rex.numeroResolucion} (${rex.nombreArchivo})`
        })

        revalidatePath('/dashboard/areas/multas/notificaciones')
        return { success: true }
    } catch (e: any) {
        console.error('Error al eliminar REX:', e)
        return { success: false, error: e.message || 'Error al eliminar la resolución.' }
    }
}

// Helper: análisis y saneamiento de aspectos PAE
function parseAspecto(val: any): string {
    if (!val) return 'GENERAL'
    const s = String(val).trim().toUpperCase()
    if (s.startsWith('ASPECTO')) {
        const after = s.replace('ASPECTO', '').trim()
        if (after) return after
    }
    if (s === 'GENERAL' || s === 'GEN') return 'GENERAL'
    const match = s.match(/^[A-Z](?:\.[0-9]+)?/)
    if (match) return match[0]
    return s.slice(0, 10)
}

// Helper: parseo numérico con soporte para estándar chileno (CLP y UTM)
function parseNumeroChileno(val: any): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    if (!val) return 0
    let s = String(val).trim().replace(/[\$\s]/g, '')
    if (!s) return 0
    if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.')
    } else if (s.includes(',')) {
        s = s.replace(',', '.')
    } else if (s.includes('.')) {
        const parts = s.split('.')
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0], 10) > 0)) {
            s = s.replace(/\./g, '')
        }
    }
    const num = parseFloat(s)
    return isNaN(num) ? 0 : num
}

// Helper: búsqueda case-insensitive y flexible en filas de Excel
function findRowValue(row: any, possibleKeys: string[]): any {
    const keys = Object.keys(row)
    for (const target of possibleKeys) {
        const found = keys.find(k => {
            const cleanKey = k.toLowerCase().replace(/[\s_\-]/g, '')
            const cleanTarget = target.toLowerCase().replace(/[\s_\-]/g, '')
            return cleanKey === cleanTarget || cleanKey.includes(cleanTarget)
        })
        if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
            return row[found]
        }
    }
    return undefined
}

// Helper: parseo de fechas de Excel (número de serie o string)
function parseExcelDate(val: any): Date | null {
    if (val instanceof Date) return val
    if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000))
    }
    if (typeof val === 'string') {
        const parts = val.trim().split(/[-/]/)
        if (parts.length === 3) {
            // Caso DD/MM/YYYY o YYYY/MM/DD
            if (parts[0].length === 4) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
            } else {
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
            }
        }
        const d = new Date(val)
        return !isNaN(d.getTime()) ? d : null
    }
    return null
}
