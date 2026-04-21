const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const roles = await prisma.role.findMany()
  console.log('Roles found:')
  roles.forEach(r => {
    console.log(`- ID: ${r.id}, Name: "${r.name}", Description: "${r.description}"`)
  })
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
