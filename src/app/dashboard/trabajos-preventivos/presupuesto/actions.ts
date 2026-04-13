'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function savePresupuesto(formData: FormData) {
    const session = await getSession()
    if (!session?.user) return { error: 'No autorizado' }

    const ano = parseInt(formData.get('ano') as string)
    const sucursalId = formData.get('sucursalId') as string
    const montoAnual = parseFloat(formData.get('montoAnual') as string)

    if (isNaN(ano) || !sucursalId || isNaN(montoAnual)) {
        return { error: 'Datos inválidos' }
    }

    try {
        await prisma.presupuesto.upsert({
            where: {
                ano_sucursalId: {
                    ano,
                    sucursalId
                }
            },
            update: {
                montoAnual,
                usuario: session.user.username,
                updatedAt: new Date()
            },
            create: {
                ano,
                sucursalId,
                montoAnual,
                usuario: session.user.username
            }
        })

        revalidatePath('/dashboard/trabajos-preventivos/presupuesto')
        return { success: true }
    } catch (error) {
        console.error('Error al guardar presupuesto:', error)
        return { error: 'Error al guardar en la base de datos' }
    }
}

export async function deletePresupuesto(id: string) {
    try {
        await prisma.presupuesto.delete({ where: { id } })
        revalidatePath('/dashboard/trabajos-preventivos/presupuesto')
        return { success: true }
    } catch (error) {
        return { error: 'Error al eliminar' }
    }
}
