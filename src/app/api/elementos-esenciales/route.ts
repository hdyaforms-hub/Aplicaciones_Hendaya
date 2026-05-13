import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const rbdParam = searchParams.get('rbd') || '';
        const folioParam = searchParams.get('folio') || '';
        const mes = searchParams.get('mes') || '';
        const ano = searchParams.get('ano') || '';
        const licitacion = searchParams.get('licitacion') || '';

        // Construir el filtro where
        const where: any = {};

        if (rbdParam) {
            where.rbd = Number(rbdParam);
        }

        if (folioParam) {
            where.folio = { contains: folioParam, mode: 'insensitive' };
        }

        if (mes || ano) {
            // Asumiendo que la fecha viene como "DD / MM / YYYY" en el script de python
            // Pero como es un DateTime en la DB, podemos filtrar por rango
        }

        // Búsqueda inteligente
        if (search) {
            const isNumber = !isNaN(Number(search));
            where.OR = [
                { nombreArchivo: { contains: search, mode: 'insensitive' } },
            ];
            
            if (isNumber) {
                where.OR.push({ rbd: Number(search) });
            }

            // Para buscar por nombre de establecimiento, necesitamos cruzar con Colegios
            // Prisma no soporta OR cruzando relaciones de forma simple si la relación no es estricta o 
            // no la declaramos. Como ColegiosMatriz o Colegios se asocia por RBD pero no es una 
            // relación en prisma schema para ElementosEsenciales, filtramos primero los colegios.
            const colegios = await prisma.colegios.findMany({
                where: { nombreEstablecimiento: { contains: search, mode: 'insensitive' } },
                select: { colRBD: true }
            });
            
            if (colegios.length > 0) {
                const rbds = colegios.map(c => c.colRBD);
                where.OR.push({ rbd: { in: rbds } });
            }
        }

        if (licitacion) {
            where.licitacion = { contains: licitacion, mode: 'insensitive' };
        }

        // Filtrar por mes/año extrayéndolo si es necesario
        // Como fechaSupervision es DateTime, podemos hacer validación de año/mes
        if (ano) {
            const startYear = new Date(`${ano}-01-01T00:00:00Z`);
            const endYear = new Date(`${ano}-12-31T23:59:59Z`);
            
            if (!where.fechaSupervision) where.fechaSupervision = {};
            where.fechaSupervision.gte = startYear;
            where.fechaSupervision.lte = endYear;
        }

        if (mes && ano) {
             const startMonth = new Date(`${ano}-${mes.padStart(2, '0')}-01T00:00:00Z`);
             // Para obtener el fin de mes:
             const endMonth = new Date(Number(ano), Number(mes), 0, 23, 59, 59);
             where.fechaSupervision.gte = startMonth;
             where.fechaSupervision.lte = endMonth;
        }

        const registros = await prisma.elementosEsenciales_Cab.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                detalles: true
            }
        });

        // Adjuntar nombre de establecimiento
        const rbds = [...new Set(registros.map(r => r.rbd).filter(Boolean))] as number[];
        const colegios = await prisma.colegios.findMany({
            where: { colRBD: { in: rbds } },
            select: { colRBD: true, nombreEstablecimiento: true }
        });
        const colegioMap = new Map(colegios.map(c => [c.colRBD, c.nombreEstablecimiento]));

        const registrosConNombre = registros.map(r => ({
            ...r,
            nombreEstablecimiento: r.rbd ? colegioMap.get(r.rbd) || 'Desconocido' : 'Sin RBD'
        }));

        return NextResponse.json(registrosConNombre);
    } catch (error: any) {
        console.error('Error fetching Elementos Esenciales:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { ids } = await request.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No se proporcionaron IDs' }, { status: 400 });
        }

        const { unlink } = await import('fs/promises');
        const { join } = await import('path');

        // Buscar los registros para obtener las rutas de archivos
        const actas = await prisma.elementosEsenciales_Cab.findMany({
            where: { id: { in: ids } },
            select: { id: true, link: true }
        });

        // Eliminar de la DB
        await prisma.elementosEsenciales_Cab.deleteMany({
            where: { id: { in: ids } }
        });

        // Eliminar archivos físicos
        for (const acta of actas) {
            if (acta.link) {
                try {
                    const filePath = join(process.cwd(), 'public', acta.link);
                    await unlink(filePath);
                } catch (err) {
                    console.warn(`No se pudo eliminar archivo: ${acta.link}`, err);
                }
            }
        }

        return NextResponse.json({ success: true, count: actas.length });
    } catch (error: any) {
        console.error('Error en bulk delete:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

