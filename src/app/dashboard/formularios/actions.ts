'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { sendFormNotification } from '@/lib/notifications'

export type FormField = {
    id: string
    type: 'text' | 'textarea' | 'date' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'signature' | 'section' | 'linear-scale' | 'rating' | 'grid-multiple' | 'grid-checkbox' | 'time' | 'file'
    label: string
    required: boolean
    options?: string[]
    systemSource?: 'UT' | 'RBD' | 'SUCURSAL'
    validationType?: 'text' | 'number' | 'email' | 'rut'
    maxFileSize?: number // in MB
    allowedFileTypes?: string[] // e.g. ['image/*', 'application/pdf']
    scaleMin?: number
    scaleMax?: number
    gridRows?: string[]
    gridCols?: string[]
}

export async function saveFormDefinition(id: string | null, title: string, description: string | null, fields: FormField[], isActive: boolean = true) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        return { error: 'No tienes permisos para realizar esta acción' }
    }

    try {
        if (id) {
            // Check if editable
            const submissionCount = await prisma.formSubmission.count({ where: { formId: id } })
            if (submissionCount > 0) {
                // If it has submissions, only allow updating status or title/desc? 
                // The user says: "si ya tiene respuestas asociadas no se puede editar"
                // I'll interpret this as "cannot change fields"
                const existing = await prisma.formDefinition.findUnique({ where: { id } })
                if (existing && existing.fields !== JSON.stringify(fields)) {
                    return { error: 'No se puede editar los campos de un formulario que ya tiene respuestas' }
                }
            }

            await prisma.formDefinition.update({
                where: { id },
                data: {
                    title,
                    description,
                    fields: JSON.stringify(fields),
                    isActive
                }
            })
            revalidatePath('/dashboard/formularios/abrir')
            return { success: true, id }
        } else {
            const form = await prisma.formDefinition.create({
                data: {
                    title,
                    description,
                    fields: JSON.stringify(fields),
                    isActive,
                    createdBy: session.user.username as string
                }
            })

            revalidatePath('/dashboard/formularios/abrir')
            return { success: true, id: form.id }
        }
    } catch (e) {
        console.error('Error saving form definition:', e)
        return { error: 'Error al guardar el formulario' }
    }
}

export async function getFormDefinitions(includeInactive: boolean = false) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('fill_formularios')) {
        return { error: 'No tienes permisos para ver formularios' }
    }

    try {
        const now = new Date()
        const currentDay = now.getDay() // 0-6
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        const forms = await prisma.formDefinition.findMany({
            where: {
                AND: [
                    includeInactive ? {} : { isActive: true },
                    // Filter by allowed users if any are specified. If empty, everyone sees it?
                    // Or if any are specified, only those users see it.
                    {
                        OR: [
                            { allowedUsers: { none: {} } }, // No users specified -> Public (for logged in users)
                            { allowedUsers: { some: { id: session.user.id } } }
                        ]
                    }
                ]
            },
            include: {
                schedules: true
            },
            orderBy: { createdAt: 'desc' }
        })

        // Filter by schedules in JS for simplicity or complex SQL? 
        // Let's do it in JS since there won't be thousands of active schedules per fetch
        const filteredForms = forms.filter(form => {
            if (form.schedules.length === 0) return true // Always active if no schedule

            return form.schedules.some(s => {
                // Simplified schedule check: check if now is between startDay/Time and endDay/Time
                // This handles weekly cycles.
                const startMins = s.startDay * 1440 + timeToMins(s.startTime)
                const endMins = s.endDay * 1440 + timeToMins(s.endTime)
                const currentMins = currentDay * 1440 + timeToMins(currentTime)

                if (startMins <= endMins) {
                    return currentMins >= startMins && currentMins <= endMins
                } else {
                    // Spans over weekend end to start
                    return currentMins >= startMins || currentMins <= endMins
                }
            })
        })

        return {
            forms: filteredForms.map(f => ({
                ...f,
                fields: JSON.parse(f.fields) as FormField[]
            }))
        }
    } catch (e) {
        console.error('Error fetching forms:', e)
        return { error: 'Error al obtener formularios' }
    }
}

