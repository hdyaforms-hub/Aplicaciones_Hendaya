# Prompts para Antigravity — Plan de integración Multas

Copia un prompt a la vez, en orden. Antes de la Etapa 0, lee `00_LEEME.md` (principios, reglas comunes y prompts de cierre y corrección).
Después de cada etapa usa el **Prompt de cierre de etapa** que está al final de este archivo.


---

## Etapa 0 — Preparación, respaldo y folios testigo

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

---

## Etapa 1 — Hub "Configuración de Multas", interruptores por licitación y permisos

**Objetivo:** crear el lugar único donde se configurará todo lo nuevo, más la infraestructura
de interruptores y parámetros que usarán todas las etapas siguientes.
**No cambia ningún cálculo.**

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 1 del plan de integración de Multas: Hub de Configuración.

1) Modelo de datos (aditivo, schema.prisma):
   model MultaConfigModulo {
     id         String   @id @default(uuid())
     licId      Int
     modulo     String   @db.VarChar(40)   // código del módulo, ej. REGLAS_NC
     activo     Boolean  @default(false)
     parametros String?  @db.Text          // JSON con los parámetros del módulo
     updatedBy  String?
     createdAt  DateTime @default(now())
     updatedAt  DateTime @updatedAt
     licitacion Licitacion @relation(fields: [licId], references: [licId], onDelete: Cascade)
     @@unique([licId, modulo])
   }
   Agrega la relación inversa en Licitacion. Sigue el flujo de AI_RULES §7 (db push + generate).

2) Librería src/lib/multas/config/:
   - modulos.ts: catálogo en código de los módulos previstos (código, nombre, descripción, etapa, ruta de su mantenedor y su permiso). Códigos: CATALOGOS_HORARIOS, CATALOGOS_ESTRATOS, DOTACION_MANIPULADORAS, MINUTAS_VALIDACION, DATOS_FOLIO, EXTRACCION_V2, REGLAS_NC, NOTIFICACIONES_JUNAEB, CICLO_LEGAL, BIBLIOTECA_ARGUMENTOS, SOLUCIONES, IA. Por ahora todos aparecen como "Próximamente" salvo los que ya existen.
   - defaults.ts: parámetros por defecto de cada módulo (objeto vacío o mínimo por ahora; cada etapa los completará).
   - index.ts: funciones de servidor `isModuloActivo(licId, modulo)`, `getModuloConfig<T>(licId, modulo)` (mezcla los defaults con el JSON guardado; si el JSON es inválido, usa los defaults y registra un warning) y `setModuloConfig(...)`. Cache por request si lo estimas útil, sin cache global que quede desactualizada.
   - Valida el JSON de parámetros con un esquema por módulo (zod, si ya está en el proyecto; si no, validación manual simple. No agregues dependencias sin preguntarme).

3) Página hub /dashboard/mantenedor/multas/configuracion:
   - Selector de licitación (usa getLicitaciones de aspectos-ee/actions.ts o un equivalente).
   - Tarjetas agrupadas en tres secciones:
     a) "Parámetros base" (ya existen): UTM, Fórmulas de Aspecto EE, Servicios → enlazan a sus rutas actuales, sin moverlas.
     b) "Catálogos de validación" y c) "Módulos de análisis y gestión": una tarjeta por módulo del catálogo, con interruptor Activo/Inactivo por licitación, botón "Configurar" (deshabilitado si el módulo aún no existe) e indicador "Próximamente".
   - Activar o desactivar pide confirmación y queda en auditoría (logAuditAction) con usuario, licitación, módulo y valor.
   - Un módulo marcado "Próximamente" no se puede activar.

4) Permisos y menú:
   - Nuevo permiso `manage_multas_config` ("Configuración de Multas", categoría MANTENEDORES -> MULTAS) en roles/page.tsx.
   - En menu-config.ts, dentro de Mantenedor → Multas, agrega "Configuración de Multas" como primer subítem. Corrige el requiredPermission del grupo para que sea un arreglo con manage_utm, manage_aspectos_ee, manage_multa_servicios y manage_multas_config (hoy solo exige manage_utm).
   - Script scripts/add_perm_multas_config.js que agrega el permiso al rol admin, siguiendo el patrón de update_admin_perms_postgres.js y sin quitar otros permisos.

