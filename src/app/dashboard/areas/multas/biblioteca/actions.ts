'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureBibliotecaArgumentosTables } from '@/lib/multas/biblioteca-argumentos-db-init'
import { checkMultasPermission } from '@/lib/multas/permisos'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

export interface ArgumentoBibliotecaDTO {
    id: string
    aspecto: string
    reglaId: string | null
    titulo: string
    argumentoTexto: string
    fundamentoLegal: string | null
    folioEjemplo: string | null
    numeroRexPrecedente: string | null
    resultadoHistorico: 'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'PLANTILLA_OFICIAL'
    montoRebajadoUtm: number
    vecesUtilizado: number
    etiquetas: string | null
    esPlantillaOficial: boolean
    autor: string
    activo: boolean
    createdAt: string
    updatedAt: string
}

export interface FiltrosArgumentosDTO {
    aspecto?: string
    reglaId?: string
    search?: string
    resultado?: string
    soloPlantillas?: boolean
}

/**
 * Obtener lista de argumentos de la biblioteca con filtros
 */
export async function getArgumentosBibliotecaAction(filtros?: FiltrosArgumentosDTO): Promise<{
    success: boolean
    data: ArgumentoBibliotecaDTO[]
    error?: string
}> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized } = await checkMultasPermission('view_biblioteca_argumentos')
        if (!authorized) {
            return { success: false, data: [], error: 'No tienes permisos para consultar la biblioteca de argumentos' }
        }

        const where: any = { activo: true }

        if (filtros?.aspecto && filtros.aspecto !== 'TODOS') {
            where.aspecto = filtros.aspecto.toUpperCase()
        }

        if (filtros?.reglaId && filtros.reglaId !== 'TODAS') {
            where.reglaId = filtros.reglaId
        }

        if (filtros?.resultado && filtros.resultado !== 'TODOS') {
            where.resultadoHistorico = filtros.resultado
        }

        if (filtros?.soloPlantillas) {
            where.esPlantillaOficial = true
        }

        if (filtros?.search && filtros.search.trim() !== '') {
            const s = filtros.search.trim()
            where.OR = [
                { titulo: { contains: s, mode: 'insensitive' } },
                { argumentoTexto: { contains: s, mode: 'insensitive' } },
                { fundamentoLegal: { contains: s, mode: 'insensitive' } },
                { etiquetas: { contains: s, mode: 'insensitive' } },
                { folioEjemplo: { contains: s, mode: 'insensitive' } },
                { numeroRexPrecedente: { contains: s, mode: 'insensitive' } }
            ]
        }

        const args = await prisma.multas_Argumento_Biblioteca.findMany({
            where,
            orderBy: [
                { esPlantillaOficial: 'desc' },
                { vecesUtilizado: 'desc' },
                { createdAt: 'desc' }
            ]
        })

        const mapped: ArgumentoBibliotecaDTO[] = args.map(a => ({
            id: a.id,
            aspecto: a.aspecto,
            reglaId: a.reglaId,
            titulo: a.titulo,
            argumentoTexto: a.argumentoTexto,
            fundamentoLegal: a.fundamentoLegal,
            folioEjemplo: a.folioEjemplo,
            numeroRexPrecedente: a.numeroRexPrecedente,
            resultadoHistorico: a.resultadoHistorico as any,
            montoRebajadoUtm: a.montoRebajadoUtm,
            vecesUtilizado: a.vecesUtilizado,
            etiquetas: a.etiquetas,
            esPlantillaOficial: a.esPlantillaOficial,
            autor: a.autor,
            activo: a.activo,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString()
        }))

        return { success: true, data: mapped }
    } catch (error: any) {
        console.error('Error al obtener argumentos de biblioteca:', error)
        return { success: false, data: [], error: error.message || 'Error al obtener biblioteca de argumentos' }
    }
}

/**
 * Obtener sugerencias de argumentos precedentes / plantillas para un aspecto y regla
 */
