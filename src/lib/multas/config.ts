export interface SubModuloReglasC5 {
    aqlPesaje: boolean
    personalManipulador: boolean
    temperaturas: boolean
    calidadFrutasVerduras: boolean
    causasNoImputables: boolean
    subsanabilidad: boolean
}

export const SUBMODULOS_C5_DEFAULT: SubModuloReglasC5 = {
    aqlPesaje: true,
    personalManipulador: true,
    temperaturas: true,
    calidadFrutasVerduras: true,
    causasNoImputables: true,
    subsanabilidad: true
}

export interface SubModuloCatalogosC2 {
    horariosServicio: boolean
    estratosExcluidos: boolean
    dotacionOficial: boolean
    minutaPlanificada: boolean
}

export const SUBMODULOS_C2_DEFAULT: SubModuloCatalogosC2 = {
    horariosServicio: true,
    estratosExcluidos: false,
    dotacionOficial: false,
    minutaPlanificada: false
}

export interface SubModuloDatosFolioC3 {
    nivelSupervisado: boolean
    bandejasAql: boolean
    correccionManual: boolean
    exigirMotivo: boolean
}

export const SUBMODULOS_C3_DEFAULT: SubModuloDatosFolioC3 = {
    nivelSupervisado: true,
    bandejasAql: true,
    correccionManual: true,
    exigirMotivo: true
}

export interface SubModuloExtraccionC4 {
    extraccionRobusta: boolean
    alertasSubcontada: boolean
    tipoInstrumentoJ: boolean
}

export const SUBMODULOS_C4_DEFAULT: SubModuloExtraccionC4 = {
    extraccionRobusta: false, // Invarianza: apagado por defecto para no alterar montos históricos
    alertasSubcontada: true,
    tipoInstrumentoJ: true
}

export interface ModuloSistemaConfig {
    codigo: string
    nombre: string
    descripcion: string
    activo: boolean
    fase: 'Operativo' | 'En Desarrollo' | 'Planificado'
    submodulos?: SubModuloReglasC5 | SubModuloCatalogosC2 | any
    parametros?: any
}

export const MODULOS_C_DEFAULT: ModuloSistemaConfig[] = [
    {
        codigo: 'C1',
        nombre: 'Hub Configuración y Parametrización Global',
        descripcion: 'Parametrización dinámica y centralizada de umbrales por licitación.',
        activo: true,
        fase: 'Operativo'
    },
    {
        codigo: 'C2',
        nombre: 'Catálogos de Validación de Terreno (Horarios, Estratos, Dotación)',
        descripcion: 'Validación de actas fuera de horario, estratos excluidos (206, 208, 209) y dotación oficial.',
        activo: false,
        fase: 'En Desarrollo',
        submodulos: SUBMODULOS_C2_DEFAULT
    },
    {
        codigo: 'C3',
        nombre: 'Datos Complementarios por Folio (Nivel T/B/M, Bandejas y Ajustes Manuales)',
        descripcion: 'Captura de nivel supervisado, bandejas evaluadas/rechazadas y ajustes manuales auditados.',
        activo: false,
        fase: 'En Desarrollo',
        submodulos: SUBMODULOS_C3_DEFAULT
    },
    {
        codigo: 'C4',
        nombre: 'Extracción Robusta Multiaspecto (Modo Comparación F, J, K, D, E, L)',
        descripcion: 'Conteo y comparación automatizada de materias primas, instrumentos y uniformes en actas.',
        activo: false,
        fase: 'En Desarrollo',
        submodulos: SUBMODULOS_C4_DEFAULT
    },
    {
        codigo: 'C5',
        nombre: 'Motor de Reglas NC y Alertas Técnicas IT',
        descripcion: 'Motor inteligente de alertas: pesaje AQL, personal H (1:70), temperaturas K, tolerancias F y causales no imputables.',
        activo: true,
        fase: 'Operativo',
        submodulos: { ...SUBMODULOS_C5_DEFAULT }
    },
    {
        codigo: 'C6',
        nombre: 'Notificaciones JUNAEB y Conciliación REX',
        descripcion: 'Recepción, conciliación de resoluciones exentas y control de plazos perentorios de descargo.',
        activo: false,
        fase: 'Planificado'
    },
    {
        codigo: 'C7',
        nombre: 'Ciclo Legal y Expedientes (Descargos formales, Recursos, Judicial)',
        descripcion: 'Trazabilidad de escritos legales, recursos de reposición, jerárquicos y reclamaciones.',
        activo: false,
        fase: 'Planificado'
    },
    {
        codigo: 'C8',
        nombre: 'Biblioteca de Argumentos y Jurisprudencia',
        descripcion: 'Repositorio de descargos exitosos, fallos favorables y precedentes por causal de multa.',
        activo: false,
        fase: 'Planificado'
    },
    {
        codigo: 'C9',
        nombre: 'Soluciones y Planes de Acción de Sucursales',
        descripcion: 'Compromisos de corrección en terreno por supervisores y jefaturas zonales de operaciones.',
        activo: false,
        fase: 'Planificado'
    },
    {
        codigo: 'C10',
        nombre: 'Análisis con IA y Lectura Automatizada de Pesaje',
        descripcion: 'Extracción multimodal de datos desde fotos de actas y planillas de pesaje de bandejas.',
        activo: false,
        fase: 'Planificado'
    },
    {
        codigo: 'C11',
        nombre: 'Tablero Ejecutivo y Reportes Analíticos de Multas',
        descripcion: 'KPIs directivos, montos proyectados en UTM/CLP y métricas de multas por aspecto y licitación.',
        activo: false,
        fase: 'Planificado'
    }
]

