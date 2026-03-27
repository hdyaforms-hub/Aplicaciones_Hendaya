const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/dev.db');

const fields = [
  {
    id: 'field-name-' + Date.now(),
    type: 'text',
    label: 'Nombre Completo',
    required: true
  },
  {
    id: 'field-ut-' + Date.now(),
    type: 'select',
    label: 'UT de Operación',
    required: true,
    systemSource: 'UT'
  }
];

const title = 'Prueba de formulario';
const description = 'Ejemplo recreado tras el reset de base de datos.';
const areaId = 3;
const createdBy = 'admin';
const createdAt = new Date().toISOString();
const updatedAt = createdAt;
const id = 'form-' + Math.random().toString(36).substring(2, 15);

db.run(
  `INSERT INTO FormDefinition (id, title, description, fields, areaId, isActive, createdBy, createdAt, updatedAt) 
   VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  [id, title, description, JSON.stringify(fields), areaId, createdBy, createdAt, updatedAt],
  function(err) {
    if (err) {
      return console.error(err.message);
    }
    console.log(`Formulario creado con ID: ${id}`);
  }
);

db.close();
