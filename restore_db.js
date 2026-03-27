const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const allPermissions = [
  "view_tablero",
  "view_tablero_pan",
  "view_tablero_gas",
  "view_tablero_retiro",
  "manage_users",
  "manage_roles",
  "manage_areas",
  "manage_sucursales",
  "view_colegios",
  "view_pmpa",
  "view_productos",
  "manage_gas",
  "create_formularios",
  "view_formularios",
  "fill_formularios",
  "view_respuestas",
  "manage_correo",
  "manage_listas",
  "manage_notificaciones",
  "view_ingreso_raciones",
  "view_solicitud_pan",
  "view_solicitud_gas",
  "view_retiro_saldos",
  "manage_anexos",
  "view_anexos"
];

async function main() {
    // 1. Crear Rol Administrador
    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrador' },
        update: { permissions: JSON.stringify(allPermissions) },
        create: {
            name: 'Administrador',
            description: 'Acceso total al sistema',
            permissions: JSON.stringify(allPermissions)
        }
    });
    console.log('Rol Administrador creado/actualizado');

    // 2. Crear Usuario admin
    const password = 'Julio.2021';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await prisma.user.upsert({
        where: { username: 'admin' },
        update: { 
            passwordHash,
            roleId: adminRole.id 
        },
        create: {
            username: 'admin',
            email: 'admin@hendaya.cl',
            passwordHash,
            name: 'Admin User',
            roleId: adminRole.id
        }
    });
    console.log('Usuario admin creado/actualizado');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