export const CAUSAS_NO_IMPUTABLES_DEFAULT = [
    { terminoClave: 'corte de agua', descripcion: 'Corte o suspensión del suministro de agua potable no atribuible al prestador.', imputable: false },
    { terminoClave: 'corte de luz', descripcion: 'Corte o falla en el suministro de energía eléctrica acreditada por compañía.', imputable: false },
    { terminoClave: 'toma del establecimiento', descripcion: 'Toma del establecimiento educacional declarada formalmente por dirección.', imputable: false },
    { terminoClave: 'paro', descripcion: 'Paralización de actividades o paro docente/estudiantil/gremial.', imputable: false },
    { terminoClave: 'fuerza mayor', descripcion: 'Evento imprevisto de fuerza mayor, catástrofe natural o emergencia comunal.', imputable: false },
    { terminoClave: 'temporal de lluvia', descripcion: 'Temporal climático severo con lluvias torrenciales.', imputable: false },
    { terminoClave: 'temporal de viento', descripcion: 'Temporal de viento o alerta meteorológica extrema.', imputable: false },
    { terminoClave: 'lluvia torrencial', descripcion: 'Lluvia torrencial o inundación con afectación de infraestructura.', imputable: false },
    { terminoClave: 'temporal con anegamiento', descripcion: 'Temporal climático severo con anegamiento de accesos o cocina.', imputable: false }
]

export interface HorarioServicioItem {
    id?: string
    servicioCodigo: string
    servicioNombre: string
    horaInicio: string
    horaFin: string
    toleranciaMinutos: number
    activo: boolean
}

