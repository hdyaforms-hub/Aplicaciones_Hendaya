'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { ensureHomologacionPmpaTable } from '@/lib/homologacion-pmpa-db-init'

export interface CargaRacionDTO {
    id: string
    fechaIngreso: Date
    fechaSistema: Date
    rbd: number
    nombreEstablecimiento: string
    institucion: string
    ano: number
    mes: number
    programa: string
    programaHomologado: string
    estrato: string
    totalIng: number
    totalAsig: number
    tasaPreparacion: number
    observacion: string
    usuario: string
    usuarioNombre: string
}

export async function getCargaRacionesMetadata() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_reports')) {
        return { success: false, error: 'No tienes permisos para consultar esta información', instituciones: [] }
    }

    try {
        const allowedRbds = await getUserEffectiveRbds()
        const colegiosWhere: any = {}
        if (allowedRbds !== null) {
            colegiosWhere.colRBD = { in: allowedRbds }
        }

        const colegios = await prisma.colegios.findMany({
            where: colegiosWhere,
            select: { institucion: true }
        })

        const instituciones = Array.from(
            new Set(
                colegios
                    .map(c => (c.institucion || '').trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b))

        return { success: true, instituciones }
    } catch (error) {
        console.error('Error fetching metadata carga raciones:', error)
        return { success: false, error: 'Error al obtener filtros disponibles', instituciones: [] }
    }
}

export async function getCargaRaciones(ano?: number, mes?: number, rbd?: number, institucion?: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_reports')) {
        return { error: 'No tienes permisos para consultar esta información' }
    }

    try {
        await ensureHomologacionPmpaTable()

        const allowedRbds = await getUserEffectiveRbds()

        // Consultar colegios accesibles para obtener su institución y validar acceso
        const colegiosWhere: any = {}
        if (allowedRbds !== null) {
            colegiosWhere.colRBD = { in: allowedRbds }
        }

        const colegios = await prisma.colegios.findMany({
            where: colegiosWhere,
            select: { colRBD: true, institucion: true, nombreEstablecimiento: true }
        })

        // Mapa de RBD -> Institución y Establecimiento
        const rbdInstitucionMap = new Map<number, string>()
        const rbdNombreMap = new Map<number, string>()

        for (const col of colegios) {
            if (col.institucion) {
                rbdInstitucionMap.set(col.colRBD, col.institucion.trim())
            }
            if (col.nombreEstablecimiento) {
                rbdNombreMap.set(col.colRBD, col.nombreEstablecimiento.trim())
            }
        }

        // Determinar conjunto de RBDs permitidos tras aplicar filtro de institución
        let targetRbds: number[] | null = allowedRbds

        if (institucion && institucion !== 'TODAS') {
            const institucionUpper = institucion.trim().toUpperCase()
            const rbdsDeInstitucion = colegios
                .filter(c => (c.institucion || '').trim().toUpperCase() === institucionUpper)
                .map(c => c.colRBD)

            targetRbds = targetRbds !== null
                ? targetRbds.filter(r => rbdsDeInstitucion.includes(r))
                : rbdsDeInstitucion
        }

        const filters: any = {}
        if (ano) filters.ano = ano
        if (mes) filters.mes = mes

        if (rbd) {
            if (allowedRbds !== null && !allowedRbds.includes(rbd)) {
                return { error: 'No tienes acceso a este RBD' }
            }
            if (institucion && institucion !== 'TODAS' && targetRbds !== null && !targetRbds.includes(rbd)) {
                return { error: 'El RBD no pertenece a la institución seleccionada' }
            }
            filters.rbd = rbd
        } else if (targetRbds !== null) {
            filters.rbd = { in: targetRbds }
        }

        const rawRegistros = await prisma.ingRacion.findMany({
            where: filters,
            orderBy: [
                { fechaIngreso: 'desc' },
                { rbd: 'asc' }
            ]
        })

        // Cargar mapa de homologación de programas desde PMPA_Homologacion_Programas
        const homologaciones = (await rawPrisma.$queryRawUnsafe(`
            SELECT "programaPmpa", "servicioPmpa", "codigoHomologado"
            FROM "PMPA_Homologacion_Programas"
        `)) as Array<{ programaPmpa: string; servicioPmpa: string; codigoHomologado: string }>

        const homologMap = new Map<string, string>()
        for (const h of homologaciones) {
            const cod = (h.codigoHomologado || '').trim()
            if (!cod) continue
            const prog = (h.programaPmpa || '').trim().toUpperCase()
            const serv = (h.servicioPmpa || '').trim().toUpperCase()
            if (prog && serv) {
                homologMap.set(`${prog}:::${serv}`, cod)
            }
            if (prog && !homologMap.has(prog)) {
                homologMap.set(prog, cod)
            }
        }

        // Cargar nombres de usuarios desde el modelo User
        const distinctUsernames = Array.from(new Set(rawRegistros.map(r => (r.usuario || '').trim()).filter(Boolean)))
        const users = distinctUsernames.length > 0
            ? await prisma.user.findMany({
                where: { username: { in: distinctUsernames } },
                select: { username: true, name: true }
            })
            : []

        const userNamesMap = new Map<string, string>()
        for (const u of users) {
            if (u.username) {
                userNamesMap.set(u.username.toLowerCase(), u.name?.trim() || u.username)
            }
        }

        const registros: CargaRacionDTO[] = rawRegistros.map(r => {
            const progUpper = (r.programa || '').trim().toUpperCase()
            const programaHomologado = homologMap.get(progUpper) || r.programa

            const institucionRow = rbdInstitucionMap.get(r.rbd) || 'JUNAEB'
            const usernameKey = (r.usuario || '').trim().toLowerCase()
            const usuarioNombre = userNamesMap.get(usernameKey) || r.usuario

            return {
                id: r.id,
                fechaIngreso: r.fechaIngreso,
                fechaSistema: r.fechaSistema,
                rbd: r.rbd,
                nombreEstablecimiento: r.nombreEstablecimiento || rbdNombreMap.get(r.rbd) || '',
                institucion: institucionRow,
                ano: r.ano,
                mes: r.mes,
                programa: r.programa,
                programaHomologado,
                estrato: r.estrato,
                totalIng: r.totalIng,
                totalAsig: r.totalAsig,
                tasaPreparacion: r.tasaPreparacion,
                observacion: r.observacion,
                usuario: r.usuario,
                usuarioNombre
            }
        })

        return { registros }
    } catch (error) {
        console.error("Error fetching Informe Carga Raciones:", error)
        return { error: 'Ocurrió un error al cargar el informe.' }
    }
}
