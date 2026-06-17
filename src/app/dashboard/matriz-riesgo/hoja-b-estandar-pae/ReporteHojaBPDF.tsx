'use client'

import React from 'react'

export function ReporteHojaBPDF({ data, divRef }: { data: any, divRef: React.RefObject<HTMLDivElement | null> }) {
    if (!data) return null;

    const { respuestaCabecera, colegio } = data;
    const plantilla = respuestaCabecera.cabecera;

    const formatFecha = (fecha: any) => {
        if (!fecha) return ''
        const d = new Date(fecha)
        return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`
    }

    const calculateFechasTope = (fechaIngreso: Date, nivelRiesgo: number) => {
        let dias = 30;
        if (nivelRiesgo === 1) dias = 90;
        else if (nivelRiesgo === 2) dias = 60;
        
        const d = new Date(fechaIngreso);
        d.setDate(d.getDate() + dias);
        const plazo = formatFecha(d);

        // Fecha de seguimiento: último día del mes siguiente
        const dSeguimiento = new Date(d);
        dSeguimiento.setMonth(dSeguimiento.getMonth() + 2);
        dSeguimiento.setDate(0); // Último día del mes anterior (mes siguiente al tope)
        const seguimiento = formatFecha(dSeguimiento);

        return { plazo, seguimiento };
    }

    const mapNivel = (nivel: number | null | undefined) => {
        if (nivel === 1) return 'Bajo'
        if (nivel === 2) return 'Medio'
        if (nivel === 3) return 'Alto'
        return 'No aplica'
    }

    const getTextoNivelRiesgo = (nivel: number | null | undefined) => {
        if (nivel === 1) return 'Bajo riesgo: Resolver (eliminar o mitigar) en menos de 90 días'
        if (nivel === 2) return 'Medio riesgo: Resolver (eliminar o mitigar) en menos de 60 días'
        if (nivel === 3) return 'Alto riesgo: Resolver (eliminar o mitigar) en menos de 30 días'
        return 'No aplica'
    }

    const getColorNivelRiesgo = (nivel: number | null | undefined) => {
        if (nivel === 1) return 'bg-[#a9d18e]'
        if (nivel === 2) return 'bg-[#ffd966]'
        if (nivel === 3) return 'bg-[#ff0000] text-white'
        return 'bg-white'
    }

    const BAD_VALUES = ['NO', 'NO_EXISTE', 'MALO_NO_CUMPLE', 'NO_HAY_REQUIERE']

    const isFinding = (valor: string) => {
        return BAD_VALUES.includes(valor)
    }

    const EmptyCell = () => <span className="text-slate-400 font-normal">No Aplica</span>;

    const seccionConfig: any = {
        'PATIO_SERVICIO': { titulo: 'Patio de servicio y entorno', bg: 'bg-[#fff2cc]', borderColor: '#e6c200' },
        'BODEGA': { titulo: 'Bodega', bg: 'bg-[#fce4d6]', borderColor: '#f4b183' },
        'COCINA': { titulo: 'Cocina', bg: 'bg-[#e2efda]', borderColor: '#a9d18e' },
        'BANO': { titulo: 'Baño', bg: 'bg-[#ddebf7]', borderColor: '#9dc3e6' },
        'LEVANTAMIENTO_GENERAL': { titulo: 'Levantamiento General', bg: 'bg-[#dae3f3]', borderColor: '#8ea9db' }
    }

    const renderSeccion = (seccionKey: string) => {
        const tiposExcluidos = ['OBSERVACION', 'ADJUNTAR', 'NUMERICO'];
        const preguntas = plantilla.detalles
            .filter((d: any) => d.seccion === seccionKey && !tiposExcluidos.includes(d.tipoRespuesta))
            .sort((a: any, b: any) => a.orden - b.orden)
        
        if (preguntas.length === 0) return null;

        const config = seccionConfig[seccionKey] || { titulo: seccionKey, bg: 'bg-[#e2e8f0]', borderColor: '#cbd5e1' }

        return (
            <React.Fragment key={seccionKey}>
                <tr>
                    <th colSpan={17} className={`${config.bg} p-0 border border-slate-200 shadow-sm`}>
                        <div className="p-4 px-6 text-base font-black text-slate-800 tracking-widest uppercase text-left">
                            {config.titulo}
                        </div>
                    </th>
                </tr>
                {preguntas.map((p: any) => {
                    const respuesta = respuestaCabecera.detalles.find((r: any) => r.preguntaId === p.id)
                    const valorRespuesta = respuesta?.valor || ''
                    const finding = isFinding(valorRespuesta)
                    
                    const nivel = p.nivelRiesgo || p.gravedad || 3
                    const { plazo, seguimiento } = finding ? calculateFechasTope(respuestaCabecera.fechaIngreso, nivel) : { plazo: null, seguimiento: null }

                    return (
                        <tr key={p.id} className="text-center align-middle hover:bg-slate-100 transition-colors even:bg-slate-50" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td className="p-4 text-left align-top border border-slate-100 font-medium text-slate-700 min-w-[300px] border-l-[24px]" style={{ borderLeftColor: config.borderColor }}>{p.preguntaNombre}</td>
                            <td className="p-3 border border-slate-100">{finding ? <span className="font-bold text-red-500">No</span> : <span className="font-medium text-green-600">Si</span>}</td>
                            <td className="p-3 border border-slate-100 text-slate-500">{finding ? 'No cumple condición' : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100">{finding ? 'SI' : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100">{finding ? mapNivel(p.probabilidad) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100 text-slate-500">{finding ? (p.justificacion || <EmptyCell />) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100">{finding ? mapNivel(p.gravedad) : <EmptyCell />}</td>
                            <td className={`p-3 border border-slate-100 font-bold ${finding ? getColorNivelRiesgo(nivel) : 'text-slate-500'}`}>{finding ? getTextoNivelRiesgo(nivel) : <EmptyCell />}</td>
                            
                            <td className="p-3 border border-slate-100 text-slate-600 min-w-[250px] text-left">{finding ? (p.riesgoSignificativo || <EmptyCell />) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100 text-slate-600">{finding ? (p.recursoNecesario || <EmptyCell />) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100 text-slate-600">{finding ? (p.resultadoEsperado || <EmptyCell />) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100 text-slate-600">{finding ? (p.respImplementacion || <EmptyCell />) : <EmptyCell />}</td>
                            
                            <td className="p-3 border border-slate-100 font-medium whitespace-nowrap">{plazo || ''}</td>
                            <td className="p-3 border border-slate-100 font-medium whitespace-nowrap">{seguimiento || ''}</td>
                            
                            <td className="p-3 border border-slate-100 text-slate-600">{finding ? (p.respSeguimiento || <EmptyCell />) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100 text-slate-600">{finding ? (p.evidenciaCumplimiento || <EmptyCell />) : <EmptyCell />}</td>
                            <td className="p-3 border border-slate-100 text-slate-600 border-r-[24px]" style={{ borderRightColor: config.borderColor }}>{finding ? (p.evidenciaEficacia || <EmptyCell />) : <EmptyCell />}</td>
                        </tr>
                    )
                })}
            </React.Fragment>
        )
    }

    return (
        <div ref={divRef} className="bg-white p-8 w-[2400px] mx-auto text-slate-800 font-sans box-border rounded-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 border-b-2 border-slate-100 pb-6">
                <div className="flex items-center gap-2">
                    <span className="text-cyan-600 font-black text-4xl tracking-tighter">HENDAYA</span>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-widest text-slate-700">Hoja B Estandar Pae</h1>
                <div className="w-32"></div> {/* Spacer para centrar el titulo */}
            </div>

            {/* Cabecera Datos */}
            <div className="flex flex-wrap text-sm mb-8 gap-8 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex gap-2 items-center">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">UT:</span>
                    <span className="font-black text-slate-700 text-base">{respuestaCabecera.ut}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">RBD:</span>
                    <span className="font-black text-cyan-600 text-base">{respuestaCabecera.rbd}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">Establecimiento:</span>
                    <span className="font-black text-slate-700 text-base">{colegio?.nombreEstablecimiento || ''}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">Fecha evaluación:</span>
                    <span className="font-black text-slate-700 text-base">{formatFecha(respuestaCabecera.fechaIngreso)}</span>
                </div>
            </div>

            {/* Tabla Gigante */}
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                <table className="w-full text-[11px] border-collapse bg-white">
                    <thead>
                        <tr className="bg-slate-800 text-slate-200">
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide text-left min-w-[300px]">Requisito</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[3%]">Cumple<br/>(Si/No)</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[5%]">Desviación</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[4%]">Impacto en<br/>inocuidad</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[5%]">Probabilidad<br/>ocurrencia</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[8%]">Justificación</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[5%]">Gravedad<br/>impacto</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[8%]">Nivel de riesgo</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide min-w-[250px]">Medida de Control (Riesgo Significativo)</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[8%]">Recursos Necesarios</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[7%]">Resultados esperados</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[6%]">Resp. Implementación</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[5%]">Plazo implement.</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[5%]">Fecha seguimiento</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[5%]">Resp. seguimiento</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[6%]">Evidencia<br/>cumplimiento</th>
                            <th className="p-3 border border-slate-700 font-semibold tracking-wide w-[6%]">Evidencia<br/>eficacia</th>
                        </tr>
                    </thead>
                <tbody>
                    {renderSeccion('PATIO_SERVICIO')}
                    {renderSeccion('BODEGA')}
                    {renderSeccion('COCINA')}
                    {renderSeccion('BANO')}
                    {renderSeccion('LEVANTAMIENTO_GENERAL')}
                </tbody>
            </table>
            </div>
        </div>
    )
}
