# Etapa 3 — Datos complementarios por folio (nivel supervisado, bandejas, correcciones manuales)

**Objetivo:** que el usuario pueda registrar por folio datos que el acta no trae o trae mal, con trazabilidad:
- **Nivel supervisado** (T, B o M) y **bandejas evaluadas y rechazadas**: G se calcula con las raciones de ese nivel y alimenta las reglas G-MUESTRA y G-AQL.
- **Corrección de cantidad por aspecto** con motivo obligatorio (en sigs_actas: `cantidad_overrides`).

Hoy `variablesUsadas` guarda valores ingresados a mano, pero sin motivo, sin autor por variable y
mezclados con los valores que se extraen automáticamente.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 3 del plan de integración de Multas: datos complementarios por folio.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): tabla nivel_supervisado (~181), get_raciones_por_nivel (~742), set_nivel_supervisado (~3590), cantidad_overrides (~146), get_override_qty (~1506) y cómo recalcular (~1639) usa raciones_nivel_supervisado para G.

1) Modelos (aditivos):
   - MultaFolioDato { id, folio @unique, nivelSupervisado String? (T|B|M), bandejasEvaluadas Int?, bandejasRechazadas Int?, motivo String? @db.Text, updatedBy, timestamps }
   - MultaCantidadOverride { id, folio, letraAspecto, variable String (MANIPULADORA, MATERIAPRIMA, INSTRUMENTO, ELEMENTOS, etc., las mismas variables de las fórmulas), valor Float, motivo String @db.Text (obligatorio), valorOriginal Float?, createdBy, timestamps } @@unique([folio, letraAspecto, variable])

2) Integración en el cálculo, SOLO si DATOS_FOLIO está activo para la licitación:
   - Prioridad de cada variable: override manual > valor guardado en variablesUsadas > extracción automática. Documenta esta prioridad en un comentario de src/lib/multas/variables.ts y centraliza ahí la resolución de variables (hoy está repetida entre calculateAll y getDetalleFolioParaCalculo).
   - Para G, si hay nivelSupervisado, usa getRacionesFolio(..., nivel) de la Etapa 2A (PMPA ya tiene columna nivel; verifica cómo vienen los valores y mapéalos a T/B/M con una tabla configurable en defaults.ts).
   - Con el interruptor apagado, el resultado debe ser idéntico al actual.

3) UI en CalculoModal.tsx:
   - Sección "Datos del folio": nivel, bandejas evaluadas y rechazadas, motivo.
   - Junto a cada variable, un ícono de lápiz para corregir con motivo obligatorio. Muestra el origen del valor con una etiqueta ("Auto", "Guardado" o "Corregido por <usuario> el <fecha>") y permite revertir la corrección.
   - Todo cambio queda en auditoría.

4) Parámetros configurables (defaults.ts → DATOS_FOLIO): { mapeoNiveles: {...}, exigirMotivo: true, rangoBandejas: {min:1, max:13} }.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Con `DATOS_FOLIO` apagado: folios testigo **0 cambios**.
- Activado: en un folio con G NC, registra el nivel B y verifica que G use las raciones de básica. Luego corrige una cantidad de F y verifica el monto y la etiqueta "Corregido".
- Revierte las correcciones de prueba.
