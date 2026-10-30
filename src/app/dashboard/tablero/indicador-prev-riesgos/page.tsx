import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import IndicadorPrevRiesgosClient from './IndicadorPrevRiesgosClient'
import { getIndicadorPrevRiesgosData } from './actions'

export const metadata = {
    title: 'Tablero Indicadores Prevención de Riesgos | Hendaya',
    description: 'Tablero ejecutivo y operativo de tasas de accidentabilidad, siniestralidad, análisis por zona/sucursal, top 10 comunas y supervisores, y proyección DS 67.'
}

export default async function IndicadorPrevRiesgosPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    const isAdmin = roleName.includes('admin') || roleName.includes('gerencia')
    const permissions = session.user.role?.permissions || []

    if (!isAdmin && !permissions.includes('view_tablero_indicador_prev_riesgos')) {
        redirect('/dashboard')
    }

    const initialData = await getIndicadorPrevRiesgosData()

    return (
        <IndicadorPrevRiesgosClient
            initialData={initialData}
            currentUser={{
                username: session.user.username,
                name: session.user.name,
                roleName: session.user.role?.name
            }}
        />
    )
}

