'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensurePrevIndicadoresTables } from '@/lib/prev-indicadores-db-init'
import { revalidatePath } from 'next/cache'
import * as xlsx from 'xlsx'
import crypto from 'crypto'

export interface CargaIndicadoresHistorialItem {
    id: string
    anio: number
    mes: number
    periodo: string
    fileName: string
    fuente?: string | null
    cargadoPor: string
    createdAt: string
}

export interface CargaIndicadoresResponse {
    success: boolean
    error?: string
    avisos?: string[]
    resumen?: {
        cargaId?: string
        periodo: string
        anio: number
        mes: number
        totalAccidentes: number
        totalDiasPerdidos: number
        zonasCount: number
        comunasTopCount: number
        jefaturasTopCount: number
        tsit?: string
    }
}

const MESES12 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic']
const ZONA_NOMBRES = ['Metropolitana', 'Copiapó', 'Vallenar', 'Coyhaique']
const TRAMOS_DS67 = [
    { r: '0 – 32', p: '0,93%', d: '+0,00%' },
    { r: '33 – 64', p: '1,27%', d: '+0,34%' },
    { r: '65 – 96', p: '1,61%', d: '+0,68%' },
    { r: '97 – 128', p: '1,95%', d: '+1,02%' },
    { r: '129 – 160', p: '2,29%', d: '+1,36%' },
    { r: '161 – 192', p: '2,63%', d: '+1,70%' },
    { r: '193 – 224', p: '2,97%', d: '+2,04%' },
    { r: '225 – 272', p: '3,31%', d: '+2,38%' },
    { r: '273 – 320', p: '3,65%', d: '+2,72%' },
    { r: '321 – 368', p: '3,99%', d: '+3,06%' },
    { r: '369 – 416', p: '4,33%', d: '+3,40%' },
    { r: '417 – 464', p: '4,67%', d: '+3,74%' },
    { r: '465 – 512', p: '5,01%', d: '+4,08%' },
    { r: '513 – 560', p: '5,35%', d: '+4,42%' },
    { r: '561 – 630', p: '5,69%', d: '+4,76%' },
    { r: '631 – 700', p: '6,03%', d: '+5,10%' },
    { r: '701 – 770', p: '6,37%', d: '+5,44%' },
    { r: '771 – 840', p: '6,71%', d: '+5,78%' },
    { r: '841 – 910', p: '7,05%', d: '+6,12%' },
    { r: '911 – 980', p: '7,39%', d: '+6,46%' },
    { r: '981 y más', p: '7,73%', d: '+6,80%' }
]

