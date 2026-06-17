import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import MatrizResponderClient from './MatrizResponderClient'

export const metadata = {
    title: 'Llenar Matriz de Riesgo | AplicacionWeb',
}

async function getMatrixData(id: string) {
    const matrix = await prisma.matrizT_Cabecera.findUnique({
        where: { id },
        include: {
            detalles: {
                orderBy: { orden: 'asc' }
            }
        }
    })
    return matrix
}

async function getUtsAndRbds(licId: number) {
    // Get all UTs for this licitacion
    const uts = await prisma.uT.findMany({
        where: { licId: licId, estado: 1 },
        select: { codUT: true }
    })
    
    // Get all colegios
    const colegios = await prisma.colegios.findMany({
        select: { colut: true, colRBD: true, nombreEstablecimiento: true }
    })
    
    return { uts, colegios }
}

export default async function IngresarMatrizFillPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const { id } = await params
    const matrix = await getMatrixData(id)

    if (!matrix || !matrix.estado) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-red-100">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Matriz no disponible</h2>
                <p className="text-slate-500">La matriz solicitada no existe o no se encuentra vigente.</p>
            </div>
        )
    }

    const { uts, colegios } = await getUtsAndRbds(matrix.licId)

    return (
        <div className="max-w-5xl mx-auto py-8 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{matrix.titulo}</h1>
                <p className="text-sm text-slate-500">Licitación: {matrix.licId} • Año: {matrix.anio}</p>
            </div>

            <MatrizResponderClient 
                matrix={matrix} 
                uts={uts} 
                colegios={colegios} 
                sessionUser={{ name: session.user.name || session.user.username, email: session.user.email || '', username: session.user.username }} 
            />
        </div>
    )
}