5) Fuera de alcance: no implementes ningún módulo todavía y no cambies calculos/ ni descargos/.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Entra con admin: debe aparecer **Mantenedor → Multas → Configuración de Multas**.
- Entra con un rol que tenga solo `manage_utm`: debe seguir viendo UTM igual que antes.
- Activar o desactivar una tarjeta "Próximamente" no debe ser posible.
- Folios testigo: **0 cambios**.

---

## Etapa 2A — Catálogos: horarios por servicio y estratos excluidos

**Objetivo:** dos catálogos simples y configurables por licitación que usarán las reglas y el cálculo.
- **Horarios por servicio:** ventana horaria de cada servicio, para las reglas HORARIO y G-HORARIO.
- **Estratos excluidos:** estratos del PMPA que no se suman en las raciones. En sigs_actas, por defecto: 206, 208 y 209.

⚠️ **Los estratos excluidos SÍ cambian montos** (afectan las raciones de A, C y G). Por eso su efecto
en el cálculo va detrás del interruptor `CATALOGOS_ESTRATOS`, que nace apagado.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 2A del plan de integración de Multas: catálogos de horarios por servicio y estratos excluidos.

Referencia funcional (solo lógica) en sigs_actas, ruta SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py:
- horarios_servicio: tabla en init_db (~línea 150), get_horarios_dict (~1629) y endpoints /api/horarios (~2031).
- estratos_excluidos: tabla e inserción por defecto 206/208/209 (~145 y ~255), estratos_excluidos_activos (~2597), y cómo procesar_maestro (~2624) omite esas filas.

1) Modelos (aditivos):
   - MultaHorarioServicio { id, licId, servicioCodigo (MultaServicio.codigo), horaInicio "HH:MM", horaFin "HH:MM", toleranciaMin Int @default(0), activo, timestamps } @@unique([licId, servicioCodigo])
   - MultaEstratoExcluido { id, licId, estrato String, descripcion, activo, timestamps } @@unique([licId, estrato])

2) Mantenedores (enlazados desde las tarjetas del Hub, que dejan de estar en "Próximamente"):
   - /dashboard/mantenedor/multas/configuracion/horarios: CRUD por licitación, validando HH:MM y que inicio < fin. Botón "Cargar valores sugeridos" (desayuno 06:30–10:30, almuerzo 11:30–15:30, once 15:00–18:00), mapeando a los códigos de MultaServicio existentes; si algún servicio no calza, muéstralo para asignarlo a mano.
   - /dashboard/mantenedor/multas/configuracion/estratos: CRUD por licitación, con botón "Cargar sugeridos (206, 208, 209)".
   - Permiso: reutiliza manage_multas_config.

3) Uso de los estratos en el cálculo (detrás del interruptor):
   - Hoy calculateAll y getDetalleFolioParaCalculo suman pMPA.raceqJunaeb por rbd/año/mes/licitación/servicio. Crea en src/lib/multas/raciones.ts una función única `getRacionesFolio({rbd, anho, mes, licId, servicio, nivel?})` que haga esa suma y, SOLO si CATALOGOS_ESTRATOS está activo para la licitación, excluya los estratos activos del catálogo.
   - Reemplaza las sumas duplicadas por esa función, sin cambiar el resultado cuando el interruptor está apagado. Esto lo verificamos con los folios testigo.
   - En el modal de cálculo, si se excluyeron raciones, muestra "Raciones: X (se excluyeron Y por estratos 206/208…)".

