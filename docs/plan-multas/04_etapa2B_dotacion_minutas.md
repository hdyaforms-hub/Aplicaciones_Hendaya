# Etapa 2B — Dotación de manipuladoras y minutas como fuentes de validación

**Objetivo:** tener disponibles, por RBD y mes, los datos que permiten validar los aspectos H (dotación) y A (minuta).
Esta etapa **solo carga y consulta los datos**; las reglas que los usan van en la Etapa 5B.

Punto clave: **reutilizar lo que ya existe** en AplicacionWeb antes de crear tablas nuevas
(hay modelo `Minutas`, módulos de personal y dotación, y carga masiva de manipuladoras).

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 2B del plan de integración de Multas: fuentes de validación para dotación (aspecto H) y minuta (aspecto A).

Paso 1 — Investigación (entrégame el informe ANTES de proponer código):
- Dotación: revisa src/lib/personal-dotacion-db-init.ts, /dashboard/mantenedor/manipuladoras y cualquier modelo de dotación o manipuladoras por RBD. ¿Existe hoy la cantidad oficial de manipuladoras por RBD y mes? ¿Con qué granularidad y de qué fuente?
- Minuta: revisa el modelo Minutas (schema.prisma ~624) y el módulo calculadora/minutas. ¿Permite saber qué preparación estaba planificada para un RBD (o cocina, programa o nivel), una fecha y un servicio?
- Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): _parse_manipuladoras_excel (~3325), _parse_minuta_excel (~3239) y comparar_minuta_aspecto_a (~3485), para entender qué datos necesita la validación.
- Conclusión: para cada fuente, indica si se puede reutilizar tal cual, si conviene un adaptador o si hay que crear una tabla nueva.

Paso 2 — Implementación (después de que apruebe el informe):
- Crea src/lib/multas/fuentes/dotacion.ts con `getDotacionOficial(rbd, anho, mes, licId)` → { total, fuente } | null.
- Crea src/lib/multas/fuentes/minuta.ts con `getMinutaPlanificada(rbd, fecha, servicioCodigo, nivel?, licId)` → lista de preparaciones planificadas | null.
- Si una fuente no existe en la aplicación: crea una tabla aditiva mínima (ej. MultaDotacionRbd {licId, anho, mes, rbd, total, archivo, cargadoPor}) y un mantenedor de carga Excel en /dashboard/mantenedor/multas/configuracion/dotacion, con vista previa antes de confirmar, reemplazo por mes y detalle de filas rechazadas. Usa exceljs o xlsx, que ya están instalados.
- Las tarjetas DOTACION_MANIPULADORAS y MINUTAS_VALIDACION del Hub enlazan a la pantalla correspondiente y muestran la cobertura: meses con datos y cantidad de RBD.
- Parámetros configurables por defecto (defaults.ts): DOTACION_MANIPULADORAS { umbralFaltantesPct: 50 }, MINUTAS_VALIDACION { compararPor: "nombrePreparacion", normalizarTildes: true }.

Fuera de alcance: no generes hallazgos ni cambies cálculos.

Muéstrame el informe del Paso 1 y espera mi aprobación.
```

## Cómo revisar
- Lee con calma el informe del Paso 1: aquí se decide si se duplica información o no.
- Prueba `getDotacionOficial` y `getMinutaPlanificada` con 3 RBD reales (pide a la IA un script de prueba de solo lectura).
- Folios testigo: **0 cambios**.
