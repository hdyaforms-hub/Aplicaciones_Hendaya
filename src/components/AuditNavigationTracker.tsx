'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Mapeo de rutas a módulos y descripciones legibles
function getModuleInfoFromPath(path: string): { modulo: string; detalle: string } | null {
    if (!path || path === '/login') return null

    if (path === '/dashboard') {
        return { modulo: 'Inicio', detalle: 'Accedió a la pantalla de Inicio / Estadísticas' }
    }

    // Tableros y Avances
    if (path.startsWith('/dashboard/tablero')) {
        if (path.includes('/widgets')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Widgets Personalizables' }
        if (path.includes('/auditoria')) return { modulo: 'Tableros y Avances', detalle: 'Accedió al módulo de Auditoría de Actividad' }
        if (path.includes('/organigrama')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Organigrama por zonas' }
        if (path.includes('/solicitudes-pan')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Solicitudes de Pan' }
        if (path.includes('/solicitud-gas')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Solicitud de Gas' }
        if (path.includes('/retiro-saldos')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Retiro de Saldos' }
        if (path.includes('/elementos-esenciales')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Carga de Elementos Esenciales' }
        if (path.includes('/multas-ee')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Multas EE' }
        if (path.includes('/kilometraje')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero de Kilometraje' }
        if (path.includes('/actas')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero de Actas' }
        if (path.includes('/verificador-temperaturas')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Verificador de Temperaturas' }
        if (path.includes('/monitoreo-rrhh')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Monitoreo RRHH' }
        if (path.includes('/monitoreo-avances')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Monitoreo de Avances' }
        if (path.includes('/tendencias-pmpa')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Tendencias y Oscilación PMPA' }
        if (path.includes('/resolucion-sanitaria')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero de Resolución Sanitaria (Evolución Histórica)' }
        return { modulo: 'Tableros y Avances', detalle: 'Accedió a Avance PMPA' }
    }

    // Aplicaciones
    if (path.startsWith('/dashboard/ingreso-raciones')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Ingreso de Raciones' }
    if (path.startsWith('/dashboard/solicitud-pan')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Solicitud de Pan' }
    if (path.startsWith('/dashboard/solicitud-gas')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Solicitud de Gas' }
    if (path.startsWith('/dashboard/retiro-saldos')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Retiro de Saldos' }

    // Gestor Documental
    if (path.startsWith('/dashboard/documentos')) return { modulo: 'Gestor Documental', detalle: 'Accedió a Gestor Documental' }

    // Actas
    if (path.startsWith('/dashboard/actas')) {
        if (path.includes('/generar-acta')) return { modulo: 'Actas', detalle: 'Accedió a Generar Acta JUNAEB' }
        if (path.includes('/descargar-actas')) return { modulo: 'Actas', detalle: 'Accedió a Descargar Actas' }
        return { modulo: 'Actas', detalle: 'Accedió a Actas' }
    }

    // Áreas -> Recursos Humanos (Personal)
    if (path.startsWith('/dashboard/areas/personal')) {
        if (path.includes('/asistencia/atrasos-adelantos')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Atrasos y Adelantos (Asistencia)' }
        if (path.includes('/administracion/atrasos-adelantos')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Adm. Atrasos y Adelantos' }
        if (path.includes('/atrasos-adelantos')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Carga Masiva de Atrasos y Adelantos' }
        if (path.includes('/asistencia/cambio-rbd')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Cambio de RBD (Personal)' }
        if (path.includes('/asistencia/horas-extras') || path.includes('/horas-extras')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Horas Extras (HHEE)' }
        if (path.includes('/asistencia')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Ausentismo y Asistencia' }
        if (path.includes('/dotacion')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Dotación de Personal' }
        if (path.includes('/administracion')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Administración de RRHH' }
        if (path.includes('/carga-masiva')) return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Carga Masiva de RRHH' }
        return { modulo: 'Áreas -> Recursos Humanos', detalle: 'Accedió a Recursos Humanos' }
    }

    // Áreas -> Logística
    if (path.startsWith('/dashboard/areas/logistica')) {
        if (path.includes('/tablero')) return { modulo: 'Áreas -> Logística', detalle: 'Accedió a Tablero de Despacho Logístico' }
        if (path.includes('/rutas')) return { modulo: 'Áreas -> Logística', detalle: 'Accedió a Historial de Rutas de Despacho' }
        if (path.includes('/metricas')) return { modulo: 'Áreas -> Logística', detalle: 'Accedió a Métricas de Despacho' }
        if (path.includes('/configuracion')) return { modulo: 'Áreas -> Logística', detalle: 'Accedió a Configuración Logística' }
        if (path.includes('/integraciones')) return { modulo: 'Áreas -> Logística', detalle: 'Accedió a Integraciones (n8n)' }
        return { modulo: 'Áreas -> Logística', detalle: 'Accedió a Logística' }
    }

    // Áreas
    if (path.startsWith('/dashboard/areas/operaciones/elementos-esenciales')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Carga de Elementos Esenciales' }
    if (path.startsWith('/dashboard/areas/operaciones/descargas-pae')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Descargas PAE Online' }
    if (path.startsWith('/dashboard/areas/operaciones/cargar-pae')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Cargar PaeOnline' }
    if (path.startsWith('/dashboard/areas/manipuladoras')) return { modulo: 'Áreas -> Manipuladoras', detalle: 'Accedió a Cálculo de Gramaje' }
    if (path.startsWith('/dashboard/areas/calidad/resolucion-sanitaria')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Resolución Sanitaria' }
    if (path.startsWith('/dashboard/areas/calidad/retorno-productos')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Retirada de Productos' }
    if (path.startsWith('/dashboard/areas/calidad/verificador-temperaturas')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Verificador de Temperaturas de Productos' }
    if (path.startsWith('/dashboard/areas/calidad/subir-actas-pae')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Subir Actas Estándar PAE' }
    if (path.startsWith('/dashboard/areas/calidad/transporte-higiene')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Registro transportista interno higiene y estado Transporte' }
    if (path.startsWith('/dashboard/areas/calidad/higiene-personal')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Registro de Transportista interno Higiene Personal' }
    if (path.startsWith('/dashboard/areas/multas')) {
        if (path.includes('/descargos')) return { modulo: 'Áreas -> Multas', detalle: 'Accedió a Descargos de Actas' }
        return { modulo: 'Áreas -> Multas', detalle: 'Accedió a Cálculos de Elementos Esenciales' }
    }
    if (path.startsWith('/dashboard/areas/prevencion-riesgos') || path.startsWith('/dashboard/areas/prev-riesgos')) {
        if (path.includes('/riesgo-minuta')) return { modulo: 'Áreas -> Prev. de riesgos', detalle: 'Accedió a Riesgo en Minuta' }
        return { modulo: 'Áreas -> Prev. de riesgos', detalle: 'Accedió a Gravedad en Preparación' }
    }

    // Trabajos Preventivos
    if (path.startsWith('/dashboard/trabajos-preventivos')) {
        if (path.includes('/presupuesto')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Presupuesto de Mantenimiento' }
        if (path.includes('/avance')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Estado de Avance Mantenimiento' }
        return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Cargar OT (Trabajos Preventivos)' }
    }

    // Matriz de Riesgo
    if (path.startsWith('/dashboard/matriz-riesgo')) {
        if (path.includes('/ingresar')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Ingresar nueva Matriz' }
        if (path.includes('/detalle')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Detalle Matriz' }
        if (path.includes('/mitigacion')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Cierre de Mitigación' }
        if (path.includes('/cerrar-matriz')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Sol. desviación Matriz' }
        if (path.includes('/historico')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Histórico de Matrices' }
        if (path.includes('/estado-avance')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Estado de Avance' }
        if (path.includes('/auditoria')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Auditoría Externa' }
        if (path.includes('/inf-auditoria-mitigacion')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Inf. Auditoria Mitigación' }
        if (path.includes('/hoja-b-estandar-pae')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Hoja B Estandar Pae' }
        if (path.includes('/matriz-2026')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Matriz 2026' }
        return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Matriz de Riesgo' }
    }

    // Formularios
    if (path.startsWith('/dashboard/formularios')) return { modulo: 'Formularios', detalle: `Accedió a Formularios (${path})` }

    // Mantenedores
    if (path.startsWith('/dashboard/mantenedor') || path.startsWith('/dashboard/productos') || path.startsWith('/dashboard/calculadora')) {
        if (path.includes('/personal/configuracion-visualizacion')) return { modulo: 'Mantenedor -> Recursos Humanos', detalle: 'Accedió a Configuración de Visualización (Asignación Jefatura-Personal)' }
        if (path.includes('/personal/monitoreo')) return { modulo: 'Mantenedor -> Recursos Humanos', detalle: 'Accedió a Mantenedor Monitoreo RRHH (Roles Asignados)' }
        if (path.includes('/personal/criterios-ausencias')) return { modulo: 'Mantenedor -> Recursos Humanos', detalle: 'Accedió a Criterios de Ausencias' }
        if (path.includes('/monitoreo')) return { modulo: 'Mantenedor', detalle: 'Accedió a Configuración de Monitoreo de Evaluaciones' }
        return { modulo: 'Mantenedor', detalle: `Accedió a Mantenedor (${path.replace('/dashboard/', '')})` }
    }

    // Configuración & Administración
    if (path.startsWith('/dashboard/users')) return { modulo: 'Configuración', detalle: 'Accedió a Gestión de Usuarios' }
    if (path.startsWith('/dashboard/roles')) return { modulo: 'Configuración', detalle: 'Accedió a Roles y Perfiles' }
    if (path.startsWith('/dashboard/configuracion')) {
        if (path.includes('/global')) return { modulo: 'Configuración', detalle: 'Accedió a Configuración Global del Sistema' }
        if (path.includes('/reubicacion')) return { modulo: 'Configuración', detalle: 'Accedió a Reubicación de Aplicaciones' }
        if (path.includes('/correo')) return { modulo: 'Configuración', detalle: 'Accedió a Configuración de Correo' }
        if (path.includes('/listas-correo')) return { modulo: 'Configuración', detalle: 'Accedió a Listas de Distribución' }
        if (path.includes('/notificaciones')) return { modulo: 'Configuración', detalle: 'Accedió a Notificaciones por Pantalla' }
        return { modulo: 'Configuración', detalle: `Accedió a Configuración (${path.replace('/dashboard/configuracion/', '')})` }
    }

    // Reportes
    if (path.startsWith('/dashboard/reports')) return { modulo: 'Reportes', detalle: `Accedió a Reportes (${path.replace('/dashboard/reports/', '')})` }

    // Colaboradores
    if (path.includes('/anonimizador')) return { modulo: 'Colaboradores', detalle: 'Accedió a Anonimizador de Planillas' }
    if (path.includes('/sala-reuniones')) return { modulo: 'Colaboradores', detalle: 'Accedió a Reserva Sala de Reuniones' }
    if (path.includes('/conversacion')) return { modulo: 'Colaboradores', detalle: 'Accedió a Conversación y Colaboración' }
    if (path.includes('/registro-capacitacion')) return { modulo: 'Colaboradores', detalle: 'Accedió a Registro de Capacitación' }

    // Ayuda
    if (path.startsWith('/dashboard/ayuda')) {
        if (path.includes('/agregar')) return { modulo: 'Ayuda', detalle: 'Accedió a Agregar Anexos' }
        if (path.includes('/ver')) return { modulo: 'Ayuda', detalle: 'Accedió a Directorio de Anexos' }
        return { modulo: 'Ayuda', detalle: 'Accedió al módulo de Ayuda' }
    }

    return { modulo: 'Sistema', detalle: `Accedió a la ruta ${path}` }
}

export default function AuditNavigationTracker() {
    const pathname = usePathname()
    const lastLoggedPath = useRef<string>('')

    useEffect(() => {
        if (!pathname || pathname === lastLoggedPath.current) return

        const moduleInfo = getModuleInfoFromPath(pathname)
        if (!moduleInfo) return

        lastLoggedPath.current = pathname

        // Enviar evento de navegación de manera asíncrona no bloqueante
        fetch('/api/audit/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'NAVEGACION',
                modulo: moduleInfo.modulo,
                detalle: moduleInfo.detalle,
            }),
        }).catch(err => console.error('Error enviando auditoría de navegación:', err))
    }, [pathname])

    // Heartbeat periódico (cada 3 minutos) mientras la pestaña permanezca activa y visible
    useEffect(() => {
        const heartbeatInterval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
            if (!pathname) return
            const moduleInfo = getModuleInfoFromPath(pathname)
            if (!moduleInfo) return

            fetch('/api/audit/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SESION_ACTIVA',
                    modulo: moduleInfo.modulo,
                    detalle: `Permanencia activa en ${moduleInfo.modulo}`,
                }),
                keepalive: true,
            }).catch(() => {})
        }, 3 * 60 * 1000)

        return () => clearInterval(heartbeatInterval)
    }, [pathname])

    return null
}
