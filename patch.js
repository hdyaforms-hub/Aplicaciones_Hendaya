const fs = require('fs');

const path = 'D:/Programas/AplicacionWeb/src/app/dashboard/mantenedor/operaciones/personal/PersonalClient.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Add States
if (content.includes('// Distances Table States')) {
    console.log("States already added");
} else {
    content = content.replace(
        `    useEffect(() => {\n        setPageSuper(1)\n    }, [searchSuper, sortSuper])\n\n    // Many-to-many checklists filters`,
        `    useEffect(() => {\n        setPageSuper(1)\n    }, [searchSuper, sortSuper])\n\n    // Distances Table States\n    const [distSearchSupervisor, setDistSearchSupervisor] = useState('')\n    const [distSearchSucursal, setDistSearchSucursal] = useState('')\n    const [distSort, setDistSort] = useState({ col: 'recorrido', dir: 'desc' })\n    const [distPage, setDistPage] = useState(1)\n    \n    useEffect(() => {\n        setDistPage(1)\n    }, [distSearchSupervisor, distSearchSucursal, distSort])\n\n    // Many-to-many checklists filters`
    );
}

// 2. Pre-calculate processedDistancesSupervisores
if (content.includes('const processedDistancesSupervisores =')) {
    console.log("Processed states already added");
} else {
    content = content.replace(
        `    const totalSuperPages = Math.ceil(sortedSupervisores.length / itemsPerPage) || 1\n    const pagedSupervisores = sortedSupervisores.slice((pageSuper - 1) * itemsPerPage, pageSuper * itemsPerPage)\n\n    const downloadExcel = () => {`,
        `    const totalSuperPages = Math.ceil(sortedSupervisores.length / itemsPerPage) || 1\n    const pagedSupervisores = sortedSupervisores.slice((pageSuper - 1) * itemsPerPage, pageSuper * itemsPerPage)\n\n    // Pre-calculate distances for the table and apply filters/sorting\n    const processedDistancesSupervisores = [...initialSupervisores].map(s => {\n        const hasOp = !!s.jefeOperacion\n        const dependencyName = hasOp \n            ? \`👔 Jefe Op: \${s.jefeOperacion.nombre} \${s.jefeOperacion.apellido}\`\n            : \`💼 Jefe Zonal: \${s.jefeZonal?.nombre} \${s.jefeZonal?.apellido}\`\n        \n        const zonal = s.jefeOperacion?.jefeZonal || s.jefeZonal\n        const supervisorSucursales = zonal?.sucursales || []\n\n        let totalKm = 0\n        let hasPending = false\n        let hasError = false\n\n        s.rbdsAuditar.forEach((r) => {\n            const school = colegios.find(col => col.colRBD === r.rbd)\n            const schoolSucursal = school ? school.sucursal : (supervisorSucursales?.[0]?.sucursal?.nombre || null)\n            if (schoolSucursal) {\n                const cache = distanciasCache.find(c => c.sucursal === schoolSucursal && c.rbd === r.rbd)\n                if (cache) {\n                    if (cache.distanciaKm === -1) {\n                        hasError = true\n                    } else {\n                        totalKm += cache.distanciaKm\n                    }\n                } else {\n                    hasPending = true\n                }\n            } else {\n                hasError = true\n            }\n        })\n\n        return { ...s, totalKm, hasPending, hasError, dependencyName, supervisorSucursales }\n    })\n    .filter(s => {\n        const qSup = distSearchSupervisor.toLowerCase().trim()\n        const qSuc = distSearchSucursal.toLowerCase().trim()\n        \n        const matchSup = s.nombre.toLowerCase().includes(qSup) || s.apellido.toLowerCase().includes(qSup)\n        const matchSuc = s.supervisorSucursales.some((su) => su.sucursal.nombre.toLowerCase().includes(qSuc))\n        \n        return (qSup === '' || matchSup) && (qSuc === '' || matchSuc)\n    })\n    .sort((a, b) => {\n        const dir = distSort.dir === 'asc' ? 1 : -1\n        switch (distSort.col) {\n            case 'nombre': return dir * (\`\${a.nombre} \${a.apellido}\`).localeCompare(\`\${b.nombre} \${b.apellido}\`)\n            case 'recorrido': return dir * (a.totalKm - b.totalKm)\n            case 'rbds': return dir * (a.rbdsAuditar.length - b.rbdsAuditar.length)\n            default: return 0\n        }\n    })\n\n    const totalDistPages = Math.ceil(processedDistancesSupervisores.length / itemsPerPage) || 1\n    const pagedDistances = processedDistancesSupervisores.slice((distPage - 1) * itemsPerPage, distPage * itemsPerPage)\n\n    const downloadExcel = () => {`
    );
}