4) Los horarios solo se guardan en esta etapa; las reglas que los usan llegan en la Etapa 5B.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Con `CATALOGOS_ESTRATOS` apagado: folios testigo **0 cambios** (esto prueba que el refactor de raciones no alteró nada).
- Actívalo para una licitación, recalcula 2 o 3 folios con estratos excluidos y revisa a mano que las raciones bajen lo esperado.
- Vuelve a apagarlo antes de cerrar la etapa, o actualiza el snapshot si decides dejarlo activo.

---

## Etapa 2B — Dotación de manipuladoras y minutas como fuentes de validación

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

---

## Etapa 3 — Datos complementarios por folio (nivel supervisado, bandejas, correcciones manuales)

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

---

## Etapa 4 — Extracción robusta de cantidades (F, J, K, D, E, L)

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

---

## Etapa 5A — Motor de reglas NC (infraestructura + reglas que usan solo el acta)

**Objetivo:** el núcleo de valor de sigs_actas. Detectar NC **mal imputados o defendibles** y generar
hallazgos con fundamento normativo. El motor es configurable: cada regla se activa o desactiva
por licitación y sus parámetros, severidad y textos se editan desde la interfaz.

**No cambia montos:** los hallazgos son información para el descargo; no rebajan la multa calculada.

## Reglas de esta etapa (solo necesitan datos del acta)
`J-GK-NA-1`, `G-J-1`, `K-J-1`, `K-MARGEN-1`, `A-IGUAL-1`, `C-CONF-1`, `NC-VACIO-1`, `NC-PEND-1`,
`DESABASTO-1`, `F-CALIBRE-C8`, `M-PLAZO-1`, `B-CELULAR-1`, `SERVICIO-VACIO`.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 5A del plan de integración de Multas: motor de reglas de análisis de NC.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f):
- app/analisis_nc.py completo: _hallazgo (~76) define la estructura del hallazgo; analizar_acta (~876) orquesta. Reglas de esta etapa: regla_j_impone_na_gk (~534), regla_gramaje_sin_balanza (~344), regla_temperatura_sin_termometro (~369), regla_temperatura_marginal (~393), regla_a_preparaciones_iguales (~425), regla_c_conforme (~707), regla_nc_sin_evidencia (~456), regla_desabastecimiento_no_imputable (~571), regla_f_calibre_es_c8 (~612), regla_m_antes_junio_2025 (~641), regla_b_celular_manipuladora (~677), además de NC-PEND-1 y SERVICIO-VACIO dentro de analizar_acta.
- app/main.py: _REGLAS_DEFAULT (~445) y reglas_config (~311), para el modelo de reglas configurables; endpoints /api/reglas (~4957).
- CONTEXTO_PROYECTO_SIGS_PAE_v3.md §4 y §11 ("Combinaciones críticas").

1) Modelos (aditivos):
   - MultaReglaAnalisis { id, licId, codigo @db.VarChar(30), aspecto (A..M o GENERAL), nombre, descripcion @db.Text, fundamento @db.Text (cita normativa, ej. IT-DAE-SUP026 p.14), severidad (alta|media|baja), tipo (impugnar|verificar|atenuante|informativo), activa Boolean, parametros @db.Text (JSON), orden Int, updatedBy, timestamps } @@unique([licId, codigo])
   - MultaHallazgo { id, folio, licId, codigoRegla, aspecto, severidad, tipo, titulo, detalle @db.Text, evidencia @db.Text (JSON con los valores que dispararon la regla), origen ('regla'|'ia'|'manual'), estadoRevision ('pendiente'|'aceptado'|'descartado') @default("pendiente"), notaRevision, revisadoPor, revisadoEn, versionMotor String, createdAt } con índices por folio y por codigoRegla.

