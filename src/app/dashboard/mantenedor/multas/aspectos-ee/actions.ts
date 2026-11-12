'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'

const PATH = '/dashboard/mantenedor/multas/aspectos-ee'

async function checkPermission() {
    const session = await getSession()
    if (!session?.user) return false

    // Administradores siempre tienen acceso completo
    const sessionRole = session.user.role?.name?.toUpperCase() || ''
    if (sessionRole.includes('ADMIN') || sessionRole.includes('SUPER')) return true

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })

    if (!user) return false
    
    const userRole = user.role?.name?.toUpperCase() || ''
    if (userRole.includes('ADMIN') || userRole.includes('SUPER')) return true

    try {
        let permissions: string[] = []
        if (typeof user.role?.permissions === 'string') {
            permissions = JSON.parse(user.role.permissions)
        } else if (Array.isArray(user.role?.permissions)) {
            permissions = user.role.permissions as any
        }
        return permissions.includes('manage_aspectos_ee') || permissions.includes('*')
    } catch {
        return false
    }
}

export async function getAspectosEE(licId?: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos para consultar aspectos EE.' }
    }

    try {
        try {
            await ensureMultasEETables()
        } catch (initErr) {
            console.warn('Advertencia en ensureMultasEETables:', initErr)
        }

        // 1. Consultar aspectos directamente
        const aspectos = await prisma.aspectoEE.findMany({
            where: licId ? { licId } : {},
            include: { licitacion: true },
            orderBy: [
                { licId: 'asc' },
                { letra: 'asc' }
            ]
        })

        // 2. Consultar restricciones de manera desacoplada
        let restricciones: any[] = []
        try {
            restricciones = await rawPrisma.$queryRawUnsafe(`
                SELECT "licId", UPPER(letra) as letra, activo
                FROM "Multas_Aspecto_EE_Restriccion"
                ${licId ? 'WHERE "licId" = ' + Number(licId) : ''}
            `)
        } catch (rErr) {
            console.warn('Advertencia al consultar restricciones:', rErr)
        }

        const aspectosConRestricciones = aspectos.map(asp => {
            const aspRestricciones = restricciones.filter(
                r => r.licId === asp.licId && r.letra.toUpperCase() === asp.letra.toUpperCase()
            )
            return {
                ...asp,
                restriccionesCount: aspRestricciones.length,
                restriccionesActivasCount: aspRestricciones.filter(r => r.activo).length
            }
        })

        return { aspectos: aspectosConRestricciones }
    } catch (e: any) {
        console.error('Error al consultar aspectos:', e)
        return { error: 'Error al consultar aspectos: ' + (e?.message || 'Error en servidor') }
    }
}

export async function saveAspectoEE(data: { id?: string, licId: number, letra: string, descripcion?: string, formula?: string, solucionable?: string }) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos.' }
    }

    try {
        if (data.id) {
            await prisma.aspectoEE.update({
                where: { id: data.id },
                data: {
                    letra: data.letra,
                    descripcion: data.descripcion,
                    formula: data.formula,
                    solucionable: data.solucionable
                }
            })
        } else {
            // Validar duplicidad
            const existing = await prisma.aspectoEE.findUnique({
                where: { licId_letra: { licId: data.licId, letra: data.letra } }
            })
            if (existing) return { error: `Ya existe el aspecto ${data.letra} para esta licitación.` }

            await prisma.aspectoEE.create({
                data: {
                    licId: data.licId,
                    letra: data.letra,
                    descripcion: data.descripcion,
                    formula: data.formula,
                    solucionable: data.solucionable
                }
            })
        }
        revalidatePath(PATH)
        return { success: true }
    } catch (e) {
        return { error: 'Error al guardar el aspecto.' }
    }
}

export async function deleteAspectoEE(id: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos.' }
    }

    try {
        await prisma.aspectoEE.delete({ where: { id } })
        revalidatePath(PATH)
        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar el aspecto.' }
    }
}

