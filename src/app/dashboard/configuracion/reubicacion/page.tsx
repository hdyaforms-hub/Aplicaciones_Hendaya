import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getMenuStructure, checkAccess } from './actions'
import ReubicacionClient from './ReubicacionClient'

export const dynamic = 'force-dynamic'

export default async function ReubicacionPage() {
    const hasAccess = await checkAccess()

    if (!hasAccess) {
        redirect('/dashboard')
    }

    const structure = await getMenuStructure()

    return (
        <div className="max-w-4xl mx-auto py-6">
            <ReubicacionClient initialStructure={structure} />
        </div>
    )
}
