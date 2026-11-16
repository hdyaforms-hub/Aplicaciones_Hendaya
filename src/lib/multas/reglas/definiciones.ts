/**
 * Tipos y definiciones del Motor de Reglas NC Avanzadas (C5)
 * Basado en la homologación de las 19+ reglas normativas de sigs_actas / IT JUNAEB
 */

export type SeveridadHallazgo = 'alta' | 'media' | 'info'
export type TipoHallazgo = 'mal_imputado' | 'descargo' | 'verificar'
export type EstadoHallazgo = 'PENDIENTE' | 'ACEPTADO' | 'DESCARTADO'

export interface HallazgoNC {
    id?: number
    folio: string
    licitacionId?: number | null
    aspecto: string // 'A'..'M' o 'GENERAL'
    reglaId: string
    severidad: SeveridadHallazgo
    tipo: TipoHallazgo
    titulo: string
    detalle: string
    sugerencia?: string | null
    evidencia?: string | null
    estado?: EstadoHallazgo
    nota?: string | null
    autor?: string | null
    descartadoPor?: string | null
    descartadoEn?: Date | string | null
    aceptadoPor?: string | null
    aceptadoEn?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface ReglaCatalogoInfo {
    id: string
    nombre: string
    aspecto: string
    severidadDefault: SeveridadHallazgo
    tipoDefault: TipoHallazgo
    norma: string
    descripcion: string
    sugerenciaBase: string
}

export const CATALOGO_REGLAS: ReglaCatalogoInfo[] = [
    {
        id: 'SERVICIO-VACIO',
        nombre: 'Servicio supervisado no consignado',
        aspecto: 'GENERAL',
        severidadDefault: 'alta',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026',
        descripcion: 'El campo "Servicio" del encabezado está vacío, impidiendo validar horarios y raciones del servicio controlado.',
        sugerenciaBase: 'Verificar acta y constatar vicio procedimental si el supervisor no identificó el servicio auditado.'
    },
    {
        id: 'HORARIO-1',
        nombre: 'Supervisión posterior al término del servicio',
        aspecto: 'GENERAL',
        severidadDefault: 'alta',
        tipoDefault: 'descargo',
        norma: 'IT-DAE-SUP026 C2.1',
        descripcion: 'La supervisión inició después de la hora de término configurada para el servicio.',
        sugerenciaBase: 'Impugnar NC de A, G y K al haberse realizado el control fuera de la entrega efectiva del servicio.'
    },
    {
        id: 'HORARIO-2',
        nombre: 'Supervisión muy anterior al inicio del servicio',
        aspecto: 'GENERAL',
        severidadDefault: 'media',
        tipoDefault: 'descargo',
        norma: 'IT-DAE-SUP026 C2.1',
        descripcion: 'La supervisión inició con más de 60 minutos de anticipación al horario oficial del servicio.',
        sugerenciaBase: 'Descargo por elaboración en curso legítima previo a la ventana horaria de entrega.'
    },
    {
        id: 'G-HORARIO-1',
        nombre: 'Supervisor ausente durante pesaje de servicio completo',
        aspecto: 'G',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 Anexo 3',
        descripcion: 'El supervisor llegó >10 min tarde o se retiró >10 min antes, incumpliendo el muestreo al inicio, medio y final.',
        sugerenciaBase: 'Impugnar NC de G: procedimiento de muestreo inválido por ausencia en las etapas normadas.'
    },
    {
        id: 'G-MUESTRA-1',
        nombre: 'Muestra de bandejas evaluadas insuficiente (AQL 6.5)',
        aspecto: 'G',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 Anexo 3 / Tabla AQL 6.5',
        descripcion: 'La cantidad de bandejas evaluadas en el acta es menor a la muestra mínima exigida para las raciones del establecimiento.',
        sugerenciaBase: 'Impugnar NC de G: tamaño muestral insuficiente invalida la representatividad estadística.'
    },
    {
        id: 'G-NIVEL-1',
        nombre: 'Nivel educacional supervisado no especificado',
        aspecto: 'G',
        severidadDefault: 'media',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 C3.1',
        descripcion: 'El establecimiento tiene múltiples niveles (T/B/M) con raciones distintas y el acta no precisa el nivel controlado.',
        sugerenciaBase: 'Verificar y registrar el nivel supervisado en datos de folio para asegurar raciones correctas.'
    },
    {
        id: 'G-AQL-RES-1',
        nombre: 'Lote aceptado por criterio AQL 6.5',
        aspecto: 'G',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 Anexo 3 (Ac/Re)',
        descripcion: 'La cantidad de bandejas rechazadas es menor o igual al valor Ac de aceptación (lote aceptado según norma).',
        sugerenciaBase: 'Impugnar NC de G: el resultado estadístico de la pauta AQL 6.5 es ACEPTACIÓN.'
    },
    {
        id: 'G-AQL-RES-2',
        nombre: 'Lote rechazado confirmado por criterio AQL 6.5',
        aspecto: 'G',
        severidadDefault: 'info',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 Anexo 3',
        descripcion: 'El lote alcanza o supera el umbral Re de rechazo, confirmando procedencia estadística.',
        sugerenciaBase: 'Verificar si proceden otros argumentos (balanza, horario, calibración).'
    },
    {
        id: 'G-LECHE-CC-1',
        nombre: 'Leche o fórmula láctea medida en CC sin factor densidad',
        aspecto: 'G',
        severidadDefault: 'media',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 (Factor 1,029 g/mL)',
        descripcion: 'En desayuno, el producto lácteo debe calcularse aplicando densidad volumétrica (1 mL = 1,029 g).',
        sugerenciaBase: 'Solicitar planilla de pesaje y comprobar aplicación correcta del factor de conversión.'
    },
    {
        id: 'G-J-1',
        nombre: 'Gramaje imputado sin balanza disponible en servicio',
        aspecto: 'G',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026',
        descripcion: 'Aspecto G en NC mientras que aspecto J registra balanza faltante sin instrumento trazable del servicio.',
        sugerenciaBase: 'Dejar sin efecto NC de G: falta de balanza operativa impide verificación instrumental legítima salvo supervisor calibrado.'
    },
    {
        id: 'K-J-1',
        nombre: 'Temperatura imputada sin termómetro disponible en servicio',
        aspecto: 'K',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026',
        descripcion: 'Aspecto K en NC mientras aspecto J registra termómetros faltantes.',
        sugerenciaBase: 'Solicitar anulación de K: medición sin instrumento del servicio requiere certificado de termómetro del supervisor.'
    },
    {
        id: 'K-MARGEN-1',
        nombre: 'Temperatura marginal dentro de tolerancia de instrumento',
        aspecto: 'K',
        severidadDefault: 'media',
        tipoDefault: 'descargo',
        norma: 'IT-DAE-SUP026 / Tolerancia Instrumental',
        descripcion: 'Desviación de temperatura térmica ≤1,0°C respecto al rango de refrigeración (0-5°C) o congelación (-18°C).',
        sugerenciaBase: 'Descargo por error máximo admisible (EMA) del termómetro (tolerancia instrumental de ±1°C).'
    },
    {
        id: 'A-IGUAL-1',
        nombre: 'Minuta programada idéntica a preparación entregada',
        aspecto: 'A',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 C2.4',
        descripcion: 'Aspecto A consignado como NC pero el texto de preparación entregada coincide con la programada.',
        sugerenciaBase: 'Dejar sin efecto NC de A: el propio medio de verificación acredita coincidencia de minuta.'
    },
    {
        id: 'NC-VACIO-1',
        nombre: 'Aspecto NC sin evidencia en medios de verificación',
        aspecto: 'GENERAL',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026',
        descripcion: 'El aspecto está marcado NC pero todos sus campos consignan CONFORME, NO APLICA o 0.',
        sugerenciaBase: 'Impugnar NC por inexistencia material de evidencia o incumplimiento en el acta.'
    },
    {
        id: 'NC-PEND-1',
        nombre: 'Aspecto NC con cantidad normativa indeterminada',
        aspecto: 'GENERAL',
        severidadDefault: 'media',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 C3.2',
        descripcion: 'El motor no pudo deducir una cantidad clara desde la observación; requiere revisión humana.',
        sugerenciaBase: 'Revisar acta física e ingresar corrección manual o alegar falta de medio de verificación.'
    },
    {
        id: 'H-RATIO-1',
        nombre: 'Observación general contradice índice de manipuladoras',
        aspecto: 'H',
        severidadDefault: 'media',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 Anexo 3',
        descripcion: 'La mención en observaciones generales (ej: manipuladoras vs raciones) es inconsistente con el estado de H.',
        sugerenciaBase: 'Cuestionar rigurosidad del levantamiento por contradicción interna en el acta.'
    },
    {
        id: 'H-MANIP-1',
        nombre: 'Manipuladoras faltantes superan umbral de dotación oficial',
        aspecto: 'H',
        severidadDefault: 'alta',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 C2.3',
        descripcion: 'Las manipuladoras faltantes superan el 50% de la dotación oficial asignada al establecimiento.',
        sugerenciaBase: 'Revisar libro de asistencia y certificados de inasistencia (licencias, reemplazos) para descargo.'
    },
    {
        id: 'J-GK-NA-1',
        nombre: 'Falta de balanza/termómetro impone NA en G o K',
        aspecto: 'G/K',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 pág. 14',
        descripcion: 'La norma establece expresamente que al faltar balanza o termómetro en J, G o K deben quedar como NA y no NC.',
        sugerenciaBase: 'Solicitar reclasificación de G o K de NC a NA según mandato expreso de pág. 14 IT-DAE-SUP026.'
    },
    {
        id: 'DESABASTO-1',
        nombre: 'Indicios de desabastecimiento (evaluar imputabilidad)',
        aspecto: 'A/C',
        severidadDefault: 'media',
        tipoDefault: 'descargo',
        norma: 'IT-DAE-SUP026 Tabla N° 1',
        descripcion: 'Se mencionan faltantes de producto o suministros atribuibles a causas no imputables de la Tabla 1.',
        sugerenciaBase: 'Acreditar causa externa (corte de suministro, catástrofe, atraso no imputable) para excluir responsabilidad.'
    },
    {
        id: 'F-CALIBRE-C8',
        nombre: 'Incumplimiento por calibre en F corresponde a C8',
        aspecto: 'F',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 pág. 13',
        descripcion: 'La norma prohíbe imputar calibre en F (reservado a podredumbre/daño físico); debe tramitarse en C8.',
        sugerenciaBase: 'Solicitar exclusión de multa en F y derivación a C8 según instructivo oficial.'
    },
    {
        id: 'M-PLAZO-1',
        nombre: 'Aspecto M evaluado previo a su vigencia (Junio 2025)',
        aspecto: 'M',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026 págs. 12 y 15',
        descripcion: 'El aspecto M (Gestión de Residuos) solo es exigible a contar de junio de 2025; antes debe ser NA.',
        sugerenciaBase: 'Dejar sin efecto NC de M por falta de vigencia temporal de la obligación en la fecha del acta.'
    },
    {
        id: 'B-CELULAR-1',
        nombre: 'Manual en celular personal de la manipuladora',
        aspecto: 'B',
        severidadDefault: 'media',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 pág. 13',
        descripcion: 'Si el manual está en celular personal (no tablet o equipo oficial), la norma lo considera inexistencia.',
        sugerenciaBase: 'Verificar si dispositivo es corporativo o personal para confirmar o defender el estado de B.'
    },
    {
        id: 'C-CONF-1',
        nombre: 'Aspecto C NC con materia prima conforme',
        aspecto: 'C',
        severidadDefault: 'alta',
        tipoDefault: 'mal_imputado',
        norma: 'IT-DAE-SUP026',
        descripcion: 'El aspecto C está marcado NC pero el campo "materia prima no encontrada" consigna CONFORME.',
        sugerenciaBase: 'Solicitar anulación de NC de C por contradicción directa del medio de verificación.'
    },
    {
        id: 'F-SUBCONTADA',
        nombre: 'Subconteo en Aspecto F detectado por análisis robusto',
        aspecto: 'F',
        severidadDefault: 'alta',
        tipoDefault: 'verificar',
        norma: 'IT-DAE-SUP026 C4',
        descripcion: 'El número de especies dañadas encontradas es superior a la cantidad asignada para la multa.',
        sugerenciaBase: 'Auditar detalle de frutas/verduras consignadas antes de dar por definitivo el monto.'
    }
]

export interface ParametrosMotorNC {
    margenTemperaturaMax?: number // default 1.0 °C
    umbralDotacionInasistenciaPct?: number // default 50%
    toleranciaHorarioAnticipadoMin?: number // default 60 min
    toleranciaHorarioPesajeMin?: number // default 10 min
    reglasHabilitadas?: Record<string, boolean> // reglaId -> boolean
}
