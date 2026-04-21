import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import RetornoClient from './RetornoClient'
import { getAlertas } from './actions'

export default async function RetornoProductosPage() {
    const session = await getSession()
    
    // Obtener usuario completo con sus áreas asignadas
    const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { 
            role: true, 
            areas: true,
            sucursales: true 
        }
    })

    if (!dbUser) redirect('/dashboard')

    const roleName = dbUser.role?.name || ''
    const isAdmin = roleName === 'Administrador' || roleName === 'admin'
    const hasCalidad = dbUser.areas.some(a => a.nombre.toLowerCase().includes('calidad'))
    const hasSucursal = dbUser.sucursales.length > 0
    const hasPerm = dbUser.role?.permissions.includes('view_retorno_productos')

    // Validar permiso de visualización general
    if (!(isAdmin || hasCalidad || hasSucursal || hasPerm)) {
        redirect('/dashboard')
    }



    const alertas = await getAlertas()

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-8 rounded-3xl shadow-sm border border-amber-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl" />
                
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-amber-900 tracking-tight flex items-center gap-3">
                        <span className="text-4xl drop-shadow-md">📌</span> Retirada de productos
                    </h1>
                    <p className="text-amber-800/70 mt-2 font-medium max-w-2xl">
                        Gestiona y monitorea las alertas de calidad en todas las sucursales a través de este tablero interactivo.
                    </p>
                </div>
            </div>

            <RetornoClient alertas={alertas} user={dbUser as any} />
        </div>
    )
}
