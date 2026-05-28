const fs = require('fs');

const files = [
    'D:/Programas/AplicacionWeb/src/app/dashboard/mantenedor/operaciones/personal/PersonalClient.tsx',
    'D:/Programas/AplicacionWeb/src/app/dashboard/tablero/kilometraje/KilometrajeTableroClient.tsx'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix sucursalObj lookup
    content = content.replace(
        /const sucursalObj = sucursales\.find\(su => su\.nombre === schoolSucursal\)/g,
        "const sucursalObj = sucursales.find(su => su.nombre.trim().toUpperCase() === (schoolSucursal || '').trim().toUpperCase())"
    );
    
    // Fix cache lookups in KilometrajeTableroClient and PersonalClient
    content = content.replace(
        /const cache = schoolSucursal \? distanciasCache\.find\(c => c\.sucursal === schoolSucursal && c\.rbd === r\.rbd\) : null/g,
        "const cache = schoolSucursal ? distanciasCache.find(c => c.sucursal.trim().toUpperCase() === schoolSucursal.trim().toUpperCase() && c.rbd === r.rbd) : null"
    );

    // Fix other cache lookups like `cache = distanciasCache.find(c => c.sucursal === sucursalName && c.rbd === r.rbd)`
    content = content.replace(
        /c\.sucursal === sucursalName/g,
        "c.sucursal.trim().toUpperCase() === (sucursalName || '').trim().toUpperCase()"
    );

    content = content.replace(
        /c\.sucursal === schoolSucursal/g,
        "c.sucursal.trim().toUpperCase() === (schoolSucursal || '').trim().toUpperCase()"
    );

    fs.writeFileSync(file, content, 'utf8');
}
console.log('Fixed cache and sucursalObj lookups in modals');
