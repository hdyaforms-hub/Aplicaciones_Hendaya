import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SubirActasClient from './SubirActasClient'

export const metadata = {
    title: 'Subir Actas Estándar PAE | Calidad',
}

export default async function SubirActasPaePage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    const isAdmin = session?.user?.role?.name === 'admin' || session?.user?.role?.name === 'Administrador'
    const hasCalidad = session?.user?.areas?.some((a: any) => a.nombre.toLowerCase().includes('calidad'))
    const hasPerm = permissions.includes('view_calidad_subir_actas_estandar_pae')

    if (!isAdmin && !hasCalidad && !hasPerm) {
        redirect('/dashboard')
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            <SubirActasClient />
        </div>
    )
}