function fmtCL(n: number | null | undefined, dec = 2): string {
    if (n === null || n === undefined || isNaN(n)) return '—'
    return n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

/**
 * Procesa la hoja "Panel" del Excel oficial de Indicadores de Prevención de Riesgos
 */
function parsePanelSheet(rows: any[][], fileName: string) {
    const K: Record<string, any[]> = {}
    const COM: { name: string; zona: string; acc: number; dias: number }[] = []
    const JEF: { name: string; zona: string; acc: number; dias: number }[] = []

    const num = (v: any): number | null => {
        if (v === null || v === undefined || v === '' || isNaN(+v)) return null
        return +v
    }

    rows.forEach(r => {
        if (!r || typeof r[0] !== 'string') return
        const key = r[0].trim()
        if (key === 'COM' || key === 'JEF') {
            const nm = r[1]
            if (nm !== null && nm !== undefined && String(nm).trim() !== '') {
                const item = {
                    name: String(nm).trim(),
                    zona: String(r[2] || '').trim(),
                    acc: num(r[3]) || 0,
                    dias: num(r[4]) || 0
                }
                if (key === 'COM') COM.push(item)
                else JEF.push(item)
            }
            return
        }
        if (key.includes('|')) {
            K[key] = r.slice(2, 14)
            // Normalizar variaciones con y sin tilde para máxima resiliencia
            if (key.includes('Copiapó')) {
                K[key.replace('Copiapó', 'Copiapo')] = r.slice(2, 14)
            } else if (key.includes('Copiapo')) {
                K[key.replace('Copiapo', 'Copiapó')] = r.slice(2, 14)
            }
        }
    })

    const need = ['META|anio', 'META|mes', 'TASA|frecuencia|valor', 'ZONA|Metropolitana|acc|2', 'TOT|acc|2', 'DS67|tsit']
    const miss = need.filter(k => !K[k])
    if (miss.length > 0) {
        throw new Error(`La hoja «Panel» no contiene todas las claves requeridas (${miss.join(', ')}). Verifica que corresponda al archivo oficial «Indicadores Panel - Datos.xlsx».`)
    }

    const anio = num(K['META|anio'][0])
    const mes = num(K['META|mes'][0])
    if (!anio || !mes || mes < 1 || mes > 12) {
        throw new Error('El año o mes de cierre de la hoja «Inicio» no son válidos (debe ser un mes entre 1 y 12).')
    }

    const m12 = (k: string) => (K[k] || []).concat(Array(12).fill(null)).slice(0, 12).map(num)
    const cut = (arr: (number | null)[]) => arr.map((v, i) => i < mes ? v : null)
    const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100)
    const avisos: string[] = []

    // Tasas nacionales base
    const baseNacional = [
        { id: 'frecuencia', label: 'Tasa de Frecuencia', unit: '', meta: 25, desc: 'Número de lesionados por millón de horas trabajadas.', src: 'Fuente: Tasas.xlsx, hoja «Frecuencia».' },
        { id: 'accidentabilidad', label: 'Tasa de Accidentabilidad', unit: '', meta: 1, desc: 'Porcentaje de trabajadores accidentados en el período.', src: 'Fuente: Tasas.xlsx, hoja «Accidentabilidad».' },
        { id: 'gravedad', label: 'Tasa de Gravedad', unit: '', meta: 125, desc: 'Días perdidos acumulados por millón de horas trabajadas.', src: 'Fuente: Tasas.xlsx, hoja «Gravedad».' },
        { id: 'siniestralidad', label: 'Tasa de Siniestralidad', unit: '', meta: 3, desc: 'Días perdidos promedio por cada trabajador de la dotación.', src: 'Fuente: Tasas.xlsx, hoja «Siniestralidad».' }
    ]

    const nacional = baseNacional.map(b => {
        const vals = cut(m12(`TASA|${b.id}|valor`)).slice(0, mes).map(r2)
        const meta = num((K[`TASA|${b.id}|meta`] || [])[0]) ?? b.meta
        let last = vals.length - 1
        while (last >= 0 && vals[last] === null) last--
        if (vals[mes - 1] === null) avisos.push(`${b.label}: sin dato en ${MESES12[mes - 1]}.`)
        const conDato = vals.filter(v => v !== null) as number[]
        return {
            ...b,
            meta,
            values: vals,
            current: last >= 0 ? vals[last] : null,
            overMonths: conDato.filter(v => v > meta).length,
            totalMonths: conDato.length
        }
    })

    // Zonas (Sucursales)
    const zonas = ZONA_NOMBRES.map(z => {
        const acc: Record<number, (number | null)[]> = {}
        const dias: Record<number, (number | null)[]> = {}
        for (let k = 0; k < 3; k++) {
            const y = anio - 2 + k
            acc[y] = m12(`ZONA|${z}|acc|${k}`)
            dias[y] = m12(`ZONA|${z}|dias|${k}`)
            if (k === 2) {
                acc[y] = cut(acc[y])
                dias[y] = cut(dias[y])
            }
        }
        const av = cut(m12(`ZONA|${z}|accidentab`)).slice(0, mes).map(r2)
        const yrs = m12(`ZONA|${z}|anual|anio`).slice(0, 4)
        const act = m12(`ZONA|${z}|anual|actual`).slice(0, 4)
        const met = m12(`ZONA|${z}|anual|meta`).slice(0, 4)
        let i0 = 0
        while (i0 < 3 && !act[i0] && !met[i0]) i0++

        return {
            name: z,
            accMensual: acc,
            diasMensual: dias,
            accVsMeta: {
                meta: num((K[`ZONA|${z}|accmeta`] || [])[0]) ?? 1,
                categories: MESES12.slice(0, mes),
                values: av
            },
            accAnualVsMeta: {
                categories: yrs.slice(i0).map(v => (v !== null ? String(v) : '')),
                actual: act.slice(i0),
                meta: met.slice(i0)
            }
        }
    })

    // Totales de accidentes y días perdidos 3 años
    const totales = { accidentes: {} as Record<number, (number | null)[]>, dias: {} as Record<number, (number | null)[]> }
    for (let k = 0; k < 3; k++) {
        const y = anio - 2 + k
        totales.accidentes[y] = m12(`TOT|acc|${k}`)
        totales.dias[y] = m12(`TOT|dias|${k}`)
        if (k === 2) {
            totales.accidentes[y] = cut(totales.accidentes[y])
            totales.dias[y] = cut(totales.dias[y])
        }
    }

    const ranking = ZONA_NOMBRES.map(z => ({
        name: z,
        value: r2(num((K[`ZONA|${z}|ranking`] || [])[0]) ?? 0)
    }))

    // Top 10 Comunas y Jefaturas
    const totAcc = num((K['CHK|acc'] || [])[0]) || 0
    const totDias = num((K['CHK|dias'] || [])[0]) || 0

    const topCalc = (list: { name: string; zona: string; acc: number; dias: number }[], conZona: boolean) => {
        const L = list.filter(x => x.acc > 0).sort((a, b) => b.acc - a.acc || b.dias - a.dias || a.name.localeCompare(b.name, 'es'))
        const t = L.slice(0, 10)
        const corte = t.length ? t[t.length - 1].acc : 0
        const emp = L.slice(10).filter(x => x.acc === corte).map(x => conZona ? `${x.name} (${x.zona})` : x.name)
        return {
            list: t.map(x => ({ name: x.name, zona: x.zona, acc: x.acc, dias: x.dias })),
            emp
        }
    }

    const tc = topCalc(COM, false)
    const tj = topCalc(JEF, true)

    const sumCom = COM.reduce((s, x) => s + x.acc, 0)
    const sumJef = JEF.reduce((s, x) => s + x.acc, 0)
    const conCom = num((K['CHK|accConComuna'] || [])[0])
    const conJef = num((K['CHK|accConJef'] || [])[0])
    if (conCom !== null && sumCom !== conCom) {
        avisos.push(`Comunas: la lista suma ${sumCom} accidentes y el Consolidado tiene ${conCom}.`)
    }
    if (conJef !== null && sumJef !== conJef) {
        avisos.push(`Jefaturas: la lista suma ${sumJef} accidentes y el Consolidado tiene ${conJef}.`)
    }

    const periodo = String((K['META|periodo'] || [])[0] || `Ene – ${MESES12[mes - 1]} ${anio}`)
    const top10 = {
        periodo,
        totalAcc: totAcc,
        totalDias: totDias,
        comunas: tc.list,
        jefaturas: tj.list,
        empates: { comunas: tc.emp, jefaturas: tj.emp },
        fuente: 'Hoja Consolidado del archivo de indicadores'
    }

    // DS 67
    const tsit = num((K['DS67|tsit'] || [])[0])
    if (tsit === null) avisos.push('DS 67: falta el TSIT en la hoja DS67.')
    const hold = num((K['DS67|holgura'] || [])[0])
    const lows = TRAMOS_DS67.map(t => parseInt(t.r, 10))
    let ti = 0
    if (tsit !== null) {
        const f = Math.floor(tsit)
        lows.forEach((lo, i) => { if (f >= lo) ti = i })
    }
    const adic = ti * 0.34
    const next = lows[ti + 1]
    const txt = (k: string) => String((K[k] || [])[0] ?? '')

    const ds67 = {
        cotizacionActual: fmtCL(0.93 + adic, 2) + '%',
        cotizacionCap: `Básica 0,93% + Adicional ${fmtCL(adic, 2)}%`,
        tsit: tsit === null ? '—' : fmtCL(tsit, 2),
        tsitCap: 'Tasa de siniestralidad total',
        holgura: hold === null ? '—' : fmtCL(hold, 0),
        holguraCap: next ? `Antes de cruzar TST ${next} (sig. tramo)` : 'Último tramo',
        costo: txt('DS67|costo') || '—',
        costoCap: txt('DS67|costoCap'),
        variacion: txt('DS67|variacion') || '—',
        variacionCap: txt('DS67|variacionCap'),
        tramos: TRAMOS_DS67.map((t, i) => ({ ...t, current: i === ti }))
    }

    const hoy = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const cargado = `${pad(hoy.getDate())}-${pad(hoy.getMonth() + 1)}-${hoy.getFullYear()}`

    return {
        data: {
            v: 1,
            ts: Date.now(),
            anio,
            mes,
            periodo,
            fuente: `${fileName} (cargado el ${cargado})`,
            cargado,
            nacional,
            zonas,
            totales,
            ranking,
            top10,
            ds67
        },
        avisos
    }
}

