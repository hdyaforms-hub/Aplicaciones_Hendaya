'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Búsqueda inteligente (Autocomplete) para RBD o Nombre del establecimiento
export async function buscarRbdAutocomplete(query: string) {
    if (!query || query.trim() === '') return { success: true, data: [] };
    
    const isNumeric = !isNaN(Number(query));
    
    try {
        const results = await prisma.colegios.findMany({
            where: {
                OR: [
                    isNumeric ? { colRBD: Number(query) } : { colRBD: -1 },
                    { nombreEstablecimiento: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 15,
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                comuna: true
            }
        });
        
        return { success: true, data: results };
    } catch (error: any) {
        return { success: false, error: 'Error al buscar RBD' };
    }
}

// Obtener los datos cargados para mostrarlos en la tabla
export async function obtenerPaeOnline(filtros: {
    licitacion?: string;
    institucion?: string;
    ano?: number;
    mes?: number;
    rbd?: number;
}) {
    try {
        const where: any = {};
        
        if (filtros.licitacion) where.licitacion = filtros.licitacion;
        if (filtros.institucion) where.institucion = filtros.institucion;
        if (filtros.ano) where.ano = filtros.ano;
        if (filtros.mes) where.mes = filtros.mes;
        if (filtros.rbd) where.rbd = filtros.rbd;
        
        const registros = await prisma.paeOnlineCab.findMany({
            where,
            orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { rbd: 'asc' }],
            take: 500
        });
        
        return { success: true, data: registros };
    } catch (error: any) {
        return { success: false, error: 'Error al cargar los registros PAE.' };
    }
}

// Obtener el detalle completo de un Folio (incluyendo raciones diarias y descripciones de causas)
export async function obtenerDetalleFolio(folio: string) {
    try {
        const registro = await prisma.paeOnlineCab.findUnique({
            where: { folio },
            include: {
                detalles: {
                    orderBy: { dia: 'asc' }
                }
            }
        });
        if (!registro) {
            return { success: false, error: 'No se encontró el folio.' };
        }

        const codigosCausa = await prisma.codigoCausa.findMany();
        const causaMap = codigosCausa.reduce((acc: Record<number, { descripcion: string; imputable: string; definicion: string }>, cur) => {
            acc[cur.id] = { 
                descripcion: cur.descripcion, 
                imputable: cur.imputable || 'Imputable',
                definicion: cur.definicion || ''
            };
            return acc;
        }, {});

        return { success: true, data: registro, causas: causaMap };
    } catch (error: any) {
        console.error("Error al obtener detalle del folio:", error);
        return { success: false, error: 'Error al obtener el detalle del folio.' };
    }
}

// Guardar registros confirmados (nuevos y sobrescritos)
export async function guardarRegistrosPae(registros: any[]) {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };

    try {
        let insertados = 0;
        let actualizados = 0;

        for (const reg of registros) {
            // Verificar si el folio ya existe
            const existente = await prisma.paeOnlineCab.findUnique({
                where: { folio: reg.folio }
            });

            if (existente) {
                // Eliminar el existente y sus detalles (Cascade se encargará de los detalles)
                await prisma.paeOnlineCab.delete({
                    where: { id: existente.id }
                });
                actualizados++;
            } else {
                insertados++;
            }

            // Insertar el nuevo
            await prisma.paeOnlineCab.create({
                data: {
                    institucion: reg.institucion,
                    mes: reg.mes,
                    ano: reg.ano,
                    folio: reg.folio,
                    establecimiento: reg.establecimiento,
                    comuna: reg.comuna,
                    rbd: reg.rbd,
                    estrato: reg.estrato,
                    programa: reg.programa,
                    licitacion: reg.licitacion,
                    certificacion: reg.certificacion,
                    detalles: {
                        create: reg.detalles.map((det: any) => ({
                            dia: det.dia,
                            serCompletas: det.serCompletas,
                            serIncompletas: det.serIncompletas,
                            codProducto: det.codProducto,
                            noServido: det.noServido,
                            codCausa: det.codCausa,
                            totalRaciones: det.totalRaciones
                        }))
                    }
                }
            });
        }

        return { success: true, insertados, actualizados };
    } catch (error: any) {
        console.error("Error guardando registros:", error);
        return { success: false, error: 'Ocurrió un error al guardar en la base de datos.' };
    }
}

export async function eliminarRegistrosPae(criterio: {
    tipo: 'periodo' | 'rbd' | 'folio';
    ano?: number;
    mes?: number;
    rbd?: number;
    folio?: string;
}) {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };

    try {
        const where: any = {};
        
        if (criterio.tipo === 'periodo') {
            if (!criterio.ano || !criterio.mes) {
                return { success: false, error: 'Año y Mes son requeridos para eliminar por período.' };
            }
            where.ano = criterio.ano;
            where.mes = criterio.mes;
        } else if (criterio.tipo === 'rbd') {
            if (!criterio.rbd) {
                return { success: false, error: 'El RBD es requerido para eliminar por RBD.' };
            }
            where.rbd = criterio.rbd;
        } else if (criterio.tipo === 'folio') {
            if (!criterio.folio) {
                return { success: false, error: 'El Folio es requerido para eliminar por Folio.' };
            }
            where.folio = criterio.folio;
        }

        const deleteResult = await prisma.paeOnlineCab.deleteMany({
            where
        });

        return { success: true, count: deleteResult.count };
    } catch (error: any) {
        console.error("Error al eliminar registros:", error);
        return { success: false, error: 'Ocurrió un error al intentar eliminar los registros de la base de datos.' };
    }
}

