import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const overrideStr = formData.get('override');
        const override = overrideStr === 'true';

        const files = formData.getAll('files') as File[];
        
        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, error: 'No se recibieron archivos.' }, { status: 400 });
        }

        const results = [];

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const tempDir = os.tmpdir();
            const tempFilename = `${crypto.randomUUID()}_${file.name}`;
            const tempFilePath = path.join(tempDir, tempFilename);

            await fs.writeFile(tempFilePath, buffer);

            try {
                // Execute Python script
                const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'extractor_pae_headless.py');
                const result = await executePython(scriptPath, tempFilePath);
                
                if (result.error) {
                    results.push({ filename: file.name, success: false, error: result.error });
                    continue;
                }

                const { cabecera, detalles } = result;
                
                if (!cabecera.Folio) {
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
                            create: detalles.map((d: any) => ({
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

function executePython(scriptPath: string, args: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // Enclose paths in quotes to handle spaces
        const command = `python "${scriptPath}" "${args}"`;
        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Python execution error:', error);
                // Attempt to parse stdout for JSON error from script
                if (stdout) {
                    try {
                        const parsed = JSON.parse(stdout);
                        return resolve(parsed); // The script output a structured error
                    } catch (e) {}
                }
                return resolve({ error: 'Error al ejecutar el script de extracción.' });
            }
            
            try {
                const parsed = JSON.parse(stdout);
                resolve(parsed);
            } catch (e) {
                console.error('Failed to parse Python output:', stdout);
                resolve({ error: 'Formato de salida inválido del script de extracción.' });
            }
        });
    });
}