/**
 * Server Action: Carga y procesa el Excel de Indicadores de Prevención de Riesgos
 */
export async function cargarExcelIndicadoresAction(formData: FormData): Promise<CargaIndicadoresResponse> {
    try {
        await ensurePrevIndicadoresTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_prev_riesgos_carga')) {
            return {
                success: false,
                error: 'No tienes permisos para realizar la carga masiva de Prevención de Riesgos.'
            }
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return {
                success: false,
                error: 'No se ha proporcionado ningún archivo.'
            }
        }

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            return {
                success: false,
                error: 'El archivo debe ser un libro Excel (.xlsx o .xls).'
            }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const workbook = xlsx.read(buffer, { type: 'buffer' })

        // Buscar la hoja "Panel"
        const panelSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'panel')
        if (!panelSheetName) {
            return {
                success: false,
                error: `El libro no contiene la hoja «Panel» obligatoria. Hojas encontradas: ${workbook.SheetNames.join(', ')}.`
            }
        }

        const panelSheet = workbook.Sheets[panelSheetName]
        const rows: any[][] = xlsx.utils.sheet_to_json(panelSheet, { header: 1, defval: null })

        // Parsear datos de la hoja
        const { data: parsedData, avisos } = parsePanelSheet(rows, file.name)

        // Enriquecer cruce con Supervisores del sistema para las jefaturas del Top 10
        const supervisoresDb = await rawPrisma.supervisor.findMany({
            select: {
                id: true,
                nombre: true,
                apellido: true,
                correo: true,
                rbdsAuditar: { select: { rbd: true } }
            }
        }).catch(() => [])

        // Asociar cada jefatura con el supervisor de BD si coincide
        if (parsedData.top10 && Array.isArray(parsedData.top10.jefaturas)) {
            parsedData.top10.jefaturas = parsedData.top10.jefaturas.map(j => {
                const normJef = j.name.toLowerCase().trim()
                const match = supervisoresDb.find(s => {
                    const full1 = `${s.nombre} ${s.apellido}`.toLowerCase().trim()
                    const full2 = `${s.apellido} ${s.nombre}`.toLowerCase().trim()
                    return full1 === normJef || full2 === normJef || normJef.includes(s.nombre.toLowerCase()) && normJef.includes(s.apellido.toLowerCase())
                })
                return {
                    ...j,
                    supervisorId: match?.id || null,
                    correo: match?.correo || null,
                    totalRbds: match?.rbdsAuditar?.length || 0
                }
            })
        }

        const cargaId = crypto.randomUUID()
        const dataJsonStr = JSON.stringify(parsedData)
        const currentUser = session?.user?.username || session?.user?.name || 'desconocido'

        // Guardar en la tabla "Prev_IndicadoresCargas"
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "Prev_IndicadoresCargas" ("id", "anio", "mes", "periodo", "fileName", "fuente", "dataJson", "cargadoPor", "createdAt", "updatedAt")
            VALUES (
                '${cargaId}',
                ${Number(parsedData.anio)},
                ${Number(parsedData.mes)},
                '${parsedData.periodo.replace(/'/g, "''")}',
                '${file.name.replace(/'/g, "''")}',
                '${parsedData.fuente.replace(/'/g, "''")}',
                '${dataJsonStr.replace(/'/g, "''")}',
                '${currentUser.replace(/'/g, "''")}',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        `)

        // Auditoría
        try {
            await logAuditAction({
                username: currentUser,
                userId: session?.user?.id || null,
                action: 'CARGA_EXCEL_INDICADOR_PREV_RIESGOS',
                modulo: 'Áreas -> Prev. de riesgos -> Carga masiva',
                detalle: `Carga exitosa de indicadores para período ${parsedData.periodo} desde archivo ${file.name}`
            })
        } catch (auditErr) {
            console.error('Error registrando auditoría de carga de indicadores:', auditErr)
        }

        revalidatePath('/dashboard/tablero/indicador-prev-riesgos')
        revalidatePath('/dashboard/areas/prevencion-riesgos/carga-masiva')

        return {
            success: true,
            avisos,
            resumen: {
                cargaId,
                periodo: parsedData.periodo,
                anio: parsedData.anio,
                mes: parsedData.mes,
                totalAccidentes: parsedData.top10?.totalAcc || 0,
                totalDiasPerdidos: parsedData.top10?.totalDias || 0,
                zonasCount: parsedData.zonas?.length || 0,
                comunasTopCount: parsedData.top10?.comunas?.length || 0,
                jefaturasTopCount: parsedData.top10?.jefaturas?.length || 0,
                tsit: parsedData.ds67?.tsit
            }
        }
    } catch (error: any) {
        console.error('Error al cargar Excel de Indicadores de Prevención:', error)
        return {
            success: false,
            error: error?.message || 'Error inesperado durante la carga del archivo Excel.'
        }
    }
}

