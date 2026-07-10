import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const isAdmin = session.user.role?.name === 'Administrador';
        const hasPermission = session.user.role?.permissions?.includes('view_elementos_esenciales');
        if (!isAdmin && !hasPermission) {
            return NextResponse.json({ error: 'Acceso denegado: Permisos insuficientes' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ error: 'No se encontró archivo' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Directorio de subida
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'elementos-esenciales');
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Ignorar si existe
        }

        const uniqueFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = join(uploadDir, uniqueFilename);
        
        await writeFile(filePath, buffer);

        // Llamar al script de python
        const pythonScript = join(process.cwd(), 'python_scripts', 'extract_elementos.py');
        // Ejecutable de python configurable: 'python' en Windows local, 'python3' en Railway (via PYTHON_BIN)
        const pythonExecutable = process.env.PYTHON_BIN || 'python';
        
        const { stdout, stderr } = await execFileAsync(pythonExecutable, [pythonScript, filePath], { maxBuffer: 1024 * 1024 * 10 });
        
        if (stderr) {
            console.warn('Python stderr:', stderr);
        }

        let result;
        try {
            result = JSON.parse(stdout);
        } catch(e) {
            console.error("No se pudo parsear el JSON de Python:", stdout);
            return NextResponse.json({ error: 'Error interno procesando el PDF' }, { status: 500 });
        }
        
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const cabecera = result.cabecera;
        const detalles = result.detalles;
        const folio = cabecera["Folio"];

        // Validación de duplicados por Folio
        if (folio) {
            const existing = await prisma.elementosEsenciales_Cab.findFirst({
                where: { folio: folio }
            });
            if (existing) {
                return NextResponse.json({ 
                    error: `El documento ya existe: El acta con folio "${folio}" ya fue cargada el ${existing.createdAt.toLocaleDateString()}.` 
                }, { status: 400 });
            }
        }

        // Parse date "DD / MM / YYYY"
        let fechaSupervisionDate = null;
        if (cabecera["Fecha Supervisión"]) {
            const parts = cabecera["Fecha Supervisión"].split('/');
            if (parts.length === 3) {
                const day = parts[0].trim().padStart(2, '0');
                const month = parts[1].trim().padStart(2, '0');
                const year = parts[2].trim();
                fechaSupervisionDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
            }
        }

        // Buscar licId si es necesario y existe en DB
        let licId = null;
        if (cabecera["Licitación"]) {
            // Intentamos parsear número, o buscamos
            const maybeLicId = parseInt(cabecera["Licitación"].replace(/\D/g, ''), 10);
            if (!isNaN(maybeLicId)) {
                licId = maybeLicId;
            }
        }
        
        const savedCab = await prisma.elementosEsenciales_Cab.create({
            data: {
                licitacion: cabecera["Licitación"],
                licId: licId,
                folio: cabecera["Folio"],
                fechaSupervision: fechaSupervisionDate,
                rbd: cabecera["RBD"],
                region: cabecera["Región"],
                comuna: cabecera["Comuna"],
                servicio: cabecera["Servicio"],
                horaInicio: cabecera["Hora Inicio"],
                hora: cabecera["Hora"],
                obsALosIncumplimiento: cabecera["OBSERVACIONES A LOS INCUMPLIMIENTOS"],
                nombreArchivo: file.name,
                link: `/uploads/elementos-esenciales/${uniqueFilename}`,
                detalles: {
                    create: detalles.map((d: any) => ({
                        aspecto: d["Aspecto"],
                        observacionesOMedioDeVerificacion: d["Observaciones o Medio de verificación"],
                        co: d["CO"],
                        nc: d["NC"],
                        na: d["NA"]
                    }))
                }
            }
        });

        return NextResponse.json({ success: true, id: savedCab.id });
    } catch (error: any) {
        console.error('Error uploading/processing PDF:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
