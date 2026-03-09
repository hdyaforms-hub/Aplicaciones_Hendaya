import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import IndicadoresChart from './IndicadoresChart';
import { redirect } from 'next/navigation';

export default async function TableroPage({
    searchParams
}: {
    searchParams: Promise<{
        ano?: string,
        mes?: string,
        sucursal?: string,
        ut?: string,
        rbd?: string
    }>
}) {
    const session = await getSession();

    // You can restrict this to specific roles using session.user.role.permissions
    if (!session?.user?.role?.permissions.includes('view_tablero')) {
        redirect('/dashboard');
    }

    const resolved = await searchParams;
    const filters = {
        ano: resolved.ano ? parseInt(resolved.ano) : undefined,
        mes: resolved.mes ? parseInt(resolved.mes) : undefined,
        sucursal: resolved.sucursal || undefined,
        ut: resolved.ut ? parseInt(resolved.ut) : undefined,
        rbd: resolved.rbd ? parseInt(resolved.rbd) : undefined,
    };

    // 1. Get authorized Suucursales for User
    const dbUser = await (prisma.user as any).findUnique({
        where: { id: session.user.id },
        include: { sucursales: true }
    });
    const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || [];

    const uts = await prisma.uT.findMany({
        where: { sucursal: { nombre: { in: userSucursales } } },
        select: { codUT: true, sucursal: { select: { nombre: true } } }
    });
    const allowedUTs = uts.map(ut => ut.codUT);

    // 2. Fetch Base Colegios allowed for this user
    let baseColegios = await prisma.colegios.findMany({
        where: { colut: { in: allowedUTs } },
        select: { colRBD: true, colut: true, sucursal: true, nombreEstablecimiento: true }
    });

    // Normalize sucursal in colegios to match exact allowed names, as sometimes strings have padding
    baseColegios = baseColegios.map(c => {
        const matchingUT = uts.find(u => u.codUT === c.colut);
        return {
            ...c,
            sucursal: matchingUT?.sucursal?.nombre || c.sucursal.trim()
        };
    });

    // Extraer Anos y Meses disponibles y RBD con movimientos (from records)
    const allRecords = await prisma.ingRacion.findMany({
        select: { ano: true, mes: true, rbd: true }
    });
    const availableAnos = Array.from(new Set(allRecords.map(r => r.ano))).sort((a, b) => b - a);
    const availableMeses = Array.from(new Set(allRecords.map(r => r.mes))).sort((a, b) => a - b);
    const rbdWithMovements = new Set(allRecords.map(r => r.rbd));

    // Solo usar colegios que de hecho tienen algún ingreso registrado para poblar los filtros
    const colegiosWithMovements = baseColegios.filter(c => rbdWithMovements.has(c.colRBD));

    // Extract unique filtering options based on user's authorization AND existing movements
    const availableSucursales = Array.from(new Set(colegiosWithMovements.map(c => c.sucursal))).sort();

    // If user selected sucursal, filter UTs using only those that have movements
    const availableUTs = Array.from(new Set(colegiosWithMovements
        .filter(c => !filters.sucursal || c.sucursal === filters.sucursal)
        .map(c => c.colut)
    )).sort((a: any, b: any) => a - b);

    // If user selected UT, filter RBDs
    const availableRBDs = colegiosWithMovements
        .filter(c => !filters.sucursal || c.sucursal === filters.sucursal)
        .filter(c => !filters.ut || c.colut === filters.ut)
        .map(c => ({ value: c.colRBD, label: `${c.colRBD} - ${c.nombreEstablecimiento}` }))
        .sort((a, b) => a.value - b.value);

    // 3. Build the final query filters
    const selectedColegios = baseColegios
        .filter(c => !filters.sucursal || c.sucursal === filters.sucursal)
        .filter(c => !filters.ut || c.colut === filters.ut)
        .filter(c => !filters.rbd || c.colRBD === filters.rbd);

    const queryRBDs = selectedColegios.map(c => c.colRBD);

    // Query actual Raciones
    const racFilter: any = { rbd: { in: queryRBDs } };
    if (filters.ano) racFilter.ano = filters.ano;
    if (filters.mes) racFilter.mes = filters.mes;

    // Query the actual data for the chart
    const registros = await prisma.ingRacion.findMany({
        where: racFilter,
        select: {
            fechaIngreso: true,
            totalAsig: true,
            totalIng: true
        },
        orderBy: { fechaIngreso: 'asc' }
    });

    // 4. Process data into chart format: Group by 'YYYY-MM-DD'
    const groupedData: Record<string, { ing: number, asig: number }> = {};

    registros.forEach(r => {
        // Usamos toISOString o similar para la fecha, ignorando la zona horaria si es UTC12
        const d = new Date(r.fechaIngreso);
        const dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; // eg. '15/3'
        if (!groupedData[dateStr]) groupedData[dateStr] = { ing: 0, asig: 0 };
        groupedData[dateStr].ing += r.totalIng;
        groupedData[dateStr].asig += r.totalAsig;
    });

    // Calculate overall stats
    let sumIng = 0;
    let sumAsig = 0;

    const chartData = Object.keys(groupedData).map(dateStr => {
        const data = groupedData[dateStr];
        sumIng += data.ing;
        sumAsig += data.asig;

        const tasa = data.asig > 0 ? (data.ing / data.asig) * 100 : 0;

        return {
            dateStr,
            ing: data.ing,
            asig: data.asig,
            tasa: parseFloat(tasa.toFixed(2))
        };
    });

    const avgTasa = sumAsig > 0 ? (sumIng / sumAsig) : 0;

    const resumeStats = {
        sumIng,
        sumAsig,
        avgTasa,
        days: chartData.length
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📈</span> Tablero de Control y Avances
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Visualizador de estadísticas del rendimiento PMPA vs Ingresos Reales
                    </p>
                </div>
            </div>

            {/* Header Filtros */}
            <form className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                    <select name="ano" defaultValue={filters.ano?.toString() || ''} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 appearance-none text-black font-medium">
                        <option value="">(Todos)</option>
                        {availableAnos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                    <select name="mes" defaultValue={filters.mes?.toString() || ''} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 appearance-none text-black font-medium">
                        <option value="">(Todos)</option>
                        {availableMeses.map((m, i) => <option key={i} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                    <select name="sucursal" defaultValue={filters.sucursal || ''} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 appearance-none text-black font-medium auto-submit">
                        <option value="">(Todas)</option>
                        {availableSucursales.map((s: any) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">UT</label>
                    <select name="ut" defaultValue={filters.ut?.toString() || ''} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 appearance-none text-black font-medium disabled:opacity-50 auto-submit" disabled={!filters.sucursal}>
                        <option value="">(Todas)</option>
                        {availableUTs.map(ut => <option key={ut} value={ut}>{ut}</option>)}
                    </select>
                </div>
                <div className="flex-[2] min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Establecimiento / RBD</label>
                    <select name="rbd" defaultValue={filters.rbd?.toString() || ''} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 bg-gray-50 appearance-none text-black font-medium disabled:opacity-50 auto-submit" disabled={!filters.ut}>
                        <option value="">(Todos)</option>
                        {availableRBDs.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
                <div>
                    <button type="submit" className="px-5 py-2 rounded-xl text-white bg-slate-800 hover:bg-slate-900 shadow-sm font-medium transition-colors w-full sm:w-auto h-[42px]">
                        Filtrar
                    </button>
                </div>
                <div>
                    <a href="/dashboard/tablero" className="px-4 py-2 rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors text-sm w-full sm:w-auto h-[42px] flex items-center justify-center">
                        Limpiar
                    </a>
                </div>
            </form>

            <script dangerouslySetInnerHTML={{
                __html: `
                document.querySelectorAll('.auto-submit').forEach(el => {
                    el.addEventListener('change', function() {
                        if (this.name === 'sucursal') {
                            const utComb = this.form.querySelector('select[name="ut"]');
                            if(utComb) utComb.value = '';
                            const rbdComb = this.form.querySelector('select[name="rbd"]');
                            if(rbdComb) rbdComb.value = '';
                        }
                        if (this.name === 'ut') {
                            const rbdComb = this.form.querySelector('select[name="rbd"]');
                            if(rbdComb) rbdComb.value = '';
                        }
                        this.form.submit();
                    });
                });
            `}} />

            {/* Chart Canvas */}
            <IndicadoresChart chartData={chartData} resumeStats={resumeStats} />
        </div>
    );
}
