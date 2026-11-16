# Lo que falta respecto de sigs_actas

Revisión del 16-11-2026 (rama `feature/multas-optimizacion-y-privilegios`).

| Bloque | Estado |
|---|---|
| C2.1 Horarios de Servicio | ✅ Completado (Catálogo en Hub de Configuración; validación de horario lista para regla C5) |
| C2.2 Estratos Excluidos | ✅ Completado (Puntos 1 y 2 resueltos con interruptor independiente `estratosExcluidos`) |
| C2.3 Dotación de manipuladoras por mes | ✅ Completado (Catálogo en Hub, importador Excel masivo, CRUD manual y alerta ratio 1:70 en Aspecto H) |
| C2.4 Minuta planificada por mes | ✅ Completado (Catálogo en Hub, sincronización automática desde minutas del sistema, calendario de 31 días y contraste en Aspecto A) |
| C3 Nivel supervisado, bandejas y corrección manual de cantidades | ❌ Siguiente etapa a desarrollar |
| C4, C6 a C11 | ❌ Pendiente |
| C5 Motor de reglas | 🟡 Alertas base de la IT operativas; reglas avanzadas se integrarán tras C3 |

## Puntos pendientes resueltos

1. ✅ **Las raciones se filtran por licitación:** En `getRacionesFolio` (`src/lib/multas/raciones.ts`) se agregó el filtro explícito `licitacion: Number(licId)`. Multi-licitación por RBD ya no mezcla PMPA entre contratos.
2. ✅ **Paridad de cálculo masivo y modal:** Submódulo granular `estratosExcluidos` independiente dentro de C2. El cálculo masivo y el modal evalúan exactamente la misma condición: `c2.activo && c2.submodulos?.estratosExcluidos`.
3. ✅ **Singleton de Prisma limpio:** Eliminado el Proxy que arriesgaba agotamiento de pool de conexiones. Cliente regenerado de manera limpia y estable.

## Orden sugerido

1. ~~Corregir los puntos 1 a 3.~~ (✅ Completado)
2. ~~C2.3 y C2.4.~~ (✅ Completado)
3. **C3 Datos complementarios por folio** (C3.1 Nivel supervisado y bandejas; C3.2 Corrección manual de cantidades).
4. C5 Motor de reglas.

El detalle de cada bloque está en [PENDIENTES_C2_C11_detalle.md](PENDIENTES_C2_C11_detalle.md).
