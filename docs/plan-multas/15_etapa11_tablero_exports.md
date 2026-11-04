# Etapa 11 — Tablero y exportaciones ampliadas

**Objetivo:** que el tablero Multas EE y las exportaciones muestren el valor de los módulos nuevos:
- Monto impugnable.
- Hallazgos por regla.
- Diferencias con JUNAEB.
- Efectividad de los descargos.
- Avance de las soluciones.

Va al final porque consume datos de todas las etapas anteriores.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes"), docs/plan-multas/ESTADO_ACTUAL.md y docs/plan-multas/BITACORA.md antes de empezar.

Etapa 11 del plan de integración de Multas: tablero y exportaciones.

Contexto: el tablero actual está en src/app/dashboard/tablero/multas-ee/ (MultasEEDashboardClient.tsx, generateMultasEEPDF.ts) y su API en src/app/api/tablero/multas-ee/route.ts. Referencia en sigs_actas: get_dashboard (~2955 de main.py; 8 KPIs y 6 gráficos), export_csv (~2896) y _build_detalle_rows (~2813; detalle de 13 filas por acta con ~39 columnas).

1) Nuevas secciones del tablero, cada una visible solo si su módulo está activo para la licitación filtrada:
   - REGLAS_NC: monto en CLP con hallazgos "impugnar" (aceptados / pendientes), top reglas que más se disparan y hallazgos por supervisor.
   - NOTIFICACIONES_JUNAEB: total notificado vs. calculado, diferencias por clasificación y por estado de revisión.
   - CICLO_LEGAL / BIBLIOTECA: monto notificado → resuelto (rebaja obtenida), tasa de aceptación por aspecto y plazos por vencer.
   - SOLUCIONES: planes por estado, % cumplimiento en plazo por sucursal.
   Los cálculos van en la API, no en el cliente. Mantén el estilo visual actual (Recharts, mismas tarjetas).

2) PDF del tablero: agrega las secciones activas en generateMultasEEPDF.ts.

3) Export "Detalle de actas" (Excel con exceljs) desde Cálculos: una fila por folio+aspecto con cabecera del acta, estado CO/NC/NA, observación, variables y su origen (auto/guardado/corregido), fórmula, UTM, raciones, monto, hallazgos (códigos), estado de descargo, notificación, monto JUNAEB y estado de revisión. Las columnas incluidas son configurables (selector antes de exportar, con la última selección recordada por usuario).

4) Rendimiento: revisa que las consultas nuevas usen índices y no carguen todas las actas en memoria (hoy calculateAll filtra mes/año en JS: no repitas ese patrón en la API del tablero; filtra en la consulta).

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Apaga un módulo y verifica que su sección desaparezca del tablero y del PDF.
- Contrasta 2 o 3 KPIs con una consulta manual o con el Excel de detalle.
- Mide el tiempo de carga del tablero antes y después con un año completo de datos.