/**
 * Obtiene el historial de cargas de indicadores
 */
export async function getHistorialCargasIndicadoresAction(): Promise<CargaIndicadoresHistorialItem[]> {
    try {
        await ensurePrevIndicadoresTables()
        const rows = await rawPrisma.$queryRawUnsafe<{ id: string; anio: number; mes: number; periodo: string; fileName: string; fuente?: string; cargadoPor: string; createdAt: Date }[]>(`
            SELECT "id", "anio", "mes", "periodo", "fileName", "fuente", "cargadoPor", "createdAt"
            FROM "Prev_IndicadoresCargas"
            ORDER BY "createdAt" DESC
            LIMIT 15;
        `)
        return rows.map(r => ({
            id: r.id,
            anio: r.anio,
            mes: r.mes,
            periodo: r.periodo,
            fileName: r.fileName,
            fuente: r.fuente || null,
            cargadoPor: r.cargadoPor,
            createdAt: new Date(r.createdAt).toISOString()
        }))
    } catch (e) {
        console.error('Error al obtener historial de cargas de indicadores:', e)
        return []
    }
}

/**
 * Elimina un registro de carga masiva de indicadores por ID
 */
export async function eliminarCargaIndicadoresAction(cargaId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session || !session.user) {
            return { success: false, error: 'No autorizado. Por favor inicie sesión.' }
        }

        const roleName = session.user.role?.name?.toLowerCase() || ''
        const isAdmin = roleName.includes('admin') || roleName.includes('gerencia')
        const permissions = session.user.role?.permissions || []

        if (!isAdmin && !permissions.includes('manage_prev_riesgos_carga')) {
            return { success: false, error: 'No tienes permisos suficientes para eliminar registros de carga.' }
        }

        await ensurePrevIndicadoresTables()

        // Obtener detalles del registro antes de eliminar para auditoría
        const existing = await rawPrisma.$queryRawUnsafe<{ id: string; periodo: string; fileName: string }[]>(`
            SELECT "id", "periodo", "fileName"
            FROM "Prev_IndicadoresCargas"
            WHERE "id" = $1
            LIMIT 1;
        `, cargaId)

        if (!existing || existing.length === 0) {
            return { success: false, error: 'El registro a eliminar no fue encontrado.' }
        }

        const record = existing[0]

        // Eliminar registro
        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "Prev_IndicadoresCargas"
            WHERE "id" = $1;
        `, cargaId)

        // Registrar en auditoría
        const currentUser = session.user.username || session.user.name || 'desconocido'
        try {
            await logAuditAction({
                username: currentUser,
                userId: session.user.id || null,
                action: 'ELIMINAR_CARGA_MASIVA_PREV_RIESGOS',
                modulo: 'Áreas -> Prev. de riesgos -> Carga masiva',
                detalle: `Se eliminó la carga masiva del período "${record.periodo}" (Archivo: ${record.fileName}, ID: ${cargaId})`
            })
        } catch (auditErr) {
            console.error('Error al registrar auditoría de eliminación de carga:', auditErr)
        }

        revalidatePath('/dashboard/areas/prevencion-riesgos/carga-masiva')
        revalidatePath('/dashboard/tablero/indicador-prev-riesgos')

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar carga de indicadores:', error)
        return {
            success: false,
            error: error?.message || 'Error al eliminar el registro de carga masiva.'
        }
    }
}