export interface EstratoExcluidoItem {
    id: string
    licId: number
    estrato: string
    descripcion?: string | null
    activo: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface ManipuladoraMesItem {
    id?: string
    licId: number
    anio: number
    mes: number
    rbd: number
    establecimiento?: string | null
    total: number
    filename?: string | null
    usuarioModif?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface MinutaMesItem {
    id?: string
    licId: number
    anio: number
    mes: number
    nivel: string
    datosJson: string
    filename?: string | null
    usuarioModif?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface FolioDatoItem {
    id?: string
    folio: string
    nivelSupervisado?: string | null
    bandejasEvaluadas?: number | null
    bandejasRechazadas?: number | null
    motivo?: string | null
    updatedBy?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface CantidadOverrideItem {
    id?: string
    folio: string
    letraAspecto: string
    variable: string
    valor: number
    valorOriginal?: number | null
    motivo: string
    createdBy: string
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface ModulosActivosLicitacion {
    c1: boolean
    c2: boolean
    c3: boolean
    c4: boolean
    c5: boolean
    c5Config?: {
        margenTemperaturaMax?: number
        umbralDotacionInasistenciaPct?: number
        toleranciaHorarioAnticipadoMin?: number
        toleranciaHorarioPesajeMin?: number
        reglasHabilitadas?: Record<string, boolean>
    }
    c2Submodulos?: SubModuloCatalogosC2
    c3Submodulos?: SubModuloDatosFolioC3
    c4Submodulos?: SubModuloExtraccionC4
    c5Submodulos?: SubModuloReglasC5
}

/**
 * Consulta en la base de datos el estado de activación de los módulos (C1 a C5)
 * y sus configuraciones específicas para una licitación dada.
 */
export async function getModulosActivosLicitacion(licId: number): Promise<ModulosActivosLicitacion> {
    const fallback: ModulosActivosLicitacion = {
        c1: true,
        c2: false,
        c3: false,
        c4: false,
        c5: false,
        c2Submodulos: { ...SUBMODULOS_C2_DEFAULT },
        c3Submodulos: { ...SUBMODULOS_C3_DEFAULT },
        c4Submodulos: { ...SUBMODULOS_C4_DEFAULT },
        c5Submodulos: { ...SUBMODULOS_C5_DEFAULT },
        c5Config: {
            margenTemperaturaMax: 1.0,
            umbralDotacionInasistenciaPct: 50,
            toleranciaHorarioAnticipadoMin: 60,
            toleranciaHorarioPesajeMin: 10,
            reglasHabilitadas: {}
        }
    }

    if (!licId) return fallback

    try {
        // Importación dinámica para evitar ciclos
        const { getMultasDelegate } = require('@/lib/multas/db')
        const delegate = getMultasDelegate('multas_Parametros_Licitacion')
        if (!delegate) return fallback

        const record = await delegate.findUnique({
            where: { licId }
        })

        if (!record?.modulosActivosJson) return fallback

        const parsed = JSON.parse(record.modulosActivosJson)
        if (!Array.isArray(parsed)) return fallback

        const findModulo = (code: string) => parsed.find((m: any) => m.codigo === code)

        const mC1 = findModulo('C1')
        const mC2 = findModulo('C2')
        const mC3 = findModulo('C3')
        const mC4 = findModulo('C4')
        const mC5 = findModulo('C5')

        return {
            c1: mC1 ? mC1.activo : true,
            c2: mC2 ? mC2.activo : false,
            c3: mC3 ? mC3.activo : false,
            c4: mC4 ? mC4.activo : false,
            c5: mC5 ? mC5.activo : false,
            c2Submodulos: { ...SUBMODULOS_C2_DEFAULT, ...(mC2?.submodulos || {}) },
            c3Submodulos: { ...SUBMODULOS_C3_DEFAULT, ...(mC3?.submodulos || {}) },
            c4Submodulos: { ...SUBMODULOS_C4_DEFAULT, ...(mC4?.submodulos || {}) },
            c5Submodulos: { ...SUBMODULOS_C5_DEFAULT, ...(mC5?.submodulos || {}) },
            c5Config: {
                margenTemperaturaMax: mC5?.parametros?.margenTemperaturaMax ?? 1.0,
                umbralDotacionInasistenciaPct: mC5?.parametros?.umbralDotacionInasistenciaPct ?? 50,
                toleranciaHorarioAnticipadoMin: mC5?.parametros?.toleranciaHorarioAnticipadoMin ?? 60,
                toleranciaHorarioPesajeMin: mC5?.parametros?.toleranciaHorarioPesajeMin ?? 10,
                reglasHabilitadas: mC5?.parametros?.reglasHabilitadas ?? {}
            }
        }
    } catch (e) {
        console.warn('[C5] Error al leer modulos activos para licitacion', licId, e)
        return fallback
    }
}



