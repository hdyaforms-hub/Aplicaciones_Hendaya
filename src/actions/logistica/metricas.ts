'use server'

import { rawPrisma } from '@/lib/prisma'

export async function getMetricasDespacho(bodegaId?: string, fecha?: string) {
    try {
        const targetFecha = fecha || new Date().toISOString().slice(0, 10)
        const where: any = { fechaRuta: targetFecha }
        if (bodegaId && bodegaId !== 'ALL') {
            where.bodegaId = bodegaId
        }

        const rutasHoy = await rawPrisma.logRuta.findMany({
            where,
            include: { anden: true }
        })

        const totalHoy = rutasHoy.length
        const despachadas = rutasHoy.filter(r => r.estado === 'DESPACHADA')
        const enProceso = rutasHoy.filter(r => r.estado === 'EN_ANDEN' || r.estado === 'EN_PROCESO')
        const enPorton = rutasHoy.filter(r => r.estado === 'EN_PORTON')
        const programadas = rutasHoy.filter(r => r.estado === 'PROGRAMADA' || r.estado === 'NOTIFICADA')

        // Cálculo de tiempos
        let tiempoEsperaPortonTotalMin = 0
        let countPorton = 0

        let tiempoAndenTotalMin = 0
        let countAnden = 0
        let demorasAndenCount = 0

        for (const r of rutasHoy) {
            // Espera en portón: desde llegada a portón hasta entrada a andén
            if (r.horaLlegadaPorton && r.horaEntradaAnden) {
                const diffMin = Math.floor(
                    (new Date(r.horaEntradaAnden).getTime() - new Date(r.horaLlegadaPorton).getTime()) / 60000
                )
                if (diffMin >= 0) {
                    tiempoEsperaPortonTotalMin += diffMin
                    countPorton++
                }
            }

            // Permanencia en andén: desde entrada hasta salida
            if (r.horaEntradaAnden && r.horaSalidaAnden) {
                const diffMin = Math.floor(
                    (new Date(r.horaSalidaAnden).getTime() - new Date(r.horaEntradaAnden).getTime()) / 60000
                )
                if (diffMin >= 0) {
                    tiempoAndenTotalMin += diffMin
                    countAnden++
                    if (diffMin > 45) {
                        demorasAndenCount++
                    }
                }
            }
        }

        const promEsperaPorton = countPorton > 0 ? Math.round(tiempoEsperaPortonTotalMin / countPorton) : 0
        const promPermanenciaAnden = countAnden > 0 ? Math.round(tiempoAndenTotalMin / countAnden) : 0
        const tasaCumplimiento =
            countAnden > 0 ? Math.round(((countAnden - demorasAndenCount) / countAnden) * 100) : 100

        // Rotación por Andén
        const rotacionAndenesMap: Record<string, { codigo: string; nombre: string; total: number }> = {}
        const andenesDB = await rawPrisma.logAnden.findMany({
            where: bodegaId && bodegaId !== 'ALL' ? { bodegaId } : {},
            orderBy: { orden: 'asc' }
        })

        for (const a of andenesDB) {
            rotacionAndenesMap[a.id] = { codigo: a.codigo, nombre: a.nombre, total: 0 }
        }

        for (const r of despachadas) {
            if (r.andenId && rotacionAndenesMap[r.andenId]) {
                rotacionAndenesMap[r.andenId].total++
            }
        }

        // Distribución Horaria (06:00 a 20:00)
        const horasDistribucion: Record<string, number> = {}
        for (let h = 6; h <= 20; h++) {
            const hKey = `${String(h).padStart(2, '0')}:00`
            horasDistribucion[hKey] = 0
        }

        for (const r of despachadas) {
            if (r.horaSalidaAnden) {
                const h = new Date(r.horaSalidaAnden).getHours()
                const hKey = `${String(h).padStart(2, '0')}:00`
                if (horasDistribucion[hKey] !== undefined) {
                    horasDistribucion[hKey]++
                }
            }
        }

        return {
            success: true,
            kpis: {
                totalHoy,
                despachadas: despachadas.length,
                enProceso: enProceso.length,
                enPorton: enPorton.length,
                programadas: programadas.length,
                promEsperaPorton,
                promPermanenciaAnden,
                tasaCumplimiento,
                demorasAndenCount
            },
            rotacionAndenes: Object.values(rotacionAndenesMap),
            distribucionHoraria: Object.entries(horasDistribucion).map(([hora, total]) => ({ hora, total }))
        }
    } catch (error: any) {
        console.error('Error calculando métricas:', error)
        return { success: false, error: error?.message }
    }
}
