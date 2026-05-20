import DescargasPaeClient from './DescargasPaeClient'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Descargas PAE Online | Hendaya',
    description: 'Generación y descarga de informes PAE',
}

export default async function DescargasPaePage() {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    // Role check
    if (!session.user?.role?.permissions.includes('view_operaciones_descargas_pae')) {
        redirect('/dashboard');
    }
    
    return (
        <div className="p-6 h-full overflow-y-auto">
            <DescargasPaeClient />
        </div>
    )
}
