const { PrismaClient } = require('./src/generated/client')
const prisma = new PrismaClient()

async function main() {
  const adminRole = await prisma.role.findFirst({
    where: { name: 'Administrador' }
  })

  if (!adminRole) {
    console.log('Role "Administrador" not found')
    return
  }

  let perms = []
  try {
    perms = JSON.parse(adminRole.permissions)
  } catch (e) {
    perms = adminRole.permissions // If already array
  }

  const newPerms = [
    'manage_vehiculos',
    'manage_zonales',
    'manage_jefe_operacion',
    'manage_supervisor',
    'manage_nueva_matriz',
    'manage_colegios_matriz'
  ]
  
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

  console.log('Successfully updated permissions for role Administrador')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
