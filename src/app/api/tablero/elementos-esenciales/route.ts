import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.user?.role?.name === 'Administrador';
    const hasPermission = session.user?.role?.permissions?.includes('view_elementos_esenciales');
    if (!isAdmin && !hasPermission) {
        return NextResponse.json({ error: 'Acceso denegado: Permisos insuficientes' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const licitacion = searchParams.get('licitacion');
    const rbd = searchParams.get('rbd');
    const ano = searchParams.get('ano');
    const region = searchParams.get('region');

    // Filters
    const where: any = {};
    if (licitacion) where.licitacion = licitacion;
    if (rbd) where.rbd = parseInt(rbd);
    if (region) where.region = region;
    
    // For Año, we might need to filter the date range
    if (ano) {
        const yearInt = parseInt(ano);
        where.fechaSupervision = {
            gte: new Date(yearInt, 0, 1),
            lt: new Date(yearInt + 1, 0, 1)
        };
    }

    try {
        const records = await prisma.elementosEsenciales_Cab.findMany({
            where,
            include: { detalles: true },
            orderBy: { fechaSupervision: 'asc' }
        });

        // 1. Time Series (Consolidated)
        const timeSeriesMap: Record<string, { co: number, total: number }> = {};
        // 2. By Region Time Series
        const regionSeriesMap: Record<string, Record<string, { co: number, total: number }>> = {};
        // 3. By Aspect (Yearly Avg)
        const aspectMap: Record<string, Record<number, { co: number, total: number }>> = {};

        records.forEach(cab => {
            if (!cab.fechaSupervision) return;
            const date = new Date(cab.fechaSupervision);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const timeKey = `${month}-${year}`;
            const reg = cab.region || 'Desconocida';

            if (!timeSeriesMap[timeKey]) timeSeriesMap[timeKey] = { co: 0, total: 0 };
            if (!regionSeriesMap[reg]) regionSeriesMap[reg] = {};
            if (!regionSeriesMap[reg][timeKey]) regionSeriesMap[reg][timeKey] = { co: 0, total: 0 };

            cab.detalles.forEach(det => {
                const isCO = !!det.co;
                const isNC = !!det.nc;
                const isNA = !!det.na;

                if (isCO || isNC) {
                    const val = isCO ? 1 : 0;
                    
                    timeSeriesMap[timeKey].co += val;
                    timeSeriesMap[timeKey].total += 1;

                    regionSeriesMap[reg][timeKey].co += val;
                    regionSeriesMap[reg][timeKey].total += 1;

                    // Aspect Logic (Extract first char A, B, C...)
                    const aspectMatch = det.aspecto?.match(/^([A-Z])\./);
                    if (aspectMatch) {
                        const letter = aspectMatch[1];
                        if (!aspectMap[letter]) aspectMap[letter] = {};
                        if (!aspectMap[letter][year]) aspectMap[letter][year] = { co: 0, total: 0 };
                        aspectMap[letter][year].co += val;
                        aspectMap[letter][year].total += 1;
                    }
                }
            });
        });

        // Format for charts
        const timeSeries = Object.entries(timeSeriesMap).map(([key, val]) => ({
            name: key,
            cumplimiento: val.total > 0 ? parseFloat(((val.co / val.total) * 100).toFixed(1)) : 0
        })).sort((a, b) => {
            const [m1, y1] = a.name.split('-').map(Number);
            const [m2, y2] = b.name.split('-').map(Number);
            return y1 === y2 ? m1 - m2 : y1 - y2;
        });

        const regionSeries = Object.entries(regionSeriesMap).reduce((acc: any, [reg, data]) => {
            acc[reg] = Object.entries(data).map(([key, val]) => ({
                name: key,
                cumplimiento: val.total > 0 ? parseFloat(((val.co / val.total) * 100).toFixed(1)) : 0
            })).sort((a, b) => {
                const [m1, y1] = a.name.split('-').map(Number);
                const [m2, y2] = b.name.split('-').map(Number);
                return y1 === y2 ? m1 - m2 : y1 - y2;
            });
            return acc;
        }, {});

        const aspectStats = Object.entries(aspectMap).flatMap(([letter, years]) => {
            return Object.entries(years).map(([year, val]) => ({
                aspecto: letter,
                ano: year,
                cumplimiento: val.total > 0 ? parseFloat(((val.co / val.total) * 100).toFixed(1)) : 0
            }));
        }).sort((a, b) => a.aspecto.localeCompare(b.aspecto));

        return NextResponse.json({
            timeSeries,
            regionSeries,
            aspectStats
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
