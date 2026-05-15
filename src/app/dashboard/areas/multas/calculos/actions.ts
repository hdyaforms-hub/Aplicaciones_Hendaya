'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Utility to check permissions
async function checkPermission(permission: string) {
    const session = await getSession()
    if (!session) return false
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })
    if (!user) return false
    const permissions = JSON.parse(user.role.permissions as string)
    return permissions.includes(permission)
}

export async function getFoliosIncompletos(params: { 
    search?: string, 
    rbd?: string, 
    mes?: string, 
    ano?: string, 
    licitacion?: string, 
    folio?: string, 
    estadoCalculo?: string,
    disponibilidad?: string
}) {
    if (!await checkPermission('manage_calculos_ee')) return { error: 'No tienes permisos.' }

    try {
        const whereClause: any = {
            detalles: {
                some: {
                    nc: 'X'
                }
            }
        }

        // Search logic: RBD, Folio or School Name
        if (params.rbd) {
            whereClause.rbd = parseInt(params.rbd)
        } else if (params.search) {
            const searchTerm = params.search.toUpperCase()
            const isNumeric = /^\d+$/.test(params.search)

            if (isNumeric) {
                // If it's numeric, search by EXACT RBD only
                whereClause.rbd = parseInt(params.search)
            } else {
                // If it's text, search by School Name or Folio
                const matchingSchools = await prisma.colegiosMatriz.findMany({
                    where: {
                        OR: [
                            { nombreEstablecimiento: { contains: searchTerm } },
                            { sucursal: { contains: searchTerm } }
                        ]
                    },
                    select: { colRBD: true }
                })
                const matchingRBDs = matchingSchools.map(s => s.colRBD)

                whereClause.OR = [
                    { rbd: { in: matchingRBDs } },
                    { folio: { contains: params.search } }
                ]
            }
        }

        if (params.licitacion) whereClause.licitacion = { contains: params.licitacion }
        if (params.folio) whereClause.folio = { contains: params.folio }

        // Fetch the records
        let folios = await prisma.elementosEsenciales_Cab.findMany({
            where: whereClause,
            select: {
                id: true,
                licitacion: true,
                folio: true,
                fechaSupervision: true,
                rbd: true,
                link: true,
                servicio: true,
                licId: true
            },
            orderBy: { fechaSupervision: 'desc' }
        })

        // Filter by month/year if provided (since fechaSupervision is a DateTime)
        if (params.mes && params.mes !== 'Todos los meses') {
            const mesIndex = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ].indexOf(params.mes) + 1
            
            if (mesIndex > 0) {
                folios = folios.filter(f => f.fechaSupervision?.getMonth() + 1 === mesIndex)
            }
        }
        
        if (params.ano && params.ano.trim() !== '') {
            const anoInt = parseInt(params.ano)
            if (!isNaN(anoInt)) {
                folios = folios.filter(f => f.fechaSupervision?.getFullYear() === anoInt)
            }
        }

        if (folios.length === 0) return { data: [] }

        // Fetch School Names, Calculation Status, Formulas and PMPA
        const validFolios = folios.map(f => f.folio).filter(Boolean) as string[]
        const validRBDs = Array.from(new Set(folios.map(f => f.rbd).filter(Boolean))) as number[]
        const validLicIds = Array.from(new Set(folios.map(f => f.licId).filter(Boolean))) as number[]

        // Fetch in parallel for speed
        const [calculos, schools, aspectos, pmpas, servicios] = await Promise.all([
            prisma.multas_Elementos_Esenciales_Cab.findMany({
                where: { folioOriginal: { in: validFolios } }
            }),
            prisma.colegiosMatriz.findMany({
                where: { colRBD: { in: validRBDs } },
                select: { colRBD: true, nombreEstablecimiento: true }
            }),
            prisma.aspectoEE.findMany({
                where: { licId: { in: validLicIds } }
            }),
            prisma.pMPA.findMany({
                where: { rbd: { in: validRBDs } },
                select: { rbd: true, ano: true, mes: true, licitacion: true, servicio: true }
            }),
            prisma.multaServicio.findMany()
        ])

        let result = folios.map(f => {
            const calculo = calculos.find(c => c.folioOriginal === f.folio)
            const school = schools.find(s => s.colRBD === f.rbd)
            
            // Validation Logic
            const rbd = f.rbd
            const fecha = f.fechaSupervision ? new Date(f.fechaSupervision) : null
            const anho = fecha?.getFullYear()
            const mes = fecha ? fecha.getMonth() + 1 : null
            const licId = f.licId
            const rawServicio = (f as any).servicio || ''

            // 1. Service Code Extraction
            let serviceCode = null
            const sMatch = rawServicio.match(/\(([A-Z])\)/)
            if (sMatch) serviceCode = sMatch[1]
            if (!serviceCode) {
                const foundS = servicios.find(s => rawServicio.toLowerCase().includes(s.nombre.toLowerCase()) || rawServicio.toUpperCase() === s.codigo)
                if (foundS) serviceCode = foundS.codigo
            }

            // 2. Check PMPA
            let missingPmpa = false
            if (rbd && anho && mes && licId && serviceCode) {
                const hasPmpa = pmpas.some(p => 
                    p.rbd === rbd && 
                    p.ano === anho && 
                    p.mes === mes && 
                    p.licitacion === licId && 
                    p.servicio === serviceCode
                )
                missingPmpa = !hasPmpa
            } else {
                missingPmpa = true 
            }

            // 3. Check Formulas (AspectoEE)
            let missingFormula = false
            const formulasForLic = aspectos.filter(a => a.licId === licId)
            if (formulasForLic.length === 0) {
                missingFormula = true
            }

            return {
                ...f,
                nombreEstablecimiento: school?.nombreEstablecimiento || 'Desconocido',
                calculoEstado: calculo ? calculo.estadoCalculo : 'PENDIENTE',
                montoCalculado: calculo ? calculo.montoTotalCalculado : 0,
                missingPmpa,
                missingFormula
            }
        })

        // Apply Calculation Status filter if provided
        if (params.estadoCalculo && params.estadoCalculo !== 'Todos') {
            result = result.filter(r => r.calculoEstado === params.estadoCalculo)
        }

        // Apply Availability filter
        if (params.disponibilidad && params.disponibilidad !== 'Todos') {
            if (params.disponibilidad === 'LISTO') {
                result = result.filter(r => !r.missingFormula && !r.missingPmpa)
            } else if (params.disponibilidad === 'FALTANTE') {
                result = result.filter(r => r.missingFormula || r.missingPmpa)
            }
        }

        // JSON.parse(JSON.stringify) prevents Next.js serialization errors with Dates/Prisma objects
        const safeResult = JSON.parse(JSON.stringify(result))

        return { data: safeResult }

    } catch (error: any) {
        console.error('Error in getFoliosIncompletos:', error)
        return { error: 'Error al obtener folios: ' + (error.message || 'Desconocido') }
    }
}

