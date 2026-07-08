const fs = require('fs');
const { jsPDF } = require('jspdf');

const text = fs.readFileSync('Documentacion_Tecnica.md', 'utf-8');

const doc = new jsPDF();
doc.setFontSize(10);

const lines = doc.splitTextToSize(text, 180);
let cursorY = 20;

lines.forEach(line => {
    if (cursorY > 280) {
        doc.addPage();
        cursorY = 20;
    }
    doc.text(line, 15, cursorY);
    cursorY += 5;
});

doc.save('Documentacion_Tecnica.pdf');
console.log('PDF generado exitosamente.');
