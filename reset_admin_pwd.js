const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const password = 'Julio.2021';
    
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        console.log('Usuario admin no encontrado.');
        return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (isMatch) {
        console.log('La contraseña ya es Julio.2021');
    } else {
        console.log('La contraseña no coincide. Reseteando a Julio.2021...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await prisma.user.update({
            where: { username },
            data: { passwordHash }
        });
        console.log('Contraseña reseteada con éxito.');
    }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
