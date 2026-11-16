# Lo que falta respecto de sigs_actas

Revisión del 16-11-2026 (rama `feature/multas-optimizacion-y-privilegios`).

| Bloque | Estado |
|---|---|
| C2.1 Horarios de Servicio | ✅ Completado (Catálogo en Hub de Configuración; validación de horario lista para regla C5) |
| C2.2 Estratos Excluidos | ✅ Completado (Puntos 1 y 2 resueltos con interruptor independiente `estratosExcluidos`) |
| C2.3 Dotación de manipuladoras por mes | ✅ Completado (Catálogo en Hub, importador Excel masivo, CRUD manual y alerta ratio 1:70 en Aspecto H) |
| C2.4 Minuta planificada por mes | ✅ Completado (Catálogo en Hub, sincronización automática desde minutas del sistema, calendario de 31 días y contraste en Aspecto A) |
| C3 Nivel supervisado, bandejas y corrección manual de cantidades | ✅ Completado (C3.1 Nivel supervisado T/B/M y bandejas AQL; C3.2 Correcciones manuales con motivo obligatorio y trazabilidad; jerarquía centralizada en variables.ts; sub-interruptores en Hub de Configuración) |
| C4 Extracción robusta de cantidades multiaspecto | ✅ Completado (Homologación 100% de sigs_actas en extractor.ts: F con separación FV/No-FV y alerta SUBCONTADA; J con tipos de instrumento máx 2; K, D, E, L; Modo Comparación masivo en Hub; Diagnóstico por folio en modal; invarianza preservada) |
| C5 Motor de reglas | 🟡 Alertas base de la IT operativas; reglas avanzadas (19 reglas de sigs_actas) es la siguiente etapa |
| C6 a C11 | ❌ Pendiente |

## Puntos pendientes resueltos

1. ✅ **Las raciones se filtran por licitación:** En `getRacionesFolio` (`src/lib/multas/raciones.ts`) se agregó el filtro explícito `licitacion: Number(licId)`. Multi-licitación por RBD ya no mezcla PMPA entre contratos.
2. ✅ **Paridad de cálculo masivo y modal:** Submódulo granular `estratosExcluidos` independiente dentro de C2. El cálculo masivo y el modal evalúan exactamente la misma condición: `c2.activo && c2.submodulos?.estratosExcluidos`.
3. ✅ **Singleton de Prisma limpio:** Eliminado el Proxy que arriesgaba agotamiento de pool de conexiones. Cliente regenerado de manera limpia y estable con `getMultasDelegate`.
4. ✅ **Etapa 3 - Datos complementarios por folio (C3):**
   - **C3.1**: Modelos `Multas_Folio_Dato` y `Multas_Cantidad_Override` con DDL idempotente. Nivel supervisado (`T`, `B`, `M`) y bandejas AQL en cabecera de cálculo.
   - **C3.2**: Corrección manual de variables (`MANIPULADORA`, `MATERIAPRIMA`, etc.) por aspecto con motivo obligatorio, trazabilidad y botón revertir.
   - **Centralización**: `src/lib/multas/variables.ts` unifica `OVERRIDE MANUAL` > `GUARDADO PREVIO` > `EXTRACCION AUTOMATICA`.
   - **Hub de Configuración**: Sub-interruptores granulares para C3 por licitación (nacen desactivados para preservar 100% invarianza histórica).
5. ✅ **Etapa 4 - Extracción robusta de cantidades multiaspecto (C4):**
   - **Módulo `src/lib/multas/extractor.ts`**: Homologado desde `sigs_actas` con diccionario canónico de alimentos, detección de unidades, separación FV/No-FV en F, conteo de tipos de instrumento (máx 2) en J, servicios y temperaturas en K, matriz de elementos EPP en L, y detección de subconteo.
   - **Modo Comparación en Hub de Configuración**: Pestaña dedicada para auditar el impacto en montos folio por folio sin alterar la base de datos.
   - **Diagnóstico por Folio en `CalculoModal`**: Botón `🔍 Diagnóstico C4` que muestra la auditoría del texto leído, valores extraídos y alertas.
   - **Garantía de Invarianza**: Sub-interruptor `extraccionRobusta` apagado por defecto para que ninguna licitación histórica cambie montos hasta que sea activada explícitamente.

## Orden sugerido

1. ~~Corregir los puntos 1 a 3.~~ (✅ Completado)
2. ~~C2.3 y C2.4.~~ (✅ Completado)
3. ~~C3 Datos complementarios por folio (C3.1 y C3.2).~~ (✅ Completado)
4. ~~C4 Extracción robusta de cantidades multiaspecto.~~ (✅ Completado)
5. **C5 Motor de reglas avanzadas** (Completar las 19 reglas normativas de la IT).

El detalle de cada bloque está en [PENDIENTES_C2_C11_detalle.md](PENDIENTES_C2_C11_detalle.md).
