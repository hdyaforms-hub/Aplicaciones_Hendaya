import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const isAdmin = session.user?.role?.name === 'Administrador';
        const hasPermission = session.user?.role?.permissions?.includes('view_operaciones_descargas_pae');
        if (!isAdmin && !hasPermission) {
            return NextResponse.json({ error: 'Acceso denegado: Permisos insuficientes' }, { status: 403 });
        }

        const body = await req.json();
        const { urlGenerada, paeCookie, ano, mes, institucion, rbd, nombre } = body;

        if (!urlGenerada || !paeCookie) {
            return NextResponse.json({ error: "Parámetros insuficientes" }, { status: 400 });
        }

        // Fetch de un único PDF con la cookie provista
        // AbortController con timeout de 30s para evitar que el proceso quede colgado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        let res: Response;
        try {
            res = await fetch(urlGenerada, {
                signal: controller.signal,
                headers: {
                    'Cookie': paeCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
        } catch (fetchErr: any) {
            if (fetchErr?.name === 'AbortError') {
                return NextResponse.json({ error: 'Tiempo de espera agotado: el servidor de Junaeb no respondió en 30 segundos.' }, { status: 504 });
            }
            throw fetchErr;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!res.ok) {
            return NextResponse.json({ error: `Error en servidor Junaeb (status ${res.status})` }, { status: res.status });
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Verificar firma de PDF para confirmar descarga correcta
        const signature = buffer.slice(0, 4).toString('utf-8');
        if (signature !== '%PDF') {
            return NextResponse.json({ error: "El servidor de Junaeb no devolvió un PDF. Su sesión puede haber expirado." }, { status: 400 });
        }

        // Registrar en la BD de auditoría de descargas
        try {
            await prisma.descargaPaeLog.create({
                data: {
                    ano: Number(ano),
                    mes: Number(mes),
                    institucion: String(institucion).toUpperCase(),
                    rbd: Number(rbd),
                    urlGenerada: String(urlGenerada),
                    usuario: session.user?.username || 'Sistema'
                }
            });
        } catch (dbErr) {
            console.error("Error guardando auditoría de descargas en BD:", dbErr);
        }

        // Retornar archivo PDF binario al cliente
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Length': buffer.length.toString()
            }
        });

    } catch (error: any) {
        console.error("Error en API de descarga individual:", error);
        return NextResponse.json({ error: "Ocurrió un error inesperado al descargar el informe." }, { status: 500 });
    }
}
