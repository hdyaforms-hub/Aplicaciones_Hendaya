# Etapa 4 — Extracción robusta de cantidades (F, J, K, D, E, L)

**Objetivo:** llevar a AplicacionWeb la lógica de sigs_actas para inferir cantidades desde las observaciones,
ya validada con actas reales. Por ejemplo:
- **F:** jerarquía de etiquetas FV / no-FV, variante del formulario y alerta "SUBCONTADA".
- **J:** cuenta **tipos** de instrumento, no unidades.

Es la etapa con **más riesgo de cambiar montos**. Por eso:
- Se implementa como funciones puras con pruebas.
- Va detrás del interruptor `EXTRACCION_V2`.
- Incluye un **modo comparación** que muestra el valor anterior y el nuevo, lado a lado, antes de adoptarlo.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 4 del plan de integración de Multas: extracción robusta de cantidades.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f):
- app/main.py: infer_cantidad (~1085), extract_f_total (~1346) y sus auxiliares extract_f_quantity_v30_detallado (~1299), _f_cantidad_variante, _f_lista_tiene_contenido, fallback_count_f_products (~1474), extract_k_normative_quantity (~888), count_l_field_values (~1048), extract_product_count_from_observation (~1017), validate_reasonableness (~1158), y split_items / canonical_food_item / is_noise_item (~900-970).
- app/parser_acta.py: extract_f_fields (~344) por coordenadas y extract_aspect_observation (~170), con el rescate del label fusionado en J.
- tests/test_f_nofv.py: 22 casos que deben seguir pasando una vez traducidos.
- CONTEXTO_PROYECTO_SIGS_PAE_v3.md §3b: fixes que NO se deben regresionar (J, F, G).

Contexto en AplicacionWeb: hoy calculateAll en src/app/dashboard/areas/multas/calculos/actions.ts (~línea 485) extrae MANIPULADORA, MANIPULADORAAFECTADA, ELEMENTOS, MATERIAPRIMA y MATERIAPRIMATPMPAP con regex sobre observacionesOMedioDeVerificacion. El PDF se extrae con python_scripts/extract_elementos.py (pdfplumber), que NO tiene campos por coordenadas.

1) Diagnóstico primero: compara qué texto llega hoy a ElementosEsenciales_Det.observacionesOMedioDeVerificacion con lo que recibe el parser de sigs_actas. Toma 5 folios testigo. Dime qué partes de la jerarquía de F se pueden replicar solo con texto y cuáles requerirían cambiar el extractor Python. NO cambies el extractor Python en esta etapa sin mi aprobación.

2) Implementación (después de aprobar el diagnóstico):
   - src/lib/multas/extraccion/ con una función pura por variable (extraerMateriaPrima, extraerInstrumentos, extraerManipuladoras, extraerElementos, extraerTpmpap, etc.). Cada una devuelve { valor: number|null, confianza: 'alta'|'media'|'baja', metodo: string, alertas: string[] } (ej. alerta SUBCONTADA). Nunca inventar cantidades: si no hay certeza, valor null + alerta.
   - Listas de palabras configurables (sinónimos, ruido, etiquetas normativas) en defaults.ts → EXTRACCION_V2, no hardcodeadas en la función.
   - Pruebas: el proyecto no tiene framework de tests. Propón el mínimo (ej. vitest como devDependency) y PREGUNTA antes de instalarlo. Traduce los casos de test_f_nofv.py y agrega casos con textos reales de los folios testigo.

3) Integración:
   - EXTRACCION_V2 apagado → se usa la extracción actual sin cambios.
   - Parámetro EXTRACCION_V2.modo: 'comparar' | 'aplicar'. En 'comparar', el cálculo sigue usando la extracción actual y el modal muestra al lado "V2 sugiere: X (método, confianza, alertas)". En 'aplicar', se usa V2 (los overrides de la Etapa 3 siguen teniendo prioridad).
   - Script scripts/multas-extraccion-compare.js (solo lectura) que recorra N folios y liste dónde difieren la extracción actual y V2, para revisarlos antes de pasar a 'aplicar'.

Muéstrame primero el diagnóstico del punto 1.
```

## Cómo revisar
- Pruebas: todas en verde. Pide ver la salida.
- Corre el script comparativo sobre unos 100 folios y revisa a mano al menos 10 diferencias. Pasa a `aplicar` **solo cuando estés de acuerdo** con las diferencias.
- Con `aplicar` activo, los cambios en los folios testigo deben ser exactamente los que revisaste; actualiza el snapshot conscientemente (`--save`).
