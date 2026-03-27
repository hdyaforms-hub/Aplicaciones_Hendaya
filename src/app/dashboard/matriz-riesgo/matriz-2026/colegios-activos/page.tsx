import { getColegiosMatriz } from '../../actions'
import { getMatrizSemesterConfig } from './actions'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ColegiosActivosClient from './ColegiosActivosClient'

export default async function ColegiosActivosPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_colegios_matriz')) {
        redirect('/dashboard')
    }

    const { colegios, error } = await getColegiosMatriz()
    const { config } = await getMatrizSemesterConfig(2026)

    if (error) {
        return <div className="p-8 text-red-500 font-bold">{error}</div>
    }

    return <ColegiosActivosClient initialColegios={colegios || []} initialSemesterConfig={config} />
}
