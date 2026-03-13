'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getPantallasConfig() {
    try {
        const results = await prisma.notificacionPantalla.findMany({
            include: {
                listaCorreo: true
            }
        })
        return results
    } catch (error) {
        console.error('Error fetching pantallas config:', error)
        return []
    }
}

export async function getPlantillasConfig() {
    try {
        return await prisma.plantillaCorreo.findMany()
    } catch (error) {
        return []
    }
}

export async function getListasCorreo() {
    try {
        return await prisma.listaCorreo.findMany({
            select: { id: true, nombre: true }
        })
    } catch (error) {
        console.error('Error fetching listas:', error)
        return []
    }
}

export async function saveScreenNotification(codigoPantalla: string, listaCorreoIds: string[], activa: boolean) {
    try {
        // Find existing for this screen
        const existing = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla }
        })

        const existingIds = existing.map(e => e.listaCorreoId)
        
        // Listas to add
        const toAdd = listaCorreoIds.filter(id => !existingIds.includes(id))
        
        // Listas to remove
        const toRemove = existingIds.filter(id => !listaCorreoIds.includes(id))

        // Transaction
        await prisma.$transaction([
            // Remove
            prisma.notificacionPantalla.deleteMany({
                where: {
                    codigoPantalla,
                    listaCorreoId: { in: toRemove }
                }
            }),
            // Add
            ...toAdd.map(id => prisma.notificacionPantalla.create({
                data: {
                    codigoPantalla,
                    listaCorreoId: id,
                    activa
                }
            })),
            // Update actives
            prisma.notificacionPantalla.updateMany({
                where: { codigoPantalla, listaCorreoId: { in: existingIds.filter(id => !toRemove.includes(id)) } },
                data: { activa }
            })
        ])

        revalidatePath('/dashboard/configuracion/notificaciones')
        return { success: true }
    } catch (error) {
        console.error('Error saving notification config:', error)
        return { success: false, error: 'Hubo un error al guardar o verificar las listas.' }
    }
}

export async function savePlantillaCorreo(codigoPantalla: string, asunto: string, cuerpo: string) {
    try {
        await prisma.plantillaCorreo.upsert({
            where: { codigoPantalla },
            update: { asunto, cuerpo },
            create: { codigoPantalla, asunto, cuerpo }
        })
        revalidatePath('/dashboard/configuracion/notificaciones')
        return { success: true }
    } catch (error) {
        console.error('Error saving template:', error)
        return { success: false, error: 'Error al grabar plantilla de correo.' }
    }
}
export async function getMockDataForPreview(codigoPantalla: string) {
    const mockData: Record<string, any> = {
        'retiro-saldos': {
            Folio: '0000000088',
            Tipo: 'Retiro de saldo',
            RBD: '1234',
            Establecimiento: 'COLEGIO DE PRUEBA HENDAYA',
            UT: '5',
            Sucursal: 'SANTIAGO SUR',
            Supervisor: 'JUAN PÉREZ',
            NombreAutoriza: 'MARÍA GONZÁLEZ',
            RUTAutoriza: '12.345.678-9',
            DetalleProductos: '- [001] PRODUCTO A: 10\n- [002] PRODUCTO B: 5'
        },
        'solicitud-pan': {
            Folio: 'PAN-2024-0015',
            RBD: '5678',
            Establecimiento: 'ESCUELA DE TALCA',
            Usuario: 'PEDRO RIVAS'
        },
        'ingreso-raciones': {
            RBD: '9012',
            Establecimiento: 'LICEO INDUSTRIAL',
            Usuario: 'ANA LÓPEZ'
        }
    }
    return mockData[codigoPantalla] || {}
}
