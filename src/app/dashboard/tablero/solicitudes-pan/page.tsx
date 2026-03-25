import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import PanDashboardChart from './PanDashboardChart';

export default async function SolicitudesPanTablero({
    searchParams
}: {
    searchParams: Promise<{
        ano?: string,
        mes?: string,
        sucursal?: string,
        rbd?: string
    }>
}) {
    const session = await getSession();

    if (!session?.user?.role?.permissions.includes('view_tablero_pan')) {
        redirect('/dashboard');
    }

    const resolved = await searchParams;
    const filters = {
        ano: resolved.ano ? parseInt(resolved.ano) : new Date().getFullYear(),
        mes: resolved.mes ? parseInt(resolved.mes) : undefined,
        sucursal: resolved.sucursal || undefined,
        rbd: resolved.rbd ? parseInt(resolved.rbd) : undefined,
    };

    // 1. Get authorized Sucursales
    const dbUser = await (prisma.user as any).findUnique({
        where: { id: session.user.id },
        include: { sucursales: true }
    });
    const userSucursalNames = dbUser?.sucursales?.map((s: any) => s.nombre) || [];

    const sucursalFilter = filters.sucursal && userSucursalNames.includes(filters.sucursal)
        ? filters.sucursal
        : { in: userSucursalNames };

    const uts = await prisma.uT.findMany({
        where: { sucursal: { nombre: sucursalFilter } },
        select: { codUT: true }
    });
    const allowedUTs = uts.map(ut => ut.codUT);

    // 2. Fetch Data
    const whereClause: any = {
        ut: { in: allowedUTs },
    };
    if (filters.rbd) whereClause.rbd = filters.rbd;

    // Filter by year using date range
    
    if (filters.mes) {
        const startDate = new Date(filters.ano, filters.mes - 1, 1, 0, 0, 0);
        const endDate = new Date(filters.ano, filters.mes, 0, 23, 59, 59);
        whereClause.fechaSolicitud = { gte: startDate, lte: endDate };
    } else {
        const startDate = new Date(`${filters.ano}-01-01T00:00:00`);
        const endDate = new Date(`${filters.ano}-12-31T23:59:59`);
        whereClause.fechaSolicitud = { gte: startDate, lte: endDate };
    }

    const solicitudes = await prisma.solicitudPan.findMany({
        where: whereClause,
        orderBy: { fechaSolicitud: 'asc' }
    });

    // 3. Process for Chart and Stats
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyData: any[] = months.map((m) => ({ month: m, unidades: 0 }));

    let totalUnidades = 0;
    const userMap: Record<string, number> = {};
    const allUTsFound = new Set<string>();

    for (const s of solicitudes) {
        const monthIdx = new Date(s.fechaSolicitud).getMonth();
        const utKey = `UT_${s.ut || 'N/A'}`;
        allUTsFound.add(utKey);

        monthlyData[monthIdx].unidades += s.cantidad;
        monthlyData[monthIdx][utKey] = (monthlyData[monthIdx][utKey] || 0) + s.cantidad;
        totalUnidades += s.cantidad;

        const user = s.nombreSolicitante || 'Desconocido';
        userMap[user] = (userMap[user] || 0) + s.cantidad;
    }

    const userRanking = Object.entries(userMap)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const utList = Array.from(allUTsFound);

    const schoolStats: Record<number, { name: string, total: number }> = {};
    for (const s of solicitudes) {
        if (!schoolStats[s.rbd]) {
            schoolStats[s.rbd] = { name: `RBD ${s.rbd}`, total: 0 };
        }
        schoolStats[s.rbd].total += s.cantidad;
    }

    // Attempt to get school names for top list
    const topRBDs = Object.keys(schoolStats).map(Number);
    const colegios = await prisma.colegios.findMany({
        where: { colRBD: { in: topRBDs } },
        select: { colRBD: true, nombreEstablecimiento: true }
    });

    const topSchoolsRaw = Object.entries(schoolStats).map(([rbd, stats]) => {
        const col = colegios.find(c => c.colRBD === Number(rbd));
        return {
            name: col ? col.nombreEstablecimiento.substring(0, 15) : stats.name,
            total: stats.total
        };
    }).sort((a, b) => b.total - a.total).slice(0, 5);

    const resumeStats = {
        totalUnidades,
        totalSolicitudes: solicitudes.length,
        avgUnidades: solicitudes.length > 0 ? totalUnidades / solicitudes.length : 0,
        growth: 0
    };

    const currentMonth = new Date().getMonth();
    const currentMonthUnits = monthlyData[currentMonth].unidades;
    const prevMonthUnits = currentMonth > 0 ? monthlyData[currentMonth - 1].unidades : 0;
    if (prevMonthUnits > 0) {
        resumeStats.growth = ((currentMonthUnits - prevMonthUnits) / prevMonthUnits) * 100;
    }

    // Filters data
    const availableAnos = [new Date().getFullYear(), new Date().getFullYear() - 1];
    const availableSucursales = userSucursalNames;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🍞</span> Tablero: Solicitudes de Pan
                    </h2>
                    <p className="text-gray-500 mt-1">Análisis de consumo y pedidos de pan por establecimiento.</p>
                </div>

                <form className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 tracking-wider">Año</label>
                        <select name="ano" defaultValue={filters.ano} className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-black shadow-sm">
                            {availableAnos.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 tracking-wider">Mes</label>
                        <select name="mes" defaultValue={filters.mes || ''} className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-black shadow-sm">
                            <option value="">Todos</option>
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 tracking-wider">Sucursal</label>
                        <select name="sucursal" defaultValue={filters.sucursal || ''} className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-black min-w-[120px] shadow-sm">
                            <option value="">Todas</option>
                            {availableSucursales.map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 tracking-wider">RBD</label>
                        <input 
                            name="rbd" 
                            type="number" 
                            placeholder="RBD..."
                            defaultValue={filters.rbd || ''} 
                            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-black w-[100px] shadow-sm"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors">
                        Actualizar
                    </button>
                    <a href="/dashboard/tablero/solicitudes-pan" className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200">
                        Limpiar
                    </a>
                </form>
            </div>

            <PanDashboardChart 
                chartData={monthlyData} 
                resumeStats={resumeStats} 
                topSchools={topSchoolsRaw}
                userRanking={userRanking}
                utList={utList}
            />
        </div>
    );
}
