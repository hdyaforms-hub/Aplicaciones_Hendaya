'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
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
        return text
    }
}

export async function searchColegios(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_pmpa') && !session?.user?.role?.permissions.includes('view_ingreso_raciones')) {
        return { error: 'No tienes permisos para buscar colegios' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))

    const isAdmin = session?.user?.role?.name === 'Administrador'
    
    try {
        let allowedUTs: number[] = []
        
        if (!isAdmin) {
            // Fetch authorized sucursales names from the DB to be sure
            const dbUser = await (prisma.user as any).findUnique({
                where: { id: session?.user?.id as string },
                include: { sucursales: true }
            })
            const userSucursalNames = dbUser?.sucursales?.map((s: any) => s.nombre) || []

            const uts = await prisma.uT.findMany({
                where: { sucursal: { nombre: { in: userSucursalNames } } },
                select: { codUT: true }
            })
            allowedUTs = uts.map(ut => ut.codUT)
        }

        const baseWhere: any = {
            OR: [
                ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                { nombreEstablecimiento: { contains: query, mode: 'insensitive' } }
            ]
        }

        const finalWhere = isAdmin ? baseWhere : {
            ...baseWhere,
            colut: { in: allowedUTs }
        }

        const colegios = await prisma.colegios.findMany({
            where: finalWhere,
            take: 20, // Limitar resultados para rendimiento
            orderBy: { nombreEstablecimiento: 'asc' }
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios:", e)
        return { error: 'Ocurrió un error al buscar los colegios.' }
    }
}

export async function checkPmpaDisponibilidad(rbd: number, year: number, month: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_ingreso_raciones') && !session?.user?.role?.permissions.includes('view_pmpa')) {
        return { error: 'No tienes permisos para consultar esta información' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: rbd, colut: { in: allowedUTs } }
        })

        if (!colegio) {
            return { error: 'No tienes acceso a este establecimiento.' }
        }

        const pmpaRecords = await prisma.pMPA.findMany({
            where: { rbd, ano: year, mes: month }
        })

        if (pmpaRecords.length === 0) {
            return { error: 'Favor comunicarse con el administrador para que cargue el PMPA del mes en curso o mes que quiere trabajar.' }
        }

        const validRecords = pmpaRecords.filter((r: any) => r.raceqJunaeb > 0)

        if (validRecords.length === 0) {
            return { error: 'No se encontraron registros con raciones asignadas (> 0) para este periodo en el PMPA.' }
        }

        // Obtener pares únicos de programa y estrato
        const validPairs = validRecords.map((r: any) => ({
            programa: r.programa as string,
            estrato: r.estrato as string
        }))

        // Eliminar duplicados de los pares
        const uniquePairs = Array.from(new Set(validPairs.map(p => JSON.stringify(p)))).map(p => JSON.parse(p))

        const programas = Array.from(new Set(uniquePairs.map(p => p.programa)))

        return {
            programas,
            validPairs: uniquePairs
        }
    } catch (e) {
        console.error("Error checking PMPA:", e)
        return { error: 'Ocurrió un error al verificar los registros del PMPA.' }
    }
}

export type IngRacionFormData = {
    ubicacion: string
    fechaIngreso: string
    rbd: number
    nombreEstablecimiento: string
    ano: number
    mes: number
    programa: string
    estrato: string
    desayunoIng: number
    almuerzoIng: number
    onceIng: number
    colacionIng: number
    cenaIng: number
    tercerServicioIng: number
    totalIng: number
    desayunoAsig: number
    almuerzoAsig: number
    onceAsig: number
    colacionAsig: number
    cenaAsig: number
    tercerServicioAsig: number
    totalAsig: number
    tasaPreparacion: number
    observacion: string
}