2) Motor en src/lib/multas/reglas/:
   - types.ts: ContextoActa (cabecera, detalles con letra/estado/observación, variables resueltas, y espacio para datos externos que llenará la Etapa 5B) y ReglaDef { codigo, aspecto, requiere: string[] (ej. ['acta'] o ['horarios','dotacion']), parametrosDefault, evaluar(ctx, params) => HallazgoDraft[] }.
   - registry.ts: registro en código de todas las reglas (la lógica vive en código; su activación, parámetros y textos vienen de MultaReglaAnalisis).
   - motor.ts: `analizarFolio(folio)` → carga el contexto, ejecuta las reglas activas de la licitación, reemplaza los hallazgos de origen 'regla' de ese folio preservando el estadoRevision de los que se mantienen (mismo código y aspecto) y devuelve el resultado. Una regla que lanza una excepción se registra y NO detiene a las demás.
   - Una función pura por regla, en un archivo por aspecto (reglas/aspectoJ.ts, etc.). Todos los umbrales van a parámetros (ej. K-MARGEN-1 { toleranciaC: 1 }, M-PLAZO-1 { fechaCorte: "2025-06-01" }, DESABASTO-1 { palabrasClave: [...] }).
   - Pruebas unitarias de cada regla con textos reales (usa el framework que se decidió en la Etapa 4).

3) Configuración (tarjeta REGLAS_NC del Hub) → /dashboard/mantenedor/multas/configuracion/reglas:
   - Tabla de reglas por licitación: activa, severidad, tipo, nombre, fundamento, y parámetros editables con un formulario generado según el tipo de cada parámetro (número, fecha, lista de textos). No uses un textarea JSON crudo salvo como modo avanzado.
   - Botón "Cargar reglas por defecto" para la licitación (inserta las que faltan sin pisar las editadas).
   - Botón "Probar regla en folio X": muestra los hallazgos sin guardarlos (similar a testFormula de aspectos-ee).

4) Operación (si REGLAS_NC está activo):
   - Pestaña o panel "Hallazgos" en CalculoModal y en el detalle de DescargosClient: lista por aspecto con severidad, fundamento y evidencia, más botones Aceptar/Descartar con nota (auditoría).
   - Botón "Analizar" por folio y "Analizar selección / todos los filtrados" (en lotes de 50, igual que calculateAll) en la pantalla de Cálculos.
   - Columna o ícono en la grilla de Cálculos: cantidad de hallazgos altos.
   - Nueva página Áreas → Multas → "Análisis de NC" (permiso view_multas_analisis_nc), con filtros por licitación, período, sucursal, regla, severidad y estado de revisión. Exportable a Excel.

5) Permisos nuevos: manage_multas_reglas (configurar) y view_multas_analisis_nc (operar).

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Folios conocidos: 2026006471 (G, J, K y M) debe disparar `J-GK-NA-1`; 2026001652 debe disparar `F-CALIBRE-C8`; 2025012484 debe disparar `K-MARGEN-1`.
- Cambia un parámetro (ej. la tolerancia de K a 0,5 °C), prueba la regla en el folio y verifica que el resultado cambie.
- Folios testigo: **0 cambios en montos**.

---

## Etapa 5B — Reglas NC que usan catálogos externos + revisión transversal por aspecto

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

---

## Etapa 6A — Notificaciones JUNAEB: carga del Anexo 1 y comparación

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

---

## Etapa 6B — Export Anexo 1 + revisión de diferencias ("Error JUNAEB" / "Error interno")

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

---

## Etapa 7 — Ciclo legal y expediente: Descargo formal, Resuelve, Recurso, Proceso judicial y documentos

**Objetivo:** modelar el proceso completo después de la notificación.

```
Notificación (REX) → Descargo presentado → Resuelve (monto final) → Recurso administrativo → Proceso judicial
```

Más un **expediente navegable** por folio, REX o descargo, con sus documentos.

**Punto delicado:** ya existen `Descargos_Cab/Det`, que hacen el *seguimiento por folio y aspecto*
(Sin antecedente / Solucionado / No Solucionado + N° resolución). **No se reemplazan.** El "Descargo formal"
nuevo es el **escrito presentado a JUNAEB** para una notificación, que agrupa varios folios, y se vincula a lo existente.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar. Ya existen MultaNotificacion (Etapa 6A) y el módulo actual de descargos en src/app/dashboard/areas/multas/descargos/.

