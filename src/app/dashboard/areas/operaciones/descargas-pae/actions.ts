'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function getRbdsPorInstitucion(institucion: string) {
    try {
        const session = await getSession();
        if (!session) {
            throw new Error("No autorizado");
        }

        const colegios = await prisma.colegios.findMany({
            where: { 
                institucion: { 
                    equals: institucion, 
                    mode: 'insensitive' 
                } 
            },
            select: { 
                colRBD: true, 
                nombreEstablecimiento: true 
            },
            distinct: ['colRBD'],
            orderBy: {
                nombreEstablecimiento: 'asc'
            }
        });

        return {
            success: true,
            data: colegios
        };
    } catch (error: any) {
        console.error("Error fetching RBDs por Institución:", error);
        return {
            success: false,
            error: "Ocurrió un error al consultar los establecimientos."
        };
    }
}

export async function registrarDescargas(datos: Array<{ano: number, mes: number, institucion: string, rbd: number, urlGenerada: string}>) {
    try {
        const session = await getSession();
        if (!session) {
            throw new Error("No autorizado");
        }

        const currentUsername = session.user?.username || 'Sistema';

        // Prepare bulk insert
        const registros = datos.map(item => ({
            ano: item.ano,
            mes: item.mes,
            institucion: item.institucion,
            rbd: item.rbd,
            urlGenerada: item.urlGenerada,
            usuario: currentUsername
        }));

        await prisma.descargaPaeLog.createMany({
            data: registros
        });

        return {
            success: true,
            message: "Descargas registradas exitosamente en auditoría."
        };

    } catch (error: any) {
        console.error("Error registrando descargas PAE:", error);
        return {
            success: false,
            error: "No se pudieron registrar las descargas en la base de datos."
        };
    }
}
