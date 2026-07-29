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
        if (path.includes('/auditoria')) return { modulo: 'Tableros y Avances', detalle: 'Accedió al módulo de Auditoría de Actividad' }
        if (path.includes('/organigrama')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Organigrama por zonas' }
        if (path.includes('/solicitudes-pan')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Solicitudes de Pan' }
        if (path.includes('/solicitud-gas')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Solicitud de Gas' }
        if (path.includes('/retiro-saldos')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Retiro de Saldos' }
        if (path.includes('/elementos-esenciales')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Carga de Elementos Esenciales' }
        if (path.includes('/multas-ee')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero Multas EE' }
        if (path.includes('/kilometraje')) return { modulo: 'Tableros y Avances', detalle: 'Accedió a Tablero de Kilometraje' }
        return { modulo: 'Tableros y Avances', detalle: 'Accedió a Avance PMPA' }
    }

    // Aplicaciones
    if (path.startsWith('/dashboard/ingreso-raciones')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Ingreso de Raciones' }
    if (path.startsWith('/dashboard/solicitud-pan')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Solicitud de Pan' }
    if (path.startsWith('/dashboard/solicitud-gas')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Solicitud de Gas' }
    if (path.startsWith('/dashboard/retiro-saldos')) return { modulo: 'Aplicaciones', detalle: 'Accedió a Retiro de Saldos' }

    // Áreas
    if (path.startsWith('/dashboard/areas/operaciones/elementos-esenciales')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Carga de Elementos Esenciales' }
    if (path.startsWith('/dashboard/areas/operaciones/descargas-pae')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Descargas PAE Online' }
    if (path.startsWith('/dashboard/areas/operaciones/cargar-pae')) return { modulo: 'Áreas -> Operaciones', detalle: 'Accedió a Cargar PaeOnline' }
    if (path.startsWith('/dashboard/areas/manipuladoras')) return { modulo: 'Áreas -> Manipuladoras', detalle: 'Accedió a Cálculo de Gramaje' }
    if (path.startsWith('/dashboard/areas/calidad/retorno-productos')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Retirada de Productos' }
    if (path.startsWith('/dashboard/areas/calidad/subir-actas-pae')) return { modulo: 'Áreas -> Calidad', detalle: 'Accedió a Subir Actas Estándar PAE' }
    if (path.startsWith('/dashboard/areas/multas')) {
        if (path.includes('/descargos')) return { modulo: 'Áreas -> Multas', detalle: 'Accedió a Descargos de Actas' }
        return { modulo: 'Áreas -> Multas', detalle: 'Accedió a Cálculos de Elementos Esenciales' }
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
        if (path.includes('/matriz-2026')) return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Matriz 2026' }
        return { modulo: 'Matriz de Riesgo', detalle: 'Accedió a Matriz de Riesgo' }
    }

    // Formularios
    if (path.startsWith('/dashboard/formularios')) return { modulo: 'Formularios', detalle: `Accedió a Formularios (${path})` }

    // Mantenedores
    if (path.startsWith('/dashboard/mantenedor') || path.startsWith('/dashboard/productos') || path.startsWith('/dashboard/calculadora')) {
        return { modulo: 'Mantenedor', detalle: `Accedió a Mantenedor (${path.replace('/dashboard/', '')})` }
    }

    // Configuración & Administración
    if (path.startsWith('/dashboard/users')) return { modulo: 'Administración', detalle: 'Accedió a Gestión de Usuarios' }
    if (path.startsWith('/dashboard/roles')) return { modulo: 'Administración', detalle: 'Accedió a Roles y Perfiles' }
    if (path.startsWith('/dashboard/configuracion')) return { modulo: 'Administración', detalle: `Accedió a Configuración (${path.replace('/dashboard/configuracion/', '')})` }

    // Reportes
    if (path.startsWith('/dashboard/reports')) return { modulo: 'Reportes', detalle: `Accedió a Reportes (${path.replace('/dashboard/reports/', '')})` }

    // Ayuda
    if (path.startsWith('/dashboard/ayuda')) return { modulo: 'Ayuda', detalle: 'Accedió al directorio de Anexos' }

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

    return null
}
