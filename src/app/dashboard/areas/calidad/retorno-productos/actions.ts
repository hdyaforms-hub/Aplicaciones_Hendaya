'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { sendGenericaNotification } from '@/lib/notifications'

// Ensure upload directory exists
const encodePath = (p: string) => p
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'retorno-productos')
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

export async function getAlertas() {
    return prisma.retornoProductosAlerta.findMany({
        orderBy: { fechaCreacion: 'desc' },
        include: {
            sucursalesEstado: {
                include: { sucursal: true }
            },
            movimientos: {
                include: { sucursal: true },
                orderBy: { fechaRegistro: 'desc' }
            }
        }
    })
}

export async function crearAlerta(formData: FormData, username: string) {
    try {
        const titulo = formData.get('titulo') as string
        const observacion = formData.get('observacion') as string
        const horas = parseInt(formData.get('horas') as string, 10)
        const color = formData.get('color') as string || 'yellow'

        // Manejo de archivos
        const archivosGuardados: string[] = []
        for (let i = 0; i < 5; i++) {
            const file = formData.get(`archivo_${i}`) as File
            if (file && file.size > 0) {
                const ext = path.extname(file.name)
                const filename = `${uuidv4()}${ext}`
                const filepath = path.join(UPLOAD_DIR, filename)
                const buffer = Buffer.from(await file.arrayBuffer())
                fs.writeFileSync(filepath, buffer)
                archivosGuardados.push(`/uploads/retorno-productos/${filename}`)
            }
        }

        // Crear Alerta
        const alerta = await prisma.retornoProductosAlerta.create({
            data: {
                titulo,
                observacion,
                horas,
                color,
                usuarioCreacion: username,
                archivos: JSON.stringify(archivosGuardados),
                estado: 'ABIERTA'
            }
        })

        // Obtener todas las sucursales
        const sucursales = await prisma.sucursal.findMany()

        // Insertar estado para cada sucursal
        const estadosCrear = sucursales.map(suc => ({
            alertaId: alerta.id,
            sucursalId: suc.id,
            estado: 'PENDIENTE'
        }))

        if (estadosCrear.length > 0) {
            await prisma.retornoProductosSucursalEstado.createMany({
                data: estadosCrear
            })
        }

        // Send Email Notification Automatically
        const bodyHtml = `
            <div style="font-family: sans-serif; background: #fef08a; padding: 20px; border-radius: 10px; border: 1px solid #eab308;">
                <h2 style="color: #854d0e;">📌 Nueva Alerta de Calidad</h2>
                <p><strong>Título:</strong> ${titulo}</p>
                <p><strong>Observación:</strong> <br/>${observacion}</p>
                <p><strong>Horas de respuesta:</strong> ${horas} hs</p>
                <hr style="border: none; border-top: 1px dashed #ca8a04; margin: 15px 0;"/>
                <p style="font-size: 12px; color: #a16207;">Creado por: ${username} | ${new Date().toLocaleString()}</p>
            </div>
        `

        await sendGenericaNotification({
            codigoPantalla: 'RETORNO_PRODUCTOS', 
            subject: `[Alerta Calidad] ${titulo}`,
            bodyHtml,
            tags: {
                Titulo: titulo,
                Observacion: observacion,
                Horas: horas.toString(),
                Usuario: username
            }
        })

        revalidatePath('/dashboard/areas/calidad/retorno-productos')
        return { success: true }
    } catch (error: any) {
        console.error('Error al crear alerta:', error)
        return { error: error.message || 'Error desconocido' }
    }
}

export async function registrarMovimiento(formData: FormData, alertaId: string, sucursalId: string, username: string) {
    try {
        const comentario = formData.get('comentario') as string
        const finalizar = formData.get('finalizar') === 'true'

        // Archivos
        const archivosGuardados: string[] = []
        for (let i = 0; i < 5; i++) {
            const file = formData.get(`archivo_${i}`) as File
            if (file && file.size > 0) {
                const ext = path.extname(file.name)
                const filename = `${uuidv4()}${ext}`
                const filepath = path.join(UPLOAD_DIR, filename)
                const buffer = Buffer.from(await file.arrayBuffer())
                fs.writeFileSync(filepath, buffer)
                archivosGuardados.push(`/uploads/retorno-productos/${filename}`)
            }
        }

        // Crear Movimiento
        const movimiento = await prisma.retornoProductosMovimiento.create({
            data: {
                alertaId,
                sucursalId,
                usuarioRegistro: username,
                comentario,
                archivos: JSON.stringify(archivosGuardados)
            },
            include: {
                alerta: true,
                sucursal: true
            }
        })

        if (finalizar) {
            await prisma.retornoProductosSucursalEstado.update({
                where: {
                    alertaId_sucursalId: { alertaId, sucursalId }
                },
                data: {
                    estado: 'FINALIZADO',
                    usuarioCierre: username,
                    fechaCierre: new Date()
                }
            })

            /* 
               AUTO-CIERRE DESHABILITADO POR REQUERIMIENTO:
               El cierre debe ser manual por un usuario de Calidad.
            */
        }

        // Send Notification
        const bodyHtml = `
            <div style="font-family: sans-serif; background: #e0f2fe; padding: 20px; border-radius: 10px; border: 1px solid #7dd3fc;">
                <h2 style="color: #0369a1;">🔔 Registro de Movimiento - ${movimiento.sucursal.nombre}</h2>
                <p><strong>Alerta origen:</strong> ${movimiento.alerta.titulo}</p>
                <p><strong>Comentarios:</strong> <br/>${comentario}</p>
                ${finalizar ? '<p style="color: #15803d; font-weight: bold;">✅ La sucursal ha finalizado su gestión.</p>' : ''}
                <hr style="border: none; border-top: 1px dashed #38bdf8; margin: 15px 0;"/>
                <p style="font-size: 12px; color: #0284c7;">Registrado por: ${username} | ${new Date().toLocaleString()}</p>
            </div>
        `

        await sendGenericaNotification({
            codigoPantalla: 'RETORNO_PRODUCTOS', 
            subject: `[Movimiento Calidad] ${movimiento.alerta.titulo} - ${movimiento.sucursal.nombre}`,
            bodyHtml,
            tags: {
                Titulo: movimiento.alerta.titulo,
                Observacion: movimiento.alerta.observacion,
                Horas: movimiento.alerta.horas.toString(),
                Sucursal: movimiento.sucursal.nombre,
                Comentario: comentario,
                Usuario: username
            }
        })

        revalidatePath('/dashboard/areas/calidad/retorno-productos')
        return { success: true }
    } catch (error: any) {
        console.error('Error al registrar movimiento:', error)
        return { error: error.message || 'Error desconocido' }
    }
}

