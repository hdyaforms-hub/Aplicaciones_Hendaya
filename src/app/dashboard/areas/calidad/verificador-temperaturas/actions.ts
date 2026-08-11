'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { getCalendarWeeksForMonth } from './calendarUtils'

export interface RegistroListItem {
    idRegistro: number
    tipoEntidad: string
    idEntidad: string
    nombreEntidad: string
    anio: number
    monitorResponsable: string
    tipoCamara: string
    descripcionCamaras: string | null
    fechaCreacion: Date
    usuarioCreacion: string
    cumplimientoGeneral: number
    totalDatos: number
    fechaRegistro: Date | null
    verificacionesDiarias?: any[]
    verificacionesSemanales?: any[]
    detalles?: {
        numeroCorrelativo?: number
        mes: number
        dia: number
        tipoProducto?: string
        nombreProducto?: string | null
        numeroCamara?: number
        temperatura?: number | null
    }[]
}

export async function getRegistrosList(userSucursalIds?: string[], isUserAdmin: boolean = false): Promise<RegistroListItem[]> {
    const whereCondition = (!isUserAdmin && userSucursalIds && userSucursalIds.length > 0)
        ? { idEntidad: { in: userSucursalIds } }
        : {}

    const registros = await prisma.vTRegistroCabecera.findMany({
        where: whereCondition,
        include: {
            configuraciones: true,
            detalles: true,
            verificacionesDiarias: true,
            verificacionesSemanales: true
        },
        orderBy: { fechaCreacion: 'desc' }
    })

    return registros.map(r => {
        // Mapa de T° máxima por mes y número de cámara en el mes
        const configMap = new Map<string, number>()
        r.configuraciones.forEach(c => {
            configMap.set(`${c.mes}_${c.numeroCamaraMes}`, c.temperaturaMaxima ?? (r.tipoCamara === 'Congelado' ? -18.0 : 5.0))
        })

        let total = 0
        let fueraDeRango = 0

        r.detalles.forEach(d => {
            if (d.temperatura !== null && d.temperatura !== undefined) {
                total++
                const maxTemp = configMap.get(`${d.mes}_${d.numeroCamara}`) ?? (r.tipoCamara === 'Congelado' ? -18.0 : 5.0)
                if (r.tipoCamara === 'Refrigerado') {
                    if (d.temperatura < 0.0 || d.temperatura > maxTemp) {
                        fueraDeRango++
                    }
                } else {
                    if (d.temperatura > maxTemp) {
                        fueraDeRango++
                    }
                }
            }
        })

        const cumplimiento = total > 0 ? ((total - fueraDeRango) / total) * 100 : 100

        return {
            idRegistro: r.idRegistro,
            tipoEntidad: r.tipoEntidad,
            idEntidad: r.idEntidad,
            nombreEntidad: r.nombreEntidad,
            anio: r.anio,
            fechaRegistro: r.fechaRegistro,
            monitorResponsable: r.monitorResponsable,
            tipoCamara: r.tipoCamara,
            descripcionCamaras: r.descripcionCamaras,
            fechaCreacion: r.fechaCreacion,
            usuarioCreacion: r.usuarioCreacion,
            cumplimientoGeneral: Math.round(cumplimiento * 10) / 10,
            totalDatos: total,
            verificacionesDiarias: r.verificacionesDiarias,
            verificacionesSemanales: r.verificacionesSemanales,
            detalles: r.detalles.map(d => ({
                numeroCorrelativo: d.numeroCorrelativo,
                mes: d.mes,
                dia: d.dia,
                tipoProducto: d.tipoProducto,
                nombreProducto: d.nombreProducto,
                numeroCamara: d.numeroCamara,
                temperatura: d.temperatura
            }))
        }
    })
}

