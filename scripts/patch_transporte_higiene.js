const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Iniciando actualización de permisos para Calidad: Transporte e Higiene ---')
    
    // Buscar todos los roles de Administrador
    const adminRoles = await prisma.role.findMany({
        where: {
            OR: [
                { name: 'Administrador' },
                { name: 'admin' },
                { name: { contains: 'Admin', mode: 'insensitive' } }
            ]
        }
    })

    const newPermissions = [
        'view_calidad_transporte_higiene',
        'manage_calidad_transporte_higiene',
        'sign_calidad_transporte_higiene',
        'sign_bodega_transporte_higiene'
    ]

    for (const role of adminRoles) {
        let currentPerms = []
        try {
            currentPerms = JSON.parse(role.permissions || '[]')
        } catch (e) {
            currentPerms = []
        }

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
            console.log(`✓ Rol "${role.name}" actualizado con permisos de Transporte e Higiene.`)
        } else {
            console.log(`• Rol "${role.name}" ya contaba con los permisos.`)
        }
    }

    // Asegurar plantilla de correo por defecto para la pantalla si no existe
    const existingPlantilla = await prisma.plantillaCorreo.findUnique({
        where: { codigoPantalla: 'calidad-transporte-higiene' }
    })

    if (!existingPlantilla) {
        await prisma.plantillaCorreo.create({
            data: {
                codigoPantalla: 'calidad-transporte-higiene',
                asunto: 'Cierre Registro Transporte e Higiene - <Sucursal> (<Fecha>)',
                cuerpo: `Estimado Jefe de Bodega,<br/><br/>Se informa que el usuario <b><UsuarioCalidad></b> ha firmado y cerrado el registro de higiene y estado de transporte correspondiente al día <b><Fecha></b> en la sucursal <b><Sucursal></b>.<br/><br/><b>Total de vehículos inspeccionados:</b> <TotalVehiculos><br/><b>Detalle / Desviaciones:</b><br/><Desviaciones><br/><br/>Por favor ingrese al módulo de Calidad para validar y efectuar su firma de conformidad.<br/><br/>Saludos cordiales,<br/><b>Área de Calidad - Hendaya</b>`
            }
        })
        console.log('✓ Plantilla de correo predeterminada creada para "calidad-transporte-higiene".')
    } else {
        console.log('• Plantilla de correo para "calidad-transporte-higiene" ya existe.')
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
