# Plan de integración sigs_actas → Módulo Multas (AplicacionWeb)

Este directorio contiene los **prompts por etapa** para incorporar al módulo de Multas
las funciones que hoy existen solo en la aplicación local `sigs_actas`
(`C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f`).

## Cómo usar este plan

1. Ejecuta **una etapa a la vez**, en orden. Cada archivo `NN_*.md` trae un prompt listo para copiar.
2. Pega el prompt completo en una conversación nueva del agente de **Antigravity**, con el workspace `C:\Desarrollo\Programas\AplicacionWeb` abierto.
   - Agrega también al workspace la carpeta de referencia `C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f`,
     para que el agente pueda leer el código de sigs_actas que citan los prompts. Si no puede acceder a ella, cópiala dentro de `AplicacionWeb\Otros\sigs_actas_ref\`
     (solo lectura; no debe formar parte del build) y reemplaza la ruta SIGS en el prompt.
   - Pídele que trabaje en modo planificación (que proponga el plan y espere tu aprobación antes de editar).
3. Cuando la IA termine, revisa tú mismo con la sección **"Cómo revisar"** de la etapa.
4. Si hay errores, **corrígelos en esa misma etapa** (en la misma sesión) antes de avanzar.
5. Al cerrar la etapa, usa el **prompt de cierre** (más abajo) y deja registro en `BITACORA.md`.
6. Recién entonces pasa a la siguiente etapa.

Todos los prompts están reunidos en orden en `PROMPTS_ANTIGRAVITY.md`, para copiarlos desde un solo archivo.

## Principios de diseño (aplican a todas las etapas)

### 1. Configuración separada de la operación
- **Configuración** (parámetros, catálogos, reglas, activar/desactivar módulos) vive en un único lugar:
  **Mantenedor → Multas → Configuración de Multas** (`/dashboard/mantenedor/multas/configuracion`).
  Es un "hub" con tarjetas; cada tarjeta abre su mantenedor. Los mantenedores que ya existen
  (UTM, Fórmulas de Aspecto EE, Servicios) se enlazan desde ahí **sin mover sus rutas**.
- **Operación** (trabajo diario: cálculos, análisis, notificaciones, expediente, soluciones)
  vive en **Áreas → Multas**, junto a "Cálculos de Elementos Esenciales" y "Descargos de actas".

### 2. Todo módulo nuevo nace APAGADO
- Cada módulo tiene un interruptor por licitación (tabla `MultaConfigModulo`, se crea en la Etapa 1).
- **Con el módulo apagado, el sistema debe comportarse exactamente igual que antes.** Esta es la
  principal protección contra conflictos: se puede desplegar código nuevo sin cambiar resultados.
- Los parámetros de cada módulo se guardan en JSON con **valores por defecto definidos en código**
  (`src/lib/multas/config/defaults.ts`). Si no hay fila en la BD, se usan los valores por defecto.

### 3. Todo lo normativo es dato, no código
- Factores, tolerancias, plazos, tablas AQL, horarios, estados de los procesos, textos de prompts de IA:
  todo configurable por licitación desde la interfaz. El código solo tiene la *lógica*, y la regla
  lee sus parámetros desde la configuración.

### 4. Cambios solo aditivos
- Solo se agregan tablas y columnas opcionales. No se renombran ni se borran tablas o columnas existentes.
- Base de datos **PostgreSQL**: usar `npx prisma db push` (nunca `migrate reset`) y seguir el flujo de `AI_RULES.md` §7.

### 5. Folios testigo (red de seguridad)
- En la Etapa 0 se toma una "foto" de los montos calculados para un conjunto de folios.
- Al cerrar cada etapa se compara contra esa foto. Si un monto cambió **sin que la etapa lo buscara**, es un error.

## Orden de etapas

| # | Archivo | Módulo | Depende de |
|---|---|---|---|
| 0 | `01_etapa0_preparacion.md` | Respaldo, rama, línea base y folios testigo | — |
| 1 | `02_etapa1_hub_configuracion.md` | Hub "Configuración de Multas" + interruptores + permisos | 0 |
| 2A | `03_etapa2A_catalogos_horarios_estratos.md` | Horarios por servicio y estratos excluidos | 1 |
| 2B | `04_etapa2B_dotacion_minutas.md` | Dotación de manipuladoras y minutas como fuentes de validación | 1 |
| 3 | `05_etapa3_datos_por_folio.md` | Nivel supervisado, bandejas y corrección manual de cantidades | 1, 2A |
| 4 | `06_etapa4_extraccion_cantidades.md` | Extracción robusta de cantidades (F, J, K, D, E, L) | 0, 3 |
| 5A | `07_etapa5A_motor_reglas_basicas.md` | Motor de reglas NC + reglas que usan solo el acta | 1, 4 |
| 5B | `08_etapa5B_reglas_contexto.md` | Reglas NC que usan catálogos externos + revisión por aspecto | 2A, 2B, 3, 5A |
| 6A | `09_etapa6A_notificaciones_junaeb.md` | Carga del Anexo 1 JUNAEB y comparación | 1 (ideal 5B) |
| 6B | `10_etapa6B_export_anexo1_revision.md` | Export Anexo 1 + revisión "Error JUNAEB / Error interno" | 6A |
| 7 | `11_etapa7_ciclo_legal_expediente.md` | Descargo formal, Resuelve, Recurso, Proceso judicial, Expediente, documentos | 6A |
| 8 | `12_etapa8_biblioteca_argumentos.md` | Biblioteca de argumentos de descargo | 6B, 7 |
| 9 | `13_etapa9_soluciones.md` | Diccionario de soluciones + plan de acción por acta + vista sucursal | 1 |
| 10 | `14_etapa10_ia.md` | Análisis con IA (por folio, masivo, planilla de pesaje) | 5A |
| 11 | `15_etapa11_tablero_exports.md` | Tablero y exportaciones ampliadas | 5B, 6A |

La Etapa 9 (Soluciones) es independiente: puede adelantarse si la necesitas antes.

---

## Reglas comunes (cada prompt pide leer esta sección)

1. Leer y cumplir `AI_RULES.md` completo (BD sin pérdida de datos, español, puerto 3001, sin push ni deploy).
2. **Antes de escribir código**, presentar un plan breve en español: archivos a crear o modificar,
   cambios de `schema.prisma` y riesgos. **Esperar mi aprobación.**
3. Seguir el estilo existente del módulo Multas: server actions en `actions.ts` con
   `'use server'`, verificación de permisos al inicio de cada acción, `prisma` desde `@/lib/prisma`,
   sesión con `getSession()` y auditoría con `logAuditAction` de `@/lib/audit` en escrituras.
4. Lógica de negocio pura (sin Prisma ni React) en `src/lib/multas/...`, para poder probarla aislada.
5. Todo permiso nuevo se registra en `src/app/dashboard/roles/page.tsx` (categoría
   `MANTENEDORES -> MULTAS` o `ÁREAS -> MULTAS`) y en `src/lib/menu-config.ts`.
   **Además, asignarlo al rol administrador** con un script en `scripts/` (ver `update_admin_perms_postgres.js`).
6. Cada módulo nuevo lee su interruptor con `isModuloActivo(licId, 'CODIGO')` (Etapa 1).
   Con el módulo apagado: no se muestra en el menú operativo, no se ejecuta y no cambia ningún cálculo.
7. Montos en pesos chilenos (CLP), formato `es-CL` (`$6.435.540`, decimales con coma). Unidades métricas.
8. UI: respetar contraste de `AI_RULES.md` §3 (fondo claro → texto oscuro).
9. Al terminar: `npx tsc --noEmit`, `npm run lint` sobre los archivos tocados y el script de folios testigo
   (`node scripts/multas-snapshot.js --compare`). Reportar los resultados reales, incluidos los errores.
10. No tocar módulos fuera de Multas salvo `menu-config.ts`, `roles/page.tsx` y `schema.prisma` (solo aditivo).
11. Referencia funcional: el código de sigs_actas es la **fuente de la lógica de negocio**, no del estilo.
    Se traduce a TypeScript/Prisma; no se copia su estructura (SQLite, JSON en columna, HTML vanilla).

---

## Prompt de cierre de etapa (usar al final de cada una)

```text
Vamos a cerrar la etapa actual del plan docs/plan-multas. Haz lo siguiente y repórtame los resultados reales:
1. Ejecuta `npx tsc --noEmit` y `npm run lint` (sobre los archivos tocados en esta etapa) y muéstrame los errores, si los hay.
2. Ejecuta `node scripts/multas-snapshot.js --compare` y explícame cada diferencia de monto: ¿la buscaba esta etapa o es una regresión?
3. Verifica que, con el/los módulo(s) de esta etapa APAGADOS en Configuración de Multas, las pantallas Cálculos y Descargos funcionan igual que antes.
4. Lista los cambios de schema.prisma que hiciste y confirma que fueron solo aditivos.
5. Agrega una entrada en docs/plan-multas/BITACORA.md con: fecha, etapa, archivos creados o modificados, tablas nuevas, permisos nuevos, pendientes y problemas conocidos.
No hagas commit ni push; yo lo reviso y lo hago.
```

## Prompt para corregir un error durante una etapa

```text
Durante la etapa actual del plan docs/plan-multas apareció este problema: <describe qué hiciste, qué esperabas y qué pasó; pega el error o la captura>.
Antes de cambiar código: explícame la causa raíz y qué archivos vas a tocar. No amplíes el alcance de la etapa ni "aproveches" de cambiar otras cosas.
Después de corregir, vuelve a correr la verificación de folios testigo y tsc.
```
