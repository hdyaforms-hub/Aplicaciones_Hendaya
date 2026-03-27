'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function getMatrizSemesterConfig(anio: number = 2026) {
    try {
        const config = await prisma.matrizConfigSemestre.findUnique({
            where: { anio }
        })
        return { success: true, config }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar la configuración del semestre.' }
    }
}

export async function saveMatrizSemesterConfig(data: { anio: number, fechaFin1: string }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_colegios_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const config = await prisma.matrizConfigSemestre.upsert({
            where: { anio: data.anio },
            update: {
                fechaFin1: new Date(data.fechaFin1)
            },
            create: {
                anio: data.anio,
                fechaFin1: new Date(data.fechaFin1)
            }
        })

        revalidatePath('/dashboard/matriz-riesgo/matriz-2026/colegios-activos')
        revalidatePath('/dashboard/matriz-riesgo/matriz-2026/mitigacion')
        return { success: true, config }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar la fecha del semestre.' }
    }
}
