'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export async function searchColegiosMatriz(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_matriz_2026')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    if (!query || query.trim() === '') return { colegios: [] }

    const isAdmin = session?.user?.role?.name === 'Administrador'
    const isNumeric = !isNaN(Number(query))

    try {
        let allowedUTs: number[] = []
        if (!isAdmin) {
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
            isActive: true, // Solo colegios activos
            OR: [
                ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                { nombreEstablecimiento: { contains: query } }
            ]
        }

        const finalWhere = isAdmin ? baseWhere : {
            ...baseWhere,
            colut: { in: allowedUTs }
        }

        const colegios = await prisma.colegiosMatriz.findMany({
            where: finalWhere,
            take: 10,
            orderBy: { nombreEstablecimiento: 'asc' }
        })

        return { colegios }
    } catch (e) {
        console.error(e)
        return { error: 'Error al buscar colegios.' }
    }
}

export async function getColegiosMatriz() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_colegios_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const colegios = await prisma.colegiosMatriz.findMany({
            orderBy: { nombreEstablecimiento: 'asc' }
        })
        return { colegios }
    } catch (e) {
        console.error(e)
        return { error: 'Error al obtener colegios.' }
    }
}

export async function toggleColegioMatrizStatus(id: string, isActive: boolean) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_colegios_matriz')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        await prisma.colegiosMatriz.update({
            where: { id },
            data: { isActive }
        })
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al actualizar estado.' }
    }
}

export async function saveMatriz2026(formData: any) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_matriz_2026')) {
        return { error: 'No tienes permisos para guardar.' }
    }

    try {
        const result = await prisma.matrizRiesgo2026.create({
            data: {
                ...formData,
                usuario: session.user.username as string,
                ut: Number(formData.ut),
                rbd: Number(formData.rbd),
                equipos_frio_sin_visor: Number(formData.equipos_frio_sin_visor || 0)
            }
        })
        return { success: true, id: result.id }
    } catch (e: any) {
        console.error("CRITICAL ERROR saving matriz:", e)
        if (e.code === 'P2002') return { error: 'Error: Ya existe un registro con estos datos únicos.' }
        return { error: `Error al guardar: ${e.message || 'Error desconocido'}` }
    }
}

export async function uploadMatrizFile(fileData: string, fileName: string, rbd: number, section: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_matriz_2026')) {
        return { error: 'No autorizado' }
    }

    try {
        const base64Content = fileData.split(';base64,').pop()
        if (!base64Content) return { error: 'Contenido de archivo inválido' }

        const buffer = Buffer.from(base64Content, 'base64')
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'matriz-2026', String(rbd), section)
        
        await fs.mkdir(uploadDir, { recursive: true })
        
        const uniqueFileName = `${crypto.randomUUID()}-${fileName}`
        const filePath = path.join(uploadDir, uniqueFileName)
        
        await fs.writeFile(filePath, buffer)
        
        // Return the relative path for the browser
        return { 
            success: true, 
            path: `/uploads/matriz-2026/${rbd}/${section}/${uniqueFileName}` 
        }
    } catch (e) {
        console.error("File upload error:", e)
        return { error: 'Error al subir el archivo.' }
    }
}

export async function getMatrizExistence(rbd: number) {
    try {
        const lastMatrix = await prisma.matrizRiesgo2026.findFirst({
            where: { rbd: rbd },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        })
        return { exists: !!lastMatrix, date: lastMatrix?.createdAt }
    } catch (e) {
        return { error: 'Error checking existence' }
    }
}
