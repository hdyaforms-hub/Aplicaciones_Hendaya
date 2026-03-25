const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const adminRole = await prisma.role.findFirst({
    where: { name: 'Administrador' }
  })

  if (!adminRole) {
    console.log('Role Administrador not found')
    return
  }

  let perms = []
  try {
    perms = JSON.parse(adminRole.permissions)
  } catch (e) {
    perms = adminRole.permissions // In case it's already an array
  }

  const newPerms = ['view_formularios', 'create_formularios', 'fill_formularios']
  
  newPerms.forEach(p => {
    if (!perms.includes(p)) {
      perms.push(p)
      console.log(`Added permission: ${p}`)
    }
  })

  await prisma.role.update({
    where: { id: adminRole.id },
    data: { permissions: JSON.stringify(perms) }
  })

  console.log('Updated permissions for Administrador')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
