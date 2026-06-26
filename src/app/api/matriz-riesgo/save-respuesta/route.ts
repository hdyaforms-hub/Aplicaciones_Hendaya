import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !session.user) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { cabeceraId, ut, rbd, respuestas, latIngreso, lngIngreso } = body

        if (!cabeceraId || !ut || !rbd || !respuestas) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos.' }, { status: 400 })
        }

        // We use user's session data for hidden fields
        const supervisorNombre = session.user.name || session.user.username
        const supervisorCorreo = session.user.email || ''
        const usuario = session.user.username

        // Get the Matrix template to know the licId
        const matrixTemplate = await prisma.matrizT_Cabecera.findUnique({
            where: { id: cabeceraId }
        })

        if (!matrixTemplate) {
            return NextResponse.json({ success: false, error: 'Matriz no encontrada.' }, { status: 404 })
        }

        // Fetch Colegio details to get the sucursal name
        const colegio = await prisma.colegiosMatriz.findUnique({
            where: { colRBD: Number(rbd) }
        })

        // Create the Answer Header
        const respuestaCabecera = await prisma.matrizT_RespuestasCabecera.create({
            data: {
                cabeceraId,
                usuario,
                supervisorNombre,
                supervisorCorreo,
                licId: matrixTemplate.licId,
                ut: Number(ut),
                rbd: Number(rbd),
                fechaIngreso: new Date(),
                latIngreso: latIngreso != null ? Number(latIngreso) : null,
                lngIngreso: lngIngreso != null ? Number(lngIngreso) : null,
                estado: 'pendiente'
            }
        })

        // Create details
        if (respuestas.length > 0) {
            const dataToInsert = respuestas.map((r: any) => ({
                respuestaCabeceraId: respuestaCabecera.id,
                preguntaId: r.preguntaId,
                valor: r.valor,
                adjuntoUrl: r.adjuntoUrl // This will store the base64 JSON string
            }))

            await prisma.matrizT_RespuestasDetalle.createMany({
                data: dataToInsert
            })

            // If there are no findings, the state is immediately "por supervisar"
            const BAD_VALUES = ['NO', 'NO_EXISTE', 'MALO_NO_CUMPLE', 'NO_HAY_REQUIERE']
            const hasFindings = respuestas.some((r: any) => BAD_VALUES.includes(r.valor))
            if (!hasFindings) {
                await prisma.matrizT_RespuestasCabecera.update({
                    where: { id: respuestaCabecera.id },
                    data: { estado: 'por supervisar' }
                })
            }
        }

        // Find formats of Sostenedor letter
        const formatosCarta = await prisma.formatoCartaSostenedor.findMany({
            where: { cabeceraId, activo: true }
        })

        // Filter deviations
        const BAD_VALUES = ['NO', 'NO_EXISTE', 'MALO_NO_CUMPLE', 'NO_HAY_REQUIERE']
        const sostenedorFindings = []
        const prestadorFindings = []

        const detallesTemplate = await prisma.matrizT_Detalle.findMany({
            where: { cabeceraId }
        })

        for (const resp of respuestas) {
            if (BAD_VALUES.includes(resp.valor)) {
                const det = detallesTemplate.find(d => d.id === resp.preguntaId)
                if (det) {
                    if (det.respImplementacion === 'Sostenedor') {
                        sostenedorFindings.push({
                            preguntaId: det.id,
                            preguntaNombre: det.preguntaNombre,
                            compromisoSostenedor: det.compromisoSostenedor || det.preguntaNombre,
                            seccion: det.seccion,
                            valor: resp.valor
                        })
                    } else if (det.respImplementacion === 'Prestador') {
                        prestadorFindings.push({
                            preguntaId: det.id,
                            preguntaNombre: det.preguntaNombre,
                            seccion: det.seccion,
                            valor: resp.valor
                        })
                    }
                }
            }
        }

        // Trigger Prestador background alerts if any
        if (prestadorFindings.length > 0) {
            try {
                await sendPrestadorAlerts({
                    rbd: Number(rbd),
                    colegioName: colegio?.nombreEstablecimiento || '',
                    sucursalName: colegio?.sucursal || '',
                    supervisorNombre,
                    supervisorCorreo,
                    findings: prestadorFindings
                })
            } catch (err) {
                console.error("Error sending Prestador alerts:", err)
            }
        }

        return NextResponse.json({
            success: true,
            id: respuestaCabecera.id,
            sostenedorFindings,
            formatosCarta
        })
    } catch (error) {
        console.error('Error guardando respuesta matriz:', error)
        return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 })
    }
}

