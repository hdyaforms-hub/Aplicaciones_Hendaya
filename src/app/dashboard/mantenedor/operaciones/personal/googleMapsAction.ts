'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const PATH = '/dashboard/mantenedor/operaciones/personal'
const SAFETY_LIMIT = 30000

// Helper to check if current user is Administrador
async function isAdministrator() {
    const session = await getSession()
    return session?.user?.role?.name === 'Administrador'
}

// ------ GET CURRENT USAGE ------
export async function getConsumoActual() {
    try {
        const now = new Date()
        const mes = now.getMonth() + 1
        const anio = now.getFullYear()

        const record = await prisma.consumoApiGoogle.findUnique({
            where: { mes_anio: { mes, anio } }
        })
        return {
            cantidad: record?.cantidad || 0,
            tope: SAFETY_LIMIT,
            mes,
            anio
        }
    } catch (e) {
        console.error('Error al obtener consumo actual:', e)
        return { cantidad: 0, tope: SAFETY_LIMIT, mes: new Date().getMonth() + 1, anio: new Date().getFullYear() }
    }
}

// ------ RESET USAGE (FOR TESTING OR RENEWAL) ------
export async function resetConsumoMensual() {
    if (!await isAdministrator()) {
        return { error: 'No tienes permisos de Administrador para esta acción.' }
    }

    try {
        const now = new Date()
        const mes = now.getMonth() + 1
        const anio = now.getFullYear()

        await prisma.consumoApiGoogle.upsert({
            where: { mes_anio: { mes, anio } },
            create: { mes, anio, cantidad: 0 },
            update: { cantidad: 0 }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e) {
        console.error('Error al reiniciar consumo:', e)
        return { error: 'Error al reiniciar el contador de consumo.' }
    }
}

// ------ SINGLE PAIR CALCULATION ------
export async function calculateSingleDistance(sucursalNombre: string, rbd: number, force = false) {
    if (!await isAdministrator()) {
        return { error: 'Acceso Denegado. Solo el Administrador puede realizar cálculos.' }
    }

    try {
        // Find cached record
        const cached = await prisma.distanciaCache.findUnique({
            where: { sucursal_rbd: { sucursal: sucursalNombre, rbd } }
        })

        // If cached and successful, and not forced, return it
        if (cached && cached.distanciaKm >= 0 && !force) {
            return { success: true, cached: true, data: cached }
        }

        // Fetch physical addresses
        const sucursal = await prisma.sucursal.findUnique({
            where: { nombre: sucursalNombre }
        })

        const colegios = await prisma.colegios.findMany({
            where: { colRBD: rbd }
        })
        const colegio = colegios[0]

        if (!sucursal) {
            return { error: `No se encontró la sucursal "${sucursalNombre}".` }
        }
        if (!colegio) {
            return { error: `No se encontró el colegio con RBD ${rbd}.` }
        }

        const addressSuc = sucursal.direccion && sucursal.comuna
            ? `${sucursal.direccion}, ${sucursal.comuna}, ${sucursal.region || 'Chile'}`
            : null

        const addressCol = colegio.direccionEstablecimiento && colegio.comuna
            ? `${colegio.direccionEstablecimiento}, ${colegio.comuna}, Chile`
            : null

        if (!addressSuc) {
            // Save as geocoding error (-1) to represent address missing
            await saveToCache(sucursalNombre, rbd, -1, -1)
            return { error: `La sucursal "${sucursalNombre}" no tiene una dirección válida ingresada.` }
        }

        if (!addressCol) {
            // Save as geocoding error (-1) to represent address missing
            await saveToCache(sucursalNombre, rbd, -1, -1)
            return { error: `El establecimiento (RBD ${rbd}) no tiene una dirección válida ingresada.` }
        }

        // Check safety limits
        const now = new Date()
        const mes = now.getMonth() + 1
        const anio = now.getFullYear()

        const usageRecord = await prisma.consumoApiGoogle.findUnique({
            where: { mes_anio: { mes, anio } }
        })
        const currentCount = usageRecord?.cantidad || 0

        if (currentCount >= SAFETY_LIMIT) {
            return {
                error: 'Límite de consultas mensuales de rutas alcanzado. No se podrá calcular la distancia para nuevos colegios hasta la próxima fecha de renovación.',
                limitExceeded: true
            }
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY
        let distanciaKm = 0
        let duracionMin = 0
        let isMock = false

        if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_API_KEY') {
            // Simulated calculation (Stable mock based on name hashes)
            isMock = true
            const seed = sucursalNombre.length + rbd
            distanciaKm = Math.round((8 + (seed % 42) + (rbd % 5)) * 10) / 10
            duracionMin = Math.round(distanciaKm * 1.5 + (seed % 10))
        } else {
            // Real Google Maps API Call
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(addressSuc)}&destinations=${encodeURIComponent(addressCol)}&key=${apiKey}`
            const response = await fetch(url)
            const json = await response.json()

            if (json.status === 'OK' && json.rows?.[0]?.elements?.[0]?.status === 'OK') {
                const element = json.rows[0].elements[0]
                const meters = element.distance.value
                const seconds = element.duration.value

                distanciaKm = Math.round((meters / 1000) * 10) / 10
                duracionMin = Math.round(seconds / 60)
            } else {
                console.warn(`Google Maps API error or no route:`, json)
                // Save geocoding error
                await saveToCache(sucursalNombre, rbd, -1, -1)
                // Increment API count for the attempt
                await incrementApiCount(mes, anio)
                return { error: 'No se pudo trazar una ruta por carretera válida entre la sucursal y el establecimiento.' }
            }
        }

        // Cache the successful result
        const saved = await saveToCache(sucursalNombre, rbd, distanciaKm, duracionMin)

        // Increment monthly counter
        await incrementApiCount(mes, anio)

        revalidatePath(PATH)
        return { success: true, data: saved, isMock }
    } catch (e: any) {
        console.error('Error al calcular distancia:', e)
        return { error: e.message || 'Error inesperado al calcular la distancia.' }
    }
}

// ------ PROCESS PENDING BATCH ------
export async function calculatePendingDistances() {
    if (!await isAdministrator()) {
        return { error: 'Acceso Denegado. Solo el Administrador puede realizar cálculos.' }
    }

    try {
        // 1. Get all assigned RBDs from active supervisors
        const supervisors = await prisma.supervisor.findMany({
            where: { vigente: true },
            include: {
                rbdsAuditar: true,
                jefeOperacion: {
                    include: { jefeZonal: { include: { sucursales: { include: { sucursal: true } } } } }
                },
                jefeZonal: {
                    include: { sucursales: { include: { sucursal: true } } }
                }
            }
        })

        // 2. Map all unique (sucursalName, rbd) that need calculation
        const uniquePairsMap = new Map<string, { sucursal: string; rbd: number }>()

        for (const s of supervisors) {
            const zonalObj = s.jefeOperacion?.jefeZonal || s.jefeZonal
            const firstSucursalName = zonalObj?.sucursales?.[0]?.sucursal?.nombre || null

            if (!s.rbdsAuditar || s.rbdsAuditar.length === 0) continue

            for (const r of s.rbdsAuditar) {
                // Find school to get its assigned sucursal
                const colegios = await prisma.colegios.findMany({
                    where: { colRBD: r.rbd }
                })
                const school = colegios[0]
                const sucursalName = school ? school.sucursal : firstSucursalName

                if (!sucursalName) continue

                const key = `${sucursalName}-${r.rbd}`
                uniquePairsMap.set(key, { sucursal: sucursalName, rbd: r.rbd })
            }
        }

        const pairs = Array.from(uniquePairsMap.values())

        // 3. Find which ones are not calculated yet or failed previously (-1)
        const cachedRecords = await prisma.distanciaCache.findMany()
        const cachedSet = new Set(cachedRecords.filter(c => c.distanciaKm >= 0).map(c => `${c.sucursal}-${c.rbd}`))

        const pendingPairs = pairs.filter(p => !cachedSet.has(`${p.sucursal}-${p.rbd}`))

        if (pendingPairs.length === 0) {
            return { success: true, message: 'Todas las distancias de supervisores activos ya están calculadas.', processed: 0 }
        }

        let successCount = 0
        let errorCount = 0
        let limitHit = false

        for (const pair of pendingPairs) {
            const res = await calculateSingleDistance(pair.sucursal, pair.rbd)
            if (res.success) {
                successCount++
            } else {
                errorCount++
                if (res.limitExceeded) {
                    limitHit = true
                    break
                }
            }
        }

        revalidatePath(PATH)
        return {
            success: true,
            processed: successCount,
            errors: errorCount,
            limitHit,
            message: limitHit 
                ? `Cálculo parcial completado (${successCount} procesados). Se detuvo al alcanzar el límite mensual de seguridad.` 
                : `Se calcularon ${successCount} rutas correctamente. ${errorCount > 0 ? `Hubo ${errorCount} errores por direcciones incompletas.` : ''}`
        }
    } catch (e: any) {
        console.error('Error en procesamiento en lotes:', e)
        return { error: e.message || 'Error general al procesar distancias.' }
    }
}

// ------ UTILITIES ------
async function saveToCache(sucursal: string, rbd: number, distanciaKm: number, duracionMin: number) {
    return await prisma.distanciaCache.upsert({
        where: { sucursal_rbd: { sucursal, rbd } },
        create: { sucursal, rbd, distanciaKm, duracionMin },
        update: { distanciaKm, duracionMin }
    })
}

async function incrementApiCount(mes: number, anio: number) {
    await prisma.consumoApiGoogle.upsert({
        where: { mes_anio: { mes, anio } },
        create: { mes, anio, cantidad: 1 },
        update: { cantidad: { increment: 1 } }
    })
}

export async function getDistanciasCache() {
    try {
        return await prisma.distanciaCache.findMany()
    } catch (e) {
        console.error('Error al obtener distancias de caché:', e)
        return []
    }
}