export async function testFormula(folio: string, formula: string, customValues?: { materiaPrima?: number, materiaPrimaTpmpap?: number, instrumento?: number, manipuladora?: number, manipuladoraAfectada?: number, nivelControlado?: number, cantServicio?: number, elementos?: number }) {
    if (!await checkPermission()) return { error: 'No tienes permisos.' }

    try {
        const cab = await prisma.elementosEsenciales_Cab.findFirst({
            where: { folio }
        })
        if (!cab) return { error: `No se encontró el Folio ${folio}.` }

        const rbd = cab.rbd
        const fecha = cab.fechaSupervision
        const licId = cab.licId
        const rawServicio = cab.servicio || ''

        if (!rbd || !fecha || !licId) return { error: 'El folio no tiene información suficiente (RBD, Fecha o Licitación).' }

        // Determinar código de servicio
        let serviceCode = null

        // 1. Intentar por paréntesis: "(A) Almuerzo" -> "A"
        const match = rawServicio.match(/\(([A-Z])\)/)
        if (match) serviceCode = match[1]

        // 2. Intentar por nombre en la tabla MultaServicio
        if (!serviceCode) {
            const servicios = await prisma.multaServicio.findMany()
            const found = servicios.find(s => 
                rawServicio.toLowerCase().includes(s.nombre.toLowerCase()) || 
                rawServicio.toUpperCase() === s.codigo
            )
            if (found) serviceCode = found.codigo
        }

        if (!serviceCode) return { error: `No se pudo determinar el código de servicio para "${rawServicio}".` }

        // Get UTM (Anho/Mes)
        const anho = fecha.getFullYear()
        const mes = fecha.getMonth() + 1
        const utmRecord = await prisma.uTM.findUnique({
            where: { anho_mes: { anho, mes } }
        })
        const utmValue = utmRecord?.monto || 0

        // Get Raciones from PMPA (Ano/Mes)
        const pmpas = await prisma.pMPA.findMany({
            where: {
                rbd,
                ano: anho,
                mes: mes,
                licitacion: licId,
                servicio: serviceCode
            }
        })
        const raciones = pmpas.reduce((acc, curr) => acc + curr.raceqJunaeb, 0)

        // Evaluate
        const cleanFormula = formula.toUpperCase()

        let finalRaciones = raciones
        let finalNivelControlado = raciones

        if (customValues?.nivelControlado !== undefined) {
            finalNivelControlado = customValues.nivelControlado
            finalRaciones = raciones
        }

        let manipuladoraAfectadaTest = customValues?.manipuladoraAfectada ?? 1;
        if (manipuladoraAfectadaTest === 0) manipuladoraAfectadaTest = 1;

        let evaluatedFormula = cleanFormula
            .replace(/UTM/g, utmValue.toString())
            .replace(/RACIONES/g, finalRaciones.toString())
            .replace(/NIVELCONTROLADO/g, finalNivelControlado.toString())
            .replace(/MATERIAPRIMATPMPAP/g, (customValues?.materiaPrimaTpmpap ?? 1).toString())
            .replace(/MATERIAPRIMA/g, (customValues?.materiaPrima ?? 1).toString())
            .replace(/INSTRUMENTO/g, (customValues?.instrumento ?? 1).toString())
            .replace(/MANIPULADORAAFECTADA/g, manipuladoraAfectadaTest.toString())
            .replace(/MANIPULADORA/g, (customValues?.manipuladora ?? 1).toString())
            .replace(/CANTSERVICIO/g, (customValues?.cantServicio ?? 1).toString())
            .replace(/ELEMENTOS/g, (customValues?.elementos ?? 1).toString())

        let result = 0
        try {
            const sanitized = evaluatedFormula.replace(/[^0-9\+\-\*\/\.\(\) ]/g, '')
            result = new Function(`return ${sanitized}`)()
        } catch (e) {
            return { error: 'Sintaxis de fórmula inválida.' }
        }

        return {
            success: true,
            data: {
                folio,
                rbd,
                fecha: fecha.toISOString().split('T')[0],
                servicio: serviceCode,
                utm: utmValue,
                raciones,
                formulaEvaluada: evaluatedFormula,
                resultado: result
            }
        }
    } catch (e) {
        return { error: 'Error al probar la fórmula.' }
    }
}

