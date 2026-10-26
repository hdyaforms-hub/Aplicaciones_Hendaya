'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type MinutaData = {
    numeroMinuta: string
    licitacion: string
    numeroPrograma: string
    programa: string
    numeroCocina: number
    cocina: string
    dia: number
    mes: number
    anio: number
    numeroPreparacion: number | string | bigint
    sucid: string
    codigoServicio: string
    nombreServicio: string
    codigoEnlace: number
    nombreEnlace: string
}

const MESES_NOMBRES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export type PeriodoMinuta = {
    licitacion: string
    anio: number
    mes: number
}

/**
 * Verificación ultraligera: recibe solo la lista de períodos únicos (1 o pocos objetos)
 * evitando enviar decenas de miles de filas por la red.
 */
export async function checkMinutasPeriodsExists(periods: PeriodoMinuta[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!periods || periods.length === 0) {
        return { error: 'No se detectaron períodos válidos en los datos.' }
    }

    try {
        const existingPeriods: string[] = []
        for (const item of periods) {
            const count = await prisma.minutas.count({
                where: {
                    licitacion: String(item.licitacion).trim(),
                    anio: Number(item.anio),
                    mes: Number(item.mes)
                }
            })
            if (count > 0) {
                const mesNombre = MESES_NOMBRES[Number(item.mes) - 1] || `Mes ${item.mes}`
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
    } catch (error: any) {
        console.error('Error verificando períodos de minutas:', error)
        return { error: 'Error al verificar existencia de períodos.' }
    }
}

/**
 * Limpia únicamente los registros correspondientes a los períodos especificados antes de cargar.
 */
export async function clearMinutasPeriods(periods: PeriodoMinuta[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!periods || periods.length === 0) {
        return { success: true, count: 0 }
    }

    try {
        let totalDeleted = 0
        for (const item of periods) {
            const deleted = await prisma.minutas.deleteMany({
                where: {
                    licitacion: String(item.licitacion).trim(),
                    anio: Number(item.anio),
                    mes: Number(item.mes)
                }
            })
            totalDeleted += deleted.count
        }

        return { success: true, count: totalDeleted }
    } catch (error: any) {
        console.error('Error limpiando períodos de minutas:', error)
        return { error: 'Error al limpiar registros existentes de minutas.' }
    }
}

/**
 * Inserta un lote de registros (chunk) de forma rápida y segura sin exceder límites de payload ni timeout.
 */
export async function uploadMinutasChunk(chunk: any[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!chunk || chunk.length === 0) {
        return { success: true, count: 0 }
    }

    try {
        const dataToInsert = chunk.map((d: any) => {
            let prepBigInt = BigInt(0)
            try {
                const prepVal = d.numeroPreparacion ?? d.NumeroPreparacion ?? 0
                const prepStr = String(prepVal).replace(/\D/g, '')
                if (prepStr) prepBigInt = BigInt(prepStr)
            } catch {
                prepBigInt = BigInt(0)
            }

            return {
                numeroMinuta: String(d.numeroMinuta ?? d.NumeroMinuta ?? '').trim().substring(0, 50),
                licitacion: String(d.licitacion ?? d.Licitacion ?? '').trim().substring(0, 10),
                numeroPrograma: String(d.numeroPrograma ?? d.NumeroPrograma ?? '').trim().substring(0, 7),
                programa: String(d.programa ?? d.Programa ?? '').trim().substring(0, 150),
                numeroCocina: Number(d.numeroCocina ?? d.NumeroCocina) || 0,
                cocina: String(d.cocina ?? d.Cocina ?? '').trim().substring(0, 150),
                dia: Number(d.dia ?? d.Dia) || 0,
                mes: Number(d.mes ?? d.Mes) || 0,
                anio: Number(d.anio ?? d.Año ?? d.Ano) || 0,
                numeroPreparacion: prepBigInt,
                sucid: String(d.sucid ?? d.SUCID ?? '').trim().substring(0, 15),
                codigoServicio: String(d.codigoServicio ?? d.CodigoServicio ?? '').trim().substring(0, 10),
                nombreServicio: String(d.nombreServicio ?? d.NombreServicio ?? '').trim().substring(0, 100),
                codigoEnlace: Number(d.codigoEnlace ?? d.CodigoEnlace) || 0,
                nombreEnlace: String(d.nombreEnlace ?? d.NombreEnlace ?? '').trim().substring(0, 150),
            }
        })

        await prisma.minutas.createMany({
            data: dataToInsert
        })

        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error insertando lote de minutas:', error)
        return { error: `Error en BD al guardar lote: ${error.message || 'Error desconocido'}` }
    }
}

/**
 * Finaliza la carga masiva revalidando la caché del dashboard.
 */
export async function finishMinutasUpload() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error finalizando carga de minutas:', error)
        return { error: 'Error al revalidar datos.' }
    }
}

