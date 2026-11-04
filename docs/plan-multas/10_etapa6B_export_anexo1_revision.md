# Etapa 6B — Export Anexo 1 + revisión de diferencias ("Error JUNAEB" / "Error interno")

**Objetivo:**
1. Generar el **Anexo 1 en formato JUNAEB** desde nuestros cálculos, con una hoja de descargos que incluye los hallazgos.
2. Implementar el pendiente de sigs_actas (CONTEXTO §13): que una persona **clasifique cada diferencia**
   como error de JUNAEB (base para impugnar) o error interno (dato que hay que corregir), con nota y trazabilidad.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar. La Etapa 6A (MultaNotificacion y comparación) ya existe.

Etapa 6B del plan de integración de Multas.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f):
- app/main.py: export_anexo1 (~3622), con hoja de Descargos y sección "--- ANÁLISIS IA ---".
- CONTEXTO_PROYECTO_SIGS_PAE_v3.md §13: requerimiento de validación de diferencias.

1) Export Anexo 1 (Áreas → Multas → Cálculos, botón "Exportar Anexo 1"):
   - Filtros: licitación, período, sucursal y estado de cálculo.
   - Hoja 1: formato JUNAEB (mismas columnas que el Anexo 1 que se recibe; toma los nombres del mapeo de la Etapa 6A).
   - Hoja 2 "Descargos": por folio y aspecto, los hallazgos aceptados o pendientes (no los descartados), con fundamento.
   - Las columnas y su orden son configurables en NOTIFICACIONES_JUNAEB.parametros.exportAnexo1. Usa exceljs.

2) Revisión de diferencias. Decisión de diseño: el estado vive POR FILA de comparación (folio + aspecto) dentro de una notificación, porque una misma acta puede tener un aspecto con error JUNAEB y otro sin diferencia. El folio muestra un resumen.
   - Modelo MultaRevisionDiferencia { id, notificacionId, folio, aspecto, clasificacionComparacion, estado ('sin_revisar'|'error_junaeb'|'error_interno'|'aceptado'), nota @db.Text (obligatoria si no es sin_revisar), revisadoPor, revisadoEn, timestamps } @@unique([notificacionId, folio, aspecto])
   - Los estados son configurables (nombre, color, ícono, si exigen nota) en NOTIFICACIONES_JUNAEB.parametros.estadosRevision, con defaults: 🔍 Sin revisar, ⚠ Error JUNAEB, 🔧 Error interno, ✓ Aceptado.
   - En la tabla comparativa de la Etapa 6A: selector de estado + nota en cada fila con diferencia, revisión masiva de filas seleccionadas e indicador por folio.
   - "Error interno" ofrece un enlace directo al CalculoModal de ese folio para corregir.
   - Historial: cada cambio de estado queda en auditoría.
   - "Error JUNAEB" deja la fila marcada para que la Etapa 8 (Biblioteca de argumentos) la tome. No implementes la biblioteca todavía; solo deja un campo o consulta clara que ella pueda usar.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Exporta el Anexo 1 de un período ya notificado y compáralo con el recibido (mismas columnas y folios).
- Marca 3 diferencias como "Error JUNAEB" con nota; intenta guardar sin nota (debe impedirlo).
- Folios testigo: **0 cambios**.
