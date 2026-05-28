const fs = require('fs');

const file = 'D:/Programas/AplicacionWeb/src/app/dashboard/areas/operaciones/descargas-pae/DescargasPaeClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add searchQuery state
if (!content.includes('const [searchQuery, setSearchQuery] = useState')) {
    content = content.replace(
        'const [successMessage, setSuccessMessage] = useState<string | null>(null)',
        'const [successMessage, setSuccessMessage] = useState<string | null>(null)\n    const [searchQuery, setSearchQuery] = useState<string>(\'\')'
    );
}

// 2. Compute filteredItems
if (!content.includes('const filteredItems = items.filter')) {
    content = content.replace(
        'const allSelected = items.length > 0 && seleccionados.size === items.length;',
        'const filteredItems = items.filter(item => item.rbd.toString().includes(searchQuery) || item.nombre.toLowerCase().includes(searchQuery.toLowerCase()))\n    const allSelected = filteredItems.length > 0 && seleccionados.size === filteredItems.length;'
    );
    
    // update someSelected
    content = content.replace(
        'const someSelected = items.length > 0 && seleccionados.size > 0 && seleccionados.size < items.length;',
        'const someSelected = filteredItems.length > 0 && seleccionados.size > 0 && seleccionados.size < filteredItems.length;'
    );
}

// 3. Update handleToggleAll
content = content.replace(
    'setSeleccionados(new Set(items.map(item => item.rbd)));',
    'setSeleccionados(new Set(filteredItems.map(item => item.rbd)));'
);

// 4. Update Header and Search Bar
const headerStart = content.indexOf('<div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">');
const headerEnd = content.indexOf('</div>', content.indexOf('</button>', headerStart)) + 6;

if (headerStart !== -1 && !content.includes('value={searchQuery}')) {
    const oldHeader = content.substring(headerStart, headerEnd);
    const newHeader = `<div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
                        <div className="flex justify-between items-center w-full">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Enlaces Disponibles ({filteredItems.length})</h3>
                                <p className="text-xs text-gray-500">Sincroniza tu sesión de Junaeb primero y luego inicia la descarga comprimida.</p>
                            </div>
                            <button 
                                onClick={handleDescargarZIP}
                                disabled={downloading || !isLinked || seleccionados.size === 0}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20 font-bold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 animate-in zoom-in"
                            >
                                <span>⚡</span>{' '}
                                {downloading
                                    ? 'Descargando...'
                                    : seleccionados.size === filteredItems.length && filteredItems.length > 0
                                    ? \`Descargar Todo en un ZIP (\${seleccionados.size})\`
                                    : \`Descargar Seleccionados (\${seleccionados.size}) en un ZIP\`}
                            </button>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Buscar por RBD o Establecimiento..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                disabled={downloading}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                        </div>
                    </div>`;
    content = content.substring(0, headerStart) + newHeader + content.substring(headerEnd);
}

// 5. Update Map loop
content = content.replace(
    '{items.map((item, idx) => (',
    '{filteredItems.map((item, idx) => ('
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched DescargasPaeClient');
