'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function getMatrizConfig() {
    try {
        const config = await prisma.matrizConfigPregunta.findMany()
        return { success: true, config }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar la configuración.' }
    }
}

export async function saveMatrizConfig(items: {
    preguntaId: string,
    seccion: string,
    gravedad: number,
    probabilidad: number,
    nivelRiesgo: string
}[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_evaluacion_detallada')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        // Aseguramos que no haya duplicados en el array antes de procesar
        const uniqueItems = Array.from(new Map(items.map(item => [item.preguntaId, item])).values())

        console.log(`Guardando ${uniqueItems.length} items de configuración de riesgos...`)

        // Usamos una transacción para guardar todo
        await prisma.$transaction(
            uniqueItems.map(item => prisma.matrizConfigPregunta.upsert({
                where: { preguntaId: item.preguntaId },
                update: {
                    seccion: item.seccion,
                    gravedad: item.gravedad,
                    probabilidad: item.probabilidad,
                    nivelRiesgo: item.nivelRiesgo
                },
                create: {
                    preguntaId: item.preguntaId,
                    seccion: item.seccion,
                    gravedad: item.gravedad,
                    probabilidad: item.probabilidad,
                    nivelRiesgo: item.nivelRiesgo
                }
            }))
        )

        revalidatePath('/dashboard/matriz-riesgo/matriz-2026/evaluacion-detallada')
        return { success: true }
    } catch (e: any) {
        console.error("ERROR AL GUARDAR CONFIGURACION:", e)
        return { error: `Error al guardar la configuración: ${e.message || 'Error desconocido'}` }
    }
}
