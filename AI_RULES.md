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

## 5. PUERTOS Y ENTORNOS DE EJECUCIÓN (MEMORIA DE PROYECTO)

*   **ENTORNO DE DESARROLLO / PRUEBAS:** Se ejecuta **exclusivamente** en el puerto **3001** (URL: `http://localhost:3001`).
    *   El script `"dev"` en `package.json` está configurado para levantar en este puerto (`next dev -p 3001`) para evitar colisiones y mantener el orden.
*   **ENTORNO DE PRODUCCIÓN:** Se ejecuta **exclusivamente** en el puerto **3000** (URL: `http://localhost:3000`).

## 6. DESPLIEGUE Y CONTROL DE VERSIONES (CRÍTICO)

*   **PROHIBIDO HACER PUSH A GITHUB O DEPLOY A PRODUCCIÓN AUTOMÁTICAMENTE:** La IA **NUNCA** debe ejecutar `git push`, `deploy_prod.bat`, `npm run build` en producción, ni ningún comando de despliegue, a menos que el usuario lo solicite **explícita y textualmente**.
*   Solo implementar cambios en el entorno de desarrollo (`d:\Programas\AplicacionWeb`, puerto 3001).
*   Esperar instrucción explícita del usuario para subir a GitHub o desplegar a producción.

## 7. INTEGRIDAD DE DATOS EN BASE DE DATOS (CRÍTICO)

*   **JAMÁS BORRAR DATOS DE TABLAS EXISTENTES:** Al agregar nuevas relaciones o columnas al schema de Prisma, **NUNCA** se debe perder la información de las tablas existentes.
*   **`prisma db push` es seguro** para agregar nuevas tablas y columnas sin eliminar datos. Pero si un cambio requiriese borrar datos, la IA debe **detenerse y pedir autorización explícita**.
*   **SIEMPRE REGENERAR EL CLIENTE PRISMA después de cambios al schema:** Al modificar `schema.prisma` se debe ejecutar `npx prisma generate` con el servidor de desarrollo **detenido** (para evitar el bloqueo del archivo DLL del motor de Prisma). Luego reiniciar el servidor. Si no se regenera el cliente, las consultas fallarán con `Unknown field` aunque la base de datos ya tenga las tablas correctas.
*   **Flujo correcto para cambios de schema:**
    1. Modificar `schema.prisma`
    2. Detener el servidor de desarrollo (`kill` de la tarea npm run dev)
    3. Ejecutar `npx prisma db push` (solo agrega, no borra datos)
    4. Ejecutar `npx prisma generate` (actualiza el cliente TypeScript)
    5. Reiniciar el servidor de desarrollo

