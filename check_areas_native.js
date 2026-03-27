const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/dev.db');

db.all("SELECT id, nombre FROM Area", [], (err, rows) => {
  if (err) {
    throw err;
  }
  rows.forEach((row) => {
    console.log(`${row.id}: ${row.nombre}`);
  });
});

db.close();
