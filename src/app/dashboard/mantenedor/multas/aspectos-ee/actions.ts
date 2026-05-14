'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const PATH = '/dashboard/mantenedor/multas/aspectos-ee'

async function checkPermission() {
    const session = await getSession()
    if (!session) return false

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })

    if (!user) return false
    
    // Parse permissions if they are stored as a JSON string
    const permissions = JSON.parse(user.role.permissions as string)
    return permissions.includes('manage_aspectos_ee')
}

export async function getAspectosEE(licId?: number) {
    if (!await checkPermission()) {
        return { error: 'No tienes permisos.' }
    }

    try {
        const aspectos = await prisma.aspectoEE.findMany({
            where: licId ? { licId } : {},
            include: { licitacion: true },
            orderBy: [
                { licId: 'asc' },
                { letra: 'asc' }
            ]
        })
        return { aspectos }
    } catch (e) {
        return { error: 'Error al consultar aspectos.' }
    }
}

export async function saveAspectoEE(data: { id?: string, licId: number, letra: string, descripcion?: string, formula?: string }) {
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
                    formula: data.formula
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
                    formula: data.formula
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

export async function testFormula(folio: string, formula: string) {
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
        let evaluatedFormula = cleanFormula
            .replace(/UTM/g, utmValue.toString())
            .replace(/RACIONES/g, raciones.toString())

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