export async function getPmpaLevelsForFolio(folio: string) {
    if (!await checkPermission()) return { error: 'No tienes permisos.' }

    try {
        const cab = await prisma.elementosEsenciales_Cab.findFirst({
            where: { folio }
        })
        if (!cab) return { error: `No se encontró el Folio ${folio}.` }

        const rbd = cab.rbd
        const fecha = cab.fechaSupervision
        const licId = cab.licId
        const rawServicio = cab.servicio || ''

        if (!rbd || !fecha || !licId) return { error: 'Folio incompleto.' }

        const anho = fecha.getFullYear()
        const mes = fecha.getMonth() + 1
        
        // Determinar código de servicio (lógica repetida de testFormula, podríamos refactorizar)
        let serviceCode = null
        const match = rawServicio.match(/\(([A-Z])\)/)
        if (match) serviceCode = match[1]
        
        if (!serviceCode) {
            const servicios = await prisma.multaServicio.findMany()
            const found = servicios.find(s => rawServicio.toLowerCase().includes(s.nombre.toLowerCase()) || rawServicio.toUpperCase() === s.codigo)
            if (found) serviceCode = found.codigo
        }

        if (!serviceCode) return { error: 'No se pudo determinar el servicio.' }

        const pmpas = await prisma.pMPA.findMany({
            where: { rbd, ano: anho, mes, licitacion: licId, servicio: serviceCode },
            select: { nivel: true, raceqJunaeb: true }
        })

        // Agrupar por nivel y sumar raciones
        const levelsMap = pmpas.reduce((acc: any, curr) => {
            if (!acc[curr.nivel]) acc[curr.nivel] = 0
            acc[curr.nivel] += curr.raceqJunaeb
            return acc
        }, {})

        const levels = Object.entries(levelsMap).map(([nivel, raciones]) => ({ nivel, raciones }))

        return { success: true, levels }
    } catch (e) {
        return { error: 'Error al consultar niveles.' }
    }
}

export async function getLicitaciones() {
    try {
        const licitaciones = await prisma.licitacion.findMany({
            where: { estado: 1 },
            orderBy: { licId: 'asc' }
        })
        return { licitaciones }
    } catch (e) {
        return { error: 'Error al consultar licitaciones.' }
    }
}

