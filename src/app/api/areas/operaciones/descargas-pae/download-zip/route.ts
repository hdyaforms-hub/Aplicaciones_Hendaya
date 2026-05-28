import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import path from 'path';
import fs from 'fs';
import os from 'os';
const archiverModule = require('archiver');

// Para almacenar el estado en memoria en producción
declare global {
    var downloadJobs: Map<string, any>;
}

if (!global.downloadJobs) {
    global.downloadJobs = new Map();
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { action, jobId, payload } = body;

        if (action === 'start') {
            const { paeCookie, items, institucion, mes, ano } = payload;

            if (!paeCookie || !items || !Array.isArray(items)) {
                return NextResponse.json({ error: "Estructura de parámetros inválida" }, { status: 400 });
            }

            const newJobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const cleanDate = new Date().toISOString().slice(0, 10);
            const zipFilename = `informes_pae_${(institucion || 'GENERAL').toLowerCase()}_${mes}_${ano}_creado_${cleanDate}.zip`;
            const filePath = path.join(os.tmpdir(), `${newJobId}.zip`);

            const output = fs.createWriteStream(filePath);
            const archive = new archiverModule.ZipArchive({ zlib: { level: 5 } });

            archive.pipe(output);

            const jobState = {
                id: newJobId,
                status: 'running',
                total: items.length,
                processed: 0,
                cancelled: false,
                filename: zipFilename,
                filePath: filePath
            };

            global.downloadJobs.set(newJobId, jobState);

            // Bucle asíncrono
            (async () => {
                try {
                    for (const item of items) {
                        const currentJob = global.downloadJobs.get(newJobId);
                        if (currentJob.cancelled) {
                            break;
                        }

                        try {
                            const res = await fetch(item.urlGenerada, {
                                headers: {
                                    'Cookie': paeCookie,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });

                            if (res.ok) {
                                const arrayBuffer = await res.arrayBuffer();
                                const buffer = Buffer.from(arrayBuffer);
                                
                                const signature = buffer.slice(0, 4).toString('utf-8');
                                if (signature === '%PDF') {
                                    const cleanName = item.nombre
                                        .replace(/[^a-zA-Z0-9\s]/g, '')
                                        .replace(/\s+/g, '_')
                                        .slice(0, 50);
                                    const filename = `${item.rbd}_${cleanName}.pdf`;
                                    archive.append(buffer, { name: filename });
                                }
                            }
                        } catch (err) {
                            console.error(`Error descargando ${item.rbd}:`, err);
                        }
                        
                        currentJob.processed++;
                        await new Promise(r => setTimeout(r, 100)); // Rate limit
                    }
                } finally {
                    archive.finalize();
                }
            })();

            output.on('close', () => {
                const finalJob = global.downloadJobs.get(newJobId);
                if (finalJob) {
                    finalJob.status = finalJob.cancelled ? 'cancelled' : 'completed';
                }
            });

            return NextResponse.json({ success: true, jobId: newJobId });

        } else if (action === 'cancel') {
            const job = global.downloadJobs.get(jobId);
            if (!job) {
                return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
            }

            job.cancelled = true;
            return NextResponse.json({ success: true, message: "Cancelación solicitada" });
        }

        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });

    } catch (error: any) {
        console.error("Error en API de descarga ZIP POST:", error);
        return NextResponse.json({ error: "Ocurrió un error inesperado." }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const url = new URL(req.url);
        const action = url.searchParams.get('action');
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
        }

        const job = global.downloadJobs.get(jobId);

        if (!job) {
            return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
        }

        if (action === 'status') {
            return NextResponse.json({
                status: job.status,
                total: job.total,
                processed: job.processed
            });
        }

        if (action === 'download') {
            if (job.status !== 'completed' && job.status !== 'cancelled') {
                return NextResponse.json({ error: "El archivo aún no está listo" }, { status: 400 });
            }

            if (!fs.existsSync(job.filePath)) {
                return NextResponse.json({ error: "Archivo no encontrado en disco" }, { status: 404 });
            }

            const stat = fs.statSync(job.filePath);
            const stream = fs.createReadStream(job.filePath);
            
            // Web Stream wrapper para Next.js App Router (Node streams to Web streams)
            const { Readable } = require('stream');
            const webStream = Readable.toWeb(stream);

            return new NextResponse(webStream, {
                status: 200,
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${job.filename}"`,
                    'Content-Length': stat.size.toString(),
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                }
            });
        }

        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });

    } catch (error: any) {
        console.error("Error en API de descarga ZIP GET:", error);
        return NextResponse.json({ error: "Ocurrió un error inesperado." }, { status: 500 });
    }
}
