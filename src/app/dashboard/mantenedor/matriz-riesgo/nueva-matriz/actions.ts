'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function getLicitaciones() {
    try {
        const licitaciones = await prisma.licitacion.findMany({
            where: { estado: 1 },
            orderBy: { licId: 'asc' }
        })
        return { success: true, licitaciones }
    } catch (e) {
        console.error(e)
        return { error: 'Error al obtener licitaciones.' }
    }
}

export async function getMatrices() {
    try {
        const matrices = await prisma.matrizT_Cabecera.findMany({
            include: {
                licitacion: true,
                _count: {
                    select: { respuestas: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        return { success: true, matrices }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar matrices.' }
    }
}

export async function getMatrix(id: string) {
    try {
        const matrix = await prisma.matrizT_Cabecera.findUnique({
            where: { id },
            include: {
                licitacion: true,
                detalles: {
                    orderBy: { orden: 'asc' }
                },
                formatosCarta: true
            }
        })
        return { success: true, matrix }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar la matriz.' }
    }
}

export async function saveMatrixHeader(data: { id?: string, licId: number, anio: number, titulo: string, estado: boolean }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        if (data.id) {
            // Check if answered
            const answersCount = await prisma.matrizT_RespuestasCabecera.count({
                where: { cabeceraId: data.id }
            })
            if (answersCount > 0) {
                const currentMatrix = await prisma.matrizT_Cabecera.findUnique({ where: { id: data.id } });
                if (currentMatrix && (currentMatrix.licId !== Number(data.licId) || currentMatrix.anio !== Number(data.anio) || currentMatrix.titulo !== data.titulo)) {
                    return { error: 'Esta matriz ya tiene respuestas. Solo puede modificar su Estado (Vigente/No Vigente), no su título ni licitación.' }
                }
            }

            const matrix = await prisma.matrizT_Cabecera.update({
                where: { id: data.id },
                data: {
                    licId: Number(data.licId),
                    anio: Number(data.anio),
                    titulo: data.titulo,
                    estado: data.estado
                }
            })
            revalidatePath('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
            return { success: true, matrix }
        } else {
            const matrix = await prisma.matrizT_Cabecera.create({
                data: {
                    licId: Number(data.licId),
                    anio: Number(data.anio),
                    titulo: data.titulo,
                    estado: data.estado
                }
            })
            revalidatePath('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
            return { success: true, matrix }
        }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar la cabecera de la matriz.' }
    }
}

export async function deleteMatrix(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const answersCount = await prisma.matrizT_RespuestasCabecera.count({
            where: { cabeceraId: id }
        })
        if (answersCount > 0) {
            return { error: 'No se puede eliminar la matriz porque ya tiene respuestas contestadas.' }
        }

        await prisma.matrizT_Cabecera.delete({
            where: { id }
        })
        revalidatePath('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al eliminar la matriz.' }
    }
}

export async function toggleMatrixState(id: string, newState: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        await prisma.matrizT_Cabecera.update({
            where: { id },
            data: { estado: newState }
        })
        revalidatePath('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cambiar el estado de la matriz.' }
    }
}

export async function duplicateMatrix(id: string, newLicId: number, newTitulo: string, newAnio: number, newEstado: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const source = await prisma.matrizT_Cabecera.findUnique({
            where: { id },
            include: { detalles: true }
        })

        if (!source) return { error: 'La matriz de origen no existe.' }

        // Create new header
        const duplicated = await prisma.matrizT_Cabecera.create({
            data: {
                licId: newLicId,
                anio: newAnio,
                titulo: newTitulo,
                estado: newEstado,
                instrucciones: source.instrucciones
            }
        })

        // Copy details
        if (source.detalles && source.detalles.length > 0) {
            const newDetalles = source.detalles.map(d => ({
                cabeceraId: duplicated.id,
                preguntaNombre: d.preguntaNombre,
                tipoRespuesta: d.tipoRespuesta,
                obligatorio: d.obligatorio,
                seccion: d.seccion,
                orden: d.orden,
                gravedad: d.gravedad,
                probabilidad: d.probabilidad,
                nivelRiesgo: d.nivelRiesgo,
                justificacion: d.justificacion,
                riesgoSignificativo: d.riesgoSignificativo,
                recursoNecesario: d.recursoNecesario,
                resultadoEsperado: d.resultadoEsperado,
                respImplementacion: d.respImplementacion,
                respSeguimiento: d.respSeguimiento,
                evidenciaCumplimiento: d.evidenciaCumplimiento,
                evidenciaEficacia: d.evidenciaEficacia,
                compromisoSostenedor: d.compromisoSostenedor
            }))

            await prisma.matrizT_Detalle.createMany({
                data: newDetalles
            })
        }

        // Copy FormatoCartaSostenedor
        const sourceFormatos = await prisma.formatoCartaSostenedor.findMany({
            where: { cabeceraId: id }
        })
        if (sourceFormatos && sourceFormatos.length > 0) {
            await prisma.formatoCartaSostenedor.createMany({
                data: sourceFormatos.map(f => ({
                    cabeceraId: duplicated.id,
                    nombre: f.nombre,
                    asuntoEmail: f.asuntoEmail,
                    cuerpoEmail: f.cuerpoEmail,
                    cuerpoInicio: f.cuerpoInicio,
                    cuerpoFin: f.cuerpoFin,
                    activo: f.activo
                }))
            })
        }

        revalidatePath('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
        return { success: true, duplicatedId: duplicated.id }
    } catch (e) {
        console.error(e)
        return { error: 'Error al duplicar la matriz.' }
    }
}

export async function saveMatrixTemplate(cabeceraId: string, details: any[], instrucciones?: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const answersCount = await prisma.matrizT_RespuestasCabecera.count({
            where: { cabeceraId }
        })

        if (instrucciones !== undefined) {
            await prisma.matrizT_Cabecera.update({
                where: { id: cabeceraId },
                data: { instrucciones }
            })
        }
        if (answersCount > 0) {
            // Partial Update: Only update the fields that don't affect existing answers
            // such as calculo and hoja B fields. We cannot delete/insert questions.
            if (details && details.length > 0) {
                for (const d of details) {
                    if (d.id && !d.id.toString().startsWith('temp-')) {
                        await prisma.matrizT_Detalle.update({
                            where: { id: d.id },
                            data: {
                                gravedad: d.gravedad ? Number(d.gravedad) : null,
                                probabilidad: d.probabilidad ? Number(d.probabilidad) : null,
                                nivelRiesgo: d.nivelRiesgo ? Number(d.nivelRiesgo) : null,
                                justificacion: d.justificacion || null,
                                riesgoSignificativo: d.riesgoSignificativo || null,
                                recursoNecesario: d.recursoNecesario || null,
                                resultadoEsperado: d.resultadoEsperado || null,
                                respImplementacion: d.respImplementacion || null,
                                respSeguimiento: d.respSeguimiento || null,
                                evidenciaCumplimiento: d.evidenciaCumplimiento || null,
                                evidenciaEficacia: d.evidenciaEficacia || null,
                                compromisoSostenedor: d.compromisoSostenedor || null
                            }
                        })
                    }
                }
            }
        } else {
            // Delete all old details
            await prisma.matrizT_Detalle.deleteMany({
                where: { cabeceraId }
            })

            // Insert new details
            if (details && details.length > 0) {
                const dataToInsert = details.map((d, index) => ({
                    cabeceraId,
                    preguntaNombre: d.preguntaNombre,
                    tipoRespuesta: d.tipoRespuesta,
                    obligatorio: d.obligatorio === true || d.obligatorio === 'true',
                    seccion: d.seccion,
                    orden: index,
                    gravedad: d.gravedad ? Number(d.gravedad) : null,
                    probabilidad: d.probabilidad ? Number(d.probabilidad) : null,
                    nivelRiesgo: d.nivelRiesgo ? Number(d.nivelRiesgo) : null,
                    justificacion: d.justificacion || null,
                    riesgoSignificativo: d.riesgoSignificativo || null,
                    recursoNecesario: d.recursoNecesario || null,
                    resultadoEsperado: d.resultadoEsperado || null,
                    respImplementacion: d.respImplementacion || null,
                    respSeguimiento: d.respSeguimiento || null,
                    evidenciaCumplimiento: d.evidenciaCumplimiento || null,
                    evidenciaEficacia: d.evidenciaEficacia || null,
                    compromisoSostenedor: d.compromisoSostenedor || null
                }))

                await prisma.matrizT_Detalle.createMany({
                    data: dataToInsert
                })
            }
        }

        revalidatePath(`/dashboard/mantenedor/matriz-riesgo/nueva-matriz/${cabeceraId}`)
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar el detalle de la matriz.' }
    }
}

export async function saveFormatosCartaSostenedor(cabeceraId: string, formatos: any[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        await prisma.$transaction([
            prisma.formatoCartaSostenedor.deleteMany({
                where: { cabeceraId }
            }),
            prisma.formatoCartaSostenedor.createMany({
                data: formatos.map(f => ({
                    cabeceraId,
                    nombre: f.nombre,
                    asuntoEmail: f.asuntoEmail,
                    cuerpoEmail: f.cuerpoEmail,
                    cuerpoInicio: f.cuerpoInicio,
                    cuerpoFin: f.cuerpoFin,
                    activo: f.activo !== false
                }))
            })
        ])

        revalidatePath(`/dashboard/mantenedor/matriz-riesgo/nueva-matriz/${cabeceraId}`)
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al guardar los formatos de carta del sostenedor.' }
    }
}

export async function exportMatrixTemplate(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const matrix = await prisma.matrizT_Cabecera.findUnique({
            where: { id },
            include: {
                licitacion: true,
                detalles: {
                    orderBy: { orden: 'asc' }
                },
                formatosCarta: true
            }
        })

        if (!matrix) {
            return { error: 'Matriz no encontrada.' }
        }

        const exportData = {
            exportVersion: '1.0',
            moduleType: 'MATRIZ_RIESGO_PLANTILLA',
            exportedAt: new Date().toISOString(),
            cabecera: {
                titulo: matrix.titulo,
                anio: matrix.anio,
                licId: matrix.licId,
                licitacionHomologada: matrix.licitacion?.licitacionHomologada,
                estado: matrix.estado,
                instrucciones: matrix.instrucciones
            },
            detalles: (matrix.detalles || []).map(d => ({
                preguntaNombre: d.preguntaNombre,
                tipoRespuesta: d.tipoRespuesta,
                obligatorio: d.obligatorio,
                seccion: d.seccion,
                orden: d.orden,
                gravedad: d.gravedad,
                probabilidad: d.probabilidad,
                nivelRiesgo: d.nivelRiesgo,
                justificacion: d.justificacion,
                riesgoSignificativo: d.riesgoSignificativo,
                recursoNecesario: d.recursoNecesario,
                resultadoEsperado: d.resultadoEsperado,
                respImplementacion: d.respImplementacion,
                respSeguimiento: d.respSeguimiento,
                evidenciaCumplimiento: d.evidenciaCumplimiento,
                evidenciaEficacia: d.evidenciaEficacia,
                compromisoSostenedor: d.compromisoSostenedor
            })),
            formatosCarta: (matrix.formatosCarta || []).map(f => ({
                nombre: f.nombre,
                asuntoEmail: f.asuntoEmail,
                cuerpoEmail: f.cuerpoEmail,
                cuerpoInicio: f.cuerpoInicio,
                cuerpoFin: f.cuerpoFin,
                activo: f.activo
            }))
        }

        return { success: true, exportData }
    } catch (e) {
        console.error('Error al exportar matriz:', e)
        return { error: 'Error al exportar la plantilla de matriz.' }
    }
}

export async function checkMatrixTitleExists(titulo: string) {
    try {
        const trimmed = titulo.trim()
        const existing = await prisma.matrizT_Cabecera.findFirst({
            where: {
                titulo: {
                    equals: trimmed
                }
            },
            select: { id: true, titulo: true, anio: true, licId: true }
        })

        return { exists: !!existing, existing }
    } catch (e) {
        console.error('Error al verificar título de matriz:', e)
        return { exists: false, error: 'Error al verificar existencia.' }
    }
}

export async function importMatrixTemplate(data: {
    titulo: string
    licId?: number
    anio?: number
    estado?: boolean
    instrucciones?: string | null
    detalles?: any[]
    formatosCarta?: any[]
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        if (!data.titulo || !data.titulo.trim()) {
            return { error: 'El título de la matriz es obligatorio.' }
        }

        // Validate or resolve licId
        let targetLicId = Number(data.licId)
        if (!targetLicId) {
            const firstLic = await prisma.licitacion.findFirst({
                where: { estado: 1 },
                orderBy: { licId: 'asc' }
            })
            if (!firstLic) {
                return { error: 'No se encontraron licitaciones disponibles en este ambiente para asociar la matriz.' }
            }
            targetLicId = firstLic.licId
        } else {
            const licExists = await prisma.licitacion.findUnique({
                where: { licId: targetLicId }
            })
            if (!licExists) {
                const firstLic = await prisma.licitacion.findFirst({
                    where: { estado: 1 },
                    orderBy: { licId: 'asc' }
                })
                if (firstLic) {
                    targetLicId = firstLic.licId
                }
            }
        }

        const anioFinal = Number(data.anio) || new Date().getFullYear()

        // Create Header
        const createdHeader = await prisma.matrizT_Cabecera.create({
            data: {
                titulo: data.titulo.trim(),
                licId: targetLicId,
                anio: anioFinal,
                estado: data.estado !== false,
                instrucciones: data.instrucciones || null
            }
        })

        // Create Details
        if (data.detalles && Array.isArray(data.detalles) && data.detalles.length > 0) {
            const newDetalles = data.detalles.map((d: any, index: number) => ({
                cabeceraId: createdHeader.id,
                preguntaNombre: d.preguntaNombre || `Pregunta ${index + 1}`,
                tipoRespuesta: d.tipoRespuesta || 'SI_NO',
                obligatorio: d.obligatorio === true,
                seccion: d.seccion || 'LEVANTAMIENTO_GENERAL',
                orden: typeof d.orden === 'number' ? d.orden : index,
                gravedad: d.gravedad !== undefined && d.gravedad !== null ? Number(d.gravedad) : null,
                probabilidad: d.probabilidad !== undefined && d.probabilidad !== null ? Number(d.probabilidad) : null,
                nivelRiesgo: d.nivelRiesgo !== undefined && d.nivelRiesgo !== null ? Number(d.nivelRiesgo) : null,
                justificacion: d.justificacion || null,
                riesgoSignificativo: d.riesgoSignificativo || null,
                recursoNecesario: d.recursoNecesario || null,
                resultadoEsperado: d.resultadoEsperado || null,
                respImplementacion: d.respImplementacion || null,
                respSeguimiento: d.respSeguimiento || null,
                evidenciaCumplimiento: d.evidenciaCumplimiento || null,
                evidenciaEficacia: d.evidenciaEficacia || null,
                compromisoSostenedor: d.compromisoSostenedor || null
            }))

            await prisma.matrizT_Detalle.createMany({
                data: newDetalles
            })
        }

        // Create FormatoCartaSostenedor if available
        if (data.formatosCarta && Array.isArray(data.formatosCarta) && data.formatosCarta.length > 0) {
            await prisma.formatoCartaSostenedor.createMany({
                data: data.formatosCarta.map((f: any) => ({
                    cabeceraId: createdHeader.id,
                    nombre: f.nombre || 'Formato Estándar',
                    asuntoEmail: f.asuntoEmail || '',
                    cuerpoEmail: f.cuerpoEmail || '',
                    cuerpoInicio: f.cuerpoInicio || '',
                    cuerpoFin: f.cuerpoFin || '',
                    activo: f.activo !== false
                }))
            })
        }

        revalidatePath('/dashboard/mantenedor/matriz-riesgo/nueva-matriz')
        return {
            success: true,
            newId: createdHeader.id,
            titulo: createdHeader.titulo,
            questionsCount: data.detalles?.length || 0
        }
    } catch (e: any) {
        console.error('Error al importar matriz:', e)
        return { error: e.message || 'Error al importar la matriz en la base de datos.' }
    }
}

