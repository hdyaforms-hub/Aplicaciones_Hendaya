import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const mes = new Date().getMonth() + 1;
        const anio = new Date().getFullYear();

        await prisma.consumoApiGoogle.upsert({
            where: { mes_anio: { mes, anio } },
            create: { mes, anio, cantidad: 1 },
            update: { cantidad: { increment: 1 } }
        });
        
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) });
    }
}
