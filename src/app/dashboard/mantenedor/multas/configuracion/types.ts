export interface ModuloSistemaConfig {
    codigo: string
    nombre: string
    descripcion: string
    activo: boolean
    fase: 'Operativo' | 'En Desarrollo' | 'Planificado'
}

export const MODULOS_C_DEFAULT: ModuloSistemaConfig[] = [
    { codigo: 'C1', nombre: 'Hub Configuración de Multas y Parámetros', descripcion: 'Parametrización dinámica y centralizada de umbrales por licitación.', activo: true, fase: 'Operativo' },
    { codigo: 'C2', nombre: 'Restricciones y Reglas por Aspecto', descripcion: 'Reglas de excepción por año calendario y rangos de fechas (ej: M 2024/2025 = $0).', activo: true, fase: 'Operativo' },
    { codigo: 'C3', nombre: 'Cálculo Dinámico y Alertas Técnicas IT', descripcion: 'Motor de cálculo de multas sincronizado con UTM, servicios y fórmulas oficiales.', activo: true, fase: 'Operativo' },
    { codigo: 'C4', nombre: 'Gestión de Descargos y Resoluciones', descripcion: 'Control de descargos de actas, resoluciones de multas y plazos de apelación.', activo: true, fase: 'Operativo' },
    { codigo: 'C5', nombre: 'Detección de Causales No Imputables', descripcion: 'Análisis textual inteligente de cortes de suministro, paros gremiales y fuerza mayor.', activo: true, fase: 'Operativo' },
    { codigo: 'C6', nombre: 'Auditoría de Pesaje y Control AQL 6,5', descripcion: 'Verificación de tamaño de muestra de bandejas pesadas según tabla Militar Estándar.', activo: true, fase: 'Operativo' },
    { codigo: 'C7', nombre: 'Control de Ratio Manipuladoras (Aspecto H)', descripcion: 'Cálculo de dotación mínima (1 manipuladora cada 70 raciones de establecimiento).', activo: true, fase: 'Operativo' },
    { codigo: 'C8', nombre: 'Rangos Térmicos y Calidad (Aspecto K)', descripcion: 'Monitoreo de umbrales térmicos en equipos de frío y congelación.', activo: true, fase: 'Operativo' },
    { codigo: 'C9', nombre: 'Tolerancias Frutas y Hortalizas (Aspecto F)', descripcion: 'Límites de defectos leves (10%), moderados (5%) y graves (0%) según Anexo 2.', activo: true, fase: 'Operativo' },
    { codigo: 'C10', nombre: 'Subsanabilidad y Pautas de Solución', descripcion: 'Detección de aspectos subsanables (B, E, J, L) y pautas de solución en 5 días.', activo: true, fase: 'Operativo' },
    { codigo: 'C11', nombre: 'Tablero Ejecutivo y Reportes EE', descripcion: 'Métricas gerenciales de multas, distribución por aspecto y montos en UTM.', activo: false, fase: 'Planificado' }
]

export const CAUSAS_NO_IMPUTABLES_DEFAULT = [
    { terminoClave: 'corte de agua', descripcion: 'Corte o suspensión del suministro de agua potable no atribuible al prestador.', imputable: false },
    { terminoClave: 'corte de luz', descripcion: 'Corte o falla en el suministro de energía eléctrica acreditada por compañía.', imputable: false },
    { terminoClave: 'toma del establecimiento', descripcion: 'Toma del establecimiento educacional declarada formalmente por dirección.', imputable: false },
    { terminoClave: 'paro', descripcion: 'Paralización de actividades o paro docente/estudiantil/gremial.', imputable: false },
    { terminoClave: 'fuerza mayor', descripcion: 'Evento imprevisto de fuerza mayor, catástrofe natural o emergencia comunal.', imputable: false },
    { terminoClave: 'temporal', descripcion: 'Temporal climático severo, lluvias torrenciales o anegamiento de accesos.', imputable: false }
]
