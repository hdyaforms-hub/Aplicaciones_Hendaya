import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Prisma Models Keys:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')))
}

main().catch(console.error).finally(() => prisma.$disconnect())