Etapa 7 del plan de integración de Multas: ciclo legal y expediente.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): tablas descargos, resuelves, recursos_admin y procesos_judiciales (~259-321), documentos (~244), endpoints de CRUD (~4906-5236), expediente_por_folio (~4650), expediente_por_rex (~4752), expediente_por_notif (~4866), expediente_por_descargo (~5063) y el gestor documental (~4413-4648).

Paso 1 — Análisis (entrégamelo antes de codificar):
- Cómo se relaciona el campo Descargos_Cab.resolucion (Float) con la REX de MultaNotificacion. ¿Es el mismo número? Propón cómo vincularlos sin romper los datos actuales (ej. columna opcional notificacionId en Descargos_Cab, poblada por un script que empareje por número, mostrándome antes las coincidencias y las ambigüedades).
- Documentos: el gestor documental existente (CarpetaDocumental/PrivilegioDocumental) está ligado a OneDrive. Evalúa si conviene usarlo para los documentos del proceso de multas o crear una tabla MultaDocumento con almacenamiento local (src/lib/storage.ts). Recomiéndame una opción con sus pros y contras.

Paso 2 — Implementación (tras aprobar el análisis):
1) Modelos (aditivos):
   - MultaDescargoFormal { id, licId, codigo @unique (correlativo configurable, ej. "DES-{REX}-{AÑO}"), notificacionId, fechaPresentacion?, descripcion, estado, observaciones, timestamps }
   - MultaResuelve { id, licId, rex @unique, notificacionId, descargoFormalId?, fecha, montoMulta Int (CLP), estado, observaciones, timestamps }
   - MultaRecurso { id, codigo @unique, resuelveId, fecha, tipo, estado, observaciones, timestamps }
   - MultaProcesoJudicial { id, codigo @unique, resuelveId, recursoId?, tipo, tribunal, rolCausa, fechaInicio, estado, notas, timestamps }
   - Documentos según la opción aprobada: entidad polimórfica (tipoEntidad: folio|notificacion|descargo|resuelve|recurso|judicial, entidadId).
2) Configurables por licitación (CICLO_LEGAL.parametros): catálogos de estados de cada entidad (código, nombre, color, orden, si es final), tipos de recurso (reposición, apelación, queja…), tipos de documento, formato de los correlativos y plazos legales en días hábiles por etapa (para alertas de vencimiento). Defaults tomados de sigs_actas.
3) UI en Áreas → Multas (permiso manage_multas_ciclo_legal):
   - Desde una notificación: "Crear descargo formal", "Registrar resuelve".
   - Listas de Resuelves, Recursos y Procesos judiciales con filtros.
   - Expediente: página /dashboard/areas/multas/expediente/[tipo]/[id] que muestra la línea de tiempo completa (acta → notificación → descargo → resuelve → recurso → judicial), los montos en cada paso (calculado, notificado, resuelto) y los documentos de cada entidad (subir, previsualizar PDF, descargar).
   - Alertas de plazos próximos a vencer según los plazos configurados.
4) Integración con lo existente: en DescargosClient, mostrar el enlace al expediente cuando el folio tenga notificación vinculada. No cambies el flujo actual de estados por aspecto.