export async function getArgumentosSugeridosAction(params: {
    aspecto: string
    reglaId?: string
}): Promise<{
    success: boolean
    data: ArgumentoBibliotecaDTO[]
    error?: string
}> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized } = await checkMultasPermission('view_biblioteca_argumentos')
        if (!authorized) {
            return { success: false, data: [], error: 'No tienes permisos para consultar sugerencias de argumentos' }
        }

        const where: any = {
            activo: true,
            aspecto: params.aspecto.toUpperCase(),
            resultadoHistorico: { in: ['ACEPTADO', 'PARCIAL', 'PLANTILLA_OFICIAL'] }
        }

        if (params.reglaId) {
            where.OR = [
                { reglaId: params.reglaId },
                { reglaId: null }
            ]
        }

        const items = await prisma.multas_Argumento_Biblioteca.findMany({
            where,
            orderBy: [
                { esPlantillaOficial: 'desc' },
                { vecesUtilizado: 'desc' },
                { montoRebajadoUtm: 'desc' }
            ],
            take: 5
        })

        const mapped: ArgumentoBibliotecaDTO[] = items.map(a => ({
            id: a.id,
            aspecto: a.aspecto,
            reglaId: a.reglaId,
            titulo: a.titulo,
            argumentoTexto: a.argumentoTexto,
            fundamentoLegal: a.fundamentoLegal,
            folioEjemplo: a.folioEjemplo,
            numeroRexPrecedente: a.numeroRexPrecedente,
            resultadoHistorico: a.resultadoHistorico as any,
            montoRebajadoUtm: a.montoRebajadoUtm,
            vecesUtilizado: a.vecesUtilizado,
            etiquetas: a.etiquetas,
            esPlantillaOficial: a.esPlantillaOficial,
            autor: a.autor,
            activo: a.activo,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString()
        }))

        return { success: true, data: mapped }
    } catch (error: any) {
        console.error('Error al obtener argumentos sugeridos:', error)
        return { success: false, data: [], error: error.message }
    }
}

/**
 * Incrementar contador de uso de un argumento (cuando se copia o aplica a un descargo)
 */
export async function incrementarUsoArgumentoAction(id: string): Promise<{ success: boolean; nuevoTotal?: number }> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized } = await checkMultasPermission('view_biblioteca_argumentos')
        if (!authorized) {
            return { success: false }
        }

        const updated = await prisma.multas_Argumento_Biblioteca.update({
            where: { id },
            data: {
                vecesUtilizado: { increment: 1 }
            },
            select: { vecesUtilizado: true }
        })
        return { success: true, nuevoTotal: updated.vecesUtilizado }
    } catch (error) {
        return { success: false }
    }
}

/**
 * Crear un nuevo argumento o precedente en la biblioteca
 */
