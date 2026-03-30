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

## 4. PRESERVACIÓN DE PREGUNTAS Y OPCIONES (MATRIZ DE RIESGO Y OTROS)

*   **ESTRICTAMENTE PROHIBIDO MODIFICAR PREGUNTAS O RESPUESTAS:** No se debe alterar ni modificar la redacción, las etiquetas (labels) de los botones ni el contenido de las preguntas de la Matriz de Riesgo 2026 u otros formularios, a menos que el usuario lo solicite explícitamente y textualmente.
*   **Opciones Estándar (Las 6 opciones):** Las etiquetas deben ser exacta y literalmente:
    1. "Bueno / Cumple"
    2. "Malo requiere cambio o reparación / No Cumple"
    3. "No hay y requiere instalar"
    4. "No hay y no requiere"
    5. "No existe"
    6. "No Aplica"
*   **Excepción para "Patio de Servicio":** La pregunta "¿Existe Patio de servicio?" TIENE EXCLUSIVAMENTE dos opciones: "Existe" y "No existe". Esta es la única excepción a las 6 opciones estándar en la sección actual y NO debe perder sus botones exclusivos.
