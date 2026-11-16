# Pendientes respecto de sigs_actas: detalle C2–C11

Revisión del 16-11-2026, después del commit `272861e` (rama `feature/multas-optimizacion-y-privilegios`).

Este detalle sale de las tablas, las rutas y las reglas de sigs_actas (`app/main.py` y `app/analisis_nc.py`). Cada módulo indica lo que tiene sigs, lo que hay que construir en AplicacionWeb y cómo comprobarlo.

> **Regla general:** cada módulo nace **apagado** en el hub (Mantenedor → Multas → Configuración), con su propio interruptor por licitación.

---

## C2. Catálogos de validación
**En sigs:** las tablas `horarios_servicio`, `estratos_excluidos`, `manipuladoras_mes` y `minutas_mes`, cada una con su pantalla de carga.

### C2.1 Horarios por servicio
- **Qué es:** el rango horario válido de cada servicio (desayuno, almuerzo, once, etc.).
- **Para qué:** detectar supervisiones hechas fuera del horario del servicio, que pueden ser una defensa.
- **Construir:**
  - Un modelo con licitación, servicio, hora de inicio y hora de término.
  - Una pantalla de mantenedor que use los servicios de `MultaServicio`.
- **Comprobar:** un acta de almuerzo registrada a las 9:00 aparece marcada "fuera de horario" (la marca la genera C5).

### C2.2 Estratos excluidos
- **Qué es:** estratos que no se suman a las raciones. En sigs son el 206, el 208 y el 209.
- **Para qué:** la suma de raciones que usan las fórmulas y la tabla AQL.
- **Construir:** un modelo con licitación, estrato y motivo. Al sumar el PMPA se excluyen esos estratos.
- **⚠️ Cambia montos:** va detrás de su propio interruptor, "Excluir estratos en raciones", apagado por defecto.
- **Comprobar:** en un RBD con estrato 206, el total de raciones baja solo con el interruptor encendido.

### C2.3 Dotación oficial de manipuladoras por mes
- **Qué es:** cuántas manipuladoras tiene cada RBD por mes, cargadas desde un Excel.
- **Para qué:** validar el aspecto H: comparar la dotación real con la requerida según 1:70.
- **Construir:**
  - Primero revisa si los módulos de Personal o RRHH ya tienen la dotación por colegio. Si la tienen, úsala.
  - Si no, crea un modelo con año, mes, RBD y total, más una carga desde Excel.
- **Comprobar:** en un acta con H NC, la alerta muestra "Dotación oficial: X; requerida: Y".

### C2.4 Minuta planificada por mes
- **Qué es:** la minuta del mes por nivel. sigs la compara con el acta (`/api/actas/{folio}/minuta_cmp`).
- **Para qué:** validar el aspecto A, es decir, si lo servido coincide con lo planificado.
- **Construir:** revisa si el modelo `Minutas` existente trae fecha, nivel y preparación. Si los trae, solo falta la comparación.
- **Comprobar:** en un acta con A NC, se ve lado a lado la minuta planificada del día y lo que consignó el supervisor.

---

## C3. Datos complementarios por folio
**En sigs:** las tablas `nivel_supervisado` (folio, nivel, bandejas evaluadas, motivo) y `cantidad_overrides` (correcciones manuales con motivo).

### C3.1 Nivel supervisado y bandejas
- **Construir:**
  - Un modelo por folio con el nivel (T, B o M), las bandejas evaluadas, las bandejas rechazadas, el motivo, el autor y la fecha.
  - Una sección en el modal de cálculo para ingresarlos.
- **Integración:**
  - La alerta AQL de G usa este nivel **antes** que la variable `NIVELCONTROLADO`.
  - Las bandejas reemplazan la detección por texto ("pesó 3 bandejas").
- **Comprobar:** al ingresar el nivel B y 5 bandejas, la alerta usa las raciones de B y compara 5 con la muestra mínima.