Muéstrame el análisis del Paso 1 y espera mi aprobación.
```

## Cómo revisar
- Recorre el caso REX-2238: notificación → descargo → resuelve, con documentos adjuntos, y abre el expediente desde el folio y desde la REX.
- El módulo actual de Descargos sigue funcionando igual (asignar resolución, estados por aspecto).
- Folios testigo: **0 cambios**.

---

## Etapa 8 — Biblioteca de argumentos de descargo

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

---

## Etapa 9 — Soluciones: diccionario, plan de acción correctiva por acta y vista sucursal

**Objetivo:** cerrar el círculo operativo. Por cada acta con NC se genera un **plan de acción correctiva**
que se asigna a la sucursal; la sucursal registra lo que hizo y sube la evidencia. Esa evidencia
alimenta el estado "Solucionado / No Solucionado" del módulo de Descargos actual.

Esta etapa es **independiente** de las Etapas 4 a 8; puede adelantarse.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 9 del plan de integración de Multas: soluciones y plan de acción correctiva.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): tablas diccionario_soluciones, soluciones_acta y solucion_aspectos (~337-378); endpoints /api/diccionario_soluciones, /api/soluciones (~5403-5586); generar_documento_solucion (~5656, Word/PDF); crear_soluciones_pendientes (~5881); _get_user_rbds (~5451) para el rol sucursal. En CONTEXTO_PROYECTO_SIGS_PAE_v3.md §11, "Solucionabilidad de NC": ficha por aspecto con ¿es solucionable?, procedimiento, evidencia requerida y combinaciones críticas.

1) Modelos (aditivos):
   - MultaSolucionDiccionario { id, licId, aspecto, tipoNc?, titulo, accionCorrectiva @db.Text, plazoDias Int, evidenciaRequerida @db.Text, solucionable (usa los mismos valores que AspectoEE.solucionable), combinacionesCriticas @db.Text? (ej. "J+K: impugnar K"), activo, timestamps }
   - MultaSolucionActa { id, folio @unique, rbd, licId, estado, asignadoA?, sucursal?, fechaCreacion, fechaEnvio?, fechaCierre?, notasSucursal, notasAdmin, timestamps }
   - MultaSolucionAspecto { id, solucionId, letraAspecto, diccionarioId?, accionTomada @db.Text, plazoDias, fechaCompromiso?, estado, evidenciaDescripcion, evidenciaRuta?, timestamps }
   Estados configurables en SOLUCIONES.parametros (defaults: pendiente, en_proceso, enviado, aprobado, rechazado).

2) Diccionario (tarjeta SOLUCIONES del Hub) → /dashboard/mantenedor/multas/configuracion/soluciones: CRUD por licitación y aspecto. Muestra junto a cada aspecto lo que ya existe en AspectoEE.solucionable para no duplicar el criterio.

3) Plan por acta (Áreas → Multas → "Soluciones", permiso manage_multas_soluciones):
   - Botón "Crear planes pendientes" para todos los folios con NC no anulados y sin plan (configurable: automático al calcular o manual). Precarga cada aspecto con la entrada del diccionario.
   - Detalle: por aspecto, acción, plazo, fecha compromiso, evidencia (archivo con storage.ts) y estado. Botón "Aplicar diccionario".
   - Generar documento "Plan de Acción Correctiva" en PDF con jspdf/jspdf-autotable, que ya están en el proyecto (mismo estilo que generateMultasEEPDF.ts). Word solo si lo pido después.
   - Integración con Descargos: cuando un aspecto queda "aprobado" con evidencia, ofrece marcar el aspecto en Descargos_Det como "Solucionado" (con confirmación; nunca automático).

4) Vista sucursal: revisa cómo se filtra hoy por sucursal en el módulo (getSucursalesDisponibles, ColegiosMatriz.sucursal, src/lib/authFilters.ts) y reutilízalo para que un usuario con permiso view_multas_soluciones_sucursal vea solo los planes de sus RBD ("Mis tareas pendientes") y pueda cargar acciones y evidencia, pero no aprobar.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Crea planes para un mes. Entra con un usuario de sucursal: solo debe ver sus RBD.
- Sube evidencia, apruébala como admin y marca el aspecto como Solucionado en Descargos.
- Genera el PDF del plan y revisa su contenido.

---

## Etapa 10 — Análisis con IA (por folio, masivo y lectura de planilla de pesaje)

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

---

## Etapa 11 — Tablero y exportaciones ampliadas

**Objetivo:** que el tablero Multas EE y las exportaciones muestren el valor de los módulos nuevos:
- Monto impugnable.
- Hallazgos por regla.
- Diferencias con JUNAEB.
- Efectividad de los descargos.
- Avance de las soluciones.

Va al final porque consume datos de todas las etapas anteriores.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes"), docs/plan-multas/ESTADO_ACTUAL.md y docs/plan-multas/BITACORA.md antes de empezar.

Etapa 11 del plan de integración de Multas: tablero y exportaciones.

Contexto: el tablero actual está en src/app/dashboard/tablero/multas-ee/ (MultasEEDashboardClient.tsx, generateMultasEEPDF.ts) y su API en src/app/api/tablero/multas-ee/route.ts. Referencia en sigs_actas: get_dashboard (~2955 de main.py; 8 KPIs y 6 gráficos), export_csv (~2896) y _build_detalle_rows (~2813; detalle de 13 filas por acta con ~39 columnas).

1) Nuevas secciones del tablero, cada una visible solo si su módulo está activo para la licitación filtrada:
   - REGLAS_NC: monto en CLP con hallazgos "impugnar" (aceptados / pendientes), top reglas que más se disparan y hallazgos por supervisor.
   - NOTIFICACIONES_JUNAEB: total notificado vs. calculado, diferencias por clasificación y por estado de revisión.
   - CICLO_LEGAL / BIBLIOTECA: monto notificado → resuelto (rebaja obtenida), tasa de aceptación por aspecto y plazos por vencer.
   - SOLUCIONES: planes por estado, % cumplimiento en plazo por sucursal.
   Los cálculos van en la API, no en el cliente. Mantén el estilo visual actual (Recharts, mismas tarjetas).

2) PDF del tablero: agrega las secciones activas en generateMultasEEPDF.ts.

3) Export "Detalle de actas" (Excel con exceljs) desde Cálculos: una fila por folio+aspecto con cabecera del acta, estado CO/NC/NA, observación, variables y su origen (auto/guardado/corregido), fórmula, UTM, raciones, monto, hallazgos (códigos), estado de descargo, notificación, monto JUNAEB y estado de revisión. Las columnas incluidas son configurables (selector antes de exportar, con la última selección recordada por usuario).

4) Rendimiento: revisa que las consultas nuevas usen índices y no carguen todas las actas en memoria (hoy calculateAll filtra mes/año en JS: no repitas ese patrón en la API del tablero; filtra en la consulta).

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Apaga un módulo y verifica que su sección desaparezca del tablero y del PDF.
- Contrasta 2 o 3 KPIs con una consulta manual o con el Excel de detalle.
- Mide el tiempo de carga del tablero antes y después con un año completo de datos.

---

## Prompts de uso continuo
### Prompt de cierre de etapa (usar al final de cada una)

```text
Vamos a cerrar la etapa actual del plan docs/plan-multas. Haz lo siguiente y repórtame los resultados reales:
1. Ejecuta `npx tsc --noEmit` y `npm run lint` (sobre los archivos tocados en esta etapa) y muéstrame los errores, si los hay.
2. Ejecuta `node scripts/multas-snapshot.js --compare` y explícame cada diferencia de monto: ¿la buscaba esta etapa o es una regresión?
3. Verifica que, con el/los módulo(s) de esta etapa APAGADOS en Configuración de Multas, las pantallas Cálculos y Descargos funcionan igual que antes.
4. Lista los cambios de schema.prisma que hiciste y confirma que fueron solo aditivos.
5. Agrega una entrada en docs/plan-multas/BITACORA.md con: fecha, etapa, archivos creados o modificados, tablas nuevas, permisos nuevos, pendientes y problemas conocidos.
No hagas commit ni push; yo lo reviso y lo hago.
```

### Prompt para corregir un error durante una etapa

```text
Durante la etapa actual del plan docs/plan-multas apareció este problema: <describe qué hiciste, qué esperabas y qué pasó; pega el error o la captura>.
Antes de cambiar código: explícame la causa raíz y qué archivos vas a tocar. No amplíes el alcance de la etapa ni "aproveches" de cambiar otras cosas.
Después de corregir, vuelve a correr la verificación de folios testigo y tsc.
```
