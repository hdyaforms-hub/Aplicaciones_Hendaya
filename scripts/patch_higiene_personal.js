const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Iniciando actualización de permisos y plantilla para Higiene Personal ---')
    
    // Buscar todos los roles de Administrador o que tengan permisos de Calidad
    const roles = await prisma.role.findMany()

    const newPermissions = [
        'view_calidad_higiene_personal',
        'manage_calidad_higiene_personal',
        'sign_calidad_higiene_personal',
        'sign_bodega_higiene_personal'
    ]

    for (const role of roles) {
        let currentPerms = []
        try {
            currentPerms = JSON.parse(role.permissions || '[]')
        } catch (e) {
            currentPerms = []
        }

        const isAdm = role.name.toLowerCase().includes('admin')
        const hasTransporte = currentPerms.includes('view_calidad_transporte_higiene')

        // Asignar a Administradores y a roles que ya gestionan transporte-higiene
        if (isAdm || hasTransporte) {
            const permsSet = new Set(currentPerms)
            let modified = false

            for (const p of newPermissions) {
                if (!permsSet.has(p)) {
                    permsSet.add(p)
                    modified = true
                }
            }

            if (modified) {
                const updatedPerms = Array.from(permsSet)
                await prisma.role.update({
                    where: { id: role.id },
                    data: { permissions: JSON.stringify(updatedPerms) }
                })
                console.log(`✓ Rol "${role.name}" actualizado con permisos de Higiene Personal.`)
            } else {
                console.log(`• Rol "${role.name}" ya contaba con los permisos.`)
            }
        }
    }

    // Asegurar plantilla de correo por defecto para 'calidad-higiene-personal'
    const existingPlantilla = await prisma.plantillaCorreo.findUnique({
        where: { codigoPantalla: 'calidad-higiene-personal' }
    })

    if (!existingPlantilla) {
        await prisma.plantillaCorreo.create({
            data: {
                codigoPantalla: 'calidad-higiene-personal',
                asunto: 'Cierre Registro Higiene Personal Transportista - <Sucursal> (<Fecha>)',
                cuerpo: `Estimado Jefe de Bodega,<br/><br/>Se informa que el usuario <b><UsuarioCalidad></b> ha firmado y cerrado el registro de higiene personal y presentación de transportistas correspondiente al día <b><Fecha></b> en la sucursal <b><Sucursal></b>.<br/><br/><b>Total de trabajadores evaluados:</b> <TotalTrabajadores><br/><b>Detalle / Desviaciones:</b><br/><Desviaciones><br/><br/>Por favor ingrese al módulo de Calidad para validar y efectuar su firma de conformidad.<br/><br/>Saludos cordiales,<br/><b>Área de Calidad - Hendaya</b>`
            }
        })
        console.log('✓ Plantilla de correo predeterminada creada para "calidad-higiene-personal".')
    } else {
        console.log('• Plantilla de correo para "calidad-higiene-personal" ya existe.')
    }

    console.log('--- Proceso finalizado exitosamente ---')
}

main()
    .catch((err) => {
        console.error('Error aplicando permisos y configuración:', err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