### C3.2 Corrección manual de cantidades
- **Construir:**
  - Un modelo con folio, código de aspecto, valor original, valor corregido, motivo (obligatorio), autor y fecha.
  - En pantalla, cada cantidad muestra su origen: **automático**, **guardado** o **corregido**.
  - Un botón para deshacer la corrección.
  - Registro en `logAuditAction`.
- **Comprobar:** si corriges una cantidad, el monto se recalcula, queda el motivo y al deshacer vuelve al valor original.

---

## C4. Extracción robusta de cantidades
**En sigs:** `parser_acta.py`, la ruta `reparse_all` para reprocesar todas las actas y `/api/diagnostico/{folio}`, que muestra qué extrajo de cada acta.

- **Qué llevar** a `extract_elementos.py`:
  - **F:** separar frutas y verduras de los demás productos, y marcar "SUBCONTADA" cuando la cantidad extraída sea menor que los productos mencionados.
  - **J:** contar **tipos** de instrumento (balanza, termómetro), no unidades.
  - **K, D, E y L:** las cantidades de cada aspecto, con las mismas reglas de sigs.
- **Modo comparación (obligatorio al principio):**
  - Una pantalla que muestre, por folio, el valor actual y el valor nuevo con la diferencia.
  - Al principio **no cambia montos**: solo informa.
  - Cuando se confirme que funciona, un interruptor permite que el valor nuevo reemplace al actual.
- **Diagnóstico por folio:** un botón "Ver extracción" que muestre el texto leído y qué encontró en cada aspecto. Sirve para depurar.
- **Comprobar:** en 20 actas, las diferencias entre ambos valores se explican y el modo comparación no altera ningún monto.

---

## C5. Motor de reglas NC (completar)
**Ya existe:** alertas en pantalla para AQL, H, K, F, M y causas no imputables, con interruptores.

**En sigs hay 19 reglas** en `analisis_nc.py`, configurables en `reglas_config` (id, activa, parámetros):

| Regla de sigs | Qué detecta | ¿Existe en AplicacionWeb? |
|---|---|---|
| `horario_servicio` | Supervisión fuera del horario del servicio | ❌ (necesita C2.1) |
| `g_horario_pesaje` | Pesaje fuera del horario del servicio | ❌ (necesita C2.1) |
| `g_muestra_insuficiente` | Menos bandejas que la muestra AQL | 🟡 solo como alerta |
| `g_nivel_no_identificado` | G sin nivel supervisado | 🟡 solo como aviso |
| `g_aql_resultado` | Rechazadas mayores que Re según la tabla | ❌ (necesita C3.1) |
| `g_leche_cc` | Leche medida en cc y no en gramos | ❌ |
| `gramaje_sin_balanza` | G NC con balanza faltante en J | ❌ |
| `temperatura_sin_termometro` | K NC con termómetro faltante en J | ❌ |
| `temperatura_marginal` | Temperatura apenas fuera del rango | ❌ |
| `j_impone_na_gk` | Si J es NC, G y K deberían ser NA | ❌ |
| `f_calibre_es_c8` | F por calibre corresponde a otro ítem (C8) | ❌ |
| `a_preparaciones_iguales` | A NC con la preparación igual a la minuta | ❌ (necesita C2.4) |
| `b_celular_manipuladora` | B por uso de celular | ❌ |
| `c_conforme` | C NC con observación que indica conformidad | ❌ |
| `nc_sin_evidencia` | NC sin observación ni medio de verificación | ❌ |
| `h_ratio_observaciones` / `h_manipuladoras` | H contra el ratio y la dotación | 🟡 sin dotación (C2.3) |
| `desabastecimiento_no_imputable` | Causa no imputable | 🟡 solo como alerta |
| `m_antes_junio_2025` | M no exigible | ✅ (restricción + alerta) |

