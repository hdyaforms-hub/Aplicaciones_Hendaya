# Etapa 5B — Reglas NC que usan catálogos externos + revisión transversal por aspecto

**Objetivo:** completar el motor con las reglas que cruzan el acta con horarios, dotación, minuta,
nivel supervisado y tablas AQL. Agregar además la vista de **revisión transversal por aspecto**.

## Reglas de esta etapa
`HORARIO-1`, `HORARIO-2`, `G-HORARIO-1`, `G-MUESTRA-1`, `G-NIVEL-1`, `G-AQL-RES-0/1/2`, `G-LECHE-CC-1`,
`H-RATIO-1`, `H-RATIO-2`, `H-MANIP-1`, y validación de A contra la minuta planificada.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar. El motor de reglas de la Etapa 5A ya existe en src/lib/multas/reglas/.

Etapa 5B del plan de integración de Multas: reglas que dependen de datos externos.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app):
- analisis_nc.py: regla_horario_servicio (~87), _bandejas_requeridas (~162), regla_g_horario_pesaje (~172), regla_g_muestra_insuficiente (~238), regla_g_nivel_no_identificado (~307), regla_h_ratio_observaciones (~497), regla_g_aql_resultado (~727), regla_g_leche_cc (~797), regla_h_manipuladoras (~825).
- main.py: comparar_minuta_aspecto_a (~3485) para la validación de A.

1) Extiende el ContextoActa de la Etapa 5A con proveedores de datos cargados de forma perezosa (lazy), solo si alguna regla activa los declara en `requiere`:
   - horarios → MultaHorarioServicio (Etapa 2A)
   - dotacion → getDotacionOficial (Etapa 2B)
   - minuta → getMinutaPlanificada (Etapa 2B)
   - datosFolio → MultaFolioDato (Etapa 3): nivel y bandejas
   - racionesPorNivel → getRacionesFolio por nivel (Etapas 2A y 3)
   Si falta un dato requerido, la regla NO falla: genera un hallazgo informativo "No se pudo evaluar <regla>: falta <dato>" (configurable si se muestra o no) o se omite.
   Si el módulo de un catálogo está apagado, la regla se trata como sin datos.

2) Parámetros configurables por regla (en MultaReglaAnalisis.parametros, con defaults):
   - Tabla AQL 6,5 (tamaño de lote → muestra mínima, aceptación y rechazo) como tabla editable en la interfaz, no en código.
   - Índice de manipuladoras (ej. 1:70), umbral de faltantes (%), tolerancia horaria en minutos y valores límite de leche (cc).

3) Nueva regla A-MINUTA-1: si A está NC y la preparación observada coincide con la planificada → hallazgo "impugnar". Si difiere, el hallazgo informativo muestra ambas preparaciones.

4) Revisión transversal por aspecto (equivale al panel-revision y a /api/aspectos de sigs_actas, main.py ~2769):
   - Página Áreas → Multas → "Revisión por aspecto": eliges una letra y ves todas las actas con ese aspecto NC en el período, con su observación, la cantidad extraída, el monto y los hallazgos. Sirve para detectar patrones o errores sistemáticos de un supervisor.
   - Filtros: licitación, período, sucursal, supervisor y con/sin hallazgos. Exportable a Excel.
   - Permiso: view_multas_analisis_nc.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Folio con supervisión fuera de horario: debe disparar `HORARIO-1/2`.
- 2026006471 con nivel B registrado: `G-NIVEL-1` **no** debe dispararse.
- Apaga `DOTACION_MANIPULADORAS` y verifica que `H-MANIP-1` no se rompa (queda "sin datos" u omitida).
- Folios testigo: **0 cambios en montos**.
