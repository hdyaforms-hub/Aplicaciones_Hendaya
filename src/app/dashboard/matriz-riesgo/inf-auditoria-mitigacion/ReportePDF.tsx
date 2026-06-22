'use client'

import React from 'react'

export function ReportePDF({ data, divRef }: { data: any, divRef: React.RefObject<HTMLDivElement | null> }) {
    if (!data) return null;

    const { respuestaCabecera, colegio, mitigaciones } = data;
    const plantilla = respuestaCabecera.cabecera;

    const PROBLEM_VALUES = [
        'NO', 'NO_EXISTE', 'MALO_NO_CUMPLE', 'NO_HAY_REQUIERE',
        'No Cumple', 'Malo requiere cambio o reparación / No Cumple', 'No hay y requiere instalar', 'Mal Estado'
    ];

    const getEstadoPregunta = (pregunta: any, respuestaValor: string) => {
        if (!respuestaValor) return { texto: 'Sin respuesta', color: 'bg-[#f1f5f9]', claseTexto: 'text-[#1e293b]' }
        
        const isProblem = PROBLEM_VALUES.includes(respuestaValor)

        if (!isProblem) {
            return { texto: 'Bueno / Cumple', color: 'bg-[#ffffff]', claseTexto: 'text-[#000000]' }
        }
        
        // Es una incidencia (hallazgo)
        if (pregunta.nivelRiesgo === 1 || pregunta.gravedad === 1) {
            return { texto: 'Bajo riesgo: Resolver (eliminar o mitigar) en menos de 90 días', color: 'bg-[#a9d18e]', claseTexto: 'text-[#000000]' }
        } else if (pregunta.nivelRiesgo === 2 || pregunta.gravedad === 2) {
            return { texto: 'Medio riesgo: Resolver (eliminar o mitigar) en menos de 60 días', color: 'bg-[#ffd966]', claseTexto: 'text-[#000000]' }
        } else {
            return { texto: 'Alto riesgo: Resolver (eliminar o mitigar) en menos de 30 días', color: 'bg-[#ff0000]', claseTexto: 'text-[#ffffff]' }
        }
    }

    const formatFecha = (fecha: any) => {
        if (!fecha) return ''
        const d = new Date(fecha)
        return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`
    }

    const calculateFechaTope = (fechaIngreso: Date, nivelRiesgo: number) => {
        let dias = 30;
        if (nivelRiesgo === 1) dias = 90;
        else if (nivelRiesgo === 2) dias = 60;
        
        const d = new Date(fechaIngreso);
        d.setDate(d.getDate() + dias);
        return formatFecha(d);
    }

    const getMitigacionInfo = (preguntaId: string) => {
        return mitigaciones.find((m: any) => m.preguntaId === preguntaId)
    }

    // Secciones a renderizar
    const seccionConfig: any = {
        'PATIO_SERVICIO': { titulo: 'Patio de servicio y entorno', color: 'bg-[#fff2cc]' },
        'BODEGA': { titulo: 'Bodega', color: 'bg-[#fce4d6]' },
        'COCINA': { titulo: 'Cocina', color: 'bg-[#e2efda]' },
        'BANO': { titulo: 'Baño', color: 'bg-[#ddebf7]' },
        'LEVANTAMIENTO_GENERAL': { titulo: 'Levantamiento General', color: 'bg-[#dae3f3]' }
    }

    const renderSeccion = (seccionKey: string) => {
        const preguntas = plantilla.detalles.filter((d: any) => d.seccion === seccionKey).sort((a: any, b: any) => a.orden - b.orden)
        if (preguntas.length === 0) return null;

        const config = seccionConfig[seccionKey] || { titulo: seccionKey, color: 'bg-[#e2e8f0]' }

        return (
            <div key={seccionKey} className="mb-6 page-break-inside-avoid">
                <table className="w-full text-[10px] border-collapse" style={{ borderColor: '#000000', borderWidth: '1px' }}>
                    <thead>
                        <tr>
                            <th colSpan={4} className={`${config.color} p-2 text-sm font-bold text-center uppercase`} style={{ border: '1px solid #000000' }}>
                                {config.titulo}
                            </th>
                        </tr>
                        <tr>
                            <th className="p-1 w-1/2 bg-[#f8fafc] font-bold text-center" style={{ border: '1px solid #000000' }}>Descripción</th>
                            <th className="p-1 w-1/5 bg-[#f8fafc] font-bold text-center" style={{ border: '1px solid #000000' }}>Estado</th>
                            <th className="p-1 w-[12%] bg-[#f8fafc] font-bold text-center text-[9px]" style={{ border: '1px solid #000000' }}>Fecha Tope Implementacion</th>
                            <th className="p-1 w-[18%] bg-[#f8fafc] font-bold text-center text-[9px]" style={{ border: '1px solid #000000' }}>Ruta de hipervinculo de: Imágenes, Ordenes de trabajo, Respaldo de Capacitación, entre otros.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {preguntas.map((p: any) => {
                            const respuesta = respuestaCabecera.detalles.find((r: any) => r.preguntaId === p.id)
                            const estadoInfo = getEstadoPregunta(p, respuesta?.valor)
                            const isProblem = PROBLEM_VALUES.includes(respuesta?.valor)
                            const mitigacion = getMitigacionInfo(p.id)
                            
                            return (
                                <tr key={p.id}>
                                    <td className="p-1 align-top" style={{ border: '1px solid #000000' }}>{p.preguntaNombre}</td>
                                    <td className={`p-1 align-middle text-center ${estadoInfo.color} ${estadoInfo.claseTexto}`} style={{ border: '1px solid #000000' }}>
                                        {estadoInfo.texto}
                                    </td>
                                    <td className="p-1 align-middle text-center" style={{ border: '1px solid #000000' }}>
                                        {isProblem ? calculateFechaTope(respuestaCabecera.fechaIngreso, p.nivelRiesgo || p.gravedad || 3) : ''}
                                    </td>
                                    <td className="p-1 align-middle text-center text-[9px]" style={{ border: '1px solid #000000' }}>
                                        {isProblem && mitigacion && mitigacion.adjuntos && mitigacion.adjuntos !== '[]' ? 'Cuenta con documentación' : ''}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )
    }

    // Calcular Resumen
    const resumen = {
        'PATIO_SERVICIO': { bajo: { rep: 0, sol: 0 }, medio: { rep: 0, sol: 0 }, alto: { rep: 0, sol: 0 } },
        'BODEGA': { bajo: { rep: 0, sol: 0 }, medio: { rep: 0, sol: 0 }, alto: { rep: 0, sol: 0 } },
        'COCINA': { bajo: { rep: 0, sol: 0 }, medio: { rep: 0, sol: 0 }, alto: { rep: 0, sol: 0 } },
        'BANO': { bajo: { rep: 0, sol: 0 }, medio: { rep: 0, sol: 0 }, alto: { rep: 0, sol: 0 } }
    }

    let totales = {
        bajo: { rep: 0, sol: 0 },
        medio: { rep: 0, sol: 0 },
        alto: { rep: 0, sol: 0 }
    }

    plantilla.detalles.forEach((p: any) => {
        if (!['PATIO_SERVICIO', 'BODEGA', 'COCINA', 'BANO'].includes(p.seccion)) return;
        const respuesta = respuestaCabecera.detalles.find((r: any) => r.preguntaId === p.id)
        if (!respuesta) return;

        const isProblem = PROBLEM_VALUES.includes(respuesta.valor)
        if (isProblem) {
            const nivel = p.nivelRiesgo || p.gravedad || 3;
            const mitigacion = getMitigacionInfo(p.id)
            const isSolucionado = mitigacion && mitigacion.fechaSolucion;
            
            let key = 'alto';
            if (nivel === 1) key = 'bajo';
            else if (nivel === 2) key = 'medio';

            resumen[p.seccion as keyof typeof resumen][key as keyof typeof totales].rep++;
            totales[key as keyof typeof totales].rep++;
            
            if (isSolucionado) {
                resumen[p.seccion as keyof typeof resumen][key as keyof typeof totales].sol++;
                totales[key as keyof typeof totales].sol++;
            }
        }
    })

    const renderFilaResumen = (label: string, key: 'bajo' | 'medio' | 'alto', colorClase: string) => {
        const totalRep = totales[key].rep;
        const totalSol = totales[key].sol;
        const pct = totalRep > 0 ? Math.round((totalSol / totalRep) * 100) : 0;
        let fechaTopeMax = ''; 
        if (totalRep > 0) {
            let dias = 30;
            if (key === 'bajo') dias = 90;
            else if (key === 'medio') dias = 60;
            const d = new Date(respuestaCabecera.fechaIngreso);
            d.setDate(d.getDate() + dias);
            fechaTopeMax = formatFecha(d);
        }

        return (
            <tr>
                <td className={`${colorClase} p-1 text-[10px]`} style={{ border: '1px solid #000000' }}>{label}</td>
                <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{totalRep}</td>
                <td className="p-1 text-center bg-[#fff2cc]" style={{ border: '1px solid #000000' }}>{resumen['PATIO_SERVICIO'][key].sol}</td>
                <td className="p-1 text-center bg-[#fce4d6]" style={{ border: '1px solid #000000' }}>{resumen['BODEGA'][key].sol}</td>
                <td className="p-1 text-center bg-[#e2efda]" style={{ border: '1px solid #000000' }}>{resumen['COCINA'][key].sol}</td>
                <td className="p-1 text-center bg-[#ddebf7]" style={{ border: '1px solid #000000' }}>{resumen['BANO'][key].sol}</td>
                <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{totalSol}</td>
                <td className="p-1 text-center" style={{ border: '1px solid #000000' }}>{pct}%</td>
                <td className="p-1 text-center" style={{ border: '1px solid #000000' }}>{fechaTopeMax}</td>
            </tr>
        )
    }

    return (
        <div ref={divRef} className="bg-[#ffffff] p-8 w-[210mm] min-h-[297mm] mx-auto text-[#000000] font-sans box-border" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            {/* Header */}
            <div className="mb-6" style={{ border: '1px solid #000000' }}>
                <div className="flex" style={{ borderBottom: '1px solid #000000' }}>
                    <div className="w-1/4 flex items-center justify-center p-4" style={{ borderRight: '1px solid #000000' }}>
                        <span className="text-[#00b0f0] font-black text-2xl tracking-tighter" style={{ color: '#00b0f0' }}>HENDAYA</span>
                    </div>
                    <div className="w-2/4 flex items-center justify-center p-4" style={{ borderRight: '1px solid #000000' }}>
                        <h1 className="text-xl font-bold uppercase text-center">Informe Auditoria Mitigación</h1>
                    </div>
                    <div className="w-1/4 flex flex-col text-[10px]">
                        <div className="p-1 px-2" style={{ borderBottom: '1px solid #000000' }}>CODIGO: R_GO_8_11</div>
                        <div className="p-1 px-2" style={{ borderBottom: '1px solid #000000' }}>VERSION:03</div>
                        <div className="p-1 px-2">FECHA: 03/02/2025</div>
                    </div>
                </div>
            </div>

            {/* Cabecera Datos */}
            <div className="flex text-xs mb-6 justify-between px-2">
                <div className="flex gap-2">
                    <span className="font-bold">UT:</span>
                    <span className="w-16 text-center" style={{ borderBottom: '1px solid #000000' }}>{respuestaCabecera.ut}</span>
                </div>
                <div className="flex gap-2">
                    <span className="font-bold">RBD:</span>
                    <span className="w-16 text-center" style={{ borderBottom: '1px solid #000000' }}>{respuestaCabecera.rbd}</span>
                </div>
                <div className="flex gap-2">
                    <span className="font-bold">Establecimiento:</span>
                    <span className="w-64 text-center truncate" style={{ borderBottom: '1px solid #000000' }}>{colegio?.nombreEstablecimiento || ''}</span>
                </div>
                <div className="flex gap-2">
                    <span className="font-bold">Fecha de la evaluación:</span>
                    <span className="w-24 text-center" style={{ borderBottom: '1px solid #000000' }}>{formatFecha(respuestaCabecera.fechaIngreso)}</span>
                </div>
            </div>

            {/* Secciones */}
            {renderSeccion('PATIO_SERVICIO')}
            {renderSeccion('BODEGA')}
            {renderSeccion('COCINA')}
            {renderSeccion('BANO')}

            {/* Resumen General */}
            <div className="mt-8 page-break-inside-avoid">
                <table className="w-full text-[10px] border-collapse" style={{ borderColor: '#000000', borderWidth: '1px' }}>
                    <thead>
                        <tr>
                            <th colSpan={9} className="bg-[#d1d5db] p-2 text-sm font-bold text-center" style={{ border: '1px solid #000000' }}>Resumen General</th>
                        </tr>
                        <tr>
                            <th rowSpan={2} className="p-1 bg-[#f8fafc] text-center w-[30%]" style={{ border: '1px solid #000000' }}>Descripción</th>
                            <th rowSpan={2} className="p-1 bg-[#f8fafc] text-center text-[9px] w-[8%]" style={{ border: '1px solid #000000' }}>Cant. Errores reportados</th>
                            <th colSpan={5} className="p-1 bg-[#f8fafc] text-center text-[10px]" style={{ border: '1px solid #000000' }}>Total de incidencias solucionadas</th>
                            <th rowSpan={2} className="p-1 bg-[#f8fafc] text-center text-[9px] w-[8%]" style={{ border: '1px solid #000000' }}>% Avance<br/>por acta<br/>(No Tocar)</th>
                            <th rowSpan={2} className="p-1 bg-[#f8fafc] text-center text-[9px] w-[12%]" style={{ border: '1px solid #000000' }}>Fecha Tope<br/>Implementacion</th>
                        </tr>
                        <tr>
                            <th className="p-1 bg-[#fff2cc] text-center text-[9px]" style={{ border: '1px solid #000000' }}>Patio de servicio y entorno</th>
                            <th className="p-1 bg-[#fce4d6] text-center text-[9px]" style={{ border: '1px solid #000000' }}>Bodega</th>
                            <th className="p-1 bg-[#e2efda] text-center text-[9px]" style={{ border: '1px solid #000000' }}>Cocina</th>
                            <th className="p-1 bg-[#ddebf7] text-center text-[9px]" style={{ border: '1px solid #000000' }}>Baño</th>
                            <th className="p-1 bg-[#f8fafc] text-center text-[9px]" style={{ border: '1px solid #000000' }}>Total solucionados</th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderFilaResumen('Bajo riesgo: Resolver (eliminar o mitigar) en menos de 90 días', 'bajo', 'bg-[#a9d18e] text-[#000000]')}
                        {renderFilaResumen('Medio riesgo: Resolver (eliminar o mitigar) en menos de 60 días', 'medio', 'bg-[#ffd966] text-[#000000]')}
                        {renderFilaResumen('Alto riesgo: Resolver (eliminar o mitigar) en menos de 30 días', 'alto', 'bg-[#ff0000] text-[#ffffff]')}
                        <tr>
                            <td className="p-1 font-bold text-right pr-2 uppercase" style={{ border: '1px solid #000000' }}>Total</td>
                            <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{totales.bajo.rep + totales.medio.rep + totales.alto.rep}</td>
                            <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{resumen['PATIO_SERVICIO'].bajo.sol + resumen['PATIO_SERVICIO'].medio.sol + resumen['PATIO_SERVICIO'].alto.sol}</td>
                            <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{resumen['BODEGA'].bajo.sol + resumen['BODEGA'].medio.sol + resumen['BODEGA'].alto.sol}</td>
                            <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{resumen['COCINA'].bajo.sol + resumen['COCINA'].medio.sol + resumen['COCINA'].alto.sol}</td>
                            <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{resumen['BANO'].bajo.sol + resumen['BANO'].medio.sol + resumen['BANO'].alto.sol}</td>
                            <td className="p-1 text-center font-bold" style={{ border: '1px solid #000000' }}>{totales.bajo.sol + totales.medio.sol + totales.alto.sol}</td>
                            <td className="p-1 bg-[#e5e7eb]" style={{ border: '1px solid #000000' }}></td>
                            <td className="p-1 bg-[#e5e7eb]" style={{ border: '1px solid #000000' }}></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <style jsx global>{`
                .page-break-inside-avoid {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
            `}</style>
        </div>
    )
}
