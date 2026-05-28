const fs = require('fs');
const path = require('path');

const sourceDir = 'd:\\Programas\\AplicacionWeb';
const destDir = 'D:\\Sitios\\Hendaya';

const files = [
  'src\\app\\api\\areas\\operaciones\\descargas-pae\\download-zip\\route.ts',
  'src\\app\\dashboard\\areas\\operaciones\\descargas-pae\\DescargasPaeClient.tsx',
  'package.json',
  'package-lock.json'
];

files.forEach(file => {
  const src = path.join(sourceDir, file);
  const dest = path.join(destDir, file);
  
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  } else {
    console.log(`Not found: ${file}`);
  }
});
