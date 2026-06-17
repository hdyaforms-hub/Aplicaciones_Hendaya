import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import HojaBClient from './HojaBClient'

export const metadata = {
    title: 'Hoja B Estándar PAE | HendayaForms',
    description: 'Reporte Hoja B Estándar PAE',
}

export default async function HojaBPage() {
    const session = await getSession()

    if (!session?.user) {
        redirect('/')
    }

    const hasPermission = session.user.role.permissions.includes('view_hoja_b_estandar_pae')
    if (!hasPermission) {
        redirect('/dashboard')
    }

    return (
        <main className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
                Hoja B Estándar PAE
            </h1>
            <HojaBClient />
        </main>
    )
}