export async function getSucursalesConLicitaciones(userSucursalIds?: string[], isUserAdmin: boolean = false) {
    const whereCondition = (!isUserAdmin && userSucursalIds && userSucursalIds.length > 0)
        ? { id: { in: userSucursalIds } }
        : {}

    const sucursales = await prisma.sucursal.findMany({
        where: whereCondition,
        orderBy: { nombre: 'asc' },
        include: {
            uts: {
                include: {
                    licitacion: true
                }
            }
        }
    })

    return sucursales.map(s => {
        const licsMap = new Map<number, string>()
        s.uts.forEach(u => {
            if (u.licitacion) {
                licsMap.set(u.licId, `Licitación N° ${u.licId}${u.licitacion.licitacionHomologada ? ` - ${u.licitacion.licitacionHomologada}` : ''}`)
            }
        })
        const licsList = Array.from(licsMap.values())
        return {
            id: s.id,
            nombre: s.nombre,
            licitacionesText: licsList.length > 0 ? licsList.join(', ') : 'Sin Licitación asociada'
        }
    })
}

function deduplicateConfigs<T extends { mes: number; numeroCamaraMes: number }>(configs: T[]): T[] {
    const seen = new Set<string>()
    const result: T[] = []
    for (const c of configs) {
        const key = `${c.mes}_${c.numeroCamaraMes}`
        if (!seen.has(key)) {
            seen.add(key)
            result.push(c)
        }
    }
    return result
}

export async function getRegistroById(idRegistro: number) {
    const registro = await prisma.vTRegistroCabecera.findUnique({
        where: { idRegistro },
        include: {
            configuraciones: {
                include: {
                    camara: true
                }
            },
            detalles: {
                orderBy: [
                    { numeroCorrelativo: 'asc' },
                    { mes: 'asc' },
                    { numeroCamara: 'asc' }
                ]
            },
            verificacionesDiarias: true,
            verificacionesSemanales: true
        }
    })
    if (registro && registro.configuraciones) {
        registro.configuraciones = deduplicateConfigs(registro.configuraciones)
    }
    return registro
}

export async function getRegistroByContext(idEntidad: string, tipoCamara: string, anio: number, mes?: number) {
    const registros = await prisma.vTRegistroCabecera.findMany({
        where: { idEntidad, tipoCamara, anio },
        include: {
            configuraciones: {
                include: {
                    camara: true
                }
            },
            detalles: {
                orderBy: [
                    { numeroCorrelativo: 'asc' },
                    { mes: 'asc' },
                    { numeroCamara: 'asc' }
                ]
            },
            verificacionesDiarias: true,
            verificacionesSemanales: true
        }
    })

    if (registros.length === 0) return null

    let selected = registros[0]
    if (mes !== undefined && mes !== null) {
        const found = registros.find(r => {
            if (!r.fechaRegistro) return false
            const rMonth = new Date(r.fechaRegistro).getUTCMonth() + 1
            return rMonth === mes
        })
        if (found) {
            selected = found
        } else {
            return null
        }
    }

    if (selected && selected.configuraciones) {
        selected.configuraciones = deduplicateConfigs(selected.configuraciones)
    }
    return selected
}

export interface SaveRegistroInput {
    idRegistro?: number
    tipoEntidad?: string
    idEntidad: string
    nombreEntidad: string
    licitacionTexto?: string
    fechaRegistro: string
    anio: number
    mesActivo: number
    monitorResponsable: string
    tipoCamara: 'Refrigerado' | 'Congelado'
    configs: {
        idCamara?: number
        nombreCamara?: string
        mes: number
        numeroCamaraMes: number
        temperaturaMaxima: number
    }[]
    detalles: {
        numeroCorrelativo: number
        dia: number
        tipoProducto: string
        nombreProducto?: string | null
        mes: number
        numeroCamara: number
        temperatura?: number | null
    }[]
}

