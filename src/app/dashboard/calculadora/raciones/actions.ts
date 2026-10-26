'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type RacionData = {
    licitacion: string
    numeroServicio: string
    servicio: string
    numeroCocina: number
    numeroArea: string
    numeroEnlace: number
    numeroLocacion: string
    locacion: string
    numeroPrograma: string
    programa: string
    mes: number
    anio: number
    fecha: string
    estadoRacion: number
    numeroBeneficiario: number
    beneficiario: string
    cantidad: number
    rbd: number
    ut: number
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export async function checkRacionesExists(data: RacionData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Obtenemos los períodos únicos (licitación, año, mes) que se están intentando cargar
    const periodMap = new Map<string, { licitacion: string; anio: number; mes: number }>()
    for (const d of data) {
        const lic = String(d.licitacion || '').trim()
        const anio = Number(d.anio)
        const mes = Number(d.mes)
        if (lic && anio > 0 && mes > 0) {
            const key = `${lic}___${anio}___${mes}`
            if (!periodMap.has(key)) {
                periodMap.set(key, { licitacion: lic, anio, mes })
            }
        }
    }

    if (periodMap.size === 0) {
        return { error: 'No se detectaron registros con licitación, año y mes válidos.' }
    }

    const existingPeriods: string[] = []
    for (const item of periodMap.values()) {
        const count = await prisma.raciones.count({
            where: {
                licitacion: item.licitacion,
                anio: item.anio,
                mes: item.mes
            }
        })
        if (count > 0) {
            const mesNombre = MESES_NOMBRES[item.mes - 1] || `Mes ${item.mes}`
            existingPeriods.push(`${mesNombre} ${item.anio} (Licitación: ${item.licitacion}, ${count.toLocaleString('es-CL')} registros existentes)`)
        }
    }

    if (existingPeriods.length > 0) {
        return { 
            exists: true, 
            message: `Ya existen registros en la base de datos para los siguientes períodos:\n• ${existingPeriods.join('\n• ')}` 
        }
    }

    return { exists: false }
}

export async function uploadRacionesData(data: RacionData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'No hay datos válidos para procesar.' }
    }

    try {
        // Extraer los períodos únicos (licitación, año, mes) involucrados en este lote
        const periodMap = new Map<string, { licitacion: string; anio: number; mes: number }>()
        for (const d of data) {
            const lic = String(d.licitacion || '').trim()
            const anio = Number(d.anio)
            const mes = Number(d.mes)
            if (lic && anio > 0 && mes > 0) {
                const key = `${lic}___${anio}___${mes}`
                if (!periodMap.has(key)) {
                    periodMap.set(key, { licitacion: lic, anio, mes })
                }
            }
        }

        if (periodMap.size === 0) {
            return { error: 'No se detectaron períodos (licitación, año y mes) válidos en los datos.' }
        }

        if (overwrite) {
            // Eliminar ÚNICAMENTE los registros que coincidan exactamente con la licitación, año y mes que se cargan
            // Esto garantiza que períodos anteriores (ej: abril) permanezcan completamente intactos
            for (const item of periodMap.values()) {
                await prisma.raciones.deleteMany({
                    where: { 
                        licitacion: item.licitacion,
                        anio: item.anio,
                        mes: item.mes
                    }
                })
            }
        } else {
            const check = await checkRacionesExists(data)
            if (check.exists) {
                return { error: check.message || 'Ya existen registros en la base de datos para este período.' }
            }
        }

        const dataToInsert = data.map(d => ({
            licitacion: String(d.licitacion || '').trim().substring(0, 10),
            numeroServicio: String(d.numeroServicio || '').trim().substring(0, 10),
            servicio: String(d.servicio || '').trim().substring(0, 100),
            numeroCocina: Number(d.numeroCocina) || 0,
            numeroArea: String(d.numeroArea || '').trim().substring(0, 5),
            numeroEnlace: Number(d.numeroEnlace) || 0,
            numeroLocacion: String(d.numeroLocacion || '').trim().substring(0, 5),
            locacion: String(d.locacion || '').trim().substring(0, 150),
            numeroPrograma: String(d.numeroPrograma || '').trim().substring(0, 7),
            programa: String(d.programa || '').trim().substring(0, 150),
            mes: Number(d.mes),
            anio: Number(d.anio),
            fecha: new Date(d.fecha),
            estadoRacion: Number(d.estadoRacion) || 0,
            numeroBeneficiario: Number(d.numeroBeneficiario) || 0,
            beneficiario: String(d.beneficiario || '').trim().substring(0, 50),
            cantidad: Number(d.cantidad) || 0,
            rbd: Number(d.rbd) || 0,
            ut: Number(d.ut) || 0
        }))

        // Insertar por lotes de 1000 para evitar límites de parámetros de PostgreSQL y optimizar memoria
        const chunkSize = 1000
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
            const chunk = dataToInsert.slice(i, i + chunkSize)
            await prisma.raciones.createMany({
                data: chunk
            })
        }

        revalidatePath('/dashboard/calculadora/raciones')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando datos Raciones:', error)
        return { error: `Ocurrió un error al guardar los registros en la base de datos: ${error.message || 'Error desconocido'}` }
    }
}

export async function deleteMassiveRaciones(mes: number, anio: number, licitacion?: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const deleted = await prisma.raciones.deleteMany({
            where: {
                mes: Number(mes),
                anio: Number(anio),
                ...(licitacion ? { licitacion: String(licitacion) } : {})
            }
        })

        revalidatePath('/dashboard/calculadora/raciones')
        return { success: true, count: deleted.count }
    } catch (error: any) {
        console.error('Error en eliminación masiva de raciones:', error)
        return { error: 'Error al realizar la eliminación de raciones.' }
    }
}

export async function updateRacion(id: string, cantidad: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_raciones')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.raciones.update({
            where: { id },
            data: { cantidad: Number(cantidad) }
        })
        revalidatePath('/dashboard/calculadora/raciones')
        return { success: true }
    } catch (error) {
        console.error('Error actualizando ración:', error)
        return { error: 'No se pudo actualizar la cantidad de la ración.' }
    }
}
