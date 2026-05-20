'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const MONTH_MAP: Record<string, number> = {
    'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
    'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
}

export async function getUtmRecords(anho?: number, mes?: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_utm')) {
        return { error: 'No tienes permisos para ver esta información.' }
    }

    try {
        const where: any = {}
        if (anho) where.anho = anho
        if (mes) where.mes = mes

        const records = await prisma.uTM.findMany({
            where,
            orderBy: [
                { anho: 'desc' },
                { mes: 'desc' }
            ]
        })

        return { records }
    } catch (e) {
        console.error("Error fetching UTM records:", e)
        return { error: 'Ocurrió un error al consultar los registros.' }
    }
}

export async function syncUtmFromSii(year: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_utm')) {
        return { error: 'No tienes permisos para realizar esta acción.' }
    }

    try {
        const url = `https://www.sii.cl/valores_y_fechas/utm/utm${year}.htm`
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        })

        if (!response.ok) {
            return { error: `No se pudo acceder a la página del SII para el año ${year}.` }
        }

        const html = await response.text()
        
        // Helper para limpiar HTML
        const stripHtml = (text: string) => text.replace(/<[^>]*>?/gm, '').trim()

        // Regex mejorado:
        // 1. Soporta <th> o <td> para la primera columna (mes)
        // 2. Captura el contenido que puede tener tags internos (<strong>, etc)
        const rowRegex = /<tr.*?>\s*<(?:td|th).*?>\s*(.*?)\s*<\/(?:td|th)>\s*<td.*?>\s*(.*?)\s*<\/td>/gi
        let match
        const results = []

        while ((match = rowRegex.exec(html)) !== null) {
            const monthRaw = match[1]
            const valueRaw = match[2]
            
            const monthName = stripHtml(monthRaw)
            const valueStr = stripHtml(valueRaw)

            // Buscar el mes en el mapa (ignorando mayúsculas/minúsculas)
            const matchedMonth = Object.keys(MONTH_MAP).find(m => m.toLowerCase() === monthName.toLowerCase())

            if (matchedMonth) {
                // Limpiar el valor: quitar puntos de miles y espacios, cambiar coma decimal por punto si existe
                const cleanValue = valueStr.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
                const value = parseFloat(cleanValue)
                
                if (!isNaN(value) && value > 0) {
                    results.push({
                        anho: year,
                        mes: MONTH_MAP[matchedMonth],
                        monto: value
                    })
                }
            }
        }

        if (results.length === 0) {
            return { error: `No se encontraron datos de UTM en la página del SII para el año ${year}.` }
        }

        // Guardar en base de datos (Upsert)
        for (const item of results) {
            await prisma.uTM.upsert({
                where: {
                    anho_mes: {
                        anho: item.anho,
                        mes: item.mes
                    }
                },
                update: { monto: item.monto },
                create: {
                    anho: item.anho,
                    mes: item.mes,
                    monto: item.monto
                }
            })
        }

        revalidatePath('/dashboard/mantenedor/multas/utm')
        return { success: true, count: results.length }
    } catch (e) {
        console.error("Error syncing UTM from SII:", e)
        return { error: 'Ocurrió un error al sincronizar con el SII.' }
    }
}
