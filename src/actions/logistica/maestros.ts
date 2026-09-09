'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { dispararEventoN8N, reintentarEnvioLogN8N } from '@/lib/logistica/n8n-dispatcher'

// ==========================================
// 1. CHOFERES
// ==========================================

export async function getChoferes(filtros: { search?: string; transportistaId?: string } = {}) {
    try {
        const where: any = { activo: true }
        if (filtros.transportistaId && filtros.transportistaId !== 'ALL') {
            where.transportistaId = filtros.transportistaId
        }
        if (filtros.search && filtros.search.trim()) {
            const s = filtros.search.trim()
            where.OR = [
                { nombre: { contains: s, mode: 'insensitive' } },
                { rut: { contains: s, mode: 'insensitive' } },
                { telefono: { contains: s, mode: 'insensitive' } }
            ]
        }

        const choferes = await rawPrisma.logChofer.findMany({
            where,
            include: { transportista: true },
            orderBy: { nombre: 'asc' }
        })
        return { success: true, choferes }
    } catch (error: any) {
        return { success: false, error: error?.message, choferes: [] }
    }
}

export async function guardarChofer(data: {
    id?: string
    rut: string
    nombre: string
    telefono: string
    email?: string
    telegramChatId?: string
    transportistaId?: string
}) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        let chofer
        if (data.id) {
            chofer = await rawPrisma.logChofer.update({
                where: { id: data.id },
                data: {
                    rut: data.rut.trim(),
                    nombre: data.nombre.trim(),
                    telefono: data.telefono.trim(),
                    email: data.email?.trim() || null,
                    telegramChatId: data.telegramChatId?.trim() || null,
                    transportistaId: data.transportistaId || null
                }
            })
        } else {
            chofer = await rawPrisma.logChofer.create({
                data: {
                    rut: data.rut.trim(),
                    nombre: data.nombre.trim(),
                    telefono: data.telefono.trim(),
                    email: data.email?.trim() || null,
                    telegramChatId: data.telegramChatId?.trim() || null,
                    transportistaId: data.transportistaId || null
                }
            })
        }

        await logAuditAction({
            username,
            userId,
            action: data.id ? 'ACTUALIZAR_CHOFER' : 'CREAR_CHOFER',
            modulo: 'Logística -> Maestros',
            detalle: `Chofer ${chofer.nombre} (${chofer.rut}) guardado.`
        })

        return { success: true, chofer }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

// ==========================================
// 2. CAMIONES
// ==========================================

export async function getCamiones(filtros: { search?: string; transportistaId?: string } = {}) {
    try {
        const where: any = { activo: true }
        if (filtros.transportistaId && filtros.transportistaId !== 'ALL') {
            where.transportistaId = filtros.transportistaId
        }
        if (filtros.search && filtros.search.trim()) {
            where.patente = { contains: filtros.search.trim().toUpperCase(), mode: 'insensitive' }
        }

        const camiones = await rawPrisma.logCamion.findMany({
            where,
            include: { transportista: true },
            orderBy: { patente: 'asc' }
        })
        return { success: true, camiones }
    } catch (error: any) {
        return { success: false, error: error?.message, camiones: [] }
    }
}

export async function guardarCamion(data: {
    id?: string
    patente: string
    tipoVehiculo: string
    capacidadKg?: number
    capacidadM3?: number
    transportistaId?: string
}) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const cleanPatente = data.patente.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

        let camion
        if (data.id) {
            camion = await rawPrisma.logCamion.update({
                where: { id: data.id },
                data: {
                    patente: cleanPatente,
                    tipoVehiculo: data.tipoVehiculo,
                    capacidadKg: data.capacidadKg ? Number(data.capacidadKg) : null,
                    capacidadM3: data.capacidadM3 ? Number(data.capacidadM3) : null,
                    transportistaId: data.transportistaId || null
                }
            })
        } else {
            camion = await rawPrisma.logCamion.create({
                data: {
                    patente: cleanPatente,
                    tipoVehiculo: data.tipoVehiculo,
                    capacidadKg: data.capacidadKg ? Number(data.capacidadKg) : null,
                    capacidadM3: data.capacidadM3 ? Number(data.capacidadM3) : null,
                    transportistaId: data.transportistaId || null
                }
            })
        }

        await logAuditAction({
            username,
            userId,
            action: data.id ? 'ACTUALIZAR_CAMION' : 'CREAR_CAMION',
            modulo: 'Logística -> Maestros',
            detalle: `Camión patente ${camion.patente} guardado.`
        })

        return { success: true, camion }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

// ==========================================
// 3. TRANSPORTISTAS
// ==========================================

export async function getTransportistas() {
    try {
        const transportistas = await rawPrisma.logTransportista.findMany({
            where: { activo: true },
            include: {
                _count: {
                    select: { choferes: true, camiones: true }
                }
            },
            orderBy: { razonSocial: 'asc' }
        })
        return { success: true, transportistas }
    } catch (error: any) {
        return { success: false, error: error?.message, transportistas: [] }
    }
}

