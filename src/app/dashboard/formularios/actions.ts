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

export async function saveFormDefinition(
    id: string | null, 
    title: string, 
    description: string | null, 
    fields: FormField[], 
    isActive: boolean = true,
    metadata?: { formCode?: string, formVersion?: string, formDate?: string }
) {
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
                    isActive,
                    formCode: metadata?.formCode,
                    formVersion: metadata?.formVersion,
                    formDate: metadata?.formDate
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
                    createdBy: session.user.username as string,
                    formCode: metadata?.formCode,
                    formVersion: metadata?.formVersion,
                    formDate: metadata?.formDate
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
                schedules: true,
                _count: {
                    select: { submissions: true }
                }
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

import { validateChileanRut } from '@/lib/validation'

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

// Se usa la función importada de @/lib/validation

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
        
        return { success: true, id: submission.id, emailWarning }
    } catch (e) {
        console.error('Error saving submission:', e)
        return { error: 'Error al guardar la respuesta' }
    }
}

export async function getSystemSourceData(source: 'UT' | 'RBD' | 'SUCURSAL', filters?: Record<string, any>) {
    try {
        if (source === 'SUCURSAL') {
            const sucs = await prisma.sucursal.findMany({ select: { nombre: true }, orderBy: { nombre: 'asc' } })
            return sucs.map(s => s.nombre)
        }
        
        if (source === 'UT') {
            const where: any = { estado: 1 }
            if (filters?.sucursal) {
                where.sucursal = { nombre: filters.sucursal }
            }
            const uts = await prisma.uT.findMany({ 
                where,
                select: { codUT: true }, 
                orderBy: { codUT: 'asc' } 
            })
            return uts.map(u => u.codUT.toString())
        }
        
        if (source === 'RBD') {
            const where: any = {}
            if (filters?.ut) {
                const utNum = parseInt(filters.ut)
                if (!isNaN(utNum)) where.colut = utNum
            }
            if (filters?.sucursal) {
                where.sucursal = { contains: filters.sucursal }
            }
            const colegios = await prisma.colegios.findMany({ 
                where,
                select: { colRBD: true, nombreEstablecimiento: true }, 
                take: 200, 
                orderBy: { colRBD: 'asc' } 
            })
            return colegios.map(c => `${c.colRBD} - ${c.nombreEstablecimiento}`)
        }
        return []
    } catch (e) {
        console.error('Error fetching system source data:', e)
        return []
    }
}
export async function deleteForm(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        return { error: 'No tienes permisos para eliminar formularios' }
    }

    try {
        const submissionCount = await prisma.formSubmission.count({ where: { formId: id } })
        if (submissionCount > 0) {
            return { error: 'No se puede eliminar un formulario que ya tiene respuestas registradas' }
        }

        await prisma.$transaction([
            prisma.formSchedule.deleteMany({ where: { formId: id } }),
            prisma.formDefinition.delete({ where: { id } })
        ])

        revalidatePath('/dashboard/formularios/gestion')
        revalidatePath('/dashboard/formularios/abrir')
        return { success: true }
    } catch (e) {
        console.error('Error deleting form:', e)
        return { error: 'Error al eliminar el formulario' }
    }
}

export async function getFormSubmissionsExport(formId: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        return { error: 'No tienes permisos para exportar respuestas' }
    }

    try {
        const form = await prisma.formDefinition.findUnique({
            where: { id: formId }
        })
        if (!form) return { error: 'Formulario no encontrado' }

        const submissions = await prisma.formSubmission.findMany({
            where: { formId },
            orderBy: { submittedAt: 'desc' }
        })

        return {
            success: true,
            title: form.title,
            fields: JSON.parse(form.fields) as any[],
            submissions: submissions.map(s => ({
                ...s,
                data: JSON.parse(s.data)
            }))
        }
    } catch (e) {
        console.error('Error fetching submissions for export:', e)
        return { error: 'Error al obtener las respuestas' }
    }
}

export async function toggleFormStatus(id: string, active: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        return { error: 'No tienes permisos para esta acción' }
    }

    try {
        await prisma.formDefinition.update({
            where: { id },
            data: { isActive: active }
        })
        revalidatePath('/dashboard/formularios/gestion')
        revalidatePath('/dashboard/formularios/abrir')
        return { success: true }
    } catch (e) {
        console.error('Error toggling form status:', e)
        return { error: 'Error al cambiar el estado del formulario' }
    }
}

export async function getForms() {
    try {
        return await prisma.formDefinition.findMany({
            where: { isActive: true },
            select: { id: true, title: true }
        })
    } catch (error) {
        return []
    }
}

export async function getFormSubmissions(filters: { formId?: string, username?: string, page?: number }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_respuestas')) {
        return { error: 'No autorizado' }
    }

    const page = filters.page || 1
    const limit = 15
    const skip = (page - 1) * limit

    const where: any = {}
    if (filters.formId) where.formId = filters.formId
    if (filters.username) where.submittedBy = { contains: filters.username }

    try {
        const [total, submissions] = await Promise.all([
            prisma.formSubmission.count({ where }),
            prisma.formSubmission.findMany({
                where,
                include: { form: true },
                orderBy: { submittedAt: 'desc' },
                skip,
                take: limit
            })
        ])

        return { 
            submissions: submissions.map(s => ({
                ...s,
                data: JSON.parse(s.data)
            })), 
            total, 
            totalPages: Math.ceil(total / limit),
            currentPage: page
        }
    } catch (error) {
        console.error('Error fetching submissions:', error)
        return { error: 'Error al obtener respuestas' }
    }
}

export async function sendSubmissionEmail(
    submissionId: string, 
    base64Pdf: string, 
    targetEmail: string,
    customSubject?: string,
    customBody?: string
) {
    const session = await getSession()
    if (!session) return { error: 'No autorizado' }

    try {
        const submission = await prisma.formSubmission.findUnique({
            where: { id: submissionId },
            include: { form: true }
        })

        if (!submission) return { error: 'Respuesta no encontrada' }

        // Importar dinámicamente para evitar dependencias circulares
        const { sendAttachmentEmail } = await import('@/lib/notifications')

        const result = await sendAttachmentEmail({
            to: targetEmail,
            subject: customSubject || `Respuesta Formulario: ${submission.form.title}`,
            body: customBody || `Se adjunta la respuesta enviada para el formulario ${submission.form.title}.`,
            attachmentBase64: base64Pdf,
            filename: `Formulario_${submission.form.title.replace(/\s+/g, '_')}.pdf`,
            codigoPantalla: 'form-submission-pdf'
        })

        return result
    } catch (error) {
        console.error('Error sending submission email:', error)
        return { error: 'Error al enviar el correo' }
    }
}

export async function getSubmissionTemplate() {
    try {
        const plantilla = await prisma.plantillaCorreo.findUnique({
            where: { codigoPantalla: 'form-submission-pdf' }
        })
        
        // También ver si hay listas de correo asociadas (opcional, para feedback al usuario si quiere)
        return {
            asunto: plantilla?.asunto || 'Respuesta Formulario: <Formulario>',
            cuerpo: plantilla?.cuerpo || 'Se adjunta la respuesta enviada para el formulario <Formulario>.'
        }
    } catch (error) {
        return {
            asunto: 'Respuesta Formulario: <Formulario>',
            cuerpo: 'Se adjunta la respuesta enviada para el formulario <Formulario>.'
        }
    }
}
