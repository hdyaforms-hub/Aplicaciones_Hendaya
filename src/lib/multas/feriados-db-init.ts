import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Tabla y catálogo persistido de feriados oficiales de Chile para el sistema de Multas.
 * Permite que los plazos administrativos legales dependan de una tabla auditable y editable en base de datos.
 */
export async function ensureFeriadosTables() {
    if (initialized) return
    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Feriado" (
                id TEXT PRIMARY KEY,
                fecha TEXT NOT NULL UNIQUE, -- Formato 'YYYY-MM-DD'
                descripcion TEXT NOT NULL,
                anio INTEGER NOT NULL,
                tipo TEXT NOT NULL DEFAULT 'LEGAL', -- 'LEGAL', 'IRREGULAR', 'ELECCION', 'REGIONAL'
                activo BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_feriado_anio_idx" ON "Multas_Feriado"(anio);
            CREATE INDEX IF NOT EXISTS "multas_feriado_activo_idx" ON "Multas_Feriado"(activo);
        `)

        // Precarga oficial de feriados de Chile (2024, 2025, 2026, 2027) según leyes 2.977, 19.668, 20.215, 20.983, 21.357
        const feriadosBase: { fecha: string; descripcion: string; anio: number; tipo?: string }[] = [
            // 2024
            { fecha: '2024-01-01', descripcion: 'Año Nuevo', anio: 2024 },
            { fecha: '2024-03-29', descripcion: 'Viernes Santo', anio: 2024 },
            { fecha: '2024-03-30', descripcion: 'Sábado Santo', anio: 2024 },
            { fecha: '2024-05-01', descripcion: 'Día Nacional del Trabajo', anio: 2024 },
            { fecha: '2024-05-21', descripcion: 'Día de las Glorias Navales', anio: 2024 },
            { fecha: '2024-06-20', descripcion: 'Día Nacional de los Pueblos Indígenas', anio: 2024 },
            { fecha: '2024-06-29', descripcion: 'San Pedro y San Pablo', anio: 2024 },
            { fecha: '2024-07-16', descripcion: 'Día de la Virgen del Carmen', anio: 2024 },
            { fecha: '2024-08-15', descripcion: 'Asunción de la Virgen', anio: 2024 },
            { fecha: '2024-09-18', descripcion: 'Independencia Nacional', anio: 2024 },
            { fecha: '2024-09-19', descripcion: 'Día de las Glorias del Ejército', anio: 2024 },
            { fecha: '2024-09-20', descripcion: 'Fiestas Patrias adicional (Ley 20.215)', anio: 2024 },
            { fecha: '2024-10-12', descripcion: 'Encuentro de Dos Mundos', anio: 2024 },
            { fecha: '2024-10-27', descripcion: 'Elecciones Municipales y Regionales', anio: 2024, tipo: 'ELECCION' },
            { fecha: '2024-10-31', descripcion: 'Día de las Iglesias Evangélicas', anio: 2024 },
            { fecha: '2024-11-01', descripcion: 'Día de Todos los Santos', anio: 2024 },
            { fecha: '2024-12-08', descripcion: 'Inmaculada Concepción', anio: 2024 },
            { fecha: '2024-12-25', descripcion: 'Navidad', anio: 2024 },

            // 2025
            { fecha: '2025-01-01', descripcion: 'Año Nuevo', anio: 2025 },
            { fecha: '2025-04-18', descripcion: 'Viernes Santo', anio: 2025 },
            { fecha: '2025-04-19', descripcion: 'Sábado Santo', anio: 2025 },
            { fecha: '2025-05-01', descripcion: 'Día Nacional del Trabajo', anio: 2025 },
            { fecha: '2025-05-21', descripcion: 'Día de las Glorias Navales', anio: 2025 },
            { fecha: '2025-06-20', descripcion: 'Día Nacional de los Pueblos Indígenas (Solsticio)', anio: 2025 },
            { fecha: '2025-06-30', descripcion: 'San Pedro y San Pablo (Traslado)', anio: 2025 },
            { fecha: '2025-07-16', descripcion: 'Día de la Virgen del Carmen', anio: 2025 },
            { fecha: '2025-08-15', descripcion: 'Asunción de la Virgen', anio: 2025 },
            { fecha: '2025-09-18', descripcion: 'Independencia Nacional', anio: 2025 },
            { fecha: '2025-09-19', descripcion: 'Día de las Glorias del Ejército', anio: 2025 },
            { fecha: '2025-10-12', descripcion: 'Encuentro de Dos Mundos', anio: 2025 },
            { fecha: '2025-10-31', descripcion: 'Día de las Iglesias Evangélicas', anio: 2025 },
            { fecha: '2025-11-01', descripcion: 'Día de Todos los Santos', anio: 2025 },
            { fecha: '2025-12-08', descripcion: 'Inmaculada Concepción', anio: 2025 },
            { fecha: '2025-12-25', descripcion: 'Navidad', anio: 2025 },

            // 2026 (18 cae viernes y 19 sábado: NO hay feriado 17, se trabaja normalmente)
            { fecha: '2026-01-01', descripcion: 'Año Nuevo', anio: 2026 },
            { fecha: '2026-04-03', descripcion: 'Viernes Santo', anio: 2026 },
            { fecha: '2026-04-04', descripcion: 'Sábado Santo', anio: 2026 },
            { fecha: '2026-05-01', descripcion: 'Día Nacional del Trabajo', anio: 2026 },
            { fecha: '2026-05-21', descripcion: 'Día de las Glorias Navales', anio: 2026 },
            { fecha: '2026-06-21', descripcion: 'Día Nacional de los Pueblos Indígenas (Solsticio)', anio: 2026 },
            { fecha: '2026-06-29', descripcion: 'San Pedro y San Pablo', anio: 2026 },
            { fecha: '2026-07-16', descripcion: 'Día de la Virgen del Carmen', anio: 2026 },
            { fecha: '2026-08-15', descripcion: 'Asunción de la Virgen', anio: 2026 },
            { fecha: '2026-09-18', descripcion: 'Independencia Nacional', anio: 2026 },
            { fecha: '2026-09-19', descripcion: 'Día de las Glorias del Ejército', anio: 2026 },
            { fecha: '2026-10-12', descripcion: 'Encuentro de Dos Mundos', anio: 2026 },
            { fecha: '2026-10-31', descripcion: 'Día de las Iglesias Evangélicas', anio: 2026 },
            { fecha: '2026-11-01', descripcion: 'Día de Todos los Santos', anio: 2026 },
            { fecha: '2026-12-08', descripcion: 'Inmaculada Concepción', anio: 2026 },
            { fecha: '2026-12-25', descripcion: 'Navidad', anio: 2026 },

            // 2027 (18 cae sábado -> viernes 17 es feriado legal por Ley 20.983; solsticio cae lunes 21)
            { fecha: '2027-01-01', descripcion: 'Año Nuevo', anio: 2027 },
            { fecha: '2027-03-26', descripcion: 'Viernes Santo', anio: 2027 },
            { fecha: '2027-03-27', descripcion: 'Sábado Santo', anio: 2027 },
            { fecha: '2027-05-01', descripcion: 'Día Nacional del Trabajo', anio: 2027 },
            { fecha: '2027-05-21', descripcion: 'Día de las Glorias Navales', anio: 2027 },
            { fecha: '2027-06-21', descripcion: 'Día Nacional de los Pueblos Indígenas (Solsticio)', anio: 2027 },
            { fecha: '2027-06-28', descripcion: 'San Pedro y San Pablo (Traslado)', anio: 2027 },
            { fecha: '2027-07-16', descripcion: 'Día de la Virgen del Carmen', anio: 2027 },
            { fecha: '2027-08-15', descripcion: 'Asunción de la Virgen', anio: 2027 },
            { fecha: '2027-09-17', descripcion: 'Fiestas Patrias adicional (Ley 20.983)', anio: 2027 },
            { fecha: '2027-09-18', descripcion: 'Independencia Nacional', anio: 2027 },
            { fecha: '2027-09-19', descripcion: 'Día de las Glorias del Ejército', anio: 2027 },
            { fecha: '2027-10-11', descripcion: 'Encuentro de Dos Mundos (Traslado)', anio: 2027 },
            { fecha: '2027-10-31', descripcion: 'Día de las Iglesias Evangélicas', anio: 2027 },
            { fecha: '2027-11-01', descripcion: 'Día de Todos los Santos', anio: 2027 },
            { fecha: '2027-12-08', descripcion: 'Inmaculada Concepción', anio: 2027 },
            { fecha: '2027-12-25', descripcion: 'Navidad', anio: 2027 }
        ]

        for (const f of feriadosBase) {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Feriado" (id, fecha, descripcion, anio, tipo, activo, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (fecha) DO NOTHING;
            `, `feriado_${f.fecha}`, f.fecha, f.descripcion, f.anio, f.tipo || 'LEGAL')
        }

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tabla Multas_Feriado:', error)
    }
}