export async function getPmpaAssignmentsAndLastRecord(rbd: number, ano: number, mes: number, programa: string, estrato: string, fechaIngreso?: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_ingreso_raciones')) {
        return { error: 'No tienes permisos para consultar esta información.' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: rbd, colut: { in: allowedUTs } }
        })

        if (!colegio) {
            return { error: 'No tienes acceso a las asignaciones de este establecimiento.' }
        }

        const pmpaRecords = await prisma.pMPA.findMany({
            where: { rbd, ano: ano, mes: mes, programa, estrato }
        })

        if (pmpaRecords.length === 0) {
            return { error: 'No se encontraron asignaciones para esta configuración en PMPA.' }
        }

        const asignados = {
            desayunoAsig: 0,
            almuerzoAsig: 0,
            onceAsig: 0,
            colacionAsig: 0,
            cenaAsig: 0,
            tercerServicioAsig: 0
        }

        for (const record of pmpaRecords) {
            if (record.servicio === 'D') asignados.desayunoAsig += record.raceqJunaeb
            if (record.servicio === 'A') asignados.almuerzoAsig += record.raceqJunaeb
            if (record.servicio === 'O') asignados.onceAsig += record.raceqJunaeb
            if (record.servicio === 'CO') asignados.colacionAsig += record.raceqJunaeb
            if (record.servicio === 'C') asignados.cenaAsig += record.raceqJunaeb
            if (record.servicio === 'T') asignados.tercerServicioAsig += record.raceqJunaeb
        }

        // Consultar si existe un registro específico para esta fecha
        let currentRecord = null
        if (fechaIngreso) {
            const utcFecha = new Date(`${fechaIngreso}T12:00:00Z`)
            currentRecord = await prisma.ingRacion.findFirst({
                where: { rbd, fechaIngreso: utcFecha, programa, estrato }
            })
        }

        // Consultar el último registro en la tabla IngRacion (historial)
        const lastRecord = await prisma.ingRacion.findFirst({
            where: { rbd, programa, estrato },
            orderBy: { fechaIngreso: 'desc' }
        })

        return {
            asignados,
            currentRecord: currentRecord ? {
                desayunoIng: currentRecord.desayunoIng,
                almuerzoIng: currentRecord.almuerzoIng,
                onceIng: currentRecord.onceIng,
                colacionIng: currentRecord.colacionIng,
                cenaIng: currentRecord.cenaIng,
                tercerServicioIng: currentRecord.tercerServicioIng,
                observacion: currentRecord.observacion || ''
            } : null,
            ultimaFecha: lastRecord ? lastRecord.fechaIngreso.toISOString() : null
        }
    } catch (e) {
        console.error("Error obteniendo asignaciones PMPA:", e)
        return { error: 'Ocurrió un error al consultar las asignaciones del PMPA o la última fecha.' }
    }
}

export async function saveIngRacion(data: IngRacionFormData, forceUpdate: boolean = false) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_ingreso_raciones')) {
        return { error: 'No tienes permisos para guardar esta información.' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: data.rbd, colut: { in: allowedUTs } }
        })

        if (!colegio) {
            return { error: 'No tienes permisos para guardar en este establecimiento.' }
        }

        // Obtener la licitación actual de la UT
        const utInfo = await prisma.uT.findUnique({ 
            where: { codUT: colegio.colut },
            include: { sucursal: true }
        })
        const nombreSuc = utInfo?.sucursal?.nombre || 'Global'

        const utcFechaIngreso = new Date(`${data.fechaIngreso}T12:00:00Z`)

        // Duplicate Check
        const existingRecord = await prisma.ingRacion.findFirst({
            where: {
                fechaIngreso: utcFechaIngreso,
                rbd: data.rbd,
                ano: data.ano,
                mes: data.mes,
                programa: data.programa,
                estrato: data.estrato
            }
        })

        if (existingRecord && !forceUpdate) {
            return { error: 'EXISTENTE' } // Use a specific code to trigger the confirm dialog in frontend
        }

        if (existingRecord && forceUpdate) {
            const actualizada = await prisma.ingRacion.update({
                where: { id: existingRecord.id },
                data: {
                    usuario: session.user.username as string,
                    desayunoIng: data.desayunoIng,
                    almuerzoIng: data.almuerzoIng,
                    onceIng: data.onceIng,
                    colacionIng: data.colacionIng,
                    cenaIng: data.cenaIng,
                    tercerServicioIng: data.tercerServicioIng,
                    totalIng: data.totalIng,
                    tasaPreparacion: data.tasaPreparacion,
                    observacion: data.observacion
                }
            })
            return { success: true, racion: actualizada }
        }

        const nuevaRacion = await prisma.ingRacion.create({
            data: {
                usuario: session.user.username as string,
                ubicacion: data.ubicacion,
                fechaIngreso: utcFechaIngreso,
                rbd: data.rbd,
                licId: utInfo?.licId,
                nombreEstablecimiento: data.nombreEstablecimiento,
                ano: data.ano,
                mes: data.mes,
                programa: data.programa,
                estrato: data.estrato,
                desayunoIng: data.desayunoIng,
                almuerzoIng: data.almuerzoIng,
                onceIng: data.onceIng,
                colacionIng: data.colacionIng,
                cenaIng: data.cenaIng,
                tercerServicioIng: data.tercerServicioIng,
                totalIng: data.totalIng,
                desayunoAsig: data.desayunoAsig,
                almuerzoAsig: data.almuerzoAsig,
                onceAsig: data.onceAsig,
                colacionAsig: data.colacionAsig,
                cenaAsig: data.cenaAsig,
                tercerServicioAsig: data.tercerServicioAsig,
                totalAsig: data.totalAsig,
                tasaPreparacion: data.tasaPreparacion,
                observacion: data.observacion,
            }
        })

        // Validar e intentar el envío de notificación
        await processNotificacionesRacion(nuevaRacion, nombreSuc)

        return { success: true }
    } catch (error) {
        console.error("Error guardando IngRacion:", error)
        return { error: 'Ocurrió un error insesperado al intentar guardar el registro.' }
    }
}

