'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { MENU_SECTIONS } from './constants'

export async function checkAccess() {
    const session = await getSession()
    if (!session) return false

    const isAdmin = session.user.role.name === 'admin' || session.user.role.name === 'Administrador'
    const permissions = session.user.role.permissions || []

    return isAdmin || permissions.includes('manage_menu_reorder')
}

export async function getMenuStructure() {
    const hasAccess = await checkAccess()
    if (!hasAccess) {
        throw new Error('No autorizado')
    }

    // Obtener las órdenes guardadas en la base de datos
    const savedOrders = await prisma.menuItemOrder.findMany({
        orderBy: { position: 'asc' }
    })

    // Construir la estructura combinando los ítems predefinidos y sus posiciones guardadas
    const sectionsWithCurrentOrder = MENU_SECTIONS.map(section => {
        // Buscar posiciones guardadas para esta sección en particular.
        // Ojo: para 'operaciones_areas' y 'operaciones_mantenedor', ambas tienen parentKey = "Operaciones".
        // Filtramos por parentKey y nos aseguramos de que el itemKey pertenezca a la sección.
        const sectionSaved = savedOrders.filter(o => 
            o.parentKey === section.parentKey && 
            section.items.includes(o.itemKey)
        )

        // Ordenar los items según las posiciones guardadas.
        const sortedItems = [...section.items].sort((a, b) => {
            const posA = sectionSaved.find(s => s.itemKey === a)?.position
            const posB = sectionSaved.find(s => s.itemKey === b)?.position

            if (posA !== undefined && posB !== undefined) {
                return posA - posB
            }
            if (posA !== undefined) return -1
            if (posB !== undefined) return 1

            // Fallback a orden predeterminado en código
            return section.items.indexOf(a) - section.items.indexOf(b)
        })

        return {
            ...section,
            items: sortedItems
        }
    })

    return sectionsWithCurrentOrder
}

export async function updateMenuOrderAction(sectionId: string, orderedKeys: string[]) {
    const hasAccess = await checkAccess()
    if (!hasAccess) {
        return { error: 'No tienes permisos para reordenar las opciones del menú' }
    }

    const section = MENU_SECTIONS.find(s => s.id === sectionId)
    if (!section) {
        return { error: 'Sección del menú no válida' }
    }

    try {
        const parentKey = section.parentKey

        // Para cada itemKey en orderedKeys, guardamos su nueva posición.
        // Usamos upsert para insertarlo si no existe, o actualizarlo si ya existe.
        await prisma.$transaction(
            orderedKeys.map((itemKey, index) => 
                prisma.menuItemOrder.upsert({
                    where: {
                        parentKey_itemKey: {
                            parentKey,
                            itemKey
                        }
                    },
                    update: {
                        position: index
                    },
                    create: {
                        parentKey,
                        itemKey,
                        position: index
                    }
                })
            )
        )

        // Revalidar el dashboard para que el sidebar cargue el nuevo orden
        revalidatePath('/dashboard', 'layout')
        return { success: true }
    } catch (error) {
        console.error('Error al actualizar el orden del menú:', error)
        return { error: 'Ocurrió un error al guardar la reubicación en la base de datos' }
    }
}