export async function cerrarAlertaDefinitiva(alertaId: string, conclusion: string, username: string) {
    try {
        const check = await prisma.retornoProductosAlerta.findUnique({
            where: { id: alertaId },
            include: { sucursalesEstado: { include: { sucursal: true } } }
        })

        if (!check) throw new Error('Alerta no encontrada')

        const hasPending = check.sucursalesEstado.some(s => s.estado !== 'FINALIZADO' && s.sucursal.nombre !== 'CASA MATRIZ')
        if (hasPending) {
            throw new Error('No se puede cerrar la alerta porque aún hay bodegas con tareas pendientes.')
        }

        const alerta = await prisma.retornoProductosAlerta.update({
            where: { id: alertaId },
            data: {
                estado: 'CERRADA',
                conclusionFinal: conclusion,
                usuarioCierre: username,
                fechaCierre: new Date()
            }
        })

        // Notificación Final de Cierre
        const bodyHtml = `
            <div style="font-family: sans-serif; background: #f0fdf4; padding: 20px; border-radius: 10px; border: 1px solid #4ade80;">
                <h2 style="color: #166534;">✅ Alerta de Calidad Cerrada</h2>
                <p><strong>Alerta:</strong> ${alerta.titulo}</p>
                <p><strong>Conclusión Final:</strong> <br/>${conclusion}</p>
                <hr style="border: none; border-top: 1px dashed #22c55e; margin: 15px 0;"/>
                <p style="font-size: 12px; color: #15803d;">Cerrado por: ${username} | ${new Date().toLocaleString()}</p>
            </div>
        `

        await sendGenericaNotification({
            codigoPantalla: 'RETORNO_PRODUCTOS', 
            subject: `[CIERRE DEFINITIVO] ${alerta.titulo}`,
            bodyHtml,
            tags: {
                Titulo: alerta.titulo,
                Observacion: alerta.observacion,
                Horas: alerta.horas.toString(),
                Comentario: conclusion, // Usamos la conclusión como el "último comentario" solicitado
                Usuario: username
            }
        })

        revalidatePath('/dashboard/areas/calidad/retorno-productos')
        return { success: true }
    } catch (error: any) {
        console.error('Error al cerrar alerta:', error)
        return { error: error.message || 'Error desconocido' }
    }
}

export async function eliminarAlertaEnCascada(alertaId: string, motivo: string, username: string, userRole: string) {
    if (userRole !== 'Administrador') {
        return { error: 'No autorizado. Solo los administradores pueden eliminar alertas.' }
    }

    try {
        const alerta = await prisma.retornoProductosAlerta.findUnique({
            where: { id: alertaId }
        })

        if (!alerta) return { error: 'Alerta no encontrada' }

        // 1. Guardar en historial
        await prisma.retornoProductosAlertaHistorialEliminado.create({
            data: {
                alertaIdOriginal: alerta.id,
                tituloAlerta: alerta.titulo,
                observacionAlerta: alerta.observacion,
                motivoEliminacion: motivo,
                usuarioEliminador: username
            }
        })

        // 2. Transacción de borrado en cascada manual
        await prisma.$transaction([
            prisma.retornoProductosMovimiento.deleteMany({ where: { alertaId: alerta.id } }),
            prisma.retornoProductosSucursalEstado.deleteMany({ where: { alertaId: alerta.id } }),
            prisma.retornoProductosAlerta.delete({ where: { id: alerta.id } })
        ])

        revalidatePath('/dashboard/areas/calidad/retorno-productos')
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar alerta:', error)
        return { error: error.message || 'Error desconocido' }
    }
}
