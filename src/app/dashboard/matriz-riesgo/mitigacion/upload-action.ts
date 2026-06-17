'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function uploadMitigacionFiles(formData: FormData) {
    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) return { error: 'No se subieron archivos.' }
    if (files.length > 4) return { error: 'Máximo 4 archivos por hallazgo.' }

    const paths: string[] = []
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'mitigacion')

    try {
        for (const file of files) {
            if (file.size > 100 * 1024 * 1024) {
                return { error: `El archivo ${file.name} excede los 100MB.` }
            }

            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            
            const fileExt = file.name.split('.').pop()
            const fileName = `${uuidv4()}.${fileExt}`
            const path = join(uploadDir, fileName)
            
            await writeFile(path, buffer)
            paths.push(`/uploads/mitigacion/${fileName}`)
        }

        return { success: true, paths }
    } catch (e) {
        console.error(e)
        return { error: 'Error al procesar la subida de archivos.' }
    }
}