export async function saveRegistro(data: SaveRegistroInput) {
    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'Usuario no autenticado' }
    }

    try {
        const username = session.user.username || 'desconocido'
        const defaultMaxTemp = data.tipoCamara === 'Congelado' ? -18.0 : 5.0
        const dateObj = new Date(data.fechaRegistro + 'T12:00:00')

        const result = await prisma.$transaction(async (tx) => {
            let cabeceraId = data.idRegistro

            if (cabeceraId) {
                // Actualizar cabecera
                await tx.vTRegistroCabecera.update({
                    where: { idRegistro: cabeceraId },
                    data: {
                        tipoEntidad: 'Sucursal',
                        idEntidad: data.idEntidad,
                        nombreEntidad: data.nombreEntidad,
                        anio: data.anio,
                        fechaRegistro: dateObj,
                        monitorResponsable: data.monitorResponsable,
                        tipoCamara: data.tipoCamara,
                        descripcionCamaras: data.licitacionTexto || null
                    }
                })

                // Limpiar todas las configuraciones de cámara del registro para reinsertar la lista anual completa sin duplicados
                await tx.vTConfiguracionCamara.deleteMany({ where: { idRegistroCabecera: cabeceraId } })
                // Limpiar detalles SOLO del mes activo para actualizar únicamente este período
                await tx.vTRegistroDetalle.deleteMany({ where: { idRegistro: cabeceraId, mes: data.mesActivo } })
            } else {
                // Crear cabecera
                const created = await tx.vTRegistroCabecera.create({
                    data: {
                        tipoEntidad: 'Sucursal',
                        idEntidad: data.idEntidad,
                        nombreEntidad: data.nombreEntidad,
                        anio: data.anio,
                        fechaRegistro: dateObj,
                        monitorResponsable: data.monitorResponsable,
                        tipoCamara: data.tipoCamara,
                        descripcionCamaras: data.licitacionTexto || null,
                        usuarioCreacion: username
                    }
                })
                cabeceraId = created.idRegistro
            }

            // Asegurar que exista una cámara base de catálogo o crear si es necesario
            let camaraBase = await tx.vTCamara.findFirst({
                where: { tipoCamara: data.tipoCamara }
            })
            if (!camaraBase) {
                camaraBase = await tx.vTCamara.create({
                    data: {
                        nombreCamara: `Cámara ${data.tipoCamara} General`,
                        tipoCamara: data.tipoCamara,
                        temperaturaMaxima: defaultMaxTemp,
                        activo: true
                    }
                })
            }

            // Guardar Configuraciones por mes
            if (data.configs.length > 0) {
                await tx.vTConfiguracionCamara.createMany({
                    data: data.configs.map(c => ({
                        idRegistroCabecera: cabeceraId!,
                        idCamara: c.idCamara || camaraBase!.idCamara,
                        mes: c.mes,
                        numeroCamaraMes: c.numeroCamaraMes,
                        nombreCamara: c.nombreCamara,
                        temperaturaMaxima: c.temperaturaMaxima ?? defaultMaxTemp
                    }))
                })
            }

            // Guardar Detalles de Temperatura
            if (data.detalles.length > 0) {
                await tx.vTRegistroDetalle.createMany({
                    data: data.detalles.map(d => ({
                        idRegistro: cabeceraId!,
                        numeroCorrelativo: d.numeroCorrelativo,
                        dia: d.dia,
                        tipoProducto: d.tipoProducto,
                        nombreProducto: d.nombreProducto || null,
                        mes: d.mes,
                        numeroCamara: d.numeroCamara,
                        temperatura: d.temperatura !== undefined && d.temperatura !== null && !isNaN(d.temperatura) ? d.temperatura : null,
                        usuarioRegistro: username
                    }))
                })
            }

            return cabeceraId
        })

        await logAuditAction({
            username: session.user.username || 'desconocido',
            userId: session.user.id || null,
            action: data.idRegistro ? 'EDITAR_VERIFICADOR_TEMPERATURA' : 'CREAR_VERIFICADOR_TEMPERATURA',
            modulo: 'ÁREAS -> CALIDAD -> VERIFICADOR DE TEMPERATURAS',
            detalle: `${data.idRegistro ? 'Actualizado' : 'Creado'} registro ID ${result} para ${data.nombreEntidad} (${data.anio}) - T° Cámara: ${data.tipoCamara}`
        })

        revalidatePath('/dashboard/areas/calidad/verificador-temperaturas')
        return { success: true, idRegistro: result }
    } catch (error: any) {
        console.error('Error al guardar registro de temperaturas:', error)
        return { success: false, error: error.message || 'Error al guardar el registro' }
    }
}

export async function deleteRegistro(idRegistro: number) {
    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'Usuario no autenticado' }
    }

    try {
        const registro = await prisma.vTRegistroCabecera.findUnique({ where: { idRegistro } })
        if (!registro) return { success: false, error: 'Registro no encontrado' }

        await prisma.vTRegistroCabecera.delete({ where: { idRegistro } })

        await logAuditAction({
            username: session.user.username || 'desconocido',
            userId: session.user.id || null,
            action: 'ELIMINAR_VERIFICADOR_TEMPERATURA',
            modulo: 'ÁREAS -> CALIDAD -> VERIFICADOR DE TEMPERATURAS',
            detalle: `Eliminado registro ID ${idRegistro} (${registro.nombreEntidad} - Año ${registro.anio})`
        })

        revalidatePath('/dashboard/areas/calidad/verificador-temperaturas')
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar registro:', error)
        return { success: false, error: error.message || 'Error al eliminar el registro' }
    }
}

