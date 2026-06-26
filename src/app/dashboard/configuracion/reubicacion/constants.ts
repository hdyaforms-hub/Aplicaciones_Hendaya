export interface MenuSection {
    id: string
    label: string
    parentKey: string
    items: string[]
}

export const MENU_SECTIONS: MenuSection[] = [
    {
        id: "main",
        label: "Menú Principal (Nivel Superior)",
        parentKey: "",
        items: ["Inicio", "Tableros y Avances", "Aplicaciones", "Áreas", "Matriz de riesgo", "Formularios", "Reportes", "Mantenedor", "Configuración", "Ayuda"]
    },
    {
        id: "tableros",
        label: "Tableros y Avances",
        parentKey: "Tableros y Avances",
        items: ["Avance PMPA", "Organigrama por zonas", "Solicitudes de Pan", "Solicitud de Gas", "Retiro de Saldos", "Carga de Elementos Esenciales", "Multas EE", "Tablero de Kilometraje"]
    },
    {
        id: "aplicaciones",
        label: "Aplicaciones",
        parentKey: "Aplicaciones",
        items: ["Ingreso de Raciones", "Solicitud de Pan", "Solicitud de Gas", "Retiro de Saldos"]
    },
    {
        id: "areas",
        label: "Áreas (Submenú Principal)",
        parentKey: "Áreas",
        items: ["Operaciones", "Manipuladoras", "Calidad", "Multas"]
    },
    {
        id: "operaciones_areas",
        label: "Áreas -> Operaciones",
        parentKey: "Operaciones",
        items: ["Trabajos Preventivos / Correctivos", "Carga de Elementos Esenciales", "Descargas PAE Online", "Cargar PaeOnline"]
    },
    {
        id: "trabajos_preventivos",
        label: "Operaciones -> Trabajos Preventivos / Correctivos",
        parentKey: "Trabajos Preventivos / Correctivos",
        items: ["Cargar OT", "Presupuesto", "Estado de Avance"]
    },
    {
        id: "manipuladoras",
        label: "Áreas -> Manipuladoras",
        parentKey: "Manipuladoras",
        items: ["Cálculo de gramaje"]
    },
    {
        id: "calidad",
        label: "Áreas -> Calidad",
        parentKey: "Calidad",
        items: ["Retirada de Productos", "Subir Actas Estándar PAE"]
    },
    {
        id: "multas_areas",
        label: "Áreas -> Multas",
        parentKey: "Multas",
        items: ["Cálculos de Elementos Esenciales"]
    },
    {
        id: "matriz_riesgo",
        label: "Matriz de riesgo",
        parentKey: "Matriz de riesgo",
        items: ["Ingresar nueva Matriz", "Detalle Matriz", "Cierre de Mitigación", "Sol. desviación Matriz", "Estado de Avance", "Auditoría", "Inf. Auditoria Mitigación", "Hoja B Estandar Pae", "Matriz 2026"]
    },
    {
        id: "matriz_2026",
        label: "Matriz de riesgo -> Matriz 2026",
        parentKey: "Matriz 2026",
        items: ["Ingresar nueva Matriz", "Evaluación Detallada"]
    },
    {
        id: "formularios",
        label: "Formularios",
        parentKey: "Formularios",
        items: ["Gestión de Formularios", "Crear Formulario", "Completar Formulario", "Respuestas de Formularios"]
    },
    {
        id: "reportes",
        label: "Reportes",
        parentKey: "Reportes",
        items: ["Informe de Carga de Raciones", "Solicitud de Pan", "Solicitud de Gas", "Retiro de Saldos"]
    },
    {
        id: "mantenedor",
        label: "Mantenedor (Submenú Principal)",
        parentKey: "Mantenedor",
        items: ["Operaciones", "Manipuladora", "Matriz de Riesgo", "Área", "Productos", "Pae Online", "Multas", "Calculadora"]
    },
    {
        id: "operaciones_mantenedor",
        label: "Mantenedor -> Operaciones",
        parentKey: "Operaciones",
        items: ["Sucursal", "PMPA", "Colegio", "Consumo de Gas x RBD", "Vehículos", "Zonales", "Jefes de Operación", "Supervisores"]
    },
    {
        id: "manipuladora_mantenedor",
        label: "Mantenedor -> Manipuladora",
        parentKey: "Manipuladora",
        items: ["Carga Masiva de usuario"]
    },
    {
        id: "matriz_mantenedor",
        label: "Mantenedor -> Matriz de Riesgo",
        parentKey: "Matriz de Riesgo",
        items: ["Colegios Activos", "Nueva Matriz"]
    },
    {
        id: "pae_online_mantenedor",
        label: "Mantenedor -> Pae Online",
        parentKey: "Pae Online",
        items: ["Código de Causa"]
    },
    {
        id: "multas_mantenedor",
        label: "Mantenedor -> Multas",
        parentKey: "Multas",
        items: ["UTM", "Fórmulas de Aspecto EE", "Servicios"]
    },
    {
        id: "calculadora_mantenedor",
        label: "Mantenedor -> Calculadora",
        parentKey: "Calculadora",
        items: ["Preparaciones", "Minutas", "Raciones"]
    },
    {
        id: "configuracion",
        label: "Configuración",
        parentKey: "Configuración",
        items: ["Gestión de Usuarios", "Roles y Perfiles", "Reubicación de Aplicaciones", "Configuración de Correo", "Listas de Distribución", "Notificaciones por Pantalla"]
    },
    {
        id: "ayuda",
        label: "Ayuda",
        parentKey: "Ayuda",
        items: ["Agregar Anexos", "Ver Anexos"]
    }
]
