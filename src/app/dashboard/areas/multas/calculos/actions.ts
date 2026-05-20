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
                servicioManual: true,
                observacionManualServicio: true,
                esServicioManual: true,
                licId: true,
                detalles: {
                    where: { nc: 'X' },
                    select: { id: true, aspecto: true }
                }
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
                folios = folios.filter(f => f.fechaSupervision && f.fechaSupervision.getMonth() + 1 === mesIndex)
            }
        }
        
        if (params.ano && params.ano.trim() !== '') {
            const anoInt = parseInt(params.ano)
            if (!isNaN(anoInt)) {
                folios = folios.filter(f => f.fechaSupervision && f.fechaSupervision.getFullYear() === anoInt)
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
                where: { folioOriginal: { in: validFolios } },
                include: { detalles: true }
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
            const rawServicio = f.esServicioManual ? (f.servicioManual || '') : ((f as any).servicio || '')

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

            // Group non-compliant details by Solucionable / No Solucionable
            let ncSolucionableCount = 0
            let ncNoSolucionableCount = 0
            if (f.detalles) {
                for (const d of f.detalles) {
                    const letraMatch = d.aspecto?.match(/^([A-Z])\./)
                    const letra = letraMatch ? letraMatch[1] : null
                    const asp = formulasForLic.find(form => form.letra === letra)
                    if (asp && asp.solucionable === 'Solucionable') {
                        ncSolucionableCount++
                    } else {
                        ncNoSolucionableCount++
                    }
                }
            }

            // Compute actual calculated amounts grouped by Solucionable / No Solucionable
            let montoSolucionable = 0
            let montoNoSolucionable = 0
            if (calculo && (calculo as any).detalles) {
                for (const d of (calculo as any).detalles) {
                    const asp = formulasForLic.find(form => form.letra === d.letraAspecto)
                    if (asp && asp.solucionable === 'Solucionable') {
                        montoSolucionable += d.montoMulta || 0
                    } else {
                        montoNoSolucionable += d.montoMulta || 0
                    }
                }
            }

            return {
                ...f,
                nombreEstablecimiento: school?.nombreEstablecimiento || 'Desconocido',
                calculoEstado: calculo ? calculo.estadoCalculo : 'PENDIENTE',
                montoCalculado: calculo ? calculo.montoTotalCalculado : 0,
                missingPmpa,
                missingFormula,
                ncCount: f.detalles?.length || 0,
                ncSolucionableCount,
                ncNoSolucionableCount,
                montoSolucionable,
                montoNoSolucionable
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

export async function calculateAll(params: { search?: string, mes?: string, ano?: string, licitacion?: string, folio?: string, estadoCalculo?: string, disponibilidad?: string }) {
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
            if (mesIdx > 0) folios = folios.filter(f => f.fechaSupervision && f.fechaSupervision.getMonth() + 1 === mesIdx)
        }
        if (params.ano) {
            const anoInt = parseInt(params.ano)
            folios = folios.filter(f => f.fechaSupervision && f.fechaSupervision.getFullYear() === anoInt)
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
                const rawServicio = cab.esServicioManual ? (cab.servicioManual || '') : (cab.servicio || '')
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

                // 1. Fetch existing saved variables if any
                let savedVars: Record<string, string> = {}
                try {
                    const existing = await prisma.multas_Elementos_Esenciales_Cab.findUnique({
                        where: { folioOriginal: cab.folio! },
                        include: { detalles: true }
                    })
                    if (existing && existing.detalles.length > 0) {
                        const firstWithVars = existing.detalles.find(d => d.variablesUsadas)
                        if (firstWithVars && firstWithVars.variablesUsadas) {
                            savedVars = JSON.parse(firstWithVars.variablesUsadas)
                        }
                    }
                } catch (e) {
                    console.error("Error loading existing in massive:", e)
                }

                // 2. Map PMPA levels for NIVELCONTROLADO lookup
                const nivelesMap = pmpas.reduce((acc: any, curr) => {
                    if (!acc[curr.nivel]) acc[curr.nivel] = 0
                    acc[curr.nivel] += curr.raceqJunaeb
                    return acc
                }, {})

                // 3. Track needed keywords to determine correct final state
                const keywordsNeeded = new Set<string>()
                const RESERVED_KEYWORDS = ['MATERIAPRIMA', 'INSTRUMENTO', 'MANIPULADORA', 'NIVELCONTROLADO', 'CANTSERVICIO', 'ELEMENTOS']

                for (const d of cab.detalles) {
                    const letraMatch = d.aspecto?.match(/^([A-Z])\./)
                    const letra = letraMatch ? letraMatch[1] : null
                    const formula = formulasForLic.find(f => f.letra === letra)?.formula
                    if (formula) {
                        const words = formula.match(/[A-Za-z]+/g) || []
                        words.forEach(w => {
                            const upper = w.toUpperCase()
                            if (RESERVED_KEYWORDS.includes(upper)) {
                                keywordsNeeded.add(upper)
                            }
                        })
                    }
                }

                const missingKeywords = Array.from(keywordsNeeded).filter(k => !savedVars[k])
                const isAnyMissing = missingKeywords.length > 0
                const finalEstado = isAnyMissing ? 'PENDIENTE' : 'CALCULADO'

                // 4. Calculate details
                for (const d of cab.detalles) {
                    const letraMatch = d.aspecto?.match(/^([A-Z])\./)
                    const letra = letraMatch ? letraMatch[1] : null
                    const formula = formulasForLic.find(f => f.letra === letra)?.formula
                    if (!formula) continue

                    try {
                        const cleanFormula = formula.toUpperCase()
                        
                        // Look up NIVELCONTROLADO raciones
                        const selectedLevelLabel = savedVars['NIVELCONTROLADO'] || ''
                        let nivelControladoVal = raciones // default fallback
                        if (selectedLevelLabel) {
                            if (!isNaN(Number(selectedLevelLabel))) {
                                nivelControladoVal = Number(selectedLevelLabel)
                            } else {
                                const matchedVal = nivelesMap[selectedLevelLabel]
                                if (matchedVal !== undefined) {
                                    nivelControladoVal = matchedVal
                                }
                            }
                        }

                        const materiaPrimaVal = Number(savedVars['MATERIAPRIMA'] || 1)
                        const instrumentoVal = Number(savedVars['INSTRUMENTO'] || 1)
                        const manipuladoraVal = Number(savedVars['MANIPULADORA'] || 1)
                        const cantServicioVal = Number(savedVars['CANTSERVICIO'] || 1)
                        const elementosVal = Number(savedVars['ELEMENTOS'] || 1)

                        let evalForm = cleanFormula
                            .replace(/UTM/g, utmVal.toString())
                            .replace(/RACIONES/g, raciones.toString())
                            .replace(/NIVELCONTROLADO/g, nivelControladoVal.toString())
                            .replace(/MATERIAPRIMA/g, materiaPrimaVal.toString())
                            .replace(/INSTRUMENTO/g, instrumentoVal.toString())
                            .replace(/MANIPULADORA/g, manipuladoraVal.toString())
                            .replace(/CANTSERVICIO/g, cantServicioVal.toString())
                            .replace(/ELEMENTOS/g, elementosVal.toString())

                        const result = new Function(`return ${evalForm.replace(/[^0-9+\-*/().]/g, '')}`)()
                        totalMonto += Number(result) || 0

                        detallesCalc.push({
                            letraAspecto: letra || '?',
                            descripcion: d.observacionesOMedioDeVerificacion,
                            formulaAplicada: evalForm,
                            montoMulta: Number(result) || 0,
                            variablesUsadas: JSON.stringify(savedVars || {})
                        })
                    } catch (e) {
                        console.error('Error eval massive:', e)
                    }
                }

                // Save using finalEstado
                await prisma.multas_Elementos_Esenciales_Cab.upsert({
                    where: { folioOriginal: cab.folio! },
                    update: {
                        montoTotalCalculado: totalMonto,
                        estadoCalculo: finalEstado,
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
                        estadoCalculo: finalEstado,
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

        // Solo calcular aquellos aspectos que tienen NC = 'X'
        const detallesRelevantes = cab.detalles.filter(d => 
            d.nc?.trim().toUpperCase() === 'X'
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
                solucionable: formulaObj ? formulaObj.solucionable : null,
                incompleto: false
            }
        })

        // Check if PMPA is available and fetch values
        const anho = cab.fechaSupervision?.getFullYear()
        const mes = cab.fechaSupervision ? cab.fechaSupervision.getMonth() + 1 : 0
        const rbd = cab.rbd
        
        let pmpaRecord: any = null
        let utmRecord: any = null
        let pmpaNiveles: { label: string, value: number }[] = []

        if (anho && mes && rbd) {
            // 1. UTM
            utmRecord = await prisma.uTM.findUnique({
                where: { anho_mes: { anho, mes } }
            })

            // 2. Raciones (PMPA)
            // Extract service code
            const rawServicio = cab.esServicioManual ? (cab.servicioManual || '') : (cab.servicio || '')
            let serviceCode = null
            const sMatch = rawServicio.match(/\(([A-Z])\)/)
            if (sMatch) serviceCode = sMatch[1]
            
            if (!serviceCode) {
                const servicios = await prisma.multaServicio.findMany()
                const foundS = servicios.find(s => rawServicio.toLowerCase().includes(s.nombre.toLowerCase()) || rawServicio.toUpperCase() === s.codigo)
                if (foundS) serviceCode = foundS.codigo
            }

            if (serviceCode) {
                const allPmpas = await prisma.pMPA.findMany({
                    where: { rbd, ano: anho, mes, servicio: serviceCode }
                })
                
                if (allPmpas.length > 0) {
                    pmpaRecord = {
                        raceqJunaeb: allPmpas.reduce((acc, curr) => acc + curr.raceqJunaeb, 0)
                    }
                    
                    const nivelesMap = allPmpas.reduce((acc: any, curr) => {
                        if (!acc[curr.nivel]) acc[curr.nivel] = 0
                        acc[curr.nivel] += curr.raceqJunaeb
                        return acc
                    }, {})
                    
                    pmpaNiveles = Object.entries(nivelesMap).map(([nivel, raciones]) => ({
                        label: nivel,
                        value: raciones as number
                    }))
                }
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

        // Fetch previously saved variables if any
        let savedVariables: Record<string, string> = {}
        try {
            const savedCalculo = await prisma.multas_Elementos_Esenciales_Cab.findUnique({
                where: { folioOriginal: folio },
                include: { detalles: true }
            })
            if (savedCalculo && savedCalculo.detalles.length > 0) {
                const firstWithVars = savedCalculo.detalles.find(d => d.variablesUsadas)
                if (firstWithVars && firstWithVars.variablesUsadas) {
                    savedVariables = JSON.parse(firstWithVars.variablesUsadas)
                }
            }
        } catch (e) {
            console.error("Error loading saved variables:", e)
        }

        const serviciosDisponibles = await prisma.multaServicio.findMany({
            orderBy: { nombre: 'asc' }
        })

        return {
            data: cab,
            detalles: detallesConFormula,
            hasPmpa: !!pmpaRecord,
            utmValue: utmRecord?.monto || 0,
            utmPeriod: utmRecord ? `${mes}/${anho}` : 'N/D',
            racionesValue: pmpaRecord?.raceqJunaeb || 0,
            keywordsNeeded: Array.from(keywordsNeeded),
            pmpaNiveles,
            savedVariables,
            serviciosDisponibles
        }

    } catch (error) {
        console.error('Error getDetalleFolioParaCalculo:', error)
        return { error: 'Error al obtener el detalle del folio.' }
    }
}

export async function guardarServicioManual(folio: string, servicioCodigo: string, observacion: string) {
    const session = await getSession()
    if (!session) return { error: 'No autorizado' }

    if (!await checkPermission('manage_calculos_ee')) return { error: 'No tienes permisos.' }

    try {
        const serv = await prisma.multaServicio.findUnique({
            where: { codigo: servicioCodigo }
        })
        if (!serv) return { error: 'El servicio seleccionado no es válido.' }

        const servicioString = `${serv.nombre} (${serv.codigo})`

        await prisma.elementosEsenciales_Cab.updateMany({
            where: { folio },
            data: {
                esServicioManual: true,
                servicioManual: servicioString,
                observacionManualServicio: observacion
            }
        })

        return { success: true }
    } catch (e: any) {
        console.error("Error al guardar servicio manual:", e)
        return { error: 'Error al actualizar el servicio: ' + e.message }
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
