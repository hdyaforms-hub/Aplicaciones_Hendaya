import { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SalaReunionesClient from './SalaReunionesClient'
import { getSalaData } from './actions'

export const metadata: Metadata = {
    title: 'Sala de Reuniones | Hendaya',
    description: 'Gestión y reserva de Sala de Reuniones con actualización en tiempo real, KPIs y calendario semanal.'
}

export const dynamic = 'force-dynamic'

function getMondayISO(d: Date): string {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    date.setDate(diff)
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default async function SalaReunionesPage() {
    const session = await getSession()
    if (!session || !session.user) {
        redirect('/login')
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    // Verificar permiso 'view_sala_reuniones' (los administradores siempre tienen acceso)
    if (!isAdmin && !permissions.includes('view_sala_reuniones')) {
        redirect('/dashboard')
    }

    const inicioSemana = getMondayISO(new Date())
    const initialData = await getSalaData(inicioSemana)

    return (
        <SalaReunionesClient initialData={initialData} />
    )
}
