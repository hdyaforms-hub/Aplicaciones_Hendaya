# Lo que falta respecto de sigs_actas

Revisión del 16-11-2026, hasta el commit `498df64` (rama `feature/multas-optimizacion-y-privilegios`).

| Bloque | Estado |
|---|---|
| C2.1 Horarios | ✅ Datos (la regla llega con C5) |
| C2.2 Estratos | ✅ Faltan los puntos 1 y 2 |
| C2.3 Dotación de manipuladoras por mes | ❌ |
| C2.4 Minuta planificada por mes | ❌ |
| C3 Nivel supervisado, bandejas y corrección manual de cantidades | ❌ |
| C4, C6 a C11 | ❌ |
| C5 Motor de reglas | 🟡 Solo las alertas de la IT; faltan reglas como "fuera de horario", que ya puede usar C2.1 |

## Puntos pendientes que menciona la tabla

1. **Las raciones no se filtran por licitación.** `getRacionesFolio` (`src/lib/multas/raciones.ts`) filtra solo por RBD, año, mes y servicio. Antes, `calculateAll` también filtraba por `licitacion: licId`. Si un RBD tiene PMPA de dos licitaciones en el mismo mes, el cálculo masivo ahora suma ambas.
2. **El cálculo masivo y el modal no coinciden con C2 encendido.** `calculateAll` siempre pasa `excluirEstratos: false`, pero el modal excluye los estratos cuando C2 está encendido. Además, la exclusión debería ir detrás de su propio interruptor, "Excluir estratos en raciones", y no de C2 completo.
3. **Parche en `src/lib/prisma.ts`.** El Proxy crea un `new PrismaClient()` cada vez que se lee una propiedad que no existe en el cliente, lo que puede agotar las conexiones a PostgreSQL. Conviene volver al singleton simple: correr `npx prisma generate` y reiniciar el servidor.

## Orden sugerido

1. Corregir los puntos 1 a 3.
2. C2.3 y C2.4.
3. C3.
4. C5.

El detalle de cada bloque está en [PENDIENTES_C2_C11_detalle.md](PENDIENTES_C2_C11_detalle.md).
