const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Aplicando parche: Columna rolesPerfiles en MatrizT_Cabecera ---')
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "MatrizT_Cabecera" ADD COLUMN IF NOT EXISTS "rolesPerfiles" TEXT;
    `)
    console.log('--- Columna rolesPerfiles verificada/creada exitosamente ---')
}

main()
    .catch((e) => {
        console.error('Error aplicando parche:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