export async function calculateAll(params: { search?: string, mes?: string, ano?: string, licitacion?: string, folio?: string }) {
    if (!await checkPermission('manage_calculos_ee')) return { error: 'No tienes permisos.' }
    const session = await getSession()
    if (!session) return { error: 'No autorizado' }

    try {
        // 1. Get ALL matching folios (without take limit)
        const whereClause: any = { detalles: { some: { nc: 'X' } } }
        if (params.search) {
            whereClause.OR = [
                { rbd: { equals: parseInt(params.search) || 0 } },
                { folio: { contains: params.search } }
            ]
        }
        if (params.licitacion) whereClause.licitacion = { contains: params.licitacion }
        if (params.folio) whereClause.folio = { contains: params.folio }

        let folios = await prisma.elementosEsenciales_Cab.findMany({
            where: whereClause,
            include: { detalles: { where: { nc: 'X' } } },
            orderBy: { fechaSupervision: 'desc' }
        })

        // Apply Month/Year filters in JS
        if (params.mes && params.mes !== 'Todos los meses') {
            const mesIdx = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].indexOf(params.mes) + 1
            if (mesIdx > 0) folios = folios.filter(f => f.fechaSupervision?.getMonth() + 1 === mesIdx)
        }
        if (params.ano) {
            const anoInt = parseInt(params.ano)
            folios = folios.filter(f => f.fechaSupervision?.getFullYear() === anoInt)
        }

        if (folios.length === 0) return { count: 0 }

        // 2. Prepare for massive calculation
        const allLicIds = Array.from(new Set(folios.map(f => f.licId).filter(Boolean))) as number[]
        const allAspectos = await prisma.aspectoEE.findMany({ where: { licId: { in: allLicIds } } })
        const allUtms = await prisma.uTM.findMany()
        const allServicios = await prisma.multaServicio.findMany()

        let count = 0
        // Process in chunks to avoid overwhelming the DB/Memory
        const CHUNK_SIZE = 50
        for (let i = 0; i < folios.length; i += CHUNK_SIZE) {
            const chunk = folios.slice(i, i + CHUNK_SIZE)
            
            await Promise.all(chunk.map(async (cab) => {
                const rbd = cab.rbd
                const fecha = cab.fechaSupervision
                const licId = cab.licId
                const rawServicio = cab.servicio || ''
                if (!rbd || !fecha || !licId) return

                // Service Code
                let serviceCode = null
                const sMatch = rawServicio.match(/\(([A-Z])\)/)
                if (sMatch) serviceCode = sMatch[1]
                if (!serviceCode) {
                    const fS = allServicios.find(s => rawServicio.toLowerCase().includes(s.nombre.toLowerCase()) || rawServicio.toUpperCase() === s.codigo)
                    if (fS) serviceCode = fS.codigo
                }
                if (!serviceCode) return

                // UTM & PMPA
                const anho = fecha.getFullYear()
                const mes = fecha.getMonth() + 1
                const utmVal = allUtms.find(u => u.anho === anho && u.mes === mes)?.monto || 0
                
                const pmpas = await prisma.pMPA.findMany({
                    where: { rbd, ano: anho, mes, licitacion: licId, servicio: serviceCode }
                })
                const raciones = pmpas.reduce((acc, curr) => acc + curr.raceqJunaeb, 0)

                // Calculate each NC aspect
                let totalMonto = 0
                const detallesCalc = []
                const formulasForLic = allAspectos.filter(a => a.licId === licId)

                for (const d of cab.detalles) {
                    const letraMatch = d.aspecto?.match(/^([A-Z])\./)
                    const letra = letraMatch ? letraMatch[1] : null
                    const formula = formulasForLic.find(f => f.letra === letra)?.formula
                    if (!formula) continue

                    // Evaluation logic (simplified)
                    try {
                        const cleanFormula = formula.toUpperCase()
                        let evalForm = cleanFormula
                            .replace(/UTM/g, utmVal.toString())
                            .replace(/RACIONES/g, raciones.toString())
                            .replace(/NIVELCONTROLADO/g, raciones.toString()) // Default to raciones
                            .replace(/MATERIAPRIMA/g, "1") // Default as requested
                            .replace(/INSTRUMENTO/g, "1")
                            .replace(/MANIPULADORA/g, "1")
                            .replace(/CANTSERVICIO/g, "1")
                            .replace(/ELEMENTOS/g, "1")

                        // Basic math eval
                        const result = eval(evalForm.replace(/[^0-9+\-*/().]/g, ''))
                        totalMonto += Number(result) || 0

                        detallesCalc.push({
                            letraAspecto: letra || '?',
                            descripcion: d.observacionesOMedioDeVerificacion,
                            formulaAplicada: evalForm,
                            montoMulta: Number(result) || 0,
                            variablesUsadas: JSON.stringify({ raciones, utm: utmVal, default: '1' })
                        })
                    } catch (e) {
                        console.error('Error eval massive:', e)
                    }
                }

                // Save
                await prisma.multas_Elementos_Esenciales_Cab.upsert({
                    where: { folioOriginal: cab.folio! },
                    update: {
                        montoTotalCalculado: totalMonto,
                        estadoCalculo: 'CALCULO_MASIVO',
                        usuarioCalculo: session.user.username,
                        fechaCalculo: new Date(),
                        detalles: {
                            deleteMany: {},
                            create: detallesCalc
                        }
                    },
                    create: {
                        folioOriginal: cab.folio!,
                        rbd: rbd,
                        fechaSupervision: fecha,
                        licitacion: cab.licitacion,
                        montoTotalCalculado: totalMonto,
                        estadoCalculo: 'CALCULO_MASIVO',
                        usuarioCalculo: session.user.username,
                        detalles: {
                            create: detallesCalc
                        }
                    }
                })
                count++
            }))
        }

        return { count }

    } catch (error: any) {
        console.error('Error calculateAll:', error)
        return { error: 'Error en el cálculo masivo: ' + error.message }
    }
}

