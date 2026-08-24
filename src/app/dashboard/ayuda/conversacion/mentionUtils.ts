import { rawPrisma } from '@/lib/prisma'

/**
 * Extrae todos los nombres de usuario mencionados con '@' en un texto
 * Ejemplo: "Hola @juan.perez y @maria, favor revisar" -> ["juan.perez", "maria"]
 */
export function parseMentions(text: string): string[] {
    if (!text) return []
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g
    const matches = new Set<string>()
    let match
    while ((match = mentionRegex.exec(text)) !== null) {
        if (match[1]) {
            matches.add(match[1].trim())
        }
    }
    return Array.from(matches)
}

/**
 * Registra menciones en la base de datos para los usuarios válidos encontrados
 */
export async function registerMentions(params: {
    sourceType: 'chat' | 'task' | 'note' | 'kudo' | 'decision'
    sourceId: string
    projectId?: string | null
    text: string
    authorUsername: string
    authorName?: string | null
}) {
    try {
        const mentionedUsernames = parseMentions(params.text)
        if (mentionedUsernames.length === 0) return []

        // Filtrar menciones a uno mismo
        const targets = mentionedUsernames.filter(u => u !== params.authorUsername)
        if (targets.length === 0) return []

        // Validar que los usuarios existan en la BD
        const existingUsers = await (rawPrisma as any).user.findMany({
            where: {
                username: { in: targets },
                isDeleted: false,
                isActive: true
            },
            select: { username: true }
        })

        const validUsernames = existingUsers.map((u: any) => u.username)
        if (validUsernames.length === 0) return []

        const preview = params.text.length > 150 ? params.text.slice(0, 150) + '...' : params.text

        const created = await Promise.all(
            validUsernames.map((username: string) =>
                (rawPrisma as any).collabMention.create({
                    data: {
                        sourceType: params.sourceType,
                        sourceId: params.sourceId,
                        projectId: params.projectId || null,
                        mentionedUsername: username,
                        authorUsername: params.authorUsername,
                        authorName: params.authorName || params.authorUsername,
                        previewText: preview
                    }
                })
            )
        )

        return created
    } catch (error) {
        console.error('Error al registrar menciones:', error)
        return []
    }
}