export async function getRestriccionesAspecto(licId: number, letra: string) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos.' }
    }

    try {
        await ensureMultasEETables()
        const rows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT 
                id, 
                "licId", 
                letra, 
                tipo, 
                anho, 
                "fechaDesde", 
                "fechaHasta", 
                accion, 
                "valorFijo", 
                descripcion, 
                activo, 
                "creadoPor", 
                "createdAt", 
                "updatedAt"
            FROM "Multas_Aspecto_EE_Restriccion"
            WHERE "licId" = $1 AND UPPER(letra) = UPPER($2)
            ORDER BY activo DESC, anho DESC, "createdAt" DESC
        `, Number(licId), letra.trim().toUpperCase())

        return { restricciones: rows }
    } catch (e: any) {
        console.error('Error al obtener restricciones:', e)
        return { error: 'Error al consultar restricciones del aspecto: ' + (e?.message || 'Error en base de datos') }
    }
}

export async function saveRestriccionAspecto(data: {
    id?: string
    licId: number
    letra: string
    tipo?: string
    anho?: number | null
    fechaDesde?: string | null
    fechaHasta?: string | null
    accion: string
    valorFijo?: number
    descripcion?: string
    activo: boolean
}) {
    const session = await getSession()
    if (!session || !await checkPermission()) {
        return { error: 'No tienes permisos para modificar restricciones.' }
    }

    try {
        await ensureMultasEETables()
        const letraClean = data.letra ? data.letra.trim().toUpperCase() : 'M'
        const licIdNum = Number(data.licId)
        const isAnho = !data.tipo || data.tipo === 'ANHO'

        const parsedAnho = isAnho && data.anho ? Number(data.anho) : null

        const isValidDate = (d: any) => typeof d === 'string' && d.trim().length >= 8 && !isNaN(new Date(d).getTime())
        const parsedFechaDesde = !isAnho && isValidDate(data.fechaDesde) ? new Date(data.fechaDesde!) : null
        const parsedFechaHasta = !isAnho && isValidDate(data.fechaHasta) ? new Date(data.fechaHasta!) : null
        const parsedValorFijo = data.valorFijo !== undefined ? Number(data.valorFijo) : 0

        if (data.id) {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Multas_Aspecto_EE_Restriccion"
                SET 
                    tipo = $1,
                    anho = $2,
                    "fechaDesde" = $3,
                    "fechaHasta" = $4,
                    accion = $5,
                    "valorFijo" = $6,
                    descripcion = $7,
                    activo = $8,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = $9
            `,
                data.tipo || 'ANHO',
                parsedAnho,
                parsedFechaDesde,
                parsedFechaHasta,
                data.accion || 'VALOR_CERO',
                parsedValorFijo,
                data.descripcion?.trim() || null,
                Boolean(data.activo),
                data.id
            )
        } else {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Aspecto_EE_Restriccion" (
                    id, "licId", letra, tipo, anho, "fechaDesde", "fechaHasta", accion, "valorFijo", descripcion, activo, "creadoPor", "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
            `,
                licIdNum,
                letraClean,
                data.tipo || 'ANHO',
                parsedAnho,
                parsedFechaDesde,
                parsedFechaHasta,
                data.accion || 'VALOR_CERO',
                parsedValorFijo,
                data.descripcion?.trim() || null,
                Boolean(data.activo),
                session.user.username || session.user.name || 'ADMIN'
            )
        }

        try {
            await logAuditAction({
                username: session.user.username || session.user.name || 'ADMIN',
                userId: session.user.id,
                action: data.id ? 'UPDATE' : 'CREATE',
                modulo: 'MANTENEDOR_MULTAS',
                detalle: `Restricción aspecto EE ${data.id ? 'actualizada' : 'creada'}: Lic ${licIdNum} Aspecto ${letraClean} Año ${parsedAnho || 'N/A'}`
            })
        } catch (auditErr) {
            console.warn('Advertencia al registrar auditoría:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error('Error al guardar restricción:', e)
        return { error: 'Error al guardar la restricción: ' + (e?.message || 'Error en base de datos') }
    }
}

export async function toggleRestriccionAspecto(id: string, activo: boolean) {
    const session = await getSession()
    if (!session || !await checkPermission()) {
        return { error: 'No tienes permisos para modificar restricciones.' }
    }

    try {
        await rawPrisma.$executeRawUnsafe(`
            UPDATE "Multas_Aspecto_EE_Restriccion"
            SET activo = $1, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $2
        `, Boolean(activo), id)

        try {
            await logAuditAction({
                username: session.user.username || session.user.name || 'ADMIN',
                userId: session.user.id,
                action: 'UPDATE',
                modulo: 'MANTENEDOR_MULTAS',
                detalle: `Restricción aspecto EE ${id} cambiada a ${activo ? 'ACTIVA' : 'INACTIVA'}`
            })
        } catch (auditErr) {
            console.warn('Advertencia auditoría:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error('Error al cambiar estado de restricción:', e)
        return { error: 'Error al cambiar estado de la restricción: ' + (e?.message || 'Error en base de datos') }
    }
}

export async function deleteRestriccionAspecto(id: string) {
    const session = await getSession()
    if (!session || !await checkPermission()) {
        return { error: 'No tienes permisos para eliminar restricciones.' }
    }

    try {
        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "Multas_Aspecto_EE_Restriccion"
            WHERE id = $1
        `, id)

        try {
            await logAuditAction({
                username: session.user.username || session.user.name || 'ADMIN',
                userId: session.user.id,
                action: 'DELETE',
                modulo: 'MANTENEDOR_MULTAS',
                detalle: `Restricción aspecto EE eliminada: ID ${id}`
            })
        } catch (auditErr) {
            console.warn('Advertencia auditoría:', auditErr)
        }

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error('Error al eliminar restricción:', e)
        return { error: 'Error al eliminar la restricción: ' + (e?.message || 'Error en base de datos') }
    }
}
