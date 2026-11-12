import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { ensureMultasEETables } from '@/lib/multas-ee-db-init';
import { logAuditAction } from '@/lib/audit';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || '';
        const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin';
        const hasPermission = session.user.role?.permissions?.includes('view_elementos_esenciales');
        if (!isAdmin && !hasPermission) {
            return NextResponse.json({ error: 'Acceso denegado: Permisos insuficientes' }, { status: 403 });
        }

        // Consultar RBDs asignados al usuario si no es admin
        let userAssignedRbds: number[] | null = null;
        if (!isAdmin && session.user.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { rbds: true }
            });
            const directRbds = (dbUser?.rbds || session.user.rbds || [])
                .map(Number)
                .filter((n: number) => !isNaN(n) && n >= 0);

            if (directRbds.length > 0) {
                userAssignedRbds = Array.from(new Set(directRbds));
            }
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const rbdParam = searchParams.get('rbd') || '';
        const folioParam = searchParams.get('folio') || '';
        const mes = searchParams.get('mes') || '';
        const ano = searchParams.get('ano') || '';
        const licitacion = searchParams.get('licitacion') || '';

        // Construir el filtro where
        const where: any = {};

        // Filtro por RBDs del perfil del usuario (únicamente si tiene RBDs asignados explícitamente)
        if (userAssignedRbds && userAssignedRbds.length > 0) {
            if (rbdParam) {
                const targetRbd = Number(rbdParam);
                if (!userAssignedRbds.includes(targetRbd)) {
                    return NextResponse.json([]); // RBD fuera de su perfil asignado
                }
                where.rbd = targetRbd;
            } else {
                where.rbd = { in: userAssignedRbds };
            }
        } else if (rbdParam) {
            where.rbd = Number(rbdParam);
        }

        if (folioParam) {
            where.folio = { contains: folioParam, mode: 'insensitive' };
        }

        // Búsqueda inteligente
        if (search) {
            const isNumber = !isNaN(Number(search));
            where.OR = [
                { nombreArchivo: { contains: search, mode: 'insensitive' } },
            ];
            
            if (isNumber) {
                where.OR.push({ rbd: Number(search) });
            }

            const colegios = await prisma.colegios.findMany({
                where: { nombreEstablecimiento: { contains: search, mode: 'insensitive' } },
                select: { colRBD: true }
            });
            
            if (colegios.length > 0) {
                const rbds = colegios.map(c => c.colRBD);
                where.OR.push({ rbd: { in: rbds } });
            }
        }

        if (licitacion) {
            where.licitacion = { contains: licitacion, mode: 'insensitive' };
        }

        if (ano) {
            const startYear = new Date(`${ano}-01-01T00:00:00Z`);
            const endYear = new Date(`${ano}-12-31T23:59:59Z`);
            
            if (!where.fechaSupervision) where.fechaSupervision = {};
            where.fechaSupervision.gte = startYear;
            where.fechaSupervision.lte = endYear;
        }

        if (mes && ano) {
             const startMonth = new Date(`${ano}-${mes.padStart(2, '0')}-01T00:00:00Z`);
             const endMonth = new Date(Number(ano), Number(mes), 0, 23, 59, 59);
             where.fechaSupervision.gte = startMonth;
             where.fechaSupervision.lte = endMonth;
        }

        const registros = await prisma.elementosEsenciales_Cab.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                detalles: true
            }
        });

        // Adjuntar nombre de establecimiento
        const rbds = [...new Set(registros.map(r => r.rbd).filter(Boolean))] as number[];
        const colegios = await prisma.colegios.findMany({
            where: { colRBD: { in: rbds } },
            select: { colRBD: true, nombreEstablecimiento: true }
        });
        const colegioMap = new Map(colegios.map(c => [c.colRBD, c.nombreEstablecimiento]));

        const registrosConNombre = registros.map(r => ({
            ...r,
            nombreEstablecimiento: r.rbd ? colegioMap.get(r.rbd) || 'Desconocido' : 'Sin RBD'
        }));

        return NextResponse.json(registrosConNombre);
    } catch (error: any) {
        console.error('Error fetching Elementos Esenciales:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || '';
        const isAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'super admin';
        
        await ensureMultasEETables();

        let canDeleteBulk = isAdmin;
        if (!isAdmin && session.user.id) {
            const priv = await prisma.multas_Privilegio_EE.findUnique({
                where: { userId: session.user.id }
            });
            if (priv?.puedeEliminarMasivo) {
                canDeleteBulk = true;
            }
        }

        if (!canDeleteBulk) {
            return NextResponse.json(
                { error: 'Acceso denegado: No posee privilegios para eliminación masiva en Carga de Elementos Esenciales' },
                { status: 403 }
            );
        }

        const { ids } = await request.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No se proporcionaron IDs' }, { status: 400 });
        }

        const actas = await prisma.elementosEsenciales_Cab.findMany({
            where: { id: { in: ids } },
            select: { id: true, folio: true, link: true, rbd: true }
        });

        let userAssignedRbds: number[] | null = null;
        if (!isAdmin && session.user.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { rbds: true }
            });
            const directRbds = (dbUser?.rbds || session.user.rbds || [])
                .map(Number)
                .filter((n: number) => !isNaN(n) && n >= 0);

            if (directRbds.length > 0) {
                userAssignedRbds = Array.from(new Set(directRbds));
            }
        }

        // Validar que las actas correspondan a los RBDs permitidos del usuario si tiene asignación estricta
        if (userAssignedRbds && userAssignedRbds.length > 0) {
            const actasNoAutorizadas = actas.filter(a => a.rbd && !userAssignedRbds.includes(a.rbd));
            if (actasNoAutorizadas.length > 0) {
                return NextResponse.json(
                    { error: 'No tiene autorización para eliminar actas correspondientes a RBDs fuera de su perfil asignado' },
                    { status: 403 }
                );
            }
        }

        const { unlink } = await import('fs/promises');
        const { join } = await import('path');

        const folios = actas.map(a => a.folio).filter(Boolean) as string[];

        // Eliminar multas asociadas a los folios
        if (folios.length > 0) {
            await prisma.multas_Elementos_Esenciales_Cab.deleteMany({
                where: { folioOriginal: { in: folios } }
            });
        }

        // Eliminar de la DB (Cascade borrará los detalles de ElementosEsenciales_Det)
        await prisma.elementosEsenciales_Cab.deleteMany({
            where: { id: { in: ids } }
        });

        // Eliminar archivos físicos
        for (const acta of actas) {
            if (acta.link) {
                try {
                    const filePath = join(process.cwd(), 'public', acta.link);
                    await unlink(filePath);
                } catch (err) {
                    console.warn(`No se pudo eliminar archivo: ${acta.link}`, err);
                }
            }
        }

        // Registro de Auditoría
        await logAuditAction({
            username: session.user.username || session.user.name || 'Usuario',
            userId: session.user.id,
            action: 'ELIMINACION_MASIVA_EE',
            modulo: 'Elementos Esenciales',
            detalle: `Eliminación masiva de ${actas.length} acta(s) EE. Folios: ${folios.join(', ') || 'Sin folios'}`
        });

        return NextResponse.json({ success: true, count: actas.length });
    } catch (error: any) {
        console.error('Error en bulk delete:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
