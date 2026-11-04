# Etapa 1 — Hub "Configuración de Multas", interruptores por licitación y permisos

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
