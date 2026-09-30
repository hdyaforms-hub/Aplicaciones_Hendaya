import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import fsSync from 'fs';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

// Mecanismo de auto-recuperación (self-healing) para tablas de Actas Estándar PAE en Producción
async function ensurePaeTables() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cab_LeePdfEstandarPae" (
                "id" TEXT PRIMARY KEY,
                "NombreArchivoPdf" TEXT NOT NULL,
                "Licitacion" INTEGER,
                "Folio" TEXT NOT NULL UNIQUE,
                "Res_Sanitaria_N" TEXT,
                "Nombre_Num_establecimiento" TEXT,
                "RBD" INTEGER,
                "Region" TEXT,
                "Comuna" TEXT,
                "Fecha_Supervision" TIMESTAMP(3),
                "Porcentaje_cumplimiento_final" DOUBLE PRECISION,
                "Observaciones" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Det_LeePdfEstandarPae" (
                "id" TEXT PRIMARY KEY,
                "cabeceraId" TEXT NOT NULL,
                "Infraestructura" TEXT,
                "Calificacion" TEXT,
                "Descripcion" TEXT,
                "Comprometiendo_Inocuidad" TEXT,
                "Tipo_NC" TEXT,
                "Otros_Comentarios" TEXT,
                CONSTRAINT "Det_LeePdfEstandarPae_cabeceraId_fkey" FOREIGN KEY ("cabeceraId") REFERENCES "Cab_LeePdfEstandarPae"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Det_LeePdfEstandarPae_cabeceraId_idx" ON "Det_LeePdfEstandarPae"("cabeceraId");
        `);
    } catch (err) {
        console.warn('Advertencia en ensurePaeTables (continuando ejecución):', err);
    }
}

function getPythonBinCandidates(): string[] {
    const list: string[] = [];
    if (process.env.PYTHON_BIN) list.push(process.env.PYTHON_BIN);

    if (process.platform === 'win32') {
        list.push('python', 'py', 'python3');
    } else {
        // En Linux / Nixpacks / Railway / Docker
        list.push(
            'python3',
            'python',
            '/root/.nix-profile/bin/python3',
            '/root/.nix-profile/bin/python',
            '/nix/var/nix/profiles/default/bin/python3',
            '/nix/var/nix/profiles/default/bin/python',
            '/usr/bin/python3',
            '/usr/bin/python',
            '/usr/local/bin/python3',
            '/usr/local/bin/python'
        );
    }

    return Array.from(new Set(list));
}

async function executePython(scriptPath: string, filePath: string): Promise<any> {
    const candidates = getPythonBinCandidates();
    let lastError: any = null;
    let lastStderr = '';

    const nixBinPath = '/root/.nix-profile/bin:/nix/var/nix/profiles/default/bin:/usr/local/bin:/usr/bin:/bin';
    const currentPath = process.env.PATH || '';
    const enhancedPath = `${nixBinPath}:${currentPath}`;

    for (const bin of candidates) {
        try {
            const { stdout, stderr } = await execFileAsync(bin, [scriptPath, filePath], {
                maxBuffer: 1024 * 1024 * 15,
                env: {
                    ...process.env,
                    PATH: enhancedPath
                }
            });

            if (stderr) {
                lastStderr = stderr;
            }

            if (stdout) {
                try {
                    const parsed = JSON.parse(stdout);
                    return parsed;
                } catch (parseErr) {
                    console.error(`Error parseando JSON de Python (${bin}):`, stdout);
                }
            }
        } catch (err: any) {
            lastError = err;

            // Si el script devolvió un JSON en stdout antes de fallar
            if (err.stdout) {
                try {
                    const parsed = JSON.parse(err.stdout);
                    return parsed;
                } catch (e) {}
            }

            if (err.stderr) {
                lastStderr = err.stderr;
            }

            // Si el binario no existe (ENOENT o 127), intentar el siguiente candidato
            const isNotFound = err.code === 'ENOENT' || err.code === 127 ||
                (typeof err.message === 'string' && (err.message.includes('not found') || err.message.includes('ENOENT')));

            if (isNotFound) {
                continue;
            }

            // Si el binario sí existía y el script falló por error de ejecución, no seguir probando binarios
            break;
        }
    }

    const detail = lastStderr?.trim() || lastError?.message || 'No se pudo inicializar el entorno de Python.';
    console.error('Fallo en la ejecución de Python para extracción:', detail);
    return { error: `Error en extracción: ${detail}` };
}

export async function POST(req: NextRequest) {
    try {
        await ensurePaeTables();

        const formData = await req.formData();
        const overrideStr = formData.get('override');
        const override = overrideStr === 'true';

        const files = formData.getAll('files') as File[];
        
        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, error: 'No se recibieron archivos.' }, { status: 400 });
        }

        const results = [];

        // Resolver ruta del script de extracción (src/scripts o python_scripts)
        let scriptPath = path.join(process.cwd(), 'src', 'scripts', 'extractor_pae_headless.py');
        if (!fsSync.existsSync(scriptPath)) {
            const altPath = path.join(process.cwd(), 'python_scripts', 'extractor_pae_headless.py');
            if (fsSync.existsSync(altPath)) {
                scriptPath = altPath;
            }
        }

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const tempDir = os.tmpdir();
            const tempFilename = `${crypto.randomUUID()}_${file.name}`;
            const tempFilePath = path.join(tempDir, tempFilename);

            await fs.writeFile(tempFilePath, buffer);

            try {
                // Execute Python script
                const result = await executePython(scriptPath, tempFilePath);
                
                if (result.error) {
                    results.push({ filename: file.name, success: false, error: result.error });
                    continue;
                }

                const { cabecera, detalles } = result;
                
                if (!cabecera?.Folio) {
                    results.push({ filename: file.name, success: false, error: 'No se pudo extraer el Folio del documento.' });
                    continue;
                }

                // Check for duplicate folio
                const existing = await prisma.cab_LeePdfEstandarPae.findUnique({
                    where: { Folio: cabecera.Folio }
                });

                if (existing && !override) {
                    results.push({ filename: file.name, success: false, error: 'DUPLICATE_FOLIO', folio: cabecera.Folio });
                    continue;
                }

                // Format data
                const fechaDate = cabecera.Fecha_Supervision ? new Date(cabecera.Fecha_Supervision) : null;
                const licitacionInt = cabecera.Licitacion ? parseInt(cabecera.Licitacion) : null;
                const rbdInt = cabecera.RBD ? parseInt(cabecera.RBD) : null;

                // Delete existing if overriding
                if (existing && override) {
                    await prisma.cab_LeePdfEstandarPae.delete({
                        where: { Folio: cabecera.Folio }
                    });
                }

                // Create record
                await prisma.cab_LeePdfEstandarPae.create({
                    data: {
                        NombreArchivoPdf: file.name,
                        Folio: cabecera.Folio,
                        Licitacion: licitacionInt,
                        Res_Sanitaria_N: cabecera.Res_Sanitaria_N,
                        Nombre_Num_establecimiento: cabecera.Nombre_Num_establecimiento,
                        RBD: rbdInt,
                        Region: cabecera.Region,
                        Comuna: cabecera.Comuna,
                        Fecha_Supervision: fechaDate,
                        Porcentaje_cumplimiento_final: cabecera.Porcentaje_cumplimiento_final,
                        Observaciones: cabecera.Observaciones,
                        detalles: {
                            create: (detalles || []).map((d: any) => ({
                                Infraestructura: d.Infraestructura,
                                Calificacion: d.Calificacion,
                                Descripcion: d.Descripcion,
                                Comprometiendo_Inocuidad: d.Comprometiendo_Inocuidad,
                                Tipo_NC: d.Tipo_NC,
                                Otros_Comentarios: d.Otros_Comentarios
                            }))
                        }
                    }
                });

                results.push({ filename: file.name, success: true, folio: cabecera.Folio });
            } catch (e: any) {
                console.error(`Error processing file ${file.name}:`, e);
                results.push({ filename: file.name, success: false, error: 'Error interno al procesar el archivo.' });
            } finally {
                // Cleanup temp file
                await fs.unlink(tempFilePath).catch(() => {});
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('Error in upload route:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