// Catálogos Auxiliares

export async function getCamarasCatalog() {
    return await prisma.vTCamara.findMany({
        where: { activo: true },
        orderBy: { nombreCamara: 'asc' }
    })
}

export async function saveGlobalCamaraConfig(data: {
    tempMaxCongelado: number
    tempMaxRefrigerado: number
}) {
    const session = await getSession()
    if (!session || !session.user) return { success: false, error: 'No autenticado' }

    try {
        const congelado = await prisma.vTCamara.findFirst({ where: { tipoCamara: 'Congelado' } })
        if (congelado) {
            await prisma.vTCamara.update({
                where: { idCamara: congelado.idCamara },
                data: { temperaturaMaxima: data.tempMaxCongelado, nombreCamara: 'Cámara de Congelado' }
            })
        } else {
            await prisma.vTCamara.create({
                data: { nombreCamara: 'Cámara de Congelado', tipoCamara: 'Congelado', temperaturaMaxima: data.tempMaxCongelado, activo: true }
            })
        }

        const refrigerado = await prisma.vTCamara.findFirst({ where: { tipoCamara: 'Refrigerado' } })
        if (refrigerado) {
            await prisma.vTCamara.update({
                where: { idCamara: refrigerado.idCamara },
                data: { temperaturaMaxima: data.tempMaxRefrigerado, nombreCamara: 'Cámara de Refrigerado' }
            })
        } else {
            await prisma.vTCamara.create({
                data: { nombreCamara: 'Cámara de Refrigerado', tipoCamara: 'Refrigerado', temperaturaMaxima: data.tempMaxRefrigerado, activo: true }
            })
        }

        await logAuditAction({
            username: session.user.username || 'desconocido',
            userId: session.user.id || null,
            action: 'CONFIGURAR_CAMARAS_GLOBAL',
            modulo: 'ÁREAS -> CALIDAD -> VERIFICADOR DE TEMPERATURAS',
            detalle: `Configuración global de cámaras actualizada: Congelado (${data.tempMaxCongelado}°C), Refrigerado (${data.tempMaxRefrigerado}°C)`
        })

        revalidatePath('/dashboard/areas/calidad/verificador-temperaturas')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function saveCamaraCatalog(data: { idCamara?: number; nombreCamara: string; tipoCamara: string; temperaturaMaxima: number }) {
    const session = await getSession()
    if (!session || !session.user) return { success: false, error: 'No autenticado' }

    try {
        if (data.idCamara) {
            await prisma.vTCamara.update({
                where: { idCamara: data.idCamara },
                data: {
                    nombreCamara: data.nombreCamara,
                    tipoCamara: data.tipoCamara,
                    temperaturaMaxima: data.temperaturaMaxima
                }
            })
        } else {
            await prisma.vTCamara.create({
                data: {
                    nombreCamara: data.nombreCamara,
                    tipoCamara: data.tipoCamara,
                    temperaturaMaxima: data.temperaturaMaxima
                }
            })
        }
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getProductosCatalog() {
    return await prisma.vTProductoCatalogo.findMany({
        where: { activo: true },
        orderBy: { nombreProducto: 'asc' }
    })
}

export async function saveProductoCatalogo(nombreProducto: string) {
    if (!nombreProducto || !nombreProducto.trim()) return { success: false, error: 'Nombre de producto no válido' }
    
    try {
        const existing = await prisma.vTProductoCatalogo.findFirst({
            where: { nombreProducto: { equals: nombreProducto.trim(), mode: 'insensitive' } }
        })
        if (!existing) {
            await prisma.vTProductoCatalogo.create({
                data: { nombreProducto: nombreProducto.trim(), activo: true }
            })
        }
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function firmarVerificacionDiaria(
    idRegistro: number,
    mes: number,
    dia: number,
    firmaText?: string,
    observaciones?: string,
    accionesCorrectivas?: string
) {
    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autenticado' }
    }

    try {
        const username = session.user.name || session.user.username || 'Usuario'
        const firma = firmaText && firmaText.trim() ? firmaText.trim() : `Firmado por ${username}`

        const res = await prisma.vTVerificacionDiaria.upsert({
            where: {
                idRegistro_mes_dia: { idRegistro, mes, dia }
            },
            create: {
                idRegistro,
                mes,
                dia,
                firmadoPor: username,
                usuarioId: session.user.id || null,
                firma,
                firmado: true,
                observaciones: observaciones?.trim() || null,
                accionesCorrectivas: accionesCorrectivas?.trim() || null,
                fechaVerificacion: new Date()
            },
            update: {
                firmadoPor: username,
                usuarioId: session.user.id || null,
                firma,
                firmado: true,
                observaciones: observaciones?.trim() || null,
                accionesCorrectivas: accionesCorrectivas?.trim() || null,
                fechaVerificacion: new Date()
            }
        })

        await logAuditAction({
            username: session.user.username || username,
            userId: session.user.id || null,
            action: 'FIRMA_VERIFICACION_DIARIA',
            modulo: 'ÁREAS -> CALIDAD -> VERIFICADOR DE TEMPERATURAS',
            detalle: `Verificación Diaria (Nivel 1 - Monitor) firmada para Día ${dia}, Mes ${mes} en Registro #${idRegistro} por ${username}`
        })

        revalidatePath('/dashboard/areas/calidad/verificador-temperaturas')
        return { success: true, verificacion: res }
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al guardar firma diaria' }
    }
}

export async function firmarVerificacionJefeBodega(idRegistro: number, mes: number, semana: number, firmaText?: string) {
    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autenticado' }
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    let permissions: string[] = []
    if (session.user.role?.permissions) {
        try {
            permissions = typeof session.user.role.permissions === 'string'
                ? JSON.parse(session.user.role.permissions)
                : session.user.role.permissions
        } catch { permissions = [] }
    }

    const isAdmin = roleName.includes('admin')
    const isJefeBodega = roleName.includes('jefe de bodega') || roleName.includes('jefe bodega') || permissions.includes('sign_jefe_bodega')

    if (!isAdmin && !isJefeBodega) {
        return { success: false, error: 'Acceso denegado: Se requiere rol de Jefe de Bodega o Administrador' }
    }

    const registro = await prisma.vTRegistroCabecera.findUnique({
        where: { idRegistro },
        include: {
            detalles: { where: { mes } },
            verificacionesDiarias: { where: { mes } }
        }
    })

    if (!registro) return { success: false, error: 'Registro no encontrado' }

    if (!isAdmin) {
        const userSucursales = session.user.sucursales || []
        if (userSucursales.length > 0 && !userSucursales.includes(registro.idEntidad)) {
            return { success: false, error: 'Acceso denegado: No tienes asignada esta sucursal' }
        }
    }

    const weeks = getCalendarWeeksForMonth(registro.anio || new Date().getFullYear(), mes)
    const targetWeek = weeks.find(w => w.semanaNum === semana)
    const startDay = targetWeek ? targetWeek.startDay : (semana - 1) * 7 + 1
    const endDay = targetWeek ? targetWeek.endDay : (semana === 5 ? 31 : semana * 7)

    const detallesEnSemana = registro.detalles.filter(d => d.dia >= startDay && d.dia <= endDay)
    const diasRegistrados = Array.from(new Set(detallesEnSemana.map(d => d.dia)))

    if (diasRegistrados.length === 0) {
        return {
            success: false,
            error: `⚠️ No se puede firmar: La Semana ${semana} no cuenta con mediciones de temperatura registradas.`
        }
    }

    const diasFirmados = registro.verificacionesDiarias
        .filter(v => v.dia >= startDay && v.dia <= endDay && v.firmado)
        .map(v => v.dia)

    const faltantes = diasRegistrados.filter(d => !diasFirmados.includes(d))
    if (faltantes.length > 0) {
        return {
            success: false,
            error: `⚠️ No se puede firmar: Los días (${faltantes.join(', ')}) de la Semana ${semana} aún no cuentan con Verificación Diaria del Monitor (Nivel 1).`
        }
    }

    const username = session.user.name || session.user.username || 'Jefe de Bodega'
    const firma = firmaText && firmaText.trim() ? firmaText.trim() : `Firmado por Jefe de Bodega ${username}`

    const res = await prisma.vTVerificacionSemanal.upsert({
        where: {
            idRegistro_mes_semana: { idRegistro, mes, semana }
        },
        create: {
            idRegistro,
            mes,
            semana,
            firmadoJefeBodega: true,
            fechaFirmaJefeBodega: new Date(),
            usuarioJefeBodega: username,
            firmaJefeBodega: firma
        },
        update: {
            firmadoJefeBodega: true,
            fechaFirmaJefeBodega: new Date(),
            usuarioJefeBodega: username,
            firmaJefeBodega: firma
        }
    })

    await logAuditAction({
        username: session.user.username || username,
        userId: session.user.id || null,
        action: 'FIRMA_VERIFICACION_JEFE_BODEGA',
        modulo: 'ÁREAS -> CALIDAD -> VERIFICADOR DE TEMPERATURAS',
        detalle: `Verificación Semanal (Nivel 2 - Jefe de Bodega) firmada para Semana ${semana}, Mes ${mes} en Registro #${idRegistro} (${registro.nombreEntidad}) por ${username}`
    })

    revalidatePath('/dashboard/areas/calidad/verificador-temperaturas')
    return { success: true, verificacion: res }
}

export async function firmarVerificacionJefeZonal(idRegistro: number, mes: number, semana: number, firmaText?: string) {
    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autenticado' }
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    let permissions: string[] = []
    if (session.user.role?.permissions) {
        try {
            permissions = typeof session.user.role.permissions === 'string'
                ? JSON.parse(session.user.role.permissions)
                : session.user.role.permissions
        } catch { permissions = [] }
    }

    const isAdmin = roleName.includes('admin')
    const isJefeZonal = roleName.includes('jefe zonal') || roleName.includes('jefezonal') || roleName.includes('zonal') || permissions.includes('sign_jefe_zonal')

    if (!isAdmin && !isJefeZonal) {
        return { success: false, error: 'Acceso denegado: Se requiere rol de Jefe Zonal o Administrador' }
    }

    const registro = await prisma.vTRegistroCabecera.findUnique({
        where: { idRegistro },
        include: {
            verificacionesSemanales: { where: { mes, semana } }
        }
    })

    if (!registro) return { success: false, error: 'Registro no encontrado' }

    if (!isAdmin) {
        const userSucursales = session.user.sucursales || []
        if (userSucursales.length > 0 && !userSucursales.includes(registro.idEntidad)) {
            return { success: false, error: 'Acceso denegado: No tienes asignada esta sucursal' }
        }
    }

    const verificacionSemanal = registro.verificacionesSemanales[0]
    if (!verificacionSemanal || !verificacionSemanal.firmadoJefeBodega) {
        return {
            success: false,
            error: `⚠️ No se puede firmar: La Semana ${semana} requiere primero la firma del Jefe de Bodega (Nivel 2).`
        }
    }

    const username = session.user.name || session.user.username || 'Jefe Zonal'
    const firma = firmaText && firmaText.trim() ? firmaText.trim() : `Firmado por Jefe Zonal ${username}`

    const res = await prisma.vTVerificacionSemanal.update({
        where: {
            idRegistro_mes_semana: { idRegistro, mes, semana }
        },
        data: {
            firmadoJefeZonal: true,
            fechaFirmaJefeZonal: new Date(),
            usuarioJefeZonal: username,
            firmaJefeZonal: firma
        }
    })

    await logAuditAction({
        username: session.user.username || username,
        userId: session.user.id || null,
        action: 'FIRMA_VERIFICACION_JEFE_ZONAL',
        modulo: 'ÁREAS -> CALIDAD -> VERIFICADOR DE TEMPERATURAS',
        detalle: `Verificación Semanal (Nivel 3 - Jefe Zonal) firmada para Semana ${semana}, Mes ${mes} en Registro #${idRegistro} (${registro.nombreEntidad}) por ${username}`
    })

    revalidatePath('/dashboard/areas/calidad/verificador-temperaturas')
    return { success: true, verificacion: res }
}
