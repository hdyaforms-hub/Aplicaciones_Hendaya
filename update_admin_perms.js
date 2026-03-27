const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/dev.db');

const allPermissions = [
  "view_tablero",
  "manage_users",
  "manage_roles",
  "manage_areas",
  "manage_sucursales",
  "view_colegios",
  "view_pmpa",
  "view_productos",
  "manage_gas",
  "create_formularios",
  "fill_formularios",
  "view_respuestas"
];

db.run(
  `UPDATE Role SET permissions = ? WHERE name = 'Administrador'`,
  [JSON.stringify(allPermissions)],
  function(err) {
    if (err) throw err;
    console.log(`Permisos actualizados para el rol Administrador. Filas afectadas: ${this.changes}`);
  }
);

db.close();