function timeToMins(time: string) {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

export async function getFormEditability(id: string) {
    try {
        const submissionCount = await prisma.formSubmission.count({ where: { formId: id } })
        return { isEditable: submissionCount === 0, submissionCount }
    } catch (e) {
        return { isEditable: false, error: 'error' }
    }
}

export async function updateFormPrivileges(formId: string, userIds: string[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        return { error: 'No tienes permisos' }
    }

    try {
        await prisma.formDefinition.update({
            where: { id: formId },
            data: {
                allowedUsers: {
                    set: userIds.map(id => ({ id }))
                }
            }
        })
        return { success: true }
    } catch (e) {
        return { error: 'Error al actualizar privilegios' }
    }
}

export async function updateFormSchedules(formId: string, schedules: { startDay: number, startTime: string, endDay: number, endTime: string }[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        return { error: 'No tienes permisos' }
    }

    try {
        await prisma.$transaction([
            prisma.formSchedule.deleteMany({ where: { formId } }),
            prisma.formSchedule.createMany({
                data: schedules.map(s => ({ ...s, formId }))
            })
        ])
        return { success: true }
    } catch (e) {
        return { error: 'Error al actualizar calendario' }
    }
}

export async function getAllUsers() {
    try {
        return await prisma.user.findMany({
            select: { id: true, username: true, name: true },
            orderBy: { username: 'asc' }
        })
    } catch (e) {
        return []
    }
}

export async function getFormWithRelations(id: string) {
    try {
        const form = await prisma.formDefinition.findUnique({
            where: { id },
            include: {
                allowedUsers: { select: { id: true } },
                schedules: true
            }
        })
        if (!form) return null
        return {
            ...form,
            fields: JSON.parse(form.fields) as FormField[],
            allowedUserIds: form.allowedUsers.map(u => u.id)
        }
    } catch (e) {
        return null
    }
}

export async function getFormById(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('fill_formularios')) {
        return { error: 'No tienes permisos para acceder a este formulario' }
    }

    try {
        const form = await prisma.formDefinition.findUnique({
            where: { id }
        })

        if (!form) return { error: 'Formulario no encontrado' }

        return {
            form: {
                ...form,
                fields: JSON.parse(form.fields) as FormField[]
            }
        }
    } catch (e) {
        return { error: 'Error al cargar el formulario' }
    }
}

export async function uploadFile(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) return { error: 'No se subió ningún archivo' }

    // Check size (100MB)
    if (file.size > 100 * 1024 * 1024) {
        return { error: 'El archivo excede los 100MB permitidos' }
    }

    try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        const path = require('path')
        const fs = require('fs')
        
        const uploadDir = path.join(process.cwd(), 'public', 'uploads')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        const filePath = path.join(uploadDir, filename)
        fs.writeFileSync(filePath, buffer)

        return { success: true, url: `/uploads/${filename}`, filename: file.name }
    } catch (e) {
        console.error('Error uploading file:', e)
        return { error: 'Error al subir el archivo' }
    }
}

export function validateChileanRut(rut: string) {
    // Limpiar puntos y guión
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase()
    if (cleanRut.length < 2) return false

    const body = cleanRut.slice(0, -1)
    const dv = cleanRut.slice(-1)

    if (!/^\d+$/.test(body)) return false

    let sum = 0
    let multiplier = 2

    for (let i = body.length - 1; i >= 0; i--) {
        const digit = parseInt(body[i])
        if (isNaN(digit)) return false
        sum += digit * multiplier
        multiplier = multiplier === 7 ? 2 : multiplier + 1
    }

    const expectedDv = 11 - (sum % 11)
    let finalDv: string
    if (expectedDv === 11) finalDv = '0'
    else if (expectedDv === 10) finalDv = 'K'
    else finalDv = expectedDv.toString()

    return finalDv === dv
}

export async function saveFormSubmission(formId: string, data: any) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('fill_formularios')) {
        return { error: 'No tienes permisos para enviar formularios' }
    }

    try {
        const form = await prisma.formDefinition.findUnique({ where: { id: formId } })
        if (!form) return { error: 'Formulario no encontrado' }

        const submission = await prisma.formSubmission.create({
            data: {
                formId,
                data: JSON.stringify(data),
                submittedBy: session.user.username as string
            }
        })
        
        // --- NOTIFICACIONES ---
        let emailWarning: string | undefined;
        try {
            const notif = await sendFormNotification(form, data, session.user.username as string)
            if (notif?.warning) emailWarning = notif.warning;
        } catch (notifierr) {
            console.error("Error al procesar notificaciones de formularios:", notifierr)
        }
        
        return { success: true, emailWarning }
    } catch (e) {
        console.error('Error saving submission:', e)
        return { error: 'Error al guardar la respuesta' }
    }
}

export async function getSystemSourceData(source: 'UT' | 'RBD' | 'SUCURSAL') {
    try {
        if (source === 'UT') {
            const uts = await prisma.uT.findMany({ select: { codUT: true }, orderBy: { codUT: 'asc' } })
            return uts.map(u => u.codUT.toString())
        }
        if (source === 'RBD') {
            const colegios = await prisma.colegios.findMany({ select: { colRBD: true, nombreEstablecimiento: true }, take: 50, orderBy: { colRBD: 'asc' } })
            return colegios.map(c => `${c.colRBD} - ${c.nombreEstablecimiento}`)
        }
        if (source === 'SUCURSAL') {
            const sucs = await prisma.sucursal.findMany({ select: { nombre: true }, orderBy: { nombre: 'asc' } })
            return sucs.map(s => s.nombre)
        }
        return []
    } catch (e) {
        return []
    }
}