async function processNotificacionesRacion(racion: any, nombreSucursalColegio: string) {
    try {
        const configs = await prisma.notificacionPantalla.findMany({
            where: { codigoPantalla: 'ingreso-raciones', activa: true },
            include: { listaCorreo: { include: { sucursal: true } } }
        })
        if (configs.length === 0) return { warning: 'No hay notificaciones activas.' }

        const destinos = configs
            .map(c => c.listaCorreo)
            .filter(lista => !lista.sucursalId || lista.sucursal?.nombre === nombreSucursalColegio)

        if (destinos.length === 0) return { warning: 'No hay listas para esta sucursal.' }

        const plantilla = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla: 'ingreso-raciones' }
        })

        let correosTo: string[] = []
        let correosCc: string[] = []

        destinos.forEach(lista => {
            try {
                const para = JSON.parse(lista.para || '[]')
                const cc = JSON.parse(lista.cc || '[]')
                if (Array.isArray(para)) correosTo.push(...para)
                if (Array.isArray(cc)) correosCc.push(...cc)
            } catch (e) {}
        })

        correosTo = Array.from(new Set(correosTo))
        correosCc = Array.from(new Set(correosCc))

        let subject = plantilla?.asunto || "Ingreso de Ración RBD N° <RBD> - <Colegio> en Suc: <Sucursal>"
        let body = plantilla?.cuerpo || `Se informa que se ha ingresado una nueva ración con la siguiente descripción:
RBD: <RBD>
Colegio: <Colegio>
Programa: <Programa>
Estrato: <Estrato>
Fecha Ingreso: <FechaIngreso>
Total Ingresado: <TotalIng>
Observación: <Observacion>

Atte.
Sistema de Raciones.`

        const replaceTags = (text: string) => {
            return text
                .replace(/<RBD.*?>/gi, String(racion.rbd))
                .replace(/<Coleg.*?>/gi, racion.nombreEstablecimiento)
                .replace(/<Sucur.*?>/gi, nombreSucursalColegio)
                .replace(/<Fecha.*?In.*?>/gi, new Date(racion.fechaIngreso).toLocaleDateString('es-CL', { timeZone: 'UTC' }))
                .replace(/<Progr.*?>/gi, racion.programa)
                .replace(/<Estrat.*?>/gi, racion.estrato)
                .replace(/<TotalIng.*?>/gi, String(racion.totalIng))
                .replace(/<Observ.*?>/gi, racion.observacion || 'Ninguna');
        }

        subject = replaceTags(subject)
        body = replaceTags(body)

        if (correosTo.length > 0) {
            const emailConfig = await prisma.emailConfig.findFirst({ where: { id: "global" } })
            if (!emailConfig) return

            const transport = nodemailer.createTransport({
                host: "smtp.office365.com",
                port: 587,
                secure: false,
                auth: { user: emailConfig.email, pass: decrypt(emailConfig.password) }
            })

            await transport.sendMail({
                from: emailConfig.email,
                to: correosTo,
                cc: correosCc,
                subject: subject,
                text: body
            })
        }
    } catch (e) {
        console.error("Error al procesar notificaciones racion:", e)
    }
}