export async function guardarTransportista(data: {
    id?: string
    rut: string
    razonSocial: string
    contacto?: string
    telefono?: string
    email?: string
}) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        let trans
        if (data.id) {
            trans = await rawPrisma.logTransportista.update({
                where: { id: data.id },
                data: {
                    rut: data.rut.trim(),
                    razonSocial: data.razonSocial.trim(),
                    contacto: data.contacto?.trim() || null,
                    telefono: data.telefono?.trim() || null,
                    email: data.email?.trim() || null
                }
            })
        } else {
            trans = await rawPrisma.logTransportista.create({
                data: {
                    rut: data.rut.trim(),
                    razonSocial: data.razonSocial.trim(),
                    contacto: data.contacto?.trim() || null,
                    telefono: data.telefono?.trim() || null,
                    email: data.email?.trim() || null
                }
            })
        }

        await logAuditAction({
            username,
            userId,
            action: data.id ? 'ACTUALIZAR_TRANSPORTISTA' : 'CREAR_TRANSPORTISTA',
            modulo: 'Logística -> Maestros',
            detalle: `Transportista ${trans.razonSocial} guardado.`
        })

        return { success: true, transportista: trans }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

// ==========================================
// 4. CLIENTES
// ==========================================

export async function getClientes() {
    try {
        const clientes = await rawPrisma.logCliente.findMany({
            where: { activo: true },
            orderBy: { razonSocial: 'asc' }
        })
        return { success: true, clientes }
    } catch (error: any) {
        return { success: false, error: error?.message, clientes: [] }
    }
}

export async function guardarCliente(data: {
    id?: string
    codigo: string
    razonSocial: string
    direccion?: string
    comuna?: string
    region?: string
}) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        let cli
        if (data.id) {
            cli = await rawPrisma.logCliente.update({
                where: { id: data.id },
                data: {
                    codigo: data.codigo.trim().toUpperCase(),
                    razonSocial: data.razonSocial.trim(),
                    direccion: data.direccion?.trim() || null,
                    comuna: data.comuna?.trim() || null,
                    region: data.region?.trim() || null
                }
            })
        } else {
            cli = await rawPrisma.logCliente.create({
                data: {
                    codigo: data.codigo.trim().toUpperCase(),
                    razonSocial: data.razonSocial.trim(),
                    direccion: data.direccion?.trim() || null,
                    comuna: data.comuna?.trim() || null,
                    region: data.region?.trim() || null
                }
            })
        }

        await logAuditAction({
            username,
            userId,
            action: data.id ? 'ACTUALIZAR_CLIENTE' : 'CREAR_CLIENTE',
            modulo: 'Logística -> Maestros',
            detalle: `Cliente ${cli.razonSocial} guardado.`
        })

        return { success: true, cliente: cli }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

// ==========================================
// 5. PARÁMETROS LOGÍSTICOS
// ==========================================

export async function getParametros() {
    try {
        const parametros = await rawPrisma.logParametro.findMany({
            orderBy: { clave: 'asc' }
        })
        return { success: true, parametros }
    } catch (error: any) {
        return { success: false, error: error?.message, parametros: [] }
    }
}

export async function guardarParametro(clave: string, valor: string, descripcion?: string) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const param = await rawPrisma.logParametro.upsert({
            where: { clave },
            update: { valor, descripcion },
            create: { clave, valor, descripcion }
        })

        await logAuditAction({
            username,
            userId,
            action: 'GUARDAR_PARAMETRO_LOGISTICA',
            modulo: 'Logística -> Configuración',
            detalle: `Parámetro ${clave} actualizado a: ${valor}`
        })

        return { success: true, parametro: param }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

// ==========================================
// 6. INTEGRACIÓN N8N & WEBHOOKS
// ==========================================

export async function getIntegracionConfig() {
    try {
        const config = await rawPrisma.logIntegracionConfig.findFirst()
        const logs = await rawPrisma.logIntegracionLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { ruta: { select: { numeroRuta: true } } }
        })
        return { success: true, config, logs }
    } catch (error: any) {
        return { success: false, error: error?.message, config: null, logs: [] }
    }
}

export async function guardarIntegracionConfig(data: {
    webhookUrl: string
    secretToken?: string
    activo: boolean
    eventosSuscritos: string[]
    headersJson?: string
}) {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'
        const userId = session?.user?.id

        const configActual = await rawPrisma.logIntegracionConfig.findFirst()

        let guardada
        if (configActual) {
            guardada = await rawPrisma.logIntegracionConfig.update({
                where: { id: configActual.id },
                data: {
                    webhookUrl: data.webhookUrl.trim(),
                    secretToken: data.secretToken?.trim() || null,
                    activo: data.activo,
                    eventosSuscritos: JSON.stringify(data.eventosSuscritos),
                    headersJson: data.headersJson?.trim() || null
                }
            })
        } else {
            guardada = await rawPrisma.logIntegracionConfig.create({
                data: {
                    webhookUrl: data.webhookUrl.trim(),
                    secretToken: data.secretToken?.trim() || null,
                    activo: data.activo,
                    eventosSuscritos: JSON.stringify(data.eventosSuscritos),
                    headersJson: data.headersJson?.trim() || null
                }
            })
        }

        await logAuditAction({
            username,
            userId,
            action: 'GUARDAR_CONFIG_N8N',
            modulo: 'Logística -> Integraciones',
            detalle: `Configuración webhook n8n actualizada (Activo: ${data.activo}, URL: ${data.webhookUrl})`
        })

        return { success: true, config: guardada }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

export async function probarConexionN8N() {
    try {
        const session = await getSession()
        const username = session?.user?.username || 'sistema'

        const result = await dispararEventoN8N('PRUEBA_CONEXION', {
            origen: 'TEST_UI',
            notas: `Prueba de conexión disparada por ${username}`
        })

        return { success: result.enviado && result.ok, result }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}

export async function reintentarEnvioLogAction(logId: string) {
    try {
        const res = await reintentarEnvioLogN8N(logId)
        return { success: res.success, res }
    } catch (error: any) {
        return { success: false, error: error?.message }
    }
}
