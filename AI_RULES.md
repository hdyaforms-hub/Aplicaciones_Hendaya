# Reglas Críticas de Proyecto para la IA

Estas reglas deben ser seguidas estrictamente por cualquier asistente de inteligencia artificial que trabaje en este proyecto.

## 1. PREVENCIÓN DE PÉRDIDA DE DATOS (CRÍTICO)

*   **NUNCA BORRAR NI REINICIAR LA BASE DE DATOS:** Al modificar el esquema de datos (`schema.prisma`) para agregar nuevos módulos, tablas o columnas, **ESTÁ ESTRICTAMENTE PROHIBIDO** ejecutar comandos que borren la información existente.
*   **Comandos Prohibidos:** Si el comando `npx prisma migrate dev` levanta una alerta indicando que necesita restablecer (resetear) la base de datos de SQLite, **SE DEBE CANCELAR EL COMANDO INMEDIATAMENTE**.
*   **Comandos Permitidos:** Para empujar cambios aditivos (nuevas tablas, columnas opcionales) a la base de datos sin perder información en el entorno de desarrollo con SQLite, usar **exclusivamente**:
    `npx prisma db push --accept-data-loss` (asegurándose previamente mediante un backup o check de que no haya pérdida real) o simplemente `npx prisma db push`.
*   **Consentimiento:** Si un cambio arquitectónico *obliga* a perder datos, **LA IA DEBE DETENERSE Y PEDIR AUTORIZACIÓN EXPLÍCITA AL USUARIO** antes de proceder, documentando el riesgo. **Nunca asumir el permiso de borrar datos.**
## 2. IDIOMA Y DOCUMENTACIÓN

*   **ESPAÑOL OBLIGATORIO:** Todos los planes de implementación, resúmenes, explicaciones y cualquier comunicación o artefacto (como `implementation_plan.md`, `task.md` y `walkthrough.md`) deben ser redactados explícitamente en **Español**.

## 3. DISEÑO DE INTERFAZ Y ESTILOS (UI/UX)

*   **CONTRASTE DE FUENTES EN FORMULARIOS Y INPUTS:**
    *   Si la caja de texto, lista desplegable (`select`) o formulario tiene un **fondo claro** (ej. páginas interiores del dashboard), el color de la fuente o texto debe ser obligatoriamente **oscuro (ej. negro o text-gray-900)** para asegurar una legibilidad perfecta.
    *   Si la caja de texto tiene un **fondo oscuro** (ej. la pantalla de conexión/login), el color de la fuente debe ser obligatoriamente **claro (ej. blanco o text-white)**.