export async function crearArgumentoAction(data: {
    aspecto: string
    reglaId?: string
    titulo: string
    argumentoTexto: string
    fundamentoLegal?: string
    folioEjemplo?: string
    numeroRexPrecedente?: string
    resultadoHistorico?: 'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'PLANTILLA_OFICIAL'
    montoRebajadoUtm?: number
    etiquetas?: string
    esPlantillaOficial?: boolean
}): Promise<{ success: boolean; data?: ArgumentoBibliotecaDTO; error?: string }> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized, user } = await checkMultasPermission('manage_biblioteca_argumentos')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para crear o modificar argumentos de biblioteca' }
        }

        const autor = user.name || user.username || user.email || 'Área Legal Hendaya'

        const created = await prisma.multas_Argumento_Biblioteca.create({
            data: {
                aspecto: data.aspecto.toUpperCase(),
                reglaId: data.reglaId || null,
                titulo: data.titulo.trim(),
                argumentoTexto: data.argumentoTexto.trim(),
                fundamentoLegal: data.fundamentoLegal?.trim() || null,
                folioEjemplo: data.folioEjemplo?.trim() || null,
                numeroRexPrecedente: data.numeroRexPrecedente?.trim() || null,
                resultadoHistorico: data.resultadoHistorico || 'ACEPTADO',
                montoRebajadoUtm: Number(data.montoRebajadoUtm) || 0,
                etiquetas: data.etiquetas?.trim() || null,
                esPlantillaOficial: data.esPlantillaOficial || false,
                autor,
                activo: true
            }
        })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'CREAR_ARGUMENTO_BIBLIOTECA',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se creó el argumento "${created.titulo}" para Aspecto ${created.aspecto}`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return {
            success: true,
            data: {
                ...created,
                resultadoHistorico: created.resultadoHistorico as any,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString()
            }
        }
    } catch (error: any) {
        console.error('Error al crear argumento en biblioteca:', error)
        return { success: false, error: error.message || 'Error al guardar argumento' }
    }
}

/**
 * Editar un argumento existente
 */
export async function editarArgumentoAction(
    id: string,
    data: {
        aspecto: string
        reglaId?: string | null
        titulo: string
        argumentoTexto: string
        fundamentoLegal?: string | null
        folioEjemplo?: string | null
        numeroRexPrecedente?: string | null
        resultadoHistorico?: 'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'PLANTILLA_OFICIAL'
        montoRebajadoUtm?: number
        etiquetas?: string | null
        esPlantillaOficial?: boolean
    }
): Promise<{ success: boolean; data?: ArgumentoBibliotecaDTO; error?: string }> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized, user } = await checkMultasPermission('manage_biblioteca_argumentos')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para crear o modificar argumentos de biblioteca' }
        }

        const updated = await prisma.multas_Argumento_Biblioteca.update({
            where: { id },
            data: {
                aspecto: data.aspecto.toUpperCase(),
                reglaId: data.reglaId ?? undefined,
                titulo: data.titulo.trim(),
                argumentoTexto: data.argumentoTexto.trim(),
                fundamentoLegal: data.fundamentoLegal?.trim() ?? undefined,
                folioEjemplo: data.folioEjemplo?.trim() ?? undefined,
                numeroRexPrecedente: data.numeroRexPrecedente?.trim() ?? undefined,
                resultadoHistorico: data.resultadoHistorico || 'ACEPTADO',
                montoRebajadoUtm: Number(data.montoRebajadoUtm) || 0,
                etiquetas: data.etiquetas?.trim() ?? undefined,
                esPlantillaOficial: data.esPlantillaOficial || false
            }
        })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'EDITAR_ARGUMENTO_BIBLIOTECA',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se editó el argumento "${updated.titulo}" (ID: ${id})`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return {
            success: true,
            data: {
                ...updated,
                resultadoHistorico: updated.resultadoHistorico as any,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString()
            }
        }
    } catch (error: any) {
        console.error('Error al editar argumento en biblioteca:', error)
        return { success: false, error: error.message || 'Error al actualizar argumento' }
    }
}

/**
 * Eliminar (lógico) un argumento de la biblioteca
 */
