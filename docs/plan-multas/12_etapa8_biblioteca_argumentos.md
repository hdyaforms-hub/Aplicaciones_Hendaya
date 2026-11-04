# Etapa 8 — Biblioteca de argumentos de descargo

**Objetivo:** convertir la experiencia de cada descargo en conocimiento reutilizable.
Por folio y aspecto se guarda:
- La observación del supervisor.
- El argumento presentado.
- La multa original y la final.
- El resultado: aceptado, rechazado o parcial.

Luego se puede buscar "¿qué argumentos funcionaron para K por temperatura?".

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar. Ya existen: hallazgos (Etapa 5), notificaciones y revisión de diferencias (Etapa 6) y ciclo legal (Etapa 7).

Etapa 8 del plan de integración de Multas: biblioteca de argumentos.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): tabla nc_argumentos (~322), importar_nc_argumentos (~5238; importa desde el Excel de descargos, ej. data/documentos/descargo/DES-2238-2026/Anexo1.xlsx), biblioteca_argumentos (~5358).

1) Modelo (aditivo): MultaArgumento { id, licId, folio, aspecto, servicio, observacion @db.Text, argumento @db.Text, fundamento @db.Text?, codigoRegla? (si nació de un hallazgo), multaOriginal Int?, multaFinal Int?, resultado (configurable; default: pendiente|aceptado|rechazado|parcial), fuente ('importado'|'manual'|'hallazgo'|'error_junaeb'), notificacionId?, descargoFormalId?, resuelveId?, etiquetas String? (lista separada por comas), createdBy, timestamps } @@unique([folio, aspecto, descargoFormalId])

2) Alimentación:
   - Importar desde Excel de descargos, con mapeo de columnas configurable y vista previa (igual patrón que la Etapa 6A).
   - Desde un hallazgo aceptado: botón "Usar como argumento" que precarga el texto con fundamento y evidencia.
   - Desde la revisión de diferencias: las filas "Error JUNAEB" generan un argumento borrador (fuente error_junaeb) con la nota de revisión.
   - Al registrar un Resuelve (Etapa 7): permite completar multaFinal y resultado de los argumentos de ese descargo.

3) Consulta: Áreas → Multas → "Biblioteca de argumentos" (permiso view_multas_biblioteca; editar con manage_multas_biblioteca):
   - Búsqueda por texto, filtros por aspecto, regla, resultado y licitación.
   - Estadística por aspecto/regla: % aceptado y monto rebajado en CLP.
   - En el detalle de DescargosClient y en el panel de Hallazgos: "Argumentos similares" (mismo aspecto y regla, ordenados por tasa de éxito). Por ahora búsqueda simple por aspecto/regla/palabras clave; nada de IA en esta etapa.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Importa `DES-2238-2026/Anexo1.xlsx` y revisa que los argumentos queden por folio y aspecto.
- Acepta un hallazgo, conviértelo en argumento y verifica que aparezca en "Argumentos similares" de otro folio con el mismo aspecto.
