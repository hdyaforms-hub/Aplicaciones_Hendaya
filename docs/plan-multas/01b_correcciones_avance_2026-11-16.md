# Correcciones al avance del 12-11-2026 (antes de seguir con las etapas)

Revisión del commit `26dc6e7` (Privilegios, Instrucción de Trabajo EE y Restricciones por aspecto).
El avance va bien encaminado. Antes de continuar con las etapas conviene corregir estos puntos,
porque **ya afectan los montos calculados**.

Ejecuta primero la **Etapa 0** (`01_etapa0_preparacion.md`) para tener folios testigo, y luego este prompt.

## Prompt

```text
Lee AI_RULES.md y docs/plan-multas/00_LEEME.md (sección "Reglas comunes") antes de empezar.

Necesito corregir puntos del commit 26dc6e7 (Privilegios, Instrucción de Trabajo EE y Restricciones por aspecto) del módulo Multas. No agregues funcionalidades nuevas; solo estas correcciones. Muéstrame el plan antes de editar.

1) Seed automático de restricciones (src/lib/multas-ee-db-init.ts, punto 5):
   - Hoy se inserta "M año 2024 = $0" para TODAS las licitaciones que tengan aspecto M, en cada arranque del servidor, y si alguien BORRA la restricción vuelve a aparecer al reiniciar.
   - Quita el INSERT automático. En su lugar, en RestriccionesAspectoModal agrega un botón "Cargar restricciones sugeridas" que el usuario ejecuta a propósito para una licitación, y que no duplique restricciones existentes.
   - No borres las restricciones que ya existen en la BD.

2) Alcance de la restricción del aspecto M:
   - Según la referencia de sigs_actas (analisis_nc.py, regla_m_antes_junio_2025, citando IT-DAE-SUP026 pp.12 y 15), el aspecto M solo es exigible desde junio de 2025, por lo que las actas de enero a mayo de 2025 también deberían quedar en $0, no solo las de 2024.
   - No lo cambies tú en la BD: agrega en la sugerencia del punto 1 una restricción RANGO_FECHAS hasta 2025-05-31 y deja que yo confirme el corte contra la IT vigente (Rev. 03).

3) Comparación de fechas en RANGO_FECHAS (calculateAll y getDetalleFolioParaCalculo):
   - Hoy se usa fecha <= new Date(fechaHasta). Haz la comparación por día calendario (zona America/Santiago), incluyendo completo el día "hasta" y el día "desde". Centraliza la lógica en src/lib/multas/restricciones.ts (una sola función usada por ambos lugares; hoy está duplicada).
   - Usa el modelo Prisma Multas_Aspecto_EE_Restriccion en vez de $queryRawUnsafe.

4) Datos de la Instrucción de Trabajo hardcodeados (generarAlertasITAspecto en calculos/actions.ts):
   - La tabla AQL 6,5 está fija en el código y no coincide con la de sigs_actas (sigs: 2–15 → 2 bandejas, 16–50 → 3, 51–150 → 5, 151–500 → 8, 501–3200 → 13; aquí: 1–50 → 3, 501–1200 → 13, 1201–3200 → 20, >3200 → 32). Muéstrame lo que contiene anexoPesajeJson de la IT cargada y usa esa tabla como fuente. Si la IT no la trae, usa una tabla editable por licitación (no código).
   - Lo mismo con las palabras de "causa no imputable": deben venir de causasImputabilidadJson o de una lista editable. Hoy "paro" detecta "comparó" o "reparo", y "temporal" detecta "temporalmente". Usa coincidencia por palabra completa y sin tildes.
   - Ratio 1:70 (H), rangos de temperatura (K), tolerancias (F) y pautas de solución de respaldo: muévelos a parámetros por licitación con valor por defecto; si la IT tiene el dato, usa el de la IT.
   - Mueve generarAlertasITAspecto a src/lib/multas/it/alertas.ts como función pura, sin Prisma.
   - Redacción: cambia afirmaciones como "la multa es inválida" por "Posible defensa: …", porque es una alerta para revisión, no una conclusión.

5) Raciones para el AQL de G: hoy se usa el total de raciones del RBD/servicio. El tamaño de lote debe ser el del nivel controlado. Si no hay nivel registrado, muestra la alerta indicando que se calculó con el total y que debe verificarse el nivel (la captura del nivel llegará en la Etapa 3).

6) Tablas creadas por SQL (ensureMultasEETables):
   - El DDL no crea claves foráneas, pero schema.prisma define relaciones con onDelete: Cascade (User → Multas_Privilegio_EE, Licitacion → IT_Cab, IT_Cab → IT_Det). Verifica con una consulta de SOLO LECTURA a information_schema si esas FK existen hoy en la BD de desarrollo y en producción, y repórtame el resultado.
   - Propón cómo dejar alineados schema.prisma y la BD (por ejemplo, agregar las FK en el inicializador con IF NOT EXISTS, o hacer db push), sin perder datos y sin ejecutar nada destructivo. Espera mi aprobación.

7) Eliminación de actas EE (api/elementos-esenciales y [id]): al borrar un acta se borra su cálculo de multa, pero queda su Descargos_Cab/Det. Dime qué prefieres que pase y no lo cambies sin mi respuesta: (a) impedir el borrado si el folio tiene descargo con estados distintos de "Sin antecedente", (b) borrarlo también o (c) dejarlo como está y avisar en la confirmación.

Al terminar: npx tsc --noEmit, npm run lint sobre los archivos tocados y node scripts/multas-snapshot.js --compare, explicando cada diferencia de monto.
```

## Cómo revisar
- Borra una restricción y reinicia el servidor: no debe volver a aparecer.
- Un acta con M NC del 15-03-2025 debe quedar en $0 **solo** si cargaste la restricción sugerida.
- Un folio con G NC: la muestra mínima debe coincidir con la tabla del Anexo de la IT.
- Una observación con "comparó" no debe marcar causa no imputable.
