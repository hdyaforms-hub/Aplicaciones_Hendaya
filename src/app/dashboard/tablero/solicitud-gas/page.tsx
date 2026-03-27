
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import GasDashboardChart from './GasDashboardChart';

export default async function SolicitudGasTablero({
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

    if (!session?.user?.role?.permissions.includes('view_tablero_gas')) {
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

    // Check if user is Administrador to potentially bypass sucursal filtering
    const isAdmin = session?.user?.role?.name === 'Administrador'
    const permissions = session?.user?.role?.permissions || []
    const canSeeAll = isAdmin || permissions.includes('manage_sucursales')

    const sucursalFilter = filters.sucursal 
        ? filters.sucursal 
        : (canSeeAll ? undefined : { in: userSucursalNames });

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

    
    if (filters.mes) {
        const startDate = new Date(filters.ano, filters.mes - 1, 1, 0, 0, 0);
        const endDate = new Date(filters.ano, filters.mes, 0, 23, 59, 59);
        whereClause.fechaSolicitud = { gte: startDate, lte: endDate };
    } else {
        const startDate = new Date(`${filters.ano}-01-01T00:00:00`);
        const endDate = new Date(`${filters.ano}-12-31T23:59:59`);
        whereClause.fechaSolicitud = { gte: startDate, lte: endDate };
    }

    const solicitudes = await (prisma as any).solicitudGas.findMany({
        where: whereClause,
        orderBy: { fechaSolicitud: 'asc' }
    });

    // 3. Process for Chart and Stats
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyData: any[] = months.map((m) => ({ month: m, litros: 0, solicitudes: 0 }));

    let totalLiters = 0;
    const distributors: Record<string, number> = {};
    const types: Record<string, number> = {};
    const userMap: Record<string, number> = {};
    const allUTsFound = new Set<string>();

    for (const s of solicitudes) {
        const date = new Date(s.fechaSolicitud);
        const monthIdx = date.getMonth();
        const utKey = `UT_${s.ut || 'N/A'}`;
        allUTsFound.add(utKey);

        monthlyData[monthIdx].litros += s.cantidadLitro || 0;
        monthlyData[monthIdx].solicitudes += 1;
        monthlyData[monthIdx][utKey] = (monthlyData[monthIdx][utKey] || 0) + (s.cantidadLitro || 0);

        totalLiters += s.cantidadLitro || 0;

        const dist = s.distribuidor || 'Otro';
        distributors[dist] = (distributors[dist] || 0) + 1;

        const type = s.tipoGas || 'N/A';
        types[type] = (types[type] || 0) + 1;

        const user = s.nombreSolicitante || 'Desconocido';
        userMap[user] = (userMap[user] || 0) + (s.cantidadLitro || 0);
    }

    const distributorData = Object.entries(distributors).map(([name, value]) => ({ name, value }));
    const typeData = Object.entries(types).map(([name, value]) => ({ name, value }));
    const userRanking = Object.entries(userMap)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const utList = Array.from(allUTsFound);

    // Fetch school names for top list
    const topRBDEntries = Object.entries(solicitudes.reduce((acc: any, s: any) => {
        acc[s.rbd] = (acc[s.rbd] || 0) + (s.cantidadLitro || 0);
        return acc;
    }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

    const colegios = await prisma.colegios.findMany({
        where: { colRBD: { in: topRBDEntries.map(e => Number(e[0])) } },
        select: { colRBD: true, nombreEstablecimiento: true }
    });

    const topSchools = topRBDEntries.map(e => {
        const col = colegios.find(c => c.colRBD === Number(e[0]));
        return {
            name: col ? col.nombreEstablecimiento.substring(0, 15) : `RBD ${e[0]}`,
            total: e[1] as number
        };
    });

    const resumeStats = {
        totalLiters,
        totalSolicitudes: solicitudes.length,
        avgLiters: solicitudes.length > 0 ? totalLiters / solicitudes.length : 0,
        // Monthly trend comparison (Current month vs Previous)
        growth: 0 
    };
    
    const currentMonth = new Date().getMonth();
    const currentMonthLiters = monthlyData[currentMonth].litros;
    const prevMonthLiters = currentMonth > 0 ? monthlyData[currentMonth - 1].litros : 0;
    if (prevMonthLiters > 0) {
        resumeStats.growth = ((currentMonthLiters - prevMonthLiters) / prevMonthLiters) * 100;
    }

    const availableAnos = [new Date().getFullYear(), new Date().getFullYear() - 1];
    
    // Obtener todas las sucursales si es admin para el dropdown
    let availableSucursales = userSucursalNames;
    if (canSeeAll) {
        const allSucs = await prisma.sucursal.findMany({ select: { nombre: true } });
        availableSucursales = allSucs.map(s => s.nombre);
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>🔥</span> Tablero: Solicitudes de Gas
                    </h2>
                    <p className="text-gray-500 mt-1">Monitoreo de consumo de combustible y logística de pedidos.</p>
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
                    <a href="/dashboard/tablero/solicitud-gas" className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200">
                        Limpiar
                    </a>
                </form>
            </div>

            <GasDashboardChart 
                chartData={monthlyData} 
                resumeStats={resumeStats} 
                distributorData={distributorData}
                typeData={typeData}
                topSchools={topSchools}
                userRanking={userRanking}
                utList={utList}
            />
        </div>
    );
}
