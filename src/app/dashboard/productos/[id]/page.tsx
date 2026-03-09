import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EditProductoForm from './EditProductoForm'

export default async function EditProductoPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_productos')) {
        redirect('/dashboard')
    }

    const resolvedParams = await params

    const producto = await prisma.productos.findUnique({
        where: { id: resolvedParams.id }
    })

    if (!producto) {
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
                    <span className="text-4xl block mb-3 text-red-300">⚠️</span>
                    <h2 className="text-xl font-bold text-gray-800">Producto No Encontrado</h2>
                    <p className="text-gray-500 mt-2">El producto que estás intentando editar no existe o fue eliminado.</p>
                    <Link href="/dashboard/productos" className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">
                        ← Volver a Mantenedor
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <Link href="/dashboard/productos" className="text-gray-400 hover:text-cyan-600 transition-colors" title="Volver">←</Link>
                        <span>Editar Producto: <span className="text-cyan-600">{producto.codigo}</span></span>
                    </h2>
                    <p className="text-gray-500 mt-1 pl-8">Modifica los datos del producto: {producto.nombre}</p>
                </div>
            </div>

            <EditProductoForm producto={producto} />
        </div>
    )
}
