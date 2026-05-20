import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { pathToFileURL } from 'url';

// Configurar workerSrc con una URL absoluta de archivo local para evitar errores de carga en Next.js
const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let lastY = -1;
        let pageText = '';
        for (const item of textContent.items as any[]) {
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 3) {
                pageText += '\n';
            }
            pageText += item.str + ' ';
            lastY = item.transform[5];
        }
        fullText += pageText + '\n';
    }
    
    return fullText;
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        
        const procesados = [];
        const errores = [];
        const foliosEncontrados: string[] = [];

        // Diccionario de meses
        const mesesMap: { [key: string]: number } = {
            'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
            'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
            'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
        };

        for (const entry of zipEntries) {
            if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.pdf')) {
                try {
                    const pdfBuffer = entry.getData();
                    const text = await extractTextFromBuffer(pdfBuffer);

                    // Extracción Cabecera
                    const instMatch = text.match(/Formulario\s+(JUNAEB|JUNJI)/i);
                    const periodoMatch = text.match(/Período Informado\s+([A-Za-z]+)\s+(\d{4})/i);
                    const folioMatch = text.match(/Folio:\s*(\d+)/i);
                    const estMatch = text.match(/Establecimiento:\s*([^\n]+)/i);
                    const comMatch = text.match(/Comuna:\s*([^\n]+)/i);
                    const rbdMatch = text.match(/RBD:\s*(\d+)/i);
                    const estratoMatch = text.match(/Estrato:\s*(\d+)/i);
                    const progMatch = text.match(/Programa:\s*([\w\-]+)/i);
                    const licMatch = text.match(/Licitación:\s*(\d+)/i);
                    const certMatch = text.match(/Certificación Diaria de Raciones\s+([^\n]+)/i);

                    if (!folioMatch || !instMatch || !periodoMatch || !rbdMatch) {
                        errores.push(`El archivo ${entry.entryName} no tiene el formato esperado.`);
                        continue;
                    }

                    const institucion = instMatch[1].toUpperCase();
                    const mesNombre = periodoMatch[1].toUpperCase();
                    const mes = mesesMap[mesNombre] || 0;
                    const ano = parseInt(periodoMatch[2]);
                    const folio = folioMatch[1].trim();
                    const rbd = parseInt(rbdMatch[1]);
                    
                    const rawEst = estMatch ? estMatch[1].trim() : '';
                    const establecimiento = rawEst
                        .replace(/Concesionario:\s*HENDAYA/gi, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    const rawComuna = comMatch ? comMatch[1].trim() : '';
                    const comuna = rawComuna
                        .replace(/RBD:\s*\d+/gi, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    const estrato = estratoMatch ? estratoMatch[1].trim() : '';
                    const programa = progMatch ? progMatch[1].trim() : '';
                    const licitacion = licMatch ? licMatch[1].trim() : '';
                    const certificacion = certMatch ? certMatch[1].trim() : '';

                    // Extracción Detalle
                    const detalles = [];
                    // Buscar la línea donde comienzan los números (después de 'Total Raciones')
                    const lines = text.split('\n');
                    let inTable = false;

                    for (let line of lines) {
                        line = line.trim();
                        if (line.includes('Total Raciones')) {
                            inTable = true;
                            continue;
                        }
                        if (line.startsWith('Total ') || line === 'Total') {
                            inTable = false;
                            break;
                        }
                        
                        if (inTable && line.length > 0) {
                            // Validar que la línea comienza con un número de día (1 al 31)
                            const tokens = line.split(/\s+/);
                            if (tokens.length >= 7) {
                                const dia = parseInt(tokens[0]);
                                if (!isNaN(dia) && dia >= 1 && dia <= 31) {
                                    detalles.push({
                                        dia: dia,
                                        serCompletas: parseFloat(tokens[1].replace(',', '.')) || 0,
                                        serIncompletas: parseFloat(tokens[2].replace(',', '.')) || 0,
                                        codProducto: tokens[3],
                                        noServido: parseFloat(tokens[4].replace(',', '.')) || 0,
                                        codCausa: tokens[5],
                                        totalRaciones: parseFloat(tokens[6].replace(',', '.')) || 0
                                    });
                                }
                            }
                        }
                    }

                    procesados.push({
                        fileName: entry.entryName,
                        institucion,
                        mes,
                        ano,
                        folio,
                        establecimiento,
                        comuna,
                        rbd,
                        estrato,
                        programa,
                        licitacion,
                        certificacion,
                        detalles
                    });

                    foliosEncontrados.push(folio);

                } catch (pdfErr: any) {
                    console.error(`[Upload API] Error leyendo PDF ${entry.entryName}:`, pdfErr);
                    errores.push(`No se pudo leer the PDF ${entry.entryName}: ${pdfErr.message}`);
                }
            }
        }

        // Consultar cuáles folios ya existen en la base de datos
        const registrosExistentes = await prisma.paeOnlineCab.findMany({
            where: { folio: { in: foliosEncontrados } },
            select: { folio: true }
        });

        const foliosExistentesSet = new Set(registrosExistentes.map(r => r.folio));

        const listosParaGuardar = [];
        const conConflictos = [];

        for (const p of procesados) {
            if (foliosExistentesSet.has(p.folio)) {
                conConflictos.push(p);
            } else {
                listosParaGuardar.push(p);
            }
        }

        console.log(`[Upload API] Procesados: ${procesados.length}, Conflictos: ${conConflictos.length}, Listos: ${listosParaGuardar.length}`);
        if (errores.length > 0) {
            console.log(`[Upload API] Primeros 5 errores de parseo:`, errores.slice(0, 5));
        }

        return NextResponse.json({
            success: true,
            totalArchivosLeidos: procesados.length,
            errores,
            listosParaGuardar,
            conConflictos
        });

    } catch (error: any) {
        console.error("Error procesando ZIP PAE:", error);
        return NextResponse.json({ error: 'Ocurrió un error inesperado al procesar el archivo ZIP.' }, { status: 500 });
    }
}
