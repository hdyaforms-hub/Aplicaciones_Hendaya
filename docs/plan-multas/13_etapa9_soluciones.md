# Etapa 9 — Soluciones: diccionario, plan de acción correctiva por acta y vista sucursal

**Objetivo:** cerrar el círculo operativo. Por cada acta con NC se genera un **plan de acción correctiva**
que se asigna a la sucursal; la sucursal registra lo que hizo y sube la evidencia. Esa evidencia
alimenta el estado "Solucionado / No Solucionado" del módulo de Descargos actual.

Esta etapa es **independiente** de las Etapas 4 a 8; puede adelantarse.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 9 del plan de integración de Multas: soluciones y plan de acción correctiva.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): tablas diccionario_soluciones, soluciones_acta y solucion_aspectos (~337-378); endpoints /api/diccionario_soluciones, /api/soluciones (~5403-5586); generar_documento_solucion (~5656, Word/PDF); crear_soluciones_pendientes (~5881); _get_user_rbds (~5451) para el rol sucursal. En CONTEXTO_PROYECTO_SIGS_PAE_v3.md §11, "Solucionabilidad de NC": ficha por aspecto con ¿es solucionable?, procedimiento, evidencia requerida y combinaciones críticas.

1) Modelos (aditivos):
   - MultaSolucionDiccionario { id, licId, aspecto, tipoNc?, titulo, accionCorrectiva @db.Text, plazoDias Int, evidenciaRequerida @db.Text, solucionable (usa los mismos valores que AspectoEE.solucionable), combinacionesCriticas @db.Text? (ej. "J+K: impugnar K"), activo, timestamps }
   - MultaSolucionActa { id, folio @unique, rbd, licId, estado, asignadoA?, sucursal?, fechaCreacion, fechaEnvio?, fechaCierre?, notasSucursal, notasAdmin, timestamps }
   - MultaSolucionAspecto { id, solucionId, letraAspecto, diccionarioId?, accionTomada @db.Text, plazoDias, fechaCompromiso?, estado, evidenciaDescripcion, evidenciaRuta?, timestamps }
   Estados configurables en SOLUCIONES.parametros (defaults: pendiente, en_proceso, enviado, aprobado, rechazado).

2) Diccionario (tarjeta SOLUCIONES del Hub) → /dashboard/mantenedor/multas/configuracion/soluciones: CRUD por licitación y aspecto. Muestra junto a cada aspecto lo que ya existe en AspectoEE.solucionable para no duplicar el criterio.

3) Plan por acta (Áreas → Multas → "Soluciones", permiso manage_multas_soluciones):
   - Botón "Crear planes pendientes" para todos los folios con NC no anulados y sin plan (configurable: automático al calcular o manual). Precarga cada aspecto con la entrada del diccionario.
   - Detalle: por aspecto, acción, plazo, fecha compromiso, evidencia (archivo con storage.ts) y estado. Botón "Aplicar diccionario".
   - Generar documento "Plan de Acción Correctiva" en PDF con jspdf/jspdf-autotable, que ya están en el proyecto (mismo estilo que generateMultasEEPDF.ts). Word solo si lo pido después.
   - Integración con Descargos: cuando un aspecto queda "aprobado" con evidencia, ofrece marcar el aspecto en Descargos_Det como "Solucionado" (con confirmación; nunca automático).

4) Vista sucursal: revisa cómo se filtra hoy por sucursal en el módulo (getSucursalesDisponibles, ColegiosMatriz.sucursal, src/lib/authFilters.ts) y reutilízalo para que un usuario con permiso view_multas_soluciones_sucursal vea solo los planes de sus RBD ("Mis tareas pendientes") y pueda cargar acciones y evidencia, pero no aprobar.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Crea planes para un mes. Entra con un usuario de sucursal: solo debe ver sus RBD.
- Sube evidencia, apruébala como admin y marca el aspecto como Solucionado en Descargos.
- Genera el PDF del plan y revisa su contenido.
