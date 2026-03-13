'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import nodemailer from 'nodemailer'

export async function searchColegiosSolicitud(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_pan')) {
        return { error: 'No tienes permisos para buscar colegios' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))
    const isAdmin = session?.user?.role?.name === 'Administrador'
    
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

        const baseWhere: any = {
            OR: [
                ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                { nombreEstablecimiento: { contains: query } }
            ]
        }

        const finalWhere = isAdmin ? baseWhere : {
            ...baseWhere,
            colut: { in: allowedUTs }
        }

        const colegios = await prisma.colegios.findMany({
            where: finalWhere,
            take: 20,
            orderBy: { nombreEstablecimiento: 'asc' }
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios:", e)
        return { error: 'Ocurrió un error al buscar los colegios.' }
    }
}

export type FormDataSolicitud = {
    rbd: number
    solicitud: string // "Aumento", "Suspensión"
    cantidad: number
    fechaGestacion: string // Date string from input format YYYY-MM-DD
    servicio: string // Selected option or custom value if "Otros"
    motivo: string
}

export async function saveSolicitudPan(data: FormDataSolicitud) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_pan')) {
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

        const isAdmin = session?.user?.role?.name === 'Administrador'

        // Verificar el acceso al colegio y obtener su UT
        const colegio = await prisma.colegios.findFirst({
            where: { 
                colRBD: data.rbd,
                ...(isAdmin ? {} : { colut: { in: allowedUTs } })
            }
        })

        if (!colegio) {
            return { error: 'No tienes acceso a este establecimiento o no existe.' }
        }

        // Crear la solicitud en la base de datos
        const nuevaSolicitud = await prisma.solicitudPan.create({
            data: {
                ut: colegio.colut,
                rbd: data.rbd,
                nombreSolicitante: session.user.name || session.user.username,
                // fechaSolicitud se genera automáticamente con default(now())
                solicitud: data.solicitud,
                cantidad: data.cantidad,
                fechaGestacion: new Date(`${data.fechaGestacion}T12:00:00Z`),
                servicio: data.servicio,
                motivo: data.motivo,
            }
        })

        // Validar e intentar el envío de notificación por pantalla
        await processNotificaciones(nuevaSolicitud, colegio.sucursal);

        return { success: true, message: 'Solicitud de pan creada correctamente.' }
    } catch (error) {
        console.error("Error guardando SolicitudPan:", error)
        return { error: 'Ocurrió un error inesperado al intentar guardar la solicitud.' }
    }
}

async function processNotificaciones(solicitud: any, nombreSucursalColegio: string) {
    try {
        // Consultar configuración para la pantalla 'solicitud-pan'
        const configs = await prisma.notificacionPantalla.findMany({
            where: { 
                codigoPantalla: 'solicitud-pan',
                activa: true 
            },
            include: {
                listaCorreo: {
                    include: { sucursal: true }
                }
            }
        })

        if (configs.length === 0) return; // No hay notificaciones configuradas o están desactivadas

        /**
         * Lógica de filtrado:
         * Si la Lista de Correo tiene una sucursal específica, solo enviamos si coincide
         * con la sucursal del colegio (nombreSucursalColegio).
         * Si la Lista de Correo es "Global" (no tiene sucursal asociada), se envía siempre.
         */
        const destinos = configs
            .map(c => c.listaCorreo)
            .filter(lista => !lista.sucursalId || lista.sucursal?.nombre === nombreSucursalColegio)

        if (destinos.length === 0) return; // No aplicaba ninguna lista a esta sucursal

        // Obtener la plantilla configurada
        const plantilla = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla: 'solicitud-pan' }
        });

        console.log(`[SIMULACIÓN CORREO] Se preparan correos de 'Solicitud de Pan' para ${destinos.length} listas.`);
        
        let correosTo: string[] = []
        let correosCc: string[] = []

        destinos.forEach(lista => {
            try {
                const para = JSON.parse(lista.para || '[]');
                const cc = JSON.parse(lista.cc || '[]');
                if (Array.isArray(para)) correosTo.push(...para)
                if (Array.isArray(cc)) correosCc.push(...cc)
            } catch (e) {
                console.error("Error parseando correos de lista:", lista.nombre)
            }
        });

        // Eliminar duplicados
        correosTo = Array.from(new Set(correosTo))
        correosCc = Array.from(new Set(correosCc))

        // Parse and Replace Template variables
        let subject = plantilla?.asunto || "Solicitud de Pan del RBD N° <RBD> - Solicitud: <Usuario> en Suc: <Sucursal>";
        let body = plantilla?.cuerpo || `Se informa que se a creado una nueva solicitud de Pan con la siguiente descripción:
Nombre del solicitante: <Usuario>
Fecha Solicitud: <FechaSistema>
RBD: <RBD>
Solicitud: <Solicitud>
Cantidad: <Cantidad>
Fecha Gestación: <FechaGestacion>
Servicio: <Servicio>
Motivo: <Motivo>

Atte.
Sistema de solicitud de Pan.`;

        const replaceTags = (text: string) => {
            return text
                .replace(/<RBD.*?>/gi, String(solicitud.rbd))
                .replace(/<(Usuario|Nombre).*?>/gi, solicitud.nombreSolicitante)
                .replace(/<Sucur.*?>/gi, nombreSucursalColegio)
                .replace(/<Fecha.*?Sist.*?>/gi, new Date(solicitud.fechaSolicitud).toLocaleDateString('es-CL'))
                .replace(/<Solicitud.*?>/gi, solicitud.solicitud)
                .replace(/<Canti.*?>/gi, String(solicitud.cantidad))
                .replace(/<Fecha.*?Gest.*?>/gi, new Date(solicitud.fechaGestacion).toLocaleDateString('es-CL'))
                .replace(/<Servi.*?>/gi, solicitud.servicio)
                .replace(/<Motiv.*?>/gi, solicitud.motivo);
        };

        subject = replaceTags(subject);
        body = replaceTags(body);

        if (correosTo.length > 0) {
            console.log(`[SIMULACIÓN CORREO] Enviando correo electrónico...`);
            console.log(`PARA: ${correosTo.join(', ')}`);
            console.log(`CC: ${correosCc.join(', ')}`);
            console.log(`ASUNTO: ${subject}`);
            console.log(`CUERPO:\n${body}`);
            
            // Obtenemos las credenciales globales
            const emailConfig = await prisma.emailConfig.findFirst({
                where: { id: "global" }
            })

            if (!emailConfig) {
                console.error("No hay configuración de correo registrada en el sistema, no se puede enviar.")
                return;
            }

            // Instanciamos nodemailer usando office365 (es lo que está por defecto en el sistema para Outlook/Exchange)
            const transport = nodemailer.createTransport({
                host: "smtp.office365.com",
                port: 587,
                secure: false, // TLS
                auth: {
                    user: emailConfig.email,
                    pass: emailConfig.password
                }
            })

            try {
                const info = await transport.sendMail({
                    from: emailConfig.email,
                    to: correosTo,
                    cc: correosCc,
                    subject: subject,
                    text: body
                })
                console.log(`[CORREO ENVIADO CON ÉXITO] ${info.messageId}`)
            } catch (authError) {
                console.error("[ERROR NODEMAILER]: Error de validación o envío con las credenciales dadas", authError)
            }
        }
    } catch (e) {
        console.error("Error al procesar el envío de notificaciones:", e)
        // No bloqueamos la creación de la solicitud si los correos fallan
    }
}
