
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import RetiroClient from './RetiroClient';

export default async function RetiroSaldosPage() {
    const session = await getSession();

    if (!session?.user?.role?.permissions.includes('view_retiro_saldos')) {
        redirect('/dashboard');
    }

    // Initial data for the client
    const user = session.user;
    
    // Fetch user's authorized sucursales to pass down
    const dbUser = await (prisma.user as any).findUnique({
        where: { id: user.id },
        include: { sucursales: true }
    });
    
    const sucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || [];

    return (
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <RetiroClient 
                userName={user.name || user.username} 
                userSucursales={sucursales}
            />
        </div>
    );
}