const startIndex = content.indexOf('{/* Listado de Kilómetros por Supervisor (Con opción de ver detalles) */}');
const endIndex = content.indexOf('{/* Address Error Troubleshooting list */}');

if (startIndex === -1 || endIndex === -1) {
    console.log("NOT FOUND", startIndex, endIndex);
} else {
    const newTableBlock = `{/* Listado de Kilómetros por Supervisor (Con opción de ver detalles) */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                            <div className="mb-4">
                                <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
                                    <span>🛡️</span> Detalle de Kilómetros de Supervisores
                                </h3>
                                <p className="text-xs text-gray-400 font-semibold mt-1">Haz clic en "Ver detalle" en cualquiera de los supervisores para revisar el desglose de tramos punto por punto.</p>
                                
                                <div className="flex gap-4 mt-4">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por supervisor..." 
                                        value={distSearchSupervisor}
                                        onChange={e => setDistSearchSupervisor(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por sucursal..." 
                                        value={distSearchSucursal}
                                        onChange={e => setDistSearchSucursal(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                                            <th className="px-5 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setDistSort({ col: 'nombre', dir: distSort.col === 'nombre' && distSort.dir === 'asc' ? 'desc' : 'asc' })}>
                                                Nombre Completo {distSort.col === 'nombre' && (distSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3">Jefe Directo / Asociado Con</th>
                                            <th className="px-5 py-3">Sucursales</th>
                                            <th className="px-5 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setDistSort({ col: 'rbds', dir: distSort.col === 'rbds' && distSort.dir === 'asc' ? 'desc' : 'asc' })}>
                                                Colegios (RBDs) {distSort.col === 'rbds' && (distSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setDistSort({ col: 'recorrido', dir: distSort.col === 'recorrido' && distSort.dir === 'asc' ? 'desc' : 'asc' })}>
                                                Recorrido Total (Km) {distSort.col === 'recorrido' && (distSort.dir === 'asc' ? '↑' : '↓')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {pagedDistances.map((s: any) => {
                                            let bgRow = 'hover:bg-cyan-50/20'
                                            if (s.hasError) {
                                                bgRow = 'bg-red-50 hover:bg-red-100/50'
                                            } else if (s.hasPending) {
                                                bgRow = 'bg-amber-50 hover:bg-amber-100/50'
                                            }
                                            
                                            return (
                                                <tr key={s.id} className={\`\${bgRow} transition-colors\`}>
                                                    <td className="px-5 py-3.5 font-bold text-gray-900">{s.nombre} {s.apellido}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={\`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold \${!!s.jefeOperacion ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}\`}>
                                                            {s.dependencyName}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {s.supervisorSucursales.map((su: any) => (
                                                                <span key={su.sucursalId} className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                                    {su.sucursal.nombre}
                                                                </span>
                                                            ))}
                                                            {s.supervisorSucursales.length === 0 && (
                                                                <span className="text-[10px] text-gray-400 italic">Ninguna</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{s.rbdsAuditar.length}</td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex flex-col items-center gap-1 justify-center">
                                                            <span className="font-bold text-gray-900">{s.totalKm > 0 ? \`\${s.totalKm.toFixed(1)} Km\` : s.hasPending ? 'Pendiente' : '0.0 Km'}</span>
                                                            {s.rbdsAuditar.length > 0 && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => { setSelectedSupervisorForDetails(s); setModalPage(1); }}
                                                                    className="text-[10px] text-cyan-600 hover:text-cyan-800 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                                                                >
                                                                    👁️ Ver detalle
                                                                </button>
                                                            )}
                                                            {s.hasError && <span className="text-[9px] text-red-500 font-bold">⚠️ Error direc.</span>}
                                                            {s.hasPending && !s.hasError && <span className="text-[9px] text-amber-500 font-bold">🔍 Sin calcular</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {pagedDistances.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-gray-400 italic">No se encontraron supervisores vinculados</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                                <span className="text-slate-500 font-semibold">
                                    Página {distPage} de {totalDistPages} ({processedDistancesSupervisores.length} resultados)
                                </span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setDistPage(p => Math.max(1, p - 1))}
                                        disabled={distPage === 1}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                                    >
                                        Anterior
                                    </button>
                                    <button 
                                        onClick={() => setDistPage(p => Math.min(totalDistPages, p + 1))}
                                        disabled={distPage === totalDistPages}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        </div>\n\n                        `;

    content = content.substring(0, startIndex) + newTableBlock + content.substring(endIndex);
    fs.writeFileSync(path, content, 'utf8');
    console.log("PATCHED SUCCESSFULLY");
}