export async function checkMinutasExists(data: MinutaData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    if (!data || data.length === 0) {
        return { error: 'El archivo está vacío o tiene formato incorrecto' }
    }

    // Obtenemos los períodos únicos (licitación, año, mes) que se están intentando cargar
    const periodMap = new Map<string, { licitacion: string; anio: number; mes: number }>()
    for (const d of data as any[]) {
        const lic = String(d.licitacion || d.Licitacion || '').trim()
        const anio = Number(d.anio || d.Año || d.Ano || 0)
        const mes = Number(d.mes || d.Mes || 0)
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

    return checkMinutasPeriodsExists(Array.from(periodMap.values()))
}

export async function uploadMinutasData(data: MinutaData[], overwrite: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        if (overwrite) {
            // Obtenemos los períodos únicos (licitacion, anio, mes) para borrar únicamente ese período
            const periodMap = new Map<string, { licitacion: string; anio: number; mes: number }>()
            for (const d of data as any[]) {
                const lic = String(d.licitacion || d.Licitacion || '').trim()
                const anio = Number(d.anio || d.Año || d.Ano || 0)
                const mes = Number(d.mes || d.Mes || 0)
                if (lic && anio > 0 && mes > 0) {
                    const key = `${lic}___${anio}___${mes}`
                    if (!periodMap.has(key)) {
                        periodMap.set(key, { licitacion: lic, anio, mes })
                    }
                }
            }

            // Borrar únicamente los registros del período/año/mes específico que se está reemplazando
            for (const item of periodMap.values()) {
                await prisma.minutas.deleteMany({
                    where: { 
                        licitacion: item.licitacion,
                        anio: item.anio,
                        mes: item.mes
                    }
                })
            }
        } else {
            // Si no se permite sobrescribir, validamos que NINGUNO exista
            const check = await checkMinutasExists(data)
            if (check.exists) {
                return { error: check.message || 'Ya existen registros en la base de datos para este período.' }
            }
        }

        const dataToInsert = data.map((d: any) => ({
            numeroMinuta: String(d.NumeroMinuta || d.numeroMinuta || ''),
            licitacion: String(d.Licitacion || d.licitacion || ''),
            numeroPrograma: String(d.NumeroPrograma || d.numeroPrograma || ''),
            programa: String(d.Programa || d.programa || ''),
            numeroCocina: Number(d.NumeroCocina || d.numeroCocina) || 0,
            cocina: String(d.Cocina || d.cocina || ''),
            dia: Number(d.Dia || d.dia) || 0,
            mes: Number(d.Mes || d.mes) || 0,
            anio: Number(d.Año || d.anio) || 0,
            numeroPreparacion: (d.NumeroPreparacion || d.numeroPreparacion) ? BigInt(d.NumeroPreparacion || d.numeroPreparacion) : BigInt(0),
            sucid: String(d.sucid || d.sucid || ''),
            codigoServicio: String(d.CodigoServicio || d.codigoServicio || ''),
            nombreServicio: String(d.NombreServicio || d.nombreServicio || ''),
            codigoEnlace: Number(d.CodigoEnlace || d.codigoEnlace) || 0,
            nombreEnlace: String(d.NombreEnlace || d.nombreEnlace || ''),
        }))

        // Insertar en trozos de 1000
        const chunkSize = 1000
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
            const chunk = dataToInsert.slice(i, i + chunkSize)
            await prisma.minutas.createMany({
                data: chunk
            })
        }

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true, count: dataToInsert.length }
    } catch (error: any) {
        console.error('Error detallado insertando datos Minutas:', error)
        if (error.code === 'P2002') return { error: 'Error de duplicidad en los datos (Restricción de BD).' }
        return { error: `Error DB: ${error.message || 'Ocurrió un error al guardar los registros.'}` }
    }
}

export async function updateMinutaEntries(entries: { id: string, numeroPreparacion: number | string | bigint, codigoEnlace: number, nombreEnlace: string }[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        for (const e of entries) {
            await prisma.minutas.update({
                where: { id: e.id },
                data: {
                    numeroPreparacion: BigInt(e.numeroPreparacion),
                    codigoEnlace: Number(e.codigoEnlace),
                    nombreEnlace: e.nombreEnlace
                }
            })
        }

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error actualizando entradas de minuta:', error)
        return { error: 'Error al actualizar los registros.' }
    }
}

export async function createMinutaEntry(data: any) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        // Validar si ya existe el registro exacto
        const existing = await prisma.minutas.findFirst({
            where: {
                licitacion: data.licitacion,
                numeroMinuta: data.numeroMinuta,
                dia: Number(data.dia),
                mes: Number(data.mes),
                anio: Number(data.anio),
                numeroPreparacion: BigInt(data.numeroPreparacion),
                sucid: data.sucid,
                codigoServicio: data.codigoServicio
            }
        })

        if (existing) {
            return { error: 'Esta combinación de minuta, día, preparación y servicio ya existe para este establecimiento.' }
        }

        await prisma.minutas.create({
            data: {
                ...data,
                numeroPreparacion: BigInt(data.numeroPreparacion),
                numeroCocina: Number(data.numeroCocina),
                dia: Number(data.dia),
                mes: Number(data.mes),
                anio: Number(data.anio),
                codigoEnlace: Number(data.codigoEnlace)
            }
        })

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error creando entrada de minuta:', error)
        return { error: 'Error al crear el registro.' }
    }
}


export async function deleteMinutaEntry(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        await prisma.minutas.delete({
            where: { id }
        })

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true }
    } catch (error: any) {
        console.error('Error eliminando entrada de minuta:', error)
        return { error: 'Error al eliminar el registro.' }
    }
}
export async function deleteMassiveMinutas(mes: number, anio: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_minutas')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        const deleted = await prisma.minutas.deleteMany({
            where: {
                mes: mes,
                anio: anio
            }
        })

        revalidatePath('/dashboard/calculadora/minutas')
        return { success: true, count: deleted.count }
    } catch (error: any) {
        console.error('Error en eliminación masiva de minutas:', error)
        return { error: 'Error al realizar la eliminación masiva.' }
    }
}
