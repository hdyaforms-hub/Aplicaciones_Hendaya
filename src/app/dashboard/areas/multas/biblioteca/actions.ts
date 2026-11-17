'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureBibliotecaArgumentosTables } from '@/lib/multas/biblioteca-argumentos-db-init'
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
        const session = await getSession()
        if (!session?.user) {
            return { success: false, data: [], error: 'Sesión no iniciada' }
        }

        await ensureBibliotecaArgumentosTables()

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
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        // Permiso
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true }
        })
        const perms: string[] = currentUser?.role?.permissions
            ? (typeof currentUser.role.permissions === 'string'
                ? JSON.parse(currentUser.role.permissions)
                : currentUser.role.permissions)
            : []

        const canManage = perms.includes('*') || perms.includes('manage_biblioteca_argumentos')
        if (!canManage) {
            return { success: false, error: 'No tienes permisos para crear o modificar argumentos de biblioteca' }
        }

        if (!data.aspecto || !data.titulo?.trim() || !data.argumentoTexto?.trim()) {
            return { success: false, error: 'Aspecto, título y texto del argumento son obligatorios' }
        }

        await ensureBibliotecaArgumentosTables()

        const autor = session.user.name || session.user.email || 'Usuario'

        const created = await prisma.multas_Argumento_Biblioteca.create({
            data: {
                aspecto: data.aspecto.toUpperCase(),
                reglaId: data.reglaId?.trim() || null,
                titulo: data.titulo.trim(),
                argumentoTexto: data.argumentoTexto.trim(),
                fundamentoLegal: data.fundamentoLegal?.trim() || null,
                folioEjemplo: data.folioEjemplo?.trim() || null,
                numeroRexPrecedente: data.numeroRexPrecedente?.trim() || null,
                resultadoHistorico: data.resultadoHistorico || 'ACEPTADO',
                montoRebajadoUtm: Number(data.montoRebajadoUtm || 0),
                etiquetas: data.etiquetas?.trim() || null,
                esPlantillaOficial: Boolean(data.esPlantillaOficial),
                autor,
                activo: true
            }
        })

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'CREAR_ARGUMENTO_BIBLIOTECA',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se creó el argumento "${created.titulo}" para el Aspecto ${created.aspecto}. Oficial: ${created.esPlantillaOficial}`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return {
            success: true,
            data: {
                id: created.id,
                aspecto: created.aspecto,
                reglaId: created.reglaId,
                titulo: created.titulo,
                argumentoTexto: created.argumentoTexto,
                fundamentoLegal: created.fundamentoLegal,
                folioEjemplo: created.folioEjemplo,
                numeroRexPrecedente: created.numeroRexPrecedente,
                resultadoHistorico: created.resultadoHistorico as any,
                montoRebajadoUtm: created.montoRebajadoUtm,
                vecesUtilizado: created.vecesUtilizado,
                etiquetas: created.etiquetas,
                esPlantillaOficial: created.esPlantillaOficial,
                autor: created.autor,
                activo: created.activo,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString()
            }
        }
    } catch (error: any) {
        console.error('Error al crear argumento:', error)
        return { success: false, error: error.message || 'Error al guardar argumento' }
    }
}

/**
 * Editar un argumento existente
 */
export async function editarArgumentoAction(
    id: string,
    data: {
        aspecto?: string
        reglaId?: string | null
        titulo?: string
        argumentoTexto?: string
        fundamentoLegal?: string | null
        folioEjemplo?: string | null
        numeroRexPrecedente?: string | null
        resultadoHistorico?: 'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'PLANTILLA_OFICIAL'
        montoRebajadoUtm?: number
        etiquetas?: string | null
        esPlantillaOficial?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true }
        })
        const perms: string[] = currentUser?.role?.permissions
            ? (typeof currentUser.role.permissions === 'string'
                ? JSON.parse(currentUser.role.permissions)
                : currentUser.role.permissions)
            : []

        const canManage = perms.includes('*') || perms.includes('manage_biblioteca_argumentos')
        if (!canManage) {
            return { success: false, error: 'No tienes permisos para modificar argumentos de biblioteca' }
        }

        await ensureBibliotecaArgumentosTables()

        const updateData: any = {}
        if (data.aspecto !== undefined) updateData.aspecto = data.aspecto.toUpperCase()
        if (data.reglaId !== undefined) updateData.reglaId = data.reglaId?.trim() || null
        if (data.titulo !== undefined) updateData.titulo = data.titulo.trim()
        if (data.argumentoTexto !== undefined) updateData.argumentoTexto = data.argumentoTexto.trim()
        if (data.fundamentoLegal !== undefined) updateData.fundamentoLegal = data.fundamentoLegal?.trim() || null
        if (data.folioEjemplo !== undefined) updateData.folioEjemplo = data.folioEjemplo?.trim() || null
        if (data.numeroRexPrecedente !== undefined) updateData.numeroRexPrecedente = data.numeroRexPrecedente?.trim() || null
        if (data.resultadoHistorico !== undefined) updateData.resultadoHistorico = data.resultadoHistorico
        if (data.montoRebajadoUtm !== undefined) updateData.montoRebajadoUtm = Number(data.montoRebajadoUtm || 0)
        if (data.etiquetas !== undefined) updateData.etiquetas = data.etiquetas?.trim() || null
        if (data.esPlantillaOficial !== undefined) updateData.esPlantillaOficial = Boolean(data.esPlantillaOficial)

        await prisma.multas_Argumento_Biblioteca.update({
            where: { id },
            data: updateData
        })

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'EDITAR_ARGUMENTO_BIBLIOTECA',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se actualizó el argumento ID ${id}`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return { success: true }
    } catch (error: any) {
        console.error('Error al editar argumento:', error)
        return { success: false, error: error.message || 'Error al editar argumento' }
    }
}

