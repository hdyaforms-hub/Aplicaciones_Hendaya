import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result1 = await prisma.colegiosMatriz.findMany({
      where: {
          OR: [
              { sucursal: { in: ['CD COPIAPO'] } },
              { colRBD: { in: [] } }
          ]
      }
  })
  console.log("Result OR with in: []:", result1.length)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
