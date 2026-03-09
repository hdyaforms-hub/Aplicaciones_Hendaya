const xlsx = require('xlsx');

const createExcel = () => {
    const data = [
        { sucursal: 'Santiago Centro', año: 2026, mes: 3, rbd: 1001, programa: 'PROG-A', estrato: 'VIP', raceq: 50, servicio: 'SERV-01' },
        { sucursal: 'Santiago Centro', año: 2026, mes: 3, rbd: 1002, programa: 'PROG-B', estrato: 'REGULAR', raceq: 12, servicio: 'SERV-02' },
        { sucursal: 'Valparaiso', año: 2026, mes: 3, rbd: 2005, programa: 'PROG-A', estrato: 'REGULAR', raceq: 44, servicio: 'SERV-01' },
        { sucursal: 'Concepcion', año: 2025, mes: 12, rbd: 3001, programa: 'PROG-C', estrato: 'VIP', raceq: 8, servicio: 'SERV-03' },
    ];

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "PMPA");

    xlsx.writeFile(wb, "prueba_pmpa.xlsx");
    console.log("Archivo de prueba prueba_pmpa.xlsx generado con éxito en " + process.cwd());
};

createExcel();
