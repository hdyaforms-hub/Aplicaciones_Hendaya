const XLSX = require('xlsx');
const fs = require('fs');

function checkFile(path) {
  if (!fs.existsSync(path)) return;
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`--- ${path} ---`);
  console.log(`Total rows: ${data.length}`);
  if (data.length > 0) {
    console.log('First row:', JSON.stringify(data[0], null, 2));
  }
}

checkFile('./Formato UT.xlsx');
checkFile('./Formato Colegios.xlsx');
checkFile('./prueba_pmpa.xlsx');