**Construir:**
- **Hallazgos guardados:** un modelo con folio, aspecto, regla, mensaje, severidad, estado (pendiente, aceptado o descartado), nota, autor y fecha. Las alertas actuales pasan a generar hallazgos.
- **Catálogo de reglas en el hub:** cada regla se activa por licitación y tiene parámetros editables (por ejemplo, el margen de la temperatura marginal).
- **Pantalla "Análisis de NC":** todos los hallazgos, con filtros por licitación, regla, estado y sucursal, más la acción de aceptar o descartar.
- **Pantalla "Revisión por aspecto":** una letra a la vez, todos sus folios con sus hallazgos.
- **Comprobar:** si se descarta un hallazgo con una nota, no reaparece al recalcular, y queda registrado quién lo descartó.

---

## C6. Notificaciones JUNAEB
**En sigs:** la tabla `notificaciones` (resolución, período, filas en JSON) y las rutas para subir, comparar, exportar y `export/anexo1`.

- **Carga:** subir el Excel del **Anexo 1** que llega con la REX. Se guarda la resolución, el período y las filas (folio, aspecto, monto).
- **Comparación fila por fila** contra el cálculo propio:
  - **Coincide**;
  - **Diferencia de monto**;
  - **Solo JUNAEB**: lo notificaron y no está en el cálculo propio;
  - **No incluido**: está en el cálculo propio y JUNAEB no lo notificó;
  - **Folio repetido** en otra resolución (sigs lo detecta).
- **Clasificación:** cada diferencia se marca como "Error JUNAEB" o "Error interno", con nota obligatoria.
- **Exportar:** el Anexo 1 en el formato JUNAEB, armado con el cálculo propio.
- **Comprobar:** cargar un Anexo 1 real y verificar que cada fila caiga en una categoría y que los totales cuadren.

---

## C7. Ciclo legal y expediente
**En sigs:** las tablas `descargos`, `resuelves`, `recursos_admin`, `procesos_judiciales` y `documentos`, más las vistas de expediente por folio, REX, notificación y descargo.

- **La cadena:** Notificación (REX) → **Descargo formal** (código, fecha, estado) → **Resuelve** (REX de respuesta y monto final) → **Recurso administrativo** (reposición o jerárquico) → **Proceso judicial** (tribunal, rol, estado y notas).
- **Diferencia con el módulo actual:** el Descargos actual trabaja **por folio y aspecto** (solucionado o no). El de sigs trabaja **por notificación**, agrupando varios folios. **No reemplazar el actual**: vincular cada folio del Descargos actual con el descargo formal.
- **Documentos:** adjuntar PDFs a cada etapa, con búsqueda y vista previa.
- **Expediente:** una vista con la línea de tiempo completa de un folio o de una REX, con todos sus documentos.
- **Comprobar:** desde un folio se llega a su notificación, su descargo, su resuelve y su recurso, con fechas y montos.

---

## C8. Biblioteca de argumentos
**En sigs:** la tabla `nc_argumentos`. Se llena importando la hoja **"Descargos"** del Excel del Anexo 1 y vinculando cada argumento con su acta.

- **Construir:**
  - Un modelo con folio, aspecto, argumento, REX, resultado (aceptado, rechazado o parcial) y monto rebajado.
  - Una importación desde la hoja "Descargos".
  - Una pantalla de biblioteca con búsqueda por aspecto y por texto.
- **Al preparar un descargo:** mostrar "argumentos similares", es decir, del mismo aspecto o regla y con resultado aceptado.
- **Comprobar:** al abrir un G NC, aparecen los argumentos de G que fueron aceptados antes.

---

## C9. Soluciones y plan de acción
**En sigs:** las tablas `diccionario_soluciones` (aspecto, tipo de NC, acción correctiva, plazo y evidencia requerida), `soluciones_acta` (folio, RBD, estado, asignado a, fechas y notas) y `solucion_aspectos` (acción tomada y evidencia), más `sucursal_comunas`.

