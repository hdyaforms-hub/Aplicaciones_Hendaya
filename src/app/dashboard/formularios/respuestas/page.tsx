import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getForms, getFormSubmissions } from '../actions'
import RespuestasClient from './RespuestasClient'

export const metadata = {
    title: 'Respuestas de Formularios | Sistema Hendaya'
}

export default async function RespuestasPage({
    searchParams
}: {
    searchParams: { formId?: string, username?: string, page?: string }
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_respuestas')) {
        redirect('/dashboard')
    }

    const { formId, username, page } = searchParams
    const forms = await getForms()
    const { submissions, total, totalPages, currentPage } = await getFormSubmissions({
        formId,
        username,
        page: page ? parseInt(page) : 1
    }) as any

    return (
        <div className="space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📋</span>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Respuestas de Formularios</h1>
                        <p className="text-sm text-gray-500 mt-1">Busca y descarga las respuestas enviadas por los usuarios.</p>
                    </div>
                </div>
            </header>

            <RespuestasClient 
                initialSubmissions={submissions}
                forms={forms}
                total={total}
                totalPages={totalPages}
                currentPage={currentPage}
            />
        </div>
    )
}
