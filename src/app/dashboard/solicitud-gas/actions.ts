'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me')).digest('base64').substring(0, 32)

function decrypt(text: string) {
    try {
        const textParts = text.split(':')
        const iv = Buffer.from(textParts.shift()!, 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
        let decrypted = decipher.update(encryptedText)
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted.toString()
    } catch (e) {
        console.error("Error decrypting SMTP password:", e)
        return text // Fallback to original if not encrypted
    }
}

export async function searchColegiosGas(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_gas')) {
        return { error: 'No tienes permisos para buscar' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []
        const isAdmin = session?.user?.role?.name === 'Administrador'

        let whereClause: any = {}
        if (!isAdmin) {
            const uts = await prisma.uT.findMany({
                where: { sucursal: { nombre: { in: userSucursales } } },
                select: { codUT: true }
            })
            const allowedUTs = uts.map(ut => ut.codUT)
            whereClause.colut = { in: allowedUTs }
        }

        const colegios = await prisma.colegios.findMany({
            where: {
                ...whereClause,
                OR: [
                    ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                    { nombreEstablecimiento: { contains: query } }
                ]
            },
            take: 10
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios gas:", e)
        return { error: 'Error en la búsqueda' }
    }
}

export async function getConsumoLimitForRBD(rbd: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_gas')) {
        return { error: 'No tienes permisos' }
    }

    try {
        const limit = await (prisma as any).mat_ConsumoGas.findUnique({
            where: { rbd }
        })

        if (!limit) return { state: 'liberado' }

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const allowedMonths = limit.meses.split(',').map((m: string) => parseInt(m.trim()))

        if (!allowedMonths.includes(currentMonth)) {
            return {
                state: 'bloqueado',
                message: `No permitido en Mes ${currentMonth}. Meses permitidos: ${limit.meses}`
            }
        }

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const stats = await prisma.solicitudGas.aggregate({
            where: {
                rbd,
                fechaSolicitud: { gte: startOfMonth, lte: endOfMonth }
            },
            _count: { id: true },
            _sum: { cantidadLitro: true }
        })

        const currentCount = stats._count.id
        const currentLiters = stats._sum.cantidadLitro || 0

        return {
            state: 'controlado',
            limit: limit.cantidad,
            remaining: Math.max(0, limit.cantidad - currentCount),
            litrosMax: limit.litros,
            consumedLiters: currentLiters
        }
    } catch (e) {
        return { error: 'Error al consultar límites' }
    }
}

export async function saveSolicitudGas(data: {
    ut: number
    rbd: number
    distribuidor: string
    distribuidorOtro?: string
    tipoGas: 'Bombona' | 'Cilindro'
    litrosBombona?: number
    pesoCilindro?: string // "5 Kilos", "11 Kilos", etc.
    cantidadCilindros?: number
    observacion?: string
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_gas') && session?.user?.role?.name !== 'Administrador') {
        return { error: 'No tienes permisos para guardar solicitudes de gas' }
    }

    if (!data.ut || !data.rbd) return { error: 'UT y RBD son obligatorios' }

    try {
        const finalDistribuidor = data.distribuidor === 'Otro' ? data.distribuidorOtro : data.distribuidor
        if (!finalDistribuidor) return { error: 'Debe especificar un distribuidor' }

        let calculoLitros = 0
        if (data.tipoGas === 'Bombona') {
            calculoLitros = data.litrosBombona || 0
        } else {
            const pesoStr = data.pesoCilindro || ''
            const pesoMatch = pesoStr.match(/\d+/)
            const pesoNum = pesoMatch ? parseInt(pesoMatch[0]) : 0
            const cantidad = data.cantidadCilindros || 0
            calculoLitros = (pesoNum * 0.54) * cantidad
        }

        // --- VALIDACIÓN DE CONSUMO ---
        const consumoLimit = await (prisma as any).mat_ConsumoGas.findUnique({
            where: { rbd: data.rbd }
        })

        if (consumoLimit) {
            const now = new Date()
            const currentMonth = now.getMonth() + 1
            const allowedMonths = consumoLimit.meses.split(',').map((m: string) => parseInt(m.trim()))

            if (!allowedMonths.includes(currentMonth)) {
                const errorMsg = `Este RBD no tiene permitido solicitar gas en el mes actual (${currentMonth}). Meses permitidos: ${consumoLimit.meses}`
                // -- NOTIFICACIÓN ALERTA --
                try {
                    const colegio = await prisma.colegios.findFirst({ where: { colRBD: data.rbd } })
                    if (colegio) {
                        const ut = await prisma.uT.findUnique({ where: { codUT: colegio.colut } })
                        await processNotificacionesGas(
                            { ...data, nombreSolicitante: session?.user?.name || session?.user?.username || 'Usuario', cantidadLitro: calculoLitros }, 
                            ut?.sucursalId || null, 
                            'solicitud-gas-exceso',
                            { motive: errorMsg, limit: `${consumoLimit.cantidad} cargas`, current: `${currentMonth} (Mes no permitido)` },
                            colegio.sucursal // Pasamos el nombre para los tags
                        )
                    }
                } catch (e) {}
                return { error: errorMsg }
            }

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

            const stats = await prisma.solicitudGas.aggregate({
                where: {
                    rbd: data.rbd,
                    fechaSolicitud: { gte: startOfMonth, lte: endOfMonth }
                },
                _count: { id: true },
                _sum: { cantidadLitro: true }
            })

            const currentCount = stats._count.id
            const currentLiters = stats._sum.cantidadLitro || 0

            if (currentCount >= consumoLimit.cantidad) {
                const errorMsg = `Límite de cantidad excedido: Ya ha realizado ${currentCount} solicitudes de un máximo de ${consumoLimit.cantidad} permitidas en el periodo.`
                // -- NOTIFICACIÓN ALERTA --
                try {
                    const colegio = await prisma.colegios.findFirst({ where: { colRBD: data.rbd } })
                    if (colegio) {
                        const ut = await prisma.uT.findUnique({ where: { codUT: colegio.colut } })
                        await processNotificacionesGas(
                            { ...data, nombreSolicitante: session?.user?.name || session?.user?.username || 'Usuario', cantidadLitro: calculoLitros }, 
                            ut?.sucursalId || null, 
                            'solicitud-gas-exceso',
                            { motive: errorMsg, limit: `${consumoLimit.cantidad} cargas`, current: `${currentCount} cargas` },
                            colegio.sucursal
                        )
                    }
                } catch (e) {}
                return { error: errorMsg }
            }

            if (currentLiters + calculoLitros > consumoLimit.litros) {
                const errorMsg = `Límite de litros excedido: Esta solicitud de ${calculoLitros.toFixed(2)} Lts sumada a los ${currentLiters.toFixed(2)} Lts ya solicitados supera el máximo de ${consumoLimit.litros} Lts permitidos.`
                // -- NOTIFICACIÓN ALERTA --
                try {
                    const colegio = await prisma.colegios.findFirst({ where: { colRBD: data.rbd } })
                    if (colegio) {
                        const ut = await prisma.uT.findUnique({ where: { codUT: colegio.colut } })
                        await processNotificacionesGas(
                            { ...data, nombreSolicitante: session?.user?.name || session?.user?.username || 'Usuario', cantidadLitro: calculoLitros }, 
                            ut?.sucursalId || null, 
                            'solicitud-gas-exceso',
                            { motive: errorMsg, limit: `${consumoLimit.litros} Lts`, current: `${currentLiters.toFixed(2)} Lts` },
                            colegio.sucursal
                        )
                    }
                } catch (e) {}
                return { error: errorMsg }
            }
        }
        // --- FIN VALIDACIÓN ---

        // Obtener la licitación actual de la UT
        const utInfo = await prisma.uT.findUnique({ where: { codUT: data.ut } })

        const nuevaSolicitud = await prisma.solicitudGas.create({
            data: {
                ut: data.ut,
                licId: utInfo?.licId,
                rbd: data.rbd,
                nombreSolicitante: session?.user?.name || session?.user?.username || 'Desconocido',
                distribuidor: finalDistribuidor.substring(0, 20),
                tipoGas: data.tipoGas,
                cantidadLitro: parseFloat(calculoLitros.toFixed(2)),
                cilindro: data.tipoGas === 'Cilindro' ? data.pesoCilindro : null,
                cantidad: data.tipoGas === 'Cilindro' ? data.cantidadCilindros : null,
                observacion: data.observacion?.substring(0, 500)
            }
        })

        // -- NOTIFICACIONES --
        let emailWarning: string | undefined;
        try {
            const colegio = await prisma.colegios.findFirst({
                where: { colRBD: data.rbd }
            })
            if (colegio) {
                const ut = await prisma.uT.findUnique({ where: { codUT: colegio.colut } })
                const notif = await processNotificacionesGas(nuevaSolicitud, ut?.sucursalId || null, 'solicitud-gas', null, colegio.sucursal)
                if (notif?.warning) emailWarning = notif.warning;
            }
        } catch (notifierr) {
            console.error("Error al procesar notificaciones de gas:", notifierr)
        }
        // -- FIN NOTIFICACIONES --

        revalidatePath('/dashboard/solicitud-gas')
        revalidatePath('/dashboard/reports/solicitud-gas')
        return { success: true, emailWarning }
    } catch (e) {
        console.error("Error saving gas request:", e)
        return { error: 'Ocurrió un error al guardar la solicitud' }
    }
}

async function processNotificacionesGas(solicitud: any, sucursalIdColegio: string | null, codigoPantalla: string = 'solicitud-gas', alertData?: any, nombreSucursalString?: string) {
    console.log(`[DEBUG NOTIFICACIONES GAS] Iniciando para ${codigoPantalla}. sucursalId: ${sucursalIdColegio}. String fallback: ${nombreSucursalString}`)
    try {
        const configs = await prisma.notificacionPantalla.findMany({
            where: { 
                codigoPantalla,
                activa: true 
            },
            include: {
                listaCorreo: {
                    include: { sucursal: true }
                }
            }
        })

        console.log(`[DEBUG NOTIFICACIONES GAS] Configuraciones encontradas: ${configs.length}`)
        if (configs.length === 0) return { warning: 'No hay notificaciones activas configuradas en el sistema para esta acción.' }

        const destinos = configs
            .map(c => c.listaCorreo)
            .filter(lista => {
                // Si la lista es global (sin sucursalId), se envía.
                if (!lista.sucursalId) return true;
                
                // Si coinciden los sucursalId, se envía.
                if (sucursalIdColegio && lista.sucursalId === sucursalIdColegio) return true;

                // Fallback por nombre (por si acaso hay inconsistencias en el seeding de sucursalId)
                if (nombreSucursalString && lista.sucursal?.nombre) {
                    const s1 = lista.sucursal.nombre.toLowerCase();
                    const s2 = nombreSucursalString.toLowerCase();
                    if (s1.includes(s2) || s2.includes(s1)) return true;
                }

                return false;
            })

        console.log(`[DEBUG NOTIFICACIONES GAS] Destinatarios previos: ${configs.length}, Destinatarios filtrados: ${destinos.length}`)
        if (destinos.length === 0) return { warning: `No hay listas de correo asignadas para la sucursal "${nombreSucursalString || 'Global'}".` }

        const plantilla = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla }
        })

        let defaultSubject = codigoPantalla === 'solicitud-gas-exceso' 
            ? "ALERTA: Intento de Pedido con Exceso de Límites - RBD <RBD>"
            : "Nueva Solicitud de Gas - RBD <RBD>"

        let defaultBody = codigoPantalla === 'solicitud-gas-exceso'
            ? `Se ha bloqueado un intento de solicitud de gas por exceder límites:
Usuario: <Usuario>
RBD: <RBD>
Sucursal: <Sucursal>
Motivo: <MotivoBloqueo>
Límite Permitido: <LimiteMensual>
Acumulado Actual: <AcumuladoActual>
Intento de Carga: <CantidadLitros>

Atte.
Sistema de Solicitudes.`
            : `Se ha generado una nueva solicitud de gas:
Usuario: <Usuario>
RBD: <RBD>
Sucursal: <Sucursal>
Tipo de Gas: <TipoGas>
Cantidad (Lts): <CantidadLitros>
Distribuidor: <Distribuidor>
Observación: <Observacion>

Atte.
Sistema de Solicitudes.`

        let subject = plantilla?.asunto || defaultSubject
        let body = plantilla?.cuerpo || defaultBody

        const replaceTags = (text: string) => {
            return text
                .replace(/<RBD.*?>/gi, String(solicitud.rbd))
                .replace(/<Usuario.*?>/gi, solicitud.nombreSolicitante || 'Usuario')
                .replace(/<Sucur.*?>/gi, nombreSucursalString || 'N/A')
                .replace(/<TipoGas.*?>/gi, solicitud.tipoGas || 'N/A')
                .replace(/<CantidadLitros.*?>/gi, String(solicitud.cantidadLitro || 0))
                .replace(/<Distribuidor.*?>/gi, solicitud.distribuidor || 'N/A')
                .replace(/<Observacion.*?>/gi, solicitud.observacion || 'Sin observación')
                .replace(/<MotivoBloqueo.*?>/gi, alertData?.motive || 'N/A')
                .replace(/<LimiteMensual.*?>/gi, alertData?.limit || 'N/A')
                .replace(/<AcumuladoActual.*?>/gi, alertData?.current || 'N/A')
        }

        subject = replaceTags(subject)
        body = replaceTags(body)

        let correosTo: string[] = []
        let correosCc: string[] = []

        destinos.forEach(lista => {
            try {
                const para = JSON.parse(lista.para || '[]')
                const cc = JSON.parse(lista.cc || '[]')
                if (Array.isArray(para)) correosTo.push(...para)
                if (Array.isArray(cc)) correosCc.push(...cc)
            } catch (e) {
                console.error(`[DEBUG NOTIFICACIONES GAS] Error parseando correos de lista ${lista.nombre}:`, e)
            }
        })

        correosTo = Array.from(new Set(correosTo)).filter(email => email.includes('@'))
        correosCc = Array.from(new Set(correosCc)).filter(email => email.includes('@'))

        console.log(`[DEBUG NOTIFICACIONES GAS] Destinatarios finales: TO=${correosTo.length}, CC=${correosCc.length}`)

        if (correosTo.length > 0) {
            const emailConfig = await prisma.emailConfig.findFirst({ where: { id: "global" } })
            if (!emailConfig) {
                console.error("[DEBUG NOTIFICACIONES GAS] No se encontró configuración de email 'global'")
                return
            }

            const transport = nodemailer.createTransport({
                host: "smtp.office365.com",
                port: 587,
                secure: false,
                auth: {
                    user: emailConfig.email,
                    pass: decrypt(emailConfig.password)
                }
            })

            try {
                await transport.sendMail({
                    from: emailConfig.email,
                    to: correosTo,
                    cc: correosCc,
                    subject: subject,
                    text: body
                })
                console.log(`[CORREO GAS ENVIADO] Código: ${codigoPantalla}, RBD: ${solicitud.rbd}`)
            } catch (mailErr) {
                console.error("[DEBUG NOTIFICACIONES GAS] Error al enviar email:", mailErr)
            }
        } else {
            console.log("[DEBUG NOTIFICACIONES GAS] No hay direcciones de correo válidas para enviar.")
            return { warning: `Las listas de correo encontradas para la sucursal "${nombreSucursalString || 'Global'}" no tienen direcciones válidas configuradas.` }
        }
    } catch (e) {
        console.error("Error en processNotificacionesGas:", e)
    }
}