- **Diccionario:** las soluciones tipo por aspecto. Se puede partir de la pauta del Anexo 3 que ya está en la IT.
- **Generar pendientes:** un botón que crea una tarea por cada acta con NC que aún no la tenga (`crear_pendientes`).
- **Flujo:** Pendiente → asignada a la sucursal → la sucursal registra la acción y sube la evidencia → el administrador cierra.
- **Vista de sucursal:** solo ve sus RBD. Usar `getUserEffectiveRbds`.
- **PDF del plan de acción** por acta.
- **Independiente:** no depende de C2 a C8, así que se puede adelantar.
- **Comprobar:** un usuario de sucursal ve solo sus actas, sube la evidencia, y el administrador la ve y cierra la tarea.

---

## C10. Análisis con IA
**En sigs:** `config_ia` (API key y modelo), `/api/analisis_ia/{folio}` y `/api/adjuntos/{folio}/extraer_pesaje`, que lee la planilla de pesaje con visión.

- **Configuración:** la API key **cifrada** en la base, el modelo y un tope de gasto. Solo el administrador la ve.
- **Análisis por folio:** la IA revisa el acta, los hallazgos de C5 y la IT, y propone defensas. **Complementa las reglas, no las reemplaza.**
- **Análisis masivo:** procesa en lote los folios de una notificación.
- **Lectura de la planilla de pesaje:** se sube el PDF y la IA precarga el nivel y las bandejas de C3.1, para que el usuario los confirme.
- **Registro de consumo:** quién, qué folio, tokens y costo.
- **Comprobar:** al subir una planilla, el nivel y las bandejas aparecen como sugerencia y no se guardan sin confirmación.

---

## C11. Tablero y exportaciones
**En sigs:** `/api/dashboard`, `export_csv` y `export_detalle_csv`.

- **Indicadores a agregar** al tablero de Multas EE:
  - monto calculado y monto impugnable (según los hallazgos aceptados);
  - hallazgos por regla y por aspecto;
  - diferencias con JUNAEB por categoría (C6);
  - rebaja obtenida en los resuelves (C7);
  - avance de soluciones por sucursal (C9).
- **Exportar a Excel** el detalle completo por folio y aspecto, con monto, hallazgos y estado legal.
- **Comprobar:** los totales del tablero cuadran con la suma del Excel exportado.

---

## Extras de sigs que no estaban en el cuadro
- **Adjuntos por folio** (`adjuntos_acta`): fotos y PDFs asociados al acta. Sirven como evidencia para C7 y C9.
- **Repositorio de documentos con búsqueda** (`documentos`): base compartida de C7.
- **Sucursal ↔ comunas** (`sucursal_comunas`): revisar si el modelo de colegios y sucursales ya lo cubre.
- **Reprocesar todas las actas** (`reparse_all`): útil al mejorar la extracción de C4.

---

## Orden y dependencias
```
C2 (catálogos) ─┐
                ├─► C5 (reglas completas) ─► C10 (IA)
C3 (por folio) ─┤
C4 (extracción)─┘
C6 (JUNAEB) ─► C7 (ciclo legal) ─► C8 (biblioteca)
C9 (soluciones): independiente
C11 (tablero): al final, junta todo
```

**Orden recomendado:** C2 + C3 → C5 → C6 → C7 → C8. **C9** se puede hacer en paralelo, y **C4, C10 y C11** van al final.

---

## Detalles menores pendientes de lo ya construido
- **Raciones = 1:** cae en la última fila de la tabla AQL y exige 13 bandejas. Usar la primera fila cuando las raciones estén bajo el mínimo.
- **Texto con la subsanabilidad apagada:** el modal muestra "NO (Módulo subsanabilidad desactivado)". Es mejor ocultar la fila.
- **Dependencia invertida:** `src/lib/multas/it/alertas.ts` importa tipos desde `src/app/.../configuracion/types.ts`. Moverlos a `src/lib/multas/config.ts`.
- **Base de desarrollo:** si hay parámetros guardados con el término "temporal", usar "Restablecer valores por defecto" en esa licitación.
- **Ac/Re de la tabla AQL:** verificarlos contra el Anexo de la IT y corregirlos en el hub si difieren.
