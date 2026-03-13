
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function getRetiroDashboardData(filters: {
    year: number
    month?: number
    sucursal?: string
    rbd?: number
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_tablero_retiro')) {
        return { error: 'No tienes permisos para ver este tablero' }
    }

    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales.map(s => s.nombre) || []
        const isAdmin = session.user.role.name === 'Administrador'

        // Base where clause
        let where: any = {
            fecha: {
                gte: new Date(filters.year, filters.month ? filters.month - 1 : 0, 1),
                lt: new Date(filters.year, filters.month ? filters.month : 12, 1)
            }
        }

        // Apply Sucursal filter
        if (!isAdmin) {
            where.sucursal = { in: userSucursales }
        }
        if (filters.sucursal) {
            where.sucursal = filters.sucursal
        }

        // Apply RBD filter
        if (filters.rbd) {
            where.rbd = Number(filters.rbd)
        }

        // Fetch Data
        const headers = await prisma.retiroSaldoHeader.findMany({
            where,
            include: { detalles: true }
        })

        // Aggregations
        const totalRegistros = headers.length
        const totalItems = headers.reduce((acc, h) => acc + h.detalles.reduce((sum, d) => sum + d.cantidad, 0), 0)
        
        // Operation Type Distribution
        const typeDistribution = {
            'Retiro de saldo': headers.filter(h => h.tipoOperacion === 'Retiro de saldo').length,
            'Rebaja de Stock': headers.filter(h => h.tipoOperacion === 'Rebaja de Stock').length
        }

        // Top 10 Products
        const productMap: Record<string, { nombre: string, total: number }> = {}
        headers.forEach(h => {
            h.detalles.forEach(d => {
                if (!productMap[d.codigoProducto]) {
                    productMap[d.codigoProducto] = { nombre: d.nombreProducto, total: 0 }
                }
                productMap[d.codigoProducto].total += d.cantidad
            })
        })
        const top10Products = Object.values(productMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)

        // Top Schools
        const schoolMap: Record<number, { nombre: string, count: number }> = {}
        headers.forEach(h => {
            if (!schoolMap[h.rbd]) {
                schoolMap[h.rbd] = { nombre: h.nombreEstablecimiento, count: 0 }
            }
            schoolMap[h.rbd].count++
        })
        const topSchools = Object.values(schoolMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

        // Monthly Trend (Current Year)
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        const trendData = months.map((m, i) => {
            const monthHeaders = headers.filter(h => new Date(h.fecha).getMonth() === i)
            return {
                month: m,
                registros: monthHeaders.length,
                items: monthHeaders.reduce((acc, h) => acc + h.detalles.reduce((sum, d) => sum + d.cantidad, 0), 0)
            }
        })

        // Growth Calculation (Current vs Previous Month)
        let growth = 0
        const now = new Date()
        const currentMonth = filters.month || (now.getMonth() + 1)
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
        const prevYear = currentMonth === 1 ? filters.year - 1 : filters.year

        const currentMonthCount = headers.filter(h => new Date(h.fecha).getMonth() === (currentMonth - 1)).length
        
        const prevMonthWhere = { ...where, fecha: {
            gte: new Date(prevYear, prevMonth - 1, 1),
            lt: new Date(prevYear, prevMonth, 1)
        }}
        const prevMonthCount = await prisma.retiroSaldoHeader.count({ where: prevMonthWhere })

        if (prevMonthCount > 0) {
            growth = ((currentMonthCount - prevMonthCount) / prevMonthCount) * 100
        } else if (currentMonthCount > 0) {
            growth = 100
        }

        return {
            stats: {
                totalRegistros,
                totalItems,
                avgItemsPerReg: totalRegistros > 0 ? (totalItems / totalRegistros).toFixed(1) : 0,
                growth
            },
            charts: {
                trend: trendData,
                products: top10Products,
                schools: topSchools,
                types: Object.entries(typeDistribution).map(([name, value]) => ({ name, value }))
            },
            userSucursales
        }
    } catch (error) {
        console.error('Error in getRetiroDashboardData:', error)
        return { error: 'Error al cargar los datos del tablero' }
    }
}
