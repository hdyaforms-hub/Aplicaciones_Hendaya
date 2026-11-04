# Etapa 10 — Análisis con IA (por folio, masivo y lectura de planilla de pesaje)

**Objetivo:** que la IA complemente al motor de reglas con hallazgos que las reglas no cubren,
y que lea la planilla de pesaje (imagen o PDF) para obtener el nivel y las bandejas.
La IA **nunca reemplaza** ni pisa los hallazgos de reglas; sus hallazgos se guardan con origen 'ia'.

Tiene costo por uso. Por eso se configura con límites y queda registro de cada consumo.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar. El motor de reglas y MultaHallazgo (Etapa 5) ya existen.

Etapa 10 del plan de integración de Multas: análisis con IA usando la API de Anthropic (Claude).

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): llamar_anthropic (~2122), llamar_anthropic_vision (~2160), analisis_ia (~2246; solo envía aspectos NC + resumen_estados), extraer_pesaje (~3170) y la extracción robusta de JSON descrita en CONTEXTO_PROYECTO_SIGS_PAE_v3.md §3. Las lecciones aprendidas están en ese documento: no guardar la API key en el campo del modelo, max_tokens suficiente y manejo de errores 401/404/429.

Antes de codificar, consulta la documentación vigente de la API de Anthropic para elegir el modelo y el SDK oficial (@anthropic-ai/sdk). PREGÚNTAME antes de instalar dependencias. Usa salida estructurada (tool use o JSON schema) en vez de parsear texto libre.

1) Configuración (tarjeta IA del Hub, permiso manage_multas_ia):
   - API key guardada cifrada (revisa src/lib/crypto.ts y reutilízalo); nunca se devuelve completa al navegador (solo los últimos 4 caracteres) ni se escribe en logs ni en auditoría.
   - Parámetros por licitación en IA.parametros: modelo (seleccionable de una lista), max_tokens, temperatura, prompt de sistema editable (default: traducción del prompt de sigs_actas adaptado a la licitación), límite de folios por ejecución masiva y límite mensual de llamadas.
   - Botón "Probar conexión".

2) Modelos (aditivos):
   - MultaIaLlamada { id, folio?, tipo ('analisis'|'pesaje'), modelo, tokensEntrada, tokensSalida, estado ('ok'|'error'), error?, duracionMs, createdBy, createdAt }: registro de consumo.
   - Los hallazgos de la IA se guardan en MultaHallazgo con origen 'ia' (no crear otra tabla).

3) Análisis por folio:
   - src/lib/multas/ia/analizar.ts: arma el contexto con solo los aspectos NC + resumen CO/NC/NA + hallazgos de reglas ya existentes (para que no los repita y pueda complementarlos) + los argumentos exitosos más parecidos de la Biblioteca, si la Etapa 8 existe.
   - Respuesta estructurada: lista de hallazgos {aspecto, tipo, severidad, titulo, detalle, fundamento} + resumen.
   - Botón "Analizar con IA" en el panel de Hallazgos; ícono 🧠 en la grilla para los folios ya analizados; si falla, se muestra el error y el botón "Reintentar".

4) Análisis masivo: sobre los folios filtrados que no tienen análisis IA exitoso, con barra de progreso, contador ok/error y botón Cancelar. Procesamiento secuencial o con concurrencia baja configurable, respetando el límite. Si la ejecución en una server action puede exceder el timeout, propón una alternativa (cola en BD procesada por lotes desde el cliente).

5) Planilla de pesaje: en "Datos del folio" (Etapa 3), botón "Leer planilla de pesaje" que sube el PDF o la imagen, extrae con visión el nivel, las bandejas evaluadas y las rechazadas, y PRECARGA el formulario para que el usuario confirme. Nunca guardar sin confirmación.

6) Exports: los hallazgos IA aparecen en el Anexo 1 (hoja Descargos) y en la comparación de notificaciones con el prefijo [IA-TIPO], solo si están aceptados (configurable).

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- La API key no aparece en el HTML, en la consola del navegador ni en la tabla de auditoría.
- Analiza 3 folios conocidos y revisa que los hallazgos IA no dupliquen los de reglas.
- Revisa el consumo registrado y corre el masivo con 5 folios, probando también Cancelar.
