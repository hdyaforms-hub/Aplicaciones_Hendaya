const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const user = await prisma.user.findUnique({
        where: { username },
        include: { role: true, sucursales: true }
    });
    
    const userSucursales = user.sucursales.map(s => s.nombre) || [];
    const isAdmin = user.role.name === 'Administrador';
    const permissions = JSON.parse(user.role.permissions || '[]');
    const canSeeAll = isAdmin || permissions.includes('manage_sucursales');

    console.log('isAdmin:', isAdmin);
    console.log('canSeeAll:', canSeeAll);
    console.log('userSucursales:', userSucursales);

    const whereClause = {};
    const filters = { sucursal: '', ano: undefined, mes: undefined };

    if (filters.sucursal) {
        if (!canSeeAll && !userSucursales.includes(filters.sucursal)) {
            whereClause.sucursal = { in: [] };
        } else {
            whereClause.sucursal = filters.sucursal;
        }
    } else {
        if (!canSeeAll || userSucursales.length > 0) {
            whereClause.sucursal = { in: userSucursales };
        }
    }

    console.log('whereClause:', JSON.stringify(whereClause));

    const totalCount = await prisma.pMPA.count({ where: whereClause });
    console.log('totalCount with whereClause:', totalCount);

    const combos = await prisma.pMPA.groupBy({
        by: ['sucursal', 'ano', 'mes'],
        where: (canSeeAll && userSucursales.length === 0) ? {} : { sucursal: { in: userSucursales } },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { sucursal: 'asc' }]
    });
    console.log('Combos count:', combos.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
