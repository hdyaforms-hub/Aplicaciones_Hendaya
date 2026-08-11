import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import VerificadorTemperaturasDashboardClient from './VerificadorTemperaturasDashboardClient'

export default async function TableroVerificadorTemperaturasPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    const isAdmin = roleName.includes('admin')
    
    let permissions: string[] = []
    if (session.user.role?.permissions) {
        try {
            permissions = typeof session.user.role.permissions === 'string'
                ? JSON.parse(session.user.role.permissions)
                : session.user.role.permissions
        } catch { permissions = [] }
    }

    const canView = isAdmin || permissions.includes('view_tablero_verificador_temperaturas') || permissions.includes('view_tablero')
    if (!canView) {
        redirect('/dashboard')
    }

    const userSucursalIds = session.user.sucursalIds || []

    const whereCondition = (!isAdmin && userSucursalIds.length > 0)
        ? { idEntidad: { in: userSucursalIds } }
        : {}

    const registros = await prisma.vTRegistroCabecera.findMany({
        where: whereCondition,
        include: {
            configuraciones: true,
            detalles: true,
            verificacionesDiarias: true,
            verificacionesSemanales: true
        },
        orderBy: { fechaCreacion: 'desc' }
    })

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true }
    })

    await logAuditAction({
        username: session.user.name || session.user.username || 'Usuario',
        userId: session.user.id || null,
        action: 'ACCESO_TABLERO_VERIFICADOR_TEMPERATURAS',
        modulo: 'TABLEROS Y AVANCES -> VERIFICADOR DE TEMPERATURAS',
        detalle: `Accedió al Tablero de Analítica y Variación de Temperaturas`
    })

    const formattedRegistros = registros.map(r => ({
        idRegistro: r.idRegistro,
        tipoEntidad: r.tipoEntidad,
        idEntidad: r.idEntidad,
        nombreEntidad: r.nombreEntidad,
        anio: r.anio,
        fechaRegistro: r.fechaRegistro,
        monitorResponsable: r.monitorResponsable,
        tipoCamara: r.tipoCamara,
        descripcionCamaras: r.descripcionCamaras,
        fechaCreacion: r.fechaCreacion,
        usuarioCreacion: r.usuarioCreacion,
        configuraciones: r.configuraciones,
        detalles: r.detalles,
        verificacionesDiarias: r.verificacionesDiarias,
        verificacionesSemanales: r.verificacionesSemanales
    }))

    return (
        <VerificadorTemperaturasDashboardClient
            registros={formattedRegistros}
            sucursales={sucursales}
            currentUser={session.user.name || session.user.username || 'Usuario'}
        />
    )
}