export async function eliminarArgumentoAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized, user } = await checkMultasPermission('manage_biblioteca_argumentos')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para eliminar argumentos de biblioteca' }
        }

        const arg = await prisma.multas_Argumento_Biblioteca.update({
            where: { id },
            data: { activo: false }
        })

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'ELIMINAR_ARGUMENTO_BIBLIOTECA',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se desactivó el argumento "${arg.titulo}" (ID: ${id})`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar argumento de biblioteca:', error)
        return { success: false, error: error.message || 'Error al eliminar argumento' }
    }
}

/**
 * Importar masivamente argumentos y descargos desde Excel real de JUNAEB (Hoja "Descargos")
 */
export async function importarArgumentosExcelAction(formData: FormData): Promise<{
    success: boolean
    importados?: number
    error?: string
}> {
    try {
        await ensureBibliotecaArgumentosTables()
        const { authorized, user } = await checkMultasPermission('manage_biblioteca_argumentos')
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para importar argumentos de biblioteca' }
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'No se subió ningún archivo' }
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const workbook = XLSX.read(buffer, { type: 'buffer' })

        // Buscar estrictamente la hoja "Descargos"
        const sheetName = workbook.SheetNames.find(s => {
            const clean = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            return clean.includes('descargo')
        })

        if (!sheetName) {
            return { success: false, error: 'El archivo Excel no contiene la hoja obligatoria "Descargos".' }
        }

        const sheet = workbook.Sheets[sheetName]
        if (!sheet) {
            return { success: false, error: 'El archivo Excel no contiene hojas válidas' }
        }

        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (!rawRows || rawRows.length === 0) {
            return { success: false, error: 'La hoja de Excel está vacía' }
        }

        // Detectar fila de cabecera
        let headerRowIdx = 0
        for (let r = 0; r < Math.min(5, rawRows.length); r++) {
            const rowStr = rawRows[r].map(c => String(c).toLowerCase()).join(' ')
            if (rowStr.includes('acta') || rowStr.includes('folio') || rowStr.includes('aspecto') || rowStr.includes('descargo')) {
                headerRowIdx = r
                break
            }
        }

        const headerRow = rawRows[headerRowIdx] || []
        // Posiciones estándar sigs: col 2 (ID_ACTA/folio), col 9/10 (ASPECTO), col 11 (OBS), col 19 (PESOS), col 20 (DESCARGO)
        let colFolio = 2
        let colAspecto = 9
        let colObs = 11
        let colPesos = 19
        let colDescargo = 20

        // Si los encabezados existen, mapear dinámicamente
        headerRow.forEach((cellVal, idx) => {
            const c = String(cellVal).toLowerCase().trim()
            if (c === 'id_acta' || c === 'folio' || c === 'n° acta' || c === 'acta' || c.includes('id_acta')) colFolio = idx
            else if (c === 'aspecto' || c === 'letra' || c.includes('aspecto')) colAspecto = idx
            else if (c.includes('observacion') || c.includes('hecho') || c.includes('obs')) colObs = idx
            else if (c.includes('pesos') || c.includes('monto')) colPesos = idx
            else if (c.includes('descargo') || c.includes('argumento') || c.includes('texto')) colDescargo = idx
        })

        const autor = user.name || user.username || user.email || 'Importación Anexo 1 Descargos'
        let insertados = 0

        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r]
            if (!row || row.length === 0) continue

            const folioRaw = row[colFolio]
            const folio = folioRaw ? String(folioRaw).trim().replace(/^['"\s]+|['"\s]+$/g, '') : null

            const aspectoRaw = row[colAspecto]
            const aspecto = aspectoRaw ? String(aspectoRaw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) : 'GENERAL'

            const descargoTexto = String(row[colDescargo] || '').trim()
            if (!descargoTexto) continue

            const observacion = String(row[colObs] || '').trim()
            const titulo = observacion
                ? (observacion.length > 70 ? observacion.slice(0, 67) + '...' : observacion)
                : (folio ? `Descargo Acta #${folio} · Aspecto ${aspecto}` : `Descargo Oficial Aspecto ${aspecto}`)

            const fundamentoLegal = observacion || 'Bases de Licitación PAE e Instrucción de Trabajo de Elementos Esenciales JUNAEB'

            // Deduplicación por (folioEjemplo, aspecto)
            const existing = await prisma.multas_Argumento_Biblioteca.findFirst({
                where: {
                    folioEjemplo: folio || undefined,
                    aspecto: aspecto,
                    activo: true
                }
            })

            if (existing) {
                await prisma.multas_Argumento_Biblioteca.update({
                    where: { id: existing.id },
                    data: {
                        titulo,
                        argumentoTexto: descargoTexto,
                        fundamentoLegal,
                        autor,
                        updatedAt: new Date()
                    }
                })
            } else {
                await prisma.multas_Argumento_Biblioteca.create({
                    data: {
                        aspecto,
                        titulo,
                        argumentoTexto: descargoTexto,
                        fundamentoLegal,
                        folioEjemplo: folio || null,
                        resultadoHistorico: 'ACEPTADO',
                        montoRebajadoUtm: 0,
                        esPlantillaOficial: false,
                        autor,
                        activo: true
                    }
                })
            }

            insertados++
        }

        await logAuditAction({
            username: (user.username || user.email) as string,
            userId: user.id || null,
            action: 'IMPORTAR_ARGUMENTOS_EXCEL',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se procesaron y deduplicaron ${insertados} argumentos desde el archivo "${file.name}" (hoja "${sheetName}")`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return { success: true, importados: insertados }
    } catch (error: any) {
        console.error('Error al importar argumentos Excel:', error)
        return { success: false, error: error.message || 'Error al procesar archivo Excel' }
    }
}
