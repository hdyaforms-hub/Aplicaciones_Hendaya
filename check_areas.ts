import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const areas = await prisma.area.findMany()
  areas.forEach((a: any) => console.log(`${a.id}: ${a.nombre}`))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