export async function getDetalleFolioParaCalculo(folio: string) {
    if (!await checkPermission('manage_calculos_ee')) return { error: 'No tienes permisos.' }

    try {
        const cab = await prisma.elementosEsenciales_Cab.findFirst({
            where: { folio },
            include: {
                detalles: true
            }
        })

        if (!cab) return { error: 'Folio no encontrado.' }

        // Find formulas for this licitacion
        const licId = cab.licId
        const aspectosFormulas = await prisma.aspectoEE.findMany({
            where: { licId: licId ?? -1 }
        })

        // We need all details that are NC=X, OR details that have NO X in any (CO, NC, NA)
        const detallesRelevantes = cab.detalles.filter(d => 
            d.nc === 'X' || (!d.co && !d.nc && !d.na)
        )

        // Enhance with formula info
        const detallesConFormula = detallesRelevantes.map(d => {
            const letraMatch = d.aspecto?.match(/^([A-Z])\./)
            const letra = letraMatch ? letraMatch[1] : null
            const formulaObj = aspectosFormulas.find(af => af.letra === letra)

            return {
                ...d,
                letraAspecto: letra,
                formulaAsignada: formulaObj ? formulaObj.formula : null,
                incompleto: (!d.co && !d.nc && !d.na) // Flag if it's missing X
            }
        })

        // Check if PMPA is available and fetch values
        const anho = cab.fechaSupervision?.getFullYear()
        const mes = cab.fechaSupervision ? cab.fechaSupervision.getMonth() + 1 : 0
        const rbd = cab.rbd
        
        let pmpaRecord: any = null
        let utmRecord: any = null

        if (anho && mes && rbd) {
            // 1. UTM
            utmRecord = await prisma.uTM.findUnique({
                where: { anho_mes: { anho, mes } }
            })

            // 2. Raciones (PMPA)
            // Extract service code
            const rawServicio = cab.servicio || ''
            let serviceCode = null
            const sMatch = rawServicio.match(/\(([A-Z])\)/)
            if (sMatch) serviceCode = sMatch[1]
            
            if (!serviceCode) {
                const servicios = await prisma.multaServicio.findMany()
                const foundS = servicios.find(s => rawServicio.toLowerCase().includes(s.nombre.toLowerCase()) || rawServicio.toUpperCase() === s.codigo)
                if (foundS) serviceCode = foundS.codigo
            }

            if (serviceCode) {
                pmpaRecord = await prisma.pMPA.findFirst({
                    where: { rbd, ano: anho, mes, servicio: serviceCode }
                })
            }
        }

        // Parse reserved keywords from formulas
        const keywordsNeeded = new Set<string>()
        const RESERVED_KEYWORDS = ['MATERIAPRIMA', 'INSTRUMENTO', 'MANIPULADORA', 'NIVELCONTROLADO', 'CANTSERVICIO', 'ELEMENTOS']
        
        detallesConFormula.forEach(d => {
            if (d.formulaAsignada) {
                const words = d.formulaAsignada.match(/[A-Za-z]+/g) || []
                words.forEach(w => {
                    const upper = w.toUpperCase()
                    if (RESERVED_KEYWORDS.includes(upper)) {
                        keywordsNeeded.add(upper)
                    }
                })
            }
        })

        return {
            data: cab,
            detalles: detallesConFormula,
            hasPmpa: !!pmpaRecord,
            utmValue: utmRecord?.monto || 0,
            utmPeriod: utmRecord ? `${mes}/${anho}` : 'N/D',
            racionesValue: pmpaRecord?.raceqJunaeb || 0,
            keywordsNeeded: Array.from(keywordsNeeded)
        }

    } catch (error) {
        console.error('Error getDetalleFolioParaCalculo:', error)
        return { error: 'Error al obtener el detalle del folio.' }
    }
}

