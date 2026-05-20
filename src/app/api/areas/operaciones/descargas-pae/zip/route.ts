import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AdmZip from 'adm-zip'

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { ano, mes, institucion, paeCookie, items } = body;

        if (!paeCookie) {
            return NextResponse.json({ error: "Es obligatorio ingresar la cookie de sesión del portal Junaeb." }, { status: 400 });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No se proporcionaron colegios para descargar." }, { status: 400 });
        }

        const zip = new AdmZip();
        let downloadedCount = 0;
        const auditLogs: any[] = [];

        // Descarga secuencial en backend
        for (const item of items) {
            try {
                // Hacer petición a Junaeb usando la cookie provista
                const res = await fetch(item.urlGenerada, {
                    headers: {
                        'Cookie': paeCookie,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (res.status === 200) {
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Verificar firma del PDF para asegurarse que no sea un HTML de login/error
                    const signature = buffer.slice(0, 4).toString('utf-8');
                    if (signature === '%PDF') {
                        // Limpiar caracteres extraños en el nombre de archivo
                        const cleanName = item.nombre
                            .replace(/[^a-zA-Z0-9\s]/g, '')
                            .replace(/\s+/g, '_')
                            .slice(0, 50);
                        
                        const filename = `${item.rbd}_${cleanName}.pdf`;
                        zip.addFile(filename, buffer);
                        downloadedCount++;

                        // Preparar registro para la BD de auditoría
                        auditLogs.push({
                            ano: Number(ano),
                            mes: Number(mes),
                            institucion: String(institucion).toUpperCase(),
                            rbd: Number(item.rbd),
                            urlGenerada: String(item.urlGenerada),
                            usuario: session.user?.username || 'Sistema'
                        });
                    }
                }
            } catch (err) {
                console.error(`Error descargando RBD ${item.rbd}:`, err);
            }
        }

        if (downloadedCount === 0) {
            return NextResponse.json({ 
                error: "No se descargó ningún PDF. Por favor, asegúrate de haber copiado la cookie correctamente y que tu sesión en el portal Junaeb esté activa." 
            }, { status: 400 });
        }

        // Guardar logs de auditoría en Base de Datos de una sola vez
        try {
            await prisma.descargaPaeLog.createMany({
                data: auditLogs
            });
        } catch (dbErr) {
            console.error("Error guardando auditoría de descargas:", dbErr);
        }

        // Generar archivo ZIP en buffer
        const zipBuffer = zip.toBuffer();

        // Retornar archivo ZIP binario
        const cleanDate = new Date().toISOString().slice(0, 10);
        const zipFilename = `informes_pae_${institucion.toLowerCase()}_${mes}_${ano}_creado_${cleanDate}.zip`;

        return new NextResponse(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipFilename}"`,
                'Content-Length': zipBuffer.length.toString()
            }
        });

    } catch (error: any) {
        console.error("Error en API de descargas ZIP:", error);
        return NextResponse.json({ error: "Ocurrió un error inesperado al procesar la descarga masiva." }, { status: 500 });
    }
}
