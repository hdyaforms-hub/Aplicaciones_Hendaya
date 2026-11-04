# Etapa 6A — Notificaciones JUNAEB: carga del Anexo 1 y comparación

**Objetivo:** cargar el Excel del Anexo 1 que JUNAEB envía con la resolución (REX) y compararlo
**fila por fila** contra el cálculo propio. La comparación detecta:
- Diferencias de monto.
- Aspectos que JUNAEB multó y nosotros no tenemos como NC.
- NC que tenemos y JUNAEB no incluyó.
- Actas del período y sucursal **sin multa JUNAEB**.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 6A del plan de integración de Multas: notificaciones JUNAEB.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f):
- app/main.py: tabla notificaciones (~228, con columnas de scope fecha_desde/fecha_hasta/sucursal ~362), _parse_anexo1_excel (~3891), upload_notificacion (~3944), comparar_notificacion (~4050), export_notificacion (~4283), _tipo_divergencia (~4432), y sucursal_comunas (~350, ~4020).
- Archivos reales de ejemplo: data/documentos/notificacion/REX-2238/Anexo1.xlsx y "Comparacion_Notif_1 (8).xlsx" en la raíz (formato del export esperado). Ábrelos para conocer las columnas reales.

1) Modelos (aditivos):
   - MultaNotificacion { id, licId, resolucion (REX), nombre, fechaResolucion?, periodoDesde, periodoHasta, sucursal?, archivoNombre, archivoRuta, nFolios, nFilas, estado ('cargada'|'en_revision'|'cerrada'), createdBy, timestamps } @@unique([licId, resolucion])
   - MultaNotificacionFila { id, notificacionId, folio, rbd, aspecto, servicio, observacion, montoJunaeb Float, datosOriginales @db.Text (JSON de la fila completa) } con índices por folio y por notificacionId.

2) Mapeo de columnas configurable: el formato del Anexo 1 puede cambiar entre licitaciones o años. NOTIFICACIONES_JUNAEB.parametros.mapeoColumnas = { folio: ["ID Acta","Folio"], aspecto: [...], monto: [...] } (alias por campo). Al cargar, muestra una vista previa con el mapeo detectado y permite corregirlo antes de confirmar. Las filas que no se pudieron leer se listan con su motivo.

3) Alcance de la notificación por sucursal: antes de crear una tabla sucursal↔comunas como en sigs_actas, revisa si ColegiosMatriz.sucursal y Sucursal ya permiten saber qué RBD pertenecen a una sucursal (la Etapa 6A lo necesita para "actas sin multa en el período"). Reutiliza eso; crea tabla nueva solo si es imprescindible y dime por qué.

4) Comparación (src/lib/multas/notificaciones/comparar.ts, función pura + carga de datos aparte):
   Para cada par folio+aspecto, cruza la fila JUNAEB con Multas_Elementos_Esenciales_Det y ElementosEsenciales_Det. Clasificación:
   - 'coincide' (diferencia de monto ≤ tolerancia configurable, ej. $1)
   - 'diferencia_monto' (muestra ambos montos y la diferencia, más UTM y raciones usadas por nosotros)
   - 'solo_junaeb' (JUNAEB multa y nosotros no tenemos NC o cálculo)
   - 'solo_interno' (tenemos NC calculado y no viene en la notificación)
   - 'sin_calculo' (el folio existe pero no está calculado)
   Si REGLAS_NC está activo, agrega los hallazgos del folio y aspecto. Totales por clasificación y en CLP.

5) UI: Áreas → Multas → "Notificaciones JUNAEB" (permiso manage_multas_notificaciones):
   - Lista de notificaciones, carga de nuevas (archivo + resolución + período + sucursal).
   - Detalle con la tabla comparativa, filtros por clasificación y KPIs (total JUNAEB, total interno, diferencia).
   - Export Excel de la comparación con el formato de "Comparacion_Notif_1 (8).xlsx".
   - Guarda el archivo original con src/lib/storage.ts (uploadPath), como hace api/elementos-esenciales/upload.

Fuera de alcance: la revisión manual de las diferencias y el export del Anexo 1 van en la Etapa 6B.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Carga `REX-2238/Anexo1.xlsx` y compara los totales con lo que muestra sigs_actas para esa misma notificación.
- Revisa 5 filas "diferencia_monto" y 5 "solo_junaeb" a mano.
- Folios testigo: **0 cambios**.
