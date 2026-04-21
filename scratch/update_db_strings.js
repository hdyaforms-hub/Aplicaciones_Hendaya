const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Updating database strings...')

  // 1. Update Role descriptions
  const roles = await prisma.role.findMany()
  for (const role of roles) {
    if (role.description && role.description.includes('Retorno de Productos')) {
      const newDesc = role.description.replace(/Retorno de Productos/g, 'Retirada de productos')
      await prisma.role.update({
        where: { id: role.id },
        data: { description: newDesc }
      })
      console.log(`Updated Role description for: ${role.name}`)
    }
  }

  // 2. Update ListaCorreo names or descriptions
  const listas = await prisma.listaCorreo.findMany()
  for (const lista of listas) {
    let update = false
    let newNombre = lista.nombre
    let newDesc = lista.descripcion

    if (lista.nombre.includes('Retorno de productos') || lista.nombre.includes('Retorno de Productos')) {
      newNombre = lista.nombre.replace(/Retorno de [pP]roductos/g, 'Retirada de productos')
      update = true
    }
    if (lista.descripcion && (lista.descripcion.includes('Retorno de productos') || lista.descripcion.includes('Retorno de Productos'))) {
      newDesc = lista.descripcion.replace(/Retorno de [pP]roductos/g, 'Retirada de productos')
      update = true
    }

    if (update) {
      await prisma.listaCorreo.update({
        where: { id: lista.id },
        data: { nombre: newNombre, descripcion: newDesc }
      })
      console.log(`Updated ListaCorreo: ${lista.nombre} -> ${newNombre}`)
    }
  }

  // 3. Update PlantillaCorreo (asunto/cuerpo)
  const plantillas = await prisma.plantillaCorreo.findMany()
  for (const p of plantillas) {
    let update = false
    let newAsunto = p.asunto
    let newCuerpo = p.cuerpo

    if (p.asunto.includes('Retorno de productos') || p.asunto.includes('Retorno de Productos')) {
      newAsunto = p.asunto.replace(/Retorno de [pP]roductos/g, 'Retirada de productos')
      update = true
    }
    if (p.cuerpo.includes('Retorno de productos') || p.cuerpo.includes('Retorno de Productos')) {
      newCuerpo = p.cuerpo.replace(/Retorno de [pP]roductos/g, 'Retirada de productos')
      update = true
    }

    if (update) {
      await prisma.plantillaCorreo.update({
        where: { id: p.id },
        data: { asunto: newAsunto, cuerpo: newCuerpo }
      })
      console.log(`Updated PlantillaCorreo for screen: ${p.codigoPantalla}`)
    }
  }

  console.log('Database update completed.')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
