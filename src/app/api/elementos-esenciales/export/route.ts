import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const mes = searchParams.get('mes') || '';
        const ano = searchParams.get('ano') || '';
        const licitacion = searchParams.get('licitacion') || '';

        const where: any = {};

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

        // Crear array para excel
        const data: any[] = [];

        for (const cab of registros) {
            let fechaStr = cab.fechaSupervision ? new Intl.DateTimeFormat('es-CL', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date(cab.fechaSupervision)) : '';

            if (cab.detalles.length === 0) {
                data.push({
                    "Licitación": cab.licitacion || "",
                    "Folio": cab.folio || "",
                    "Fecha_Supervisión": fechaStr,
                    "RBD": cab.rbd || "",
                    "Región": cab.region || "",
                    "Comuna": cab.comuna || "",
                    "Servicio": cab.servicio || "",
                    "Hora_Inicio": cab.horaInicio || "",
                    "Hora": cab.hora || "",
                    "Obs_A_los_incumplimiento": cab.obsALosIncumplimiento || "",
                    "Nombre_Archivo": cab.nombreArchivo || "",
                    "Aspecto": "",
                    "Observaciones_o_medio_de_verificación": "",
                    "CO": "",
                    "NC": "",
                    "NA": ""
                });
            } else {
                for (const det of cab.detalles) {
                    data.push({
                        "Licitación": cab.licitacion || "",
                        "Folio": cab.folio || "",
                        "Fecha_Supervisión": fechaStr,
                        "RBD": cab.rbd || "",
                        "Región": cab.region || "",
                        "Comuna": cab.comuna || "",
                        "Servicio": cab.servicio || "",
                        "Hora_Inicio": cab.horaInicio || "",
                        "Hora": cab.hora || "",
                        "Obs_A_los_incumplimiento": cab.obsALosIncumplimiento || "",
                        "Nombre_Archivo": cab.nombreArchivo || "",
                        "Aspecto": det.aspecto || "",
                        "Observaciones_o_medio_de_verificación": det.observacionesOMedioDeVerificacion || "",
                        "CO": det.co || "",
                        "NC": det.nc || "",
                        "NA": det.na || ""
                    });
                }
            }
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Elementos Esenciales");

        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(excelBuffer, {
            headers: {
                'Content-Disposition': 'attachment; filename="elementos_esenciales.xlsx"',
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });
    } catch (error: any) {
        console.error('Error exporting Elementos Esenciales:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
