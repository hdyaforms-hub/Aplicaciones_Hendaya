import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import PresupuestoClient from './PresupuestoClient'

export default async function PresupuestoPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_presupuesto')) {
        redirect('/dashboard')
    }

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' }
    })

    const presupuestos = await prisma.presupuesto.findMany({
        include: { sucursal: true },
        orderBy: [{ ano: 'desc' }, { sucursal: { nombre: 'asc' } }]
    })

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-black">
            {/* Header section */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-bl-full -z-10 opacity-70" />
                
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200">💰</span>
                        Gestión de Presupuestos
                    </h2>
                    <p className="text-gray-500 mt-2 font-medium">Define, visualiza y actualiza el presupuesto anual por sucursal</p>
                </div>
            </div>

            <PresupuestoClient 
                sucursales={sucursales} 
                initialPresupuestos={presupuestos as any} 
            />
        </div>
    )
}
