'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/client'

export async function getPaeRecords(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    licitacion?: number | null;
    folio?: string;
    mes?: number | null;
    anio?: number | null;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
}) {
    const { 
        page = 1, 
        pageSize = 10, 
        search, 
        licitacion, 
        folio, 
        mes, 
        anio,
        orderBy = 'createdAt',
        orderDir = 'desc'
    } = params;

    const skip = (page - 1) * pageSize;

    const where: Prisma.Cab_LeePdfEstandarPaeWhereInput = {};

    if (search) {
        where.OR = [
            { Nombre_Num_establecimiento: { contains: search } },
        ];
        // If search is numeric, also search by RBD
        if (!isNaN(Number(search))) {
            where.OR.push({ RBD: Number(search) });
        }
    }

    if (licitacion) {
        where.Licitacion = licitacion;
    }

    if (folio) {
        where.Folio = { contains: folio };
    }

    if (mes || anio) {
        // Date filtering in Prisma can be tricky, simpler approach for exact month/year
        // Requires a date range: start of month to end of month
        let start: Date | null = null;
        let end: Date | null = null;

        const currentYear = anio || new Date().getFullYear();

        if (mes) {
            start = new Date(currentYear, mes - 1, 1);
            end = new Date(currentYear, mes, 0, 23, 59, 59, 999);
        } else if (anio) {
            start = new Date(currentYear, 0, 1);
            end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        }

        if (start && end) {
            where.Fecha_Supervision = {
                gte: start,
                lte: end
            };
        }
    }

    const [total, records] = await Promise.all([
        prisma.cab_LeePdfEstandarPae.count({ where }),
        prisma.cab_LeePdfEstandarPae.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: {
                [orderBy]: orderDir
            },
            include: {
                detalles: true
            }
        })
    ]);

    // Calculate general average compliance for the current filter
    const stats = await prisma.cab_LeePdfEstandarPae.aggregate({
        where,
        _avg: {
            Porcentaje_cumplimiento_final: true
        }
    });

    // Calculate UT counts based on Colegios table mapping
    const allFilteredRecords = await prisma.cab_LeePdfEstandarPae.findMany({
        where,
        select: { RBD: true }
    });
    
    const colegios = await prisma.colegios.findMany({
        select: { colRBD: true, colut: true }
    });
    
    const rbdToUt = new Map<number, number>();
    for (const c of colegios) {
        if (c.colRBD) {
            rbdToUt.set(c.colRBD, c.colut);
        }
    }
    
    const utCounts: Record<string, number> = {};
    for (const r of allFilteredRecords) {
        if (r.RBD) {
            const ut = rbdToUt.get(r.RBD);
            if (ut !== undefined) {
                utCounts[ut] = (utCounts[ut] || 0) + 1;
            } else {
                utCounts['Sin UT'] = (utCounts['Sin UT'] || 0) + 1;
            }
        } else {
            utCounts['Sin RBD'] = (utCounts['Sin RBD'] || 0) + 1;
        }
    }

    return {
        data: records,
        total,
        totalPages: Math.ceil(total / pageSize),
        averageCompliance: stats._avg.Porcentaje_cumplimiento_final,
        utCounts
    };
}

export async function deletePaeRecord(id: string) {
    try {
        await prisma.cab_LeePdfEstandarPae.delete({
            where: { id }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSchoolDetailsByRBD(rbd: number) {
    try {
        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: rbd }
        });

        if (!colegio) {
            return { success: false, error: 'Colegio no encontrado' };
        }

        // Fetch licitacion from UT
        const ut = await prisma.uT.findFirst({
            where: { codUT: colegio.colut }
        });

        return {
            success: true,
            data: {
                nombreEstablecimiento: colegio.nombreEstablecimiento,
                comuna: colegio.comuna,
                licitacion: ut ? ut.licId : null
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createManualPaeRecord(data: any) {
    try {
        const { Folio, Licitacion, Nombre_Num_establecimiento, RBD, Comuna, Fecha_Supervision, Porcentaje_cumplimiento_final, Observaciones } = data;

        if (!Folio) {
            return { success: false, error: 'El Folio es requerido' };
        }

        // Check for duplicate folio
        const existing = await prisma.cab_LeePdfEstandarPae.findUnique({
            where: { Folio }
        });

        if (existing) {
            return { success: false, error: 'El Folio ya existe en la base de datos.' };
        }

        const record = await prisma.cab_LeePdfEstandarPae.create({
            data: {
                NombreArchivoPdf: 'Ingreso Manual',
                Folio,
                Licitacion: Licitacion ? parseInt(Licitacion) : null,
                Nombre_Num_establecimiento,
                RBD: RBD ? parseInt(RBD) : null,
                Comuna,
                Fecha_Supervision: Fecha_Supervision ? new Date(Fecha_Supervision) : null,
                Porcentaje_cumplimiento_final: Porcentaje_cumplimiento_final ? parseFloat(Porcentaje_cumplimiento_final) : null,
                Observaciones
            }
        });

        return { success: true, data: record };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