/**
 * Eliminar (borrado lógico o físico) un argumento
 */
export async function eliminarArgumentoAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true }
        })
        const perms: string[] = currentUser?.role?.permissions
            ? (typeof currentUser.role.permissions === 'string'
                ? JSON.parse(currentUser.role.permissions)
                : currentUser.role.permissions)
            : []

        const canManage = perms.includes('*') || perms.includes('manage_biblioteca_argumentos')
        if (!canManage) {
            return { success: false, error: 'No tienes permisos para eliminar argumentos de biblioteca' }
        }

        await ensureBibliotecaArgumentosTables()

        // Desactivación lógica para preservar trazabilidad
        await prisma.multas_Argumento_Biblioteca.update({
            where: { id },
            data: { activo: false }
        })

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'ELIMINAR_ARGUMENTO_BIBLIOTECA',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se desactivó el argumento ID ${id}`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar argumento:', error)
        return { success: false, error: error.message || 'Error al eliminar argumento' }
    }
}

/**
 * Importar lote de argumentos desde archivo Excel
 */
export async function importarArgumentosExcelAction(formData: FormData): Promise<{
    success: boolean
    importados?: number
    error?: string
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true }
        })
        const perms: string[] = currentUser?.role?.permissions
            ? (typeof currentUser.role.permissions === 'string'
                ? JSON.parse(currentUser.role.permissions)
                : currentUser.role.permissions)
            : []

        const canManage = perms.includes('*') || perms.includes('manage_biblioteca_argumentos')
        if (!canManage) {
            return { success: false, error: 'No tienes permisos para importar argumentos' }
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'No se subió ningún archivo' }
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const workbook = XLSX.read(buffer, { type: 'buffer' })

        // Buscar hoja "Descargos" o la primera hoja
        let sheetName = workbook.SheetNames.find(s =>
            s.toLowerCase().includes('descargo') || s.toLowerCase().includes('argumento')
        ) || workbook.SheetNames[0]

        const sheet = workbook.Sheets[sheetName]
        if (!sheet) {
            return { success: false, error: 'El archivo Excel no contiene hojas válidas' }
        }

        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        if (!rows || rows.length === 0) {
            return { success: false, error: 'La hoja de Excel está vacía' }
        }

        await ensureBibliotecaArgumentosTables()

        const autor = session.user.name || session.user.email || 'Importación Excel'
        let insertados = 0

        for (const r of rows) {
            // Mapeo flexible de columnas
            const aspecto = String(r['Aspecto'] || r['ASPECTO'] || r['aspecto'] || '').trim().toUpperCase()
            const titulo = String(r['Titulo'] || r['Título'] || r['TITULO'] || r['Nombre'] || '').trim()
            const argumentoTexto = String(r['Argumento'] || r['ARGUMENTO'] || r['Descargo'] || r['Texto'] || '').trim()

            if (!aspecto || !titulo || !argumentoTexto) {
                continue
            }

            const reglaId = String(r['Regla'] || r['ReglaId'] || r['Criterio'] || '').trim() || null
            const fundamentoLegal = String(r['Fundamento'] || r['Fundamento Legal'] || r['Base Legal'] || '').trim() || null
            const folioEjemplo = String(r['Folio'] || r['Folio Ejemplo'] || '').trim() || null
            const numeroRexPrecedente = String(r['REX'] || r['Numero REX'] || r['Resolucion'] || '').trim() || null
            const resultadoRaw = String(r['Resultado'] || r['Estado'] || 'ACEPTADO').trim().toUpperCase()
            const resultadoHistorico = ['ACEPTADO', 'PARCIAL', 'RECHAZADO', 'PLANTILLA_OFICIAL'].includes(resultadoRaw)
                ? resultadoRaw
                : 'ACEPTADO'
            const montoRebajadoUtm = Number(r['Monto Rebajado UTM'] || r['Rebaja UTM'] || r['UTM'] || 0) || 0
            const etiquetas = String(r['Etiquetas'] || r['Tags'] || '').trim() || null
            const esPlantillaOficial = String(r['Es Plantilla'] || r['Plantilla'] || '').toLowerCase().includes('si') ||
                String(r['Es Plantilla'] || '').toLowerCase().includes('true') ||
                resultadoHistorico === 'PLANTILLA_OFICIAL'

            await prisma.multas_Argumento_Biblioteca.create({
                data: {
                    aspecto,
                    reglaId,
                    titulo,
                    argumentoTexto,
                    fundamentoLegal,
                    folioEjemplo,
                    numeroRexPrecedente,
                    resultadoHistorico,
                    montoRebajadoUtm,
                    etiquetas,
                    esPlantillaOficial,
                    autor,
                    activo: true
                }
            })
            insertados++
        }

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'IMPORTAR_ARGUMENTOS_EXCEL',
            modulo: 'Multas · Biblioteca de Argumentos',
            detalle: `Se importaron ${insertados} argumentos desde el archivo "${file.name}" (total filas: ${rows.length})`
        })

        revalidatePath('/dashboard/areas/multas/biblioteca')

        return { success: true, importados: insertados }
    } catch (error: any) {
        console.error('Error al importar argumentos Excel:', error)
        return { success: false, error: error.message || 'Error al procesar archivo Excel' }
    }
}
