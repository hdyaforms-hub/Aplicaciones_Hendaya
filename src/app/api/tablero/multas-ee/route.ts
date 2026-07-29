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
    const sucursal = searchParams.get('sucursal');
    const supervisor = searchParams.get('supervisor');

    // Build the query filters
    const where: any = {};
    if (licitacion) where.licitacion = licitacion;

    // Filter by sucursal: resolve to RBD list first
    if (sucursal) {
        const schoolsInSucursal = await prisma.colegiosMatriz.findMany({
            where: { sucursal },
            select: { colRBD: true }
        });
        const rbdsInSucursal = schoolsInSucursal.map(s => s.colRBD);
        where.rbd = { in: rbdsInSucursal };
    }

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
                mensualStats: [],
                regionStats: [],
                topSchools: [],
                aspectStats: [],
                supervisorStats: [],
                sopJopStats: []
            });
        }

        // Fetch aspects to determine solucionable status dynamically
        const aspectosList = await prisma.aspectoEE.findMany({
            include: { licitacion: true }
        });

        // Fetch colegiosMatriz for RBD -> sucursal mapping
        const colegiosMatrizDb = await prisma.colegiosMatriz.findMany({
            select: { colRBD: true, sucursal: true }
        });
        const rbdSucursalMap = new Map<number, string>();
        colegiosMatrizDb.forEach(c => {
            if (c.colRBD && c.sucursal) {
                rbdSucursalMap.set(c.colRBD, c.sucursal);
            }
        });

        // Fetch Jefes Operación and Supervisores to build SOP/JOP hierarchy
        const [jefesOperacionDb, supervisoresDb] = await Promise.all([
            prisma.jefeOperacion.findMany({
                where: { vigente: true },
                include: {
                    jefeZonal: true,
                    supervisores: {
                        where: { vigente: true },
                        include: { rbdsAuditar: { select: { rbd: true } } }
                    }
                }
            }),
            prisma.supervisor.findMany({
                where: { vigente: true },
                include: {
                    rbdsAuditar: { select: { rbd: true } },
                    jefeOperacion: true,
                    jefeZonal: true
                }
            })
        ]);

        const rbdToSupervisorMap = new Map<number, { nombre: string; sucursal: string }>();
        const rbdToSopJopMap = new Map<number, { jopName: string; supName: string }>();

        // Map hierarchy
        jefesOperacionDb.forEach(jop => {
            const jopName = `${jop.nombre} ${jop.apellido}`.trim();
            jop.supervisores.forEach(s => {
                const supName = `${s.nombre} ${s.apellido}`.trim();
                s.rbdsAuditar.forEach(r => {
                    rbdToSopJopMap.set(r.rbd, { jopName, supName });
                });
            });
        });

        supervisoresDb.forEach(s => {
            const nombreBase = `${s.nombre} ${s.apellido}`.trim();
            const sucursales = Array.from(new Set(s.rbdsAuditar.map(r => rbdSucursalMap.get(r.rbd)).filter((v): v is string => Boolean(v))));
            const sucursalName = sucursales.length > 0 ? sucursales[0] : '';
            const labelConSucursal = sucursalName ? `${nombreBase} (${sucursalName})` : nombreBase;

            const jopName = s.jefeOperacion ? `${s.jefeOperacion.nombre} ${s.jefeOperacion.apellido}`.trim() : (s.jefeZonal ? `${s.jefeZonal.nombre} ${s.jefeZonal.apellido}`.trim() : nombreBase);

            s.rbdsAuditar.forEach(r => {
                rbdToSupervisorMap.set(r.rbd, { nombre: labelConSucursal, sucursal: sucursalName });
                if (!rbdToSopJopMap.has(r.rbd)) {
                    rbdToSopJopMap.set(r.rbd, { jopName, supName: nombreBase });
                }
            });
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

        // Helper to fetch master aspect description from AspectoEE table (Fórmulas de Aspecto EE module)
        const getAspectoMasterDesc = (letra: string, licitacionName: string | null) => {
            if (!letra) return null;
            const cleanLetra = letra.replace(/^aspecto\s+/i, '').trim().toLowerCase();
            const normSearch = normalizeLicitacion(licitacionName);

            const match = aspectosList.find(a => {
                if (!a.letra || !a.descripcion) return false;
                const aLetraLower = a.letra.toLowerCase().trim();
                if (aLetraLower !== cleanLetra) return false;
                if (!normSearch) return true;
                const normLic = normalizeLicitacion(a.licitacion?.licitacionHomologada);
                return normLic === normSearch || normLic.includes(normSearch) || normSearch.includes(normLic);
            }) || aspectosList.find(a => {
                if (!a.letra || !a.descripcion) return false;
                return a.letra.toLowerCase().trim() === cleanLetra;
            });

            return match?.descripcion || null;
        };

        // Get unique valid folios from ElementosEsenciales_Cab (excluding annulled)
        const originalCabs = await prisma.elementosEsenciales_Cab.findMany({
            where: { anulado: { not: true } },
            select: { folio: true, region: true }
        });

        const validFolioRegionMap = new Map<string, string>();
        originalCabs.forEach(cab => {
            if (cab.folio) {
                validFolioRegionMap.set(cab.folio, cab.region || 'Desconocida');
            }
        });

        // Filter calculos: ONLY keep calculos whose folioOriginal exists in ElementosEsenciales_Cab AND is not annulled
        calculos = calculos.filter(c => c.folioOriginal && validFolioRegionMap.has(c.folioOriginal));

        // Filter calculos by selected supervisor if provided
        if (supervisor) {
            calculos = calculos.filter(c => {
                const supInfo = rbdToSupervisorMap.get(c.rbd);
                const supervisorName = supInfo?.nombre || 'Sin Supervisor Asignado';
                return supervisorName === supervisor || (supInfo && `${supInfo.nombre}`.toLowerCase().includes(supervisor.toLowerCase()));
            });
        }

        // Metrics calculations
        let totalMonto = 0;
        let totalSolucionable = 0;
        let totalNoSolucionable = 0;
        let totalNc = 0;

        const uniqueFolios = new Set(calculos.map(c => c.folioOriginal));
        const totalFolios = uniqueFolios.size;

        // Group structures
        const anualMap = new Map<number, { solucionable: number, noSolucionable: number, total: number }>();
        const mensualMap = new Map<number, { solucionable: number, noSolucionable: number, total: number }>();
        const regionMap = new Map<string, { monto: number, folios: Set<string>, nc: number }>();
        const rbdMap = new Map<number, { monto: number, folios: Set<string>, nc: number, ncList: Array<{ folio: string, letraAspecto: string, descripcion: string, montoMulta: number, fechaSupervision: string }> }>();
        const aspectMap = new Map<string, { monto: number, count: number, descripcion: string, letra: string, aspecto: string }>();
        const supMap = new Map<string, { monto: number, folios: Set<string>, rbds: Set<number>, nc: number, sucursal: string }>();

        calculos.forEach(c => {
            const date = new Date(c.fechaSupervision);
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-12
            const folio = c.folioOriginal;
            const region = validFolioRegionMap.get(folio) || 'Desconocida';
            const rbd = c.rbd;
            const licName = c.licitacion;

            // Initialize annual map
            if (!anualMap.has(year)) {
                anualMap.set(year, { solucionable: 0, noSolucionable: 0, total: 0 });
            }
            const anualData = anualMap.get(year)!;

            // Initialize monthly map
            if (!mensualMap.has(month)) {
                mensualMap.set(month, { solucionable: 0, noSolucionable: 0, total: 0 });
            }
            const mensualData = mensualMap.get(month)!;

            // Initialize region map
            if (!regionMap.has(region)) {
                regionMap.set(region, { monto: 0, folios: new Set(), nc: 0 });
            }
            const regData = regionMap.get(region)!;

            // Initialize school rbd map
            if (!rbdMap.has(rbd)) {
                rbdMap.set(rbd, { monto: 0, folios: new Set(), nc: 0, ncList: [] });
            }
            const rbdData = rbdMap.get(rbd)!;

            // Initialize supervisor map
            const supInfo = rbdToSupervisorMap.get(rbd);
            const supervisorName = supInfo?.nombre || 'Sin Supervisor Asignado';
            const supSucursal = supInfo?.sucursal || '';

            if (!supMap.has(supervisorName)) {
                supMap.set(supervisorName, { monto: 0, folios: new Set(), rbds: new Set(), nc: 0, sucursal: supSucursal });
            }
            const supData = supMap.get(supervisorName)!;
            supData.folios.add(folio);
            if (rbd) supData.rbds.add(rbd);

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
                    mensualData.solucionable += monto;
                } else {
                    totalNoSolucionable += monto;
                    anualData.noSolucionable += monto;
                    mensualData.noSolucionable += monto;
                }
                anualData.total += monto;
                mensualData.total += monto;

                regData.monto += monto;
                regData.nc += 1;

                rbdData.monto += monto;
                rbdData.nc += 1;

                supData.monto += monto;
                supData.nc += 1;

                let desc = det.descripcion || '';
                const cleanLetra = (det.letraAspecto || 'Desconocido').trim();
                const rawLetraOnly = cleanLetra.replace(/^aspecto\s+/i, '').trim();

                if (!desc) {
                    desc = getAspectoMasterDesc(rawLetraOnly, licName) || '';
                }

                rbdData.ncList.push({
                    folio: c.folioOriginal || '',
                    letraAspecto: det.letraAspecto || '',
                    descripcion: desc,
                    montoMulta: monto,
                    fechaSupervision: c.fechaSupervision ? new Date(c.fechaSupervision).toLocaleDateString('es-CL') : ''
                });

                // Aspect grouping by Aspect Letter (e.g. "Aspecto A")
                const aspectoTitle = cleanLetra.toUpperCase().startsWith('ASPECTO') ? cleanLetra : `Aspecto ${cleanLetra}`;
                const aspectKey = aspectoTitle;

                const masterDesc = getAspectoMasterDesc(rawLetraOnly, licName);

                if (!aspectMap.has(aspectKey)) {
                    aspectMap.set(aspectKey, {
                        monto: 0,
                        count: 0,
                        descripcion: masterDesc || desc || aspectoTitle,
                        letra: cleanLetra,
                        aspecto: aspectoTitle
                    });
                }
                const aspData = aspectMap.get(aspectKey)!;
                aspData.monto += monto;
                aspData.count += 1;
                if (masterDesc) {
                    aspData.descripcion = masterDesc;
                }
            });
        });

        // 1. Annual stats formatting
        const anualStats = Array.from(anualMap.entries()).map(([year, data]) => ({
            year,
            solucionable: parseFloat(data.solucionable.toFixed(0)),
            noSolucionable: parseFloat(data.noSolucionable.toFixed(0)),
            total: parseFloat(data.total.toFixed(0))
        })).sort((a, b) => a.year - b.year);

        // 1b. Monthly stats formatting
        const MONTH_NAMES_LIST = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const mensualStats = Array.from(mensualMap.entries()).map(([month, data]) => ({
            month,
            monthName: MONTH_NAMES_LIST[month - 1] || `Mes ${month}`,
            solucionable: parseFloat(data.solucionable.toFixed(0)),
            noSolucionable: parseFloat(data.noSolucionable.toFixed(0)),
            total: parseFloat(data.total.toFixed(0))
        })).sort((a, b) => a.month - b.month);

        // 2. Region stats formatting
        const regionStats = Array.from(regionMap.entries()).map(([region, data]) => ({
            region,
            monto: parseFloat(data.monto.toFixed(0)),
            folios: data.folios.size,
            nc: data.nc
        })).sort((a, b) => b.monto - a.monto);

        // 3. TOP 10 RBDs formatting with sucursal in parentheses
        const sortedRbds = Array.from(rbdMap.entries()).map(([rbd, data]) => ({
            rbd,
            monto: parseFloat(data.monto.toFixed(0)),
            folios: data.folios.size,
            nc: data.nc,
            ncList: data.ncList
        })).sort((a, b) => b.monto - a.monto).slice(0, 10);

        // Fetch School names & sucursales for the TOP 10
        const topRbdList = sortedRbds.map(s => s.rbd);
        const topSchoolsDb = await prisma.colegiosMatriz.findMany({
            where: { colRBD: { in: topRbdList } },
            select: { colRBD: true, nombreEstablecimiento: true, sucursal: true }
        });

        const schoolInfoMap = new Map<number, { nombre: string; sucursal: string }>();
        topSchoolsDb.forEach(s => {
            schoolInfoMap.set(s.colRBD, { nombre: s.nombreEstablecimiento, sucursal: s.sucursal || '' });
        });

        const topSchools = sortedRbds.map(s => {
            const info = schoolInfoMap.get(s.rbd);
            const nombreBase = info?.nombre || 'Establecimiento Desconocido';
            const sucursalSuffix = info?.sucursal ? ` (${info.sucursal})` : '';
            return {
                ...s,
                nombreEstablecimiento: `${nombreBase}${sucursalSuffix}`
            };
        });

        // 4. Aspect stats formatting (display Aspecto X for chart label and description for tooltip)
        const aspectStats = Array.from(aspectMap.entries()).map(([key, data]) => {
            const masterDesc = getAspectoMasterDesc(data.letra, null) || data.descripcion;
            const finalDesc = masterDesc && masterDesc !== data.aspecto ? masterDesc : data.aspecto;
            return {
                aspecto: data.aspecto,
                monto: parseFloat(data.monto.toFixed(0)),
                count: data.count,
                descripcion: finalDesc,
                letra: data.letra
            };
        }).sort((a, b) => b.monto - a.monto);

        // 5. TOP Supervisores formatting
        const supervisorStats = Array.from(supMap.entries())
            .filter(([name]) => name !== 'Sin Supervisor Asignado')
            .map(([supervisor, data]) => ({
                supervisor,
                monto: parseFloat(data.monto.toFixed(0)),
                folios: data.folios.size,
                rbdCount: data.rbds.size,
                nc: data.nc,
                sucursal: data.sucursal
            }))
            .sort((a, b) => b.monto - a.monto)
            .slice(0, 10);

        // 6. SOP y JOP stats formatting
        const sopJopMap = new Map<string, { folios: Set<string>, subItems: Map<string, Set<string>> }>();

        calculos.forEach(c => {
            const folio = c.folioOriginal;
            if (!folio) return;
            const rbd = c.rbd;
            const info = rbdToSopJopMap.get(rbd) || { jopName: 'Sin Jefe Operación', supName: 'Sin Supervisor' };

            const jopKey = info.jopName.toUpperCase().trim();
            if (!sopJopMap.has(jopKey)) {
                sopJopMap.set(jopKey, { folios: new Set(), subItems: new Map() });
            }
            const jopData = sopJopMap.get(jopKey)!;
            jopData.folios.add(folio);

            const supKey = info.supName.toUpperCase().trim();
            if (!jopData.subItems.has(supKey)) {
                jopData.subItems.set(supKey, new Set());
            }
            jopData.subItems.get(supKey)!.add(folio);
        });

        const sopJopStats = Array.from(sopJopMap.entries()).map(([nombre, data]) => ({
            nombre,
            actas: data.folios.size,
            subItems: Array.from(data.subItems.entries()).map(([supNombre, supFolios]) => ({
                nombre: supNombre,
                actas: supFolios.size
            })).sort((a, b) => b.actas - a.actas)
        })).sort((a, b) => b.actas - a.actas);

        const availableSupervisores = Array.from(new Set(
            supervisoresDb
                .filter(s => {
                    if (!sucursal) return true;
                    const sucursales = s.rbdsAuditar.map(r => rbdSucursalMap.get(r.rbd)).filter((v): v is string => Boolean(v));
                    return sucursales.includes(sucursal);
                })
                .map(s => {
                    const nombreBase = `${s.nombre} ${s.apellido}`.trim();
                    const sucursales = Array.from(new Set(s.rbdsAuditar.map(r => rbdSucursalMap.get(r.rbd)).filter((v): v is string => Boolean(v))));
                    const sucursalName = sucursales.length > 0 ? sucursales[0] : '';
                    return sucursalName ? `${nombreBase} (${sucursalName})` : nombreBase;
                })
        )).sort();

        return NextResponse.json({
            totals: {
                totalMonto: parseFloat(totalMonto.toFixed(0)),
                totalSolucionable: parseFloat(totalSolucionable.toFixed(0)),
                totalNoSolucionable: parseFloat(totalNoSolucionable.toFixed(0)),
                totalFolios,
                totalNc
            },
            anualStats,
            mensualStats,
            regionStats,
            topSchools,
            aspectStats,
            supervisorStats,
            sopJopStats,
            availableSupervisores
        });

    } catch (e: any) {
        console.error("Error generating dashboard multas-ee data:", e);
        return NextResponse.json({ error: 'Internal Server Error: ' + e.message }, { status: 500 });
    }
}
