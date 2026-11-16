# Lo que falta respecto de sigs_actas

Revisión del 16-11-2026 (rama `feature/multas-optimizacion-y-privilegios`).

| Bloque | Estado |
|---|---|
| C2.1 Horarios de Servicio | ✅ Completado (Catálogo en Hub de Configuración; validación de horario lista para regla C5) |
| C2.2 Estratos Excluidos | ✅ Completado (Puntos 1 y 2 resueltos con interruptor independiente `estratosExcluidos`) |
| C2.3 Dotación de manipuladoras por mes | ✅ Completado (Catálogo en Hub, importador Excel masivo, CRUD manual y alerta ratio 1:70 en Aspecto H) |
| C2.4 Minuta planificada por mes | ✅ Completado (Catálogo en Hub, sincronización automática desde minutas del sistema, calendario de 31 días y contraste en Aspecto A) |
| C3 Nivel supervisado, bandejas y corrección manual de cantidades | ✅ Completado (C3.1 Nivel supervisado T/B/M y bandejas AQL; C3.2 Correcciones manuales con motivo obligatorio y trazabilidad; jerarquía centralizada en variables.ts; sub-interruptores en Hub de Configuración) |
| C4 Extracción robusta de cantidades multiaspecto | ❌ Siguiente etapa a desarrollar |
| C5 Motor de reglas | 🟡 Alertas base de la IT operativas; reglas avanzadas se integrarán tras C4 |
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

## Orden sugerido

1. ~~Corregir los puntos 1 a 3.~~ (✅ Completado)
2. ~~C2.3 y C2.4.~~ (✅ Completado)
3. ~~C3 Datos complementarios por folio (C3.1 y C3.2).~~ (✅ Completado)
4. **C4 Extracción robusta de cantidades multiaspecto** (o C5 Motor de reglas avanzadas).

El detalle de cada bloque está en [PENDIENTES_C2_C11_detalle.md](PENDIENTES_C2_C11_detalle.md).
