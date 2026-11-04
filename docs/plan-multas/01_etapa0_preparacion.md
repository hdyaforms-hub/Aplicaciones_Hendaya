# Etapa 0 — Preparación, respaldo y folios testigo

**Objetivo:** antes de tocar código, dejar un punto seguro de retorno y una herramienta que detecte
si una etapa cambia montos sin querer.
**No cambia la aplicación.** Solo agrega un script de lectura.

## Antes del prompt (lo haces tú)
- Respaldo de la base PostgreSQL de desarrollo:
  `pg_dump -Fc -f respaldo_pre_multas_AAAAMMDD.dump <nombre_bd>` (o el método que uses hoy).
- Crear rama de trabajo: `git checkout -b feature/multas-config` y confirmar que no quedan cambios sin commitear.
- Elegir **10 a 20 folios testigo** con NC variados (idealmente con A, C, F, G, H, J, K y alguno con servicio manual o anulado).
  Puedes partir por los validados en sigs_actas: 2025012484, 2025012485, 2025012621, 2026001652, 2026006471, 2026006513 (si existen en tu BD).

## Prompt

```text
Lee AI_RULES.md y docs/plan-multas/00_LEEME.md (sección "Reglas comunes") antes de empezar.

Etapa 0 del plan de integración de Multas: preparación. NO modifiques código de la aplicación ni schema.prisma.

Necesito un script de solo lectura `scripts/multas-snapshot.js` (Node, usando el cliente Prisma de src/generated/client, como los otros scripts de scripts/) con dos modos:

1. `node scripts/multas-snapshot.js --save [--folios=f1,f2,...]`
   - Si no se pasan folios, usa la lista de docs/plan-multas/folios_testigo.txt (un folio por línea; créalo con un ejemplo comentado).
   - Para cada folio guarda en docs/plan-multas/snapshot_base.json: folio, rbd, fechaSupervision, licitación, anulado, servicio efectivo (manual o PDF), aspectos NC (letras), y desde Multas_Elementos_Esenciales_Cab/Det: montoTotalCalculado, estadoCalculo y, por aspecto, letraAspecto, montoMulta, formulaAplicada y variablesUsadas.
   - Incluye también el estado de Descargos_Cab/Det de esos folios (estado por aspecto y resolución).
2. `node scripts/multas-snapshot.js --compare`
   - Lee la misma información actual y la compara con snapshot_base.json.
   - Imprime una tabla de diferencias (folio, aspecto, campo, antes, después) y un resumen final "N folios sin cambios / M con cambios".
   - Termina con código de salida 1 si hay diferencias en montos.

Requisitos: solo lecturas (findMany/findUnique), nunca escrituras. Montos formateados en CLP con es-CL.

Además, crea docs/plan-multas/ESTADO_ACTUAL.md con un inventario breve (no más de 2 páginas) del módulo Multas actual: rutas, server actions, modelos Prisma que usa, permisos, y cómo se calcula hoy la multa (calculateAll / saveCalculo / variables auto-extraídas). Esto servirá de referencia para las demás etapas.

Muéstrame el plan antes de escribir los archivos.
```

## Cómo revisar
- Corre `node scripts/multas-snapshot.js --save` y luego `--compare` sin cambiar nada: debe decir **0 cambios**.
- Revisa `ESTADO_ACTUAL.md`: si algo está mal descrito, corrígelo ahora; las demás etapas se apoyan en él.
- Haz commit de la rama con el script, el snapshot y `ESTADO_ACTUAL.md`.