export async function saveCalculo(folio: string, rbd: number, fechaSupervision: string, licitacion: string, montoTotal: number, estadoCalculo: string, detallesCalculados: any[]) {
    const session = await getSession()
    if (!session) return { error: 'No autorizado' }

    try {
        // We use upsert so it can be recalculated if needed
        const result = await prisma.multas_Elementos_Esenciales_Cab.upsert({
            where: { folioOriginal: folio },
            update: {
                montoTotalCalculado: montoTotal,
                estadoCalculo: estadoCalculo,
                usuarioCalculo: session.user.username,
                fechaCalculo: new Date(),
                detalles: {
                    deleteMany: {}, // Clear old details
                    create: detallesCalculados.map(d => ({
                        letraAspecto: d.letraAspecto || '?',
                        descripcion: d.descripcion,
                        formulaAplicada: d.formulaAplicada,
                        montoMulta: d.montoMulta,
                        variablesUsadas: JSON.stringify(d.variablesUsadas || {})
                    }))
                }
            },
            create: {
                folioOriginal: folio,
                rbd: rbd,
                fechaSupervision: new Date(fechaSupervision),
                licitacion: licitacion,
                montoTotalCalculado: montoTotal,
                estadoCalculo: estadoCalculo,
                usuarioCalculo: session.user.username,
                detalles: {
                    create: detallesCalculados.map(d => ({
                        letraAspecto: d.letraAspecto || '?',
                        descripcion: d.descripcion,
                        formulaAplicada: d.formulaAplicada,
                        montoMulta: d.montoMulta,
                        variablesUsadas: JSON.stringify(d.variablesUsadas || {})
                    }))
                }
            }
        })
        
        return { success: true }
    } catch (error) {
        console.error('Error al guardar calculo:', error)
        return { error: 'Error al guardar el cálculo en la base de datos.' }
    }
}

export async function getSchoolSuggestions(search: string) {
    if (!search || search.length < 2) return { data: [] }
    
    try {
        const searchTerm = search.toUpperCase()
        const schools = await prisma.colegiosMatriz.findMany({
            where: {
                OR: [
                    { nombreEstablecimiento: { contains: searchTerm } },
                    { colRBD: { equals: parseInt(searchTerm) || 0 } }
                ]
            },
            select: {
                colRBD: true,
                nombreEstablecimiento: true
            },
            take: 10,
            orderBy: { nombreEstablecimiento: 'asc' }
        })
        
        return { data: schools }
    } catch (error) {
        console.error('Error getSchoolSuggestions:', error)
        return { error: 'Error al buscar sugerencias.' }
    }
}
