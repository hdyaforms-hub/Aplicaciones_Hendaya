import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';

// Helper to normalize licitacion strings for robust comparison
const normalizeLicitacion = (str: string | null): string => {
    if (!str) return '';
    let cleaned = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
    // Expand shorthand years (e.g., '5323' -> '532023', '5423' -> '542023')
    if (cleaned === '5323') return '532023';
    if (/^\d{4}$/.test(cleaned) && cleaned.endsWith('23')) {
        return cleaned.substring(0, 2) + '20' + cleaned.substring(2);
    }
    return cleaned;
};

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Permissions check
    if (!session.user?.role?.permissions.includes('view_tablero_multas_ee')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const licitacion = searchParams.get('licitacion');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');

    // Build the query filters
    const where: any = {};
    if (licitacion) where.licitacion = licitacion;

    if (ano) {
        const yearInt = parseInt(ano);
        if (mes) {
            const monthInt = parseInt(mes);
            where.fechaSupervision = {
                gte: new Date(Date.UTC(yearInt, monthInt - 1, 1)),
                lt: new Date(Date.UTC(yearInt, monthInt, 1))
            };
        } else {
            where.fechaSupervision = {
                gte: new Date(Date.UTC(yearInt, 0, 1)),
                lt: new Date(Date.UTC(yearInt + 1, 0, 1))
            };
        }
    } else if (mes) {
        // If they provided month but no year, we handle this in JavaScript later
    }

    try {
        // Fetch all calculations matching filters
        let calculos = await prisma.multas_Elementos_Esenciales_Cab.findMany({
            where,
            include: { detalles: true }
        });

        // Filter by month in JS if year was not provided but month was
        if (!ano && mes) {
            const monthInt = parseInt(mes);
            calculos = calculos.filter(c => {
                const date = new Date(c.fechaSupervision);
                return date.getMonth() + 1 === monthInt;
            });
        }

        if (calculos.length === 0) {
            return NextResponse.json({
                totals: { totalMonto: 0, totalSolucionable: 0, totalNoSolucionable: 0, totalFolios: 0, totalNc: 0 },
                anualStats: [],
                regionStats: [],
                topSchools: [],
                aspectStats: []
            });
        }

        // Fetch aspects to determine solucionable status dynamically
        const aspectosList = await prisma.aspectoEE.findMany({
            include: { licitacion: true }
        });

        // Helper to check if an aspect letter is Solucionable for a given licitacion
        const getSolucionableStatus = (letra: string, licitacionName: string | null) => {
            if (!licitacionName || !letra) return false;
            const normSearch = normalizeLicitacion(licitacionName);
            
            const match = aspectosList.find(a => {
                if (!a.letra || !a.licitacion?.licitacionHomologada) return false;
                const aLetraLower = a.letra.toLowerCase().trim();
                const letraLower = letra.toLowerCase().trim();
                if (aLetraLower !== letraLower) return false;
                
                const normLic = normalizeLicitacion(a.licitacion.licitacionHomologada);
                return normLic === normSearch || normLic.includes(normSearch) || normSearch.includes(normLic);
            });
            return match ? match.solucionable === 'Solucionable' : false;
        };

        // Get unique folio codes to cross-reference regions
        const folioIds = calculos.map(c => c.folioOriginal).filter(Boolean);
        const originalCabs = await prisma.elementosEsenciales_Cab.findMany({
            where: { folio: { in: folioIds } },
            select: { folio: true, region: true }
        });

        const folioRegionMap = new Map<string, string>();
        originalCabs.forEach(cab => {
            if (cab.folio && cab.region) {
                folioRegionMap.set(cab.folio, cab.region);
            }
        });

        // Metrics calculations
        let totalMonto = 0;
        let totalSolucionable = 0;
        let totalNoSolucionable = 0;
        let totalNc = 0;

        const uniqueFolios = new Set(calculos.map(c => c.folioOriginal));
        const totalFolios = uniqueFolios.size;

        // Group structures
        const anualMap = new Map<number, { solucionable: number, noSolucionable: number, total: number }>();
        const regionMap = new Map<string, { monto: number, folios: Set<string>, nc: number }>();
        const rbdMap = new Map<number, { monto: number, folios: Set<string>, nc: number }>();
        const aspectMap = new Map<string, { monto: number, count: number }>();

        calculos.forEach(c => {
            const date = new Date(c.fechaSupervision);
            const year = date.getFullYear();
            const folio = c.folioOriginal;
            const region = folioRegionMap.get(folio) || 'Desconocida';
            const rbd = c.rbd;
            const licName = c.licitacion;

            // Initialize annual map
            if (!anualMap.has(year)) {
                anualMap.set(year, { solucionable: 0, noSolucionable: 0, total: 0 });
            }
            const anualData = anualMap.get(year)!;

            // Initialize region map
            if (!regionMap.has(region)) {
                regionMap.set(region, { monto: 0, folios: new Set(), nc: 0 });
            }
            const regData = regionMap.get(region)!;

            // Initialize school rbd map
            if (!rbdMap.has(rbd)) {
                rbdMap.set(rbd, { monto: 0, folios: new Set(), nc: 0 });
            }
            const rbdData = rbdMap.get(rbd)!;

            // Add folio to sets
            regData.folios.add(folio);
            rbdData.folios.add(folio);

            c.detalles.forEach(det => {
                const monto = det.montoMulta || 0;
                const letra = det.letraAspecto || 'Desconocido';
                const sol = getSolucionableStatus(letra, licName);

                totalMonto += monto;
                totalNc += 1;

                if (sol) {
                    totalSolucionable += monto;
                    anualData.solucionable += monto;
                } else {
                    totalNoSolucionable += monto;
                    anualData.noSolucionable += monto;
                }
                anualData.total += monto;

                regData.monto += monto;
                regData.nc += 1;

                rbdData.monto += monto;
                rbdData.nc += 1;

                // Aspect grouping (e.g. "Aspecto A", "Aspecto B")
                const aspectName = `Aspecto ${letra}`;

                if (!aspectMap.has(aspectName)) {
                    aspectMap.set(aspectName, { monto: 0, count: 0 });
                }
                const aspData = aspectMap.get(aspectName)!;
                aspData.monto += monto;
                aspData.count += 1;
            });
        });

        // 1. Annual stats formatting
        const anualStats = Array.from(anualMap.entries()).map(([year, data]) => ({
            year,
            solucionable: parseFloat(data.solucionable.toFixed(0)),
            noSolucionable: parseFloat(data.noSolucionable.toFixed(0)),
            total: parseFloat(data.total.toFixed(0))
        })).sort((a, b) => a.year - b.year);

        // 2. Region stats formatting
        const regionStats = Array.from(regionMap.entries()).map(([region, data]) => ({
            region,
            monto: parseFloat(data.monto.toFixed(0)),
            folios: data.folios.size,
            nc: data.nc
        })).sort((a, b) => b.monto - a.monto);

        // 3. TOP 10 RBDs formatting
        const sortedRbds = Array.from(rbdMap.entries()).map(([rbd, data]) => ({
            rbd,
            monto: parseFloat(data.monto.toFixed(0)),
            folios: data.folios.size,
            nc: data.nc
        })).sort((a, b) => b.monto - a.monto).slice(0, 10);

        // Fetch School names for the TOP 10
        const topRbdList = sortedRbds.map(s => s.rbd);
        const topSchoolsDb = await prisma.colegiosMatriz.findMany({
            where: { colRBD: { in: topRbdList } },
            select: { colRBD: true, nombreEstablecimiento: true }
        });

        const schoolNameMap = new Map<number, string>();
        topSchoolsDb.forEach(s => {
            schoolNameMap.set(s.colRBD, s.nombreEstablecimiento);
        });

        const topSchools = sortedRbds.map(s => ({
            ...s,
            nombreEstablecimiento: schoolNameMap.get(s.rbd) || 'Establecimiento Desconocido'
        }));

        // 4. Aspect stats formatting
        const aspectStats = Array.from(aspectMap.entries()).map(([aspecto, data]) => ({
            aspecto,
            monto: parseFloat(data.monto.toFixed(0)),
            count: data.count
        })).sort((a, b) => b.monto - a.monto);

        return NextResponse.json({
            totals: {
                totalMonto: parseFloat(totalMonto.toFixed(0)),
                totalSolucionable: parseFloat(totalSolucionable.toFixed(0)),
                totalNoSolucionable: parseFloat(totalNoSolucionable.toFixed(0)),
                totalFolios,
                totalNc
            },
            anualStats,
            regionStats,
            topSchools,
            aspectStats
        });

    } catch (e: any) {
        console.error("Error generating dashboard multas-ee data:", e);
        return NextResponse.json({ error: 'Internal Server Error: ' + e.message }, { status: 500 });
    }
}