async function sendPrestadorAlerts({
    rbd,
    colegioName,
    sucursalName,
    supervisorNombre,
    supervisorCorreo,
    findings
}: {
    rbd: number
    colegioName: string
    sucursalName: string
    supervisorNombre: string
    supervisorCorreo: string
    findings: any[]
}) {
    const codigoPantalla = 'matriz-prestador'
    
    // Find active notification configurations
    const configs = await prisma.notificacionPantalla.findMany({
        where: { codigoPantalla, activa: true },
        include: { listaCorreo: { include: { sucursal: true } } }
    })

    // Filter list by sucursal
    const destinos = configs.map(c => c.listaCorreo).filter(lista => {
        if (!lista.sucursalId) return true
        if (sucursalName && lista.sucursal?.nombre) {
            return lista.sucursal.nombre.toLowerCase().includes(sucursalName.toLowerCase()) ||
                   sucursalName.toLowerCase().includes(lista.sucursal.nombre.toLowerCase())
        }
        return false
    })

    let to: string[] = []
    let cc: string[] = []

    destinos.forEach(lista => {
        try {
            const p = JSON.parse(lista.para || '[]')
            const c = JSON.parse(lista.cc || '[]')
            if (Array.isArray(p)) to.push(...p)
            if (Array.isArray(c)) cc.push(...c)
        } catch (e) {}
    })

    // Look up supervisor direct bosses
    const supervisor = await prisma.supervisor.findFirst({
        where: { correo: supervisorCorreo, vigente: true },
        include: { jefeOperacion: true, jefeZonal: true }
    })

    if (supervisor) {
        if (supervisor.jefeZonal?.correo) {
            to.push(supervisor.jefeZonal.correo)
        }
        if (supervisor.jefeOperacion?.correo) {
            to.push(supervisor.jefeOperacion.correo)
        }
    }

    // Look up sucursal bosses
    if (sucursalName) {
        const sucursalDb = await prisma.sucursal.findFirst({
            where: { nombre: { equals: sucursalName, mode: 'insensitive' } },
            include: { jefesZonales: { include: { jefeZonal: true } } }
        })
        if (sucursalDb) {
            sucursalDb.jefesZonales.forEach(jz => {
                if (jz.jefeZonal.vigente && jz.jefeZonal.correo) {
                    cc.push(jz.jefeZonal.correo)
                }
            })
        }
    }

    // Deduplicate and validate
    to = Array.from(new Set(to)).filter(e => e && e.includes('@'))
    cc = Array.from(new Set(cc)).filter(e => e && e.includes('@'))

    if (to.length === 0) {
        console.log("No recipients found for Prestador alert email.")
        return
    }

    // Load templates
    let plantilla = await prisma.plantillaCorreo.findUnique({
        where: { codigoPantalla }
    })

    if (!plantilla) {
        plantilla = await prisma.plantillaCorreo.create({
            data: {
                codigoPantalla,
                asunto: 'Alerta Prestador - Desviaciones en RBD <RBD>',
                cuerpo: 'Estimados,\n\nSe han registrado desviaciones a cargo del Prestador en la matriz de riesgo del establecimiento <Colegio> (RBD <RBD>, Sucursal <Sucursal>).\n\nDetalle de Desviaciones:\n<DetalleDesviaciones>\n\nAtte.\nSistema de Gestión Hendaya.'
            }
        })
    }

    // Format deviations list
    let tableRows = ''
    findings.forEach((f: any) => {
        tableRows += `<tr>
            <td style="padding:8px; border:1px solid #eee; font-size: 13px;"><b>${f.seccion}</b></td>
            <td style="padding:8px; border:1px solid #eee; font-size: 13px;">${f.preguntaNombre}</td>
            <td style="padding:8px; border:1px solid #eee; font-size: 13px; color: #ef4444; font-weight: bold;">${f.valor}</td>
        </tr>`
    })

    const detailHtml = `
        <table style="width:100%; border-collapse:collapse; margin:15px 0;">
            <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                    <th style="padding:8px; border:1px solid #eee; text-align:left; font-size:12px; font-weight:bold; color:#475569;">Sección</th>
                    <th style="padding:8px; border:1px solid #eee; text-align:left; font-size:12px; font-weight:bold; color:#475569;">Requisito / Desviación</th>
                    <th style="padding:8px; border:1px solid #eee; text-align:left; font-size:12px; font-weight:bold; color:#475569;">Respuesta</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `

    const replaceTags = (text: string) => {
        return text
            .replace(/<RBD.*?>/gi, String(rbd))
            .replace(/<Colegio.*?>/gi, colegioName)
            .replace(/<Usuario.*?>/gi, supervisorNombre)
            .replace(/<Sucursal.*?>/gi, sucursalName)
            .replace(/<DetalleDesviaciones.*?>/gi, detailHtml)
    }

    const subject = replaceTags(plantilla.asunto)
    const bodyText = replaceTags(plantilla.cuerpo).replace(/<[^>]*>?/gm, '') // text fallback
    
    // HTML template wrapper
    const bodyHtml = `
        <div style="font-family: sans-serif; max-width: 650px; margin: auto; border: 1px solid #eee; border-radius: 10px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h2 style="color: #0891b2; margin-top:0;">Alerta de Desviación - Prestador</h2>
            <p style="font-size:14px; color:#475569;">Notificación de hallazgos detectados en la auditoría de matriz de riesgo.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${replaceTags(plantilla.cuerpo).replace('<DetalleDesviaciones>', detailHtml)}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Mensaje automático enviado por Aplicaciones Hendaya</p>
        </div>
    `

    const emailConfig = await prisma.emailConfig.findFirst({ where: { id: "global" } })
    if (emailConfig) {
        // Decrypt password
        const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET || 'super-secret-key-change-me')).digest('base64').substring(0, 32)
        const textParts = emailConfig.password.split(':')
        const iv = Buffer.from(textParts.shift()!, 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv)
        let decrypted = decipher.update(encryptedText)
        decrypted = Buffer.concat([decrypted, decipher.final()])
        const password = decrypted.toString()

        const transport = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: { user: emailConfig.email, pass: password },
            tls: { rejectUnauthorized: false }
        })

        await transport.sendMail({
            from: `"Hendaya Alertas" <${emailConfig.email}>`,
            to: to.join(','),
            cc: cc.length > 0 ? cc.join(',') : undefined,
            subject,
            text: bodyText,
            html: bodyHtml
        })
    }
}
