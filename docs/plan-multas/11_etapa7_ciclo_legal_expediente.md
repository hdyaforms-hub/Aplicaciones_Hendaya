# Etapa 7 — Ciclo legal y expediente: Descargo formal, Resuelve, Recurso, Proceso judicial y documentos

**Objetivo:** modelar el proceso completo después de la notificación.

```
Notificación (REX) → Descargo presentado → Resuelve (monto final) → Recurso administrativo → Proceso judicial
```

Más un **expediente navegable** por folio, REX o descargo, con sus documentos.

**Punto delicado:** ya existen `Descargos_Cab/Det`, que hacen el *seguimiento por folio y aspecto*
(Sin antecedente / Solucionado / No Solucionado + N° resolución). **No se reemplazan.** El "Descargo formal"
nuevo es el **escrito presentado a JUNAEB** para una notificación, que agrupa varios folios, y se vincula a lo existente.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar. Ya existen MultaNotificacion (Etapa 6A) y el módulo actual de descargos en src/app/dashboard/areas/multas/descargos/.

Etapa 7 del plan de integración de Multas: ciclo legal y expediente.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py): tablas descargos, resuelves, recursos_admin y procesos_judiciales (~259-321), documentos (~244), endpoints de CRUD (~4906-5236), expediente_por_folio (~4650), expediente_por_rex (~4752), expediente_por_notif (~4866), expediente_por_descargo (~5063) y el gestor documental (~4413-4648).

Paso 1 — Análisis (entrégamelo antes de codificar):
- Cómo se relaciona el campo Descargos_Cab.resolucion (Float) con la REX de MultaNotificacion. ¿Es el mismo número? Propón cómo vincularlos sin romper los datos actuales (ej. columna opcional notificacionId en Descargos_Cab, poblada por un script que empareje por número, mostrándome antes las coincidencias y las ambigüedades).
- Documentos: el gestor documental existente (CarpetaDocumental/PrivilegioDocumental) está ligado a OneDrive. Evalúa si conviene usarlo para los documentos del proceso de multas o crear una tabla MultaDocumento con almacenamiento local (src/lib/storage.ts). Recomiéndame una opción con sus pros y contras.

Paso 2 — Implementación (tras aprobar el análisis):
1) Modelos (aditivos):
   - MultaDescargoFormal { id, licId, codigo @unique (correlativo configurable, ej. "DES-{REX}-{AÑO}"), notificacionId, fechaPresentacion?, descripcion, estado, observaciones, timestamps }
   - MultaResuelve { id, licId, rex @unique, notificacionId, descargoFormalId?, fecha, montoMulta Int (CLP), estado, observaciones, timestamps }
   - MultaRecurso { id, codigo @unique, resuelveId, fecha, tipo, estado, observaciones, timestamps }
   - MultaProcesoJudicial { id, codigo @unique, resuelveId, recursoId?, tipo, tribunal, rolCausa, fechaInicio, estado, notas, timestamps }
   - Documentos según la opción aprobada: entidad polimórfica (tipoEntidad: folio|notificacion|descargo|resuelve|recurso|judicial, entidadId).
2) Configurables por licitación (CICLO_LEGAL.parametros): catálogos de estados de cada entidad (código, nombre, color, orden, si es final), tipos de recurso (reposición, apelación, queja…), tipos de documento, formato de los correlativos y plazos legales en días hábiles por etapa (para alertas de vencimiento). Defaults tomados de sigs_actas.
3) UI en Áreas → Multas (permiso manage_multas_ciclo_legal):
   - Desde una notificación: "Crear descargo formal", "Registrar resuelve".
   - Listas de Resuelves, Recursos y Procesos judiciales con filtros.
   - Expediente: página /dashboard/areas/multas/expediente/[tipo]/[id] que muestra la línea de tiempo completa (acta → notificación → descargo → resuelve → recurso → judicial), los montos en cada paso (calculado, notificado, resuelto) y los documentos de cada entidad (subir, previsualizar PDF, descargar).
   - Alertas de plazos próximos a vencer según los plazos configurados.
4) Integración con lo existente: en DescargosClient, mostrar el enlace al expediente cuando el folio tenga notificación vinculada. No cambies el flujo actual de estados por aspecto.

Muéstrame el análisis del Paso 1 y espera mi aprobación.
```

## Cómo revisar
- Recorre el caso REX-2238: notificación → descargo → resuelve, con documentos adjuntos, y abre el expediente desde el folio y desde la REX.
- El módulo actual de Descargos sigue funcionando igual (asignar resolución, estados por aspecto).
- Folios testigo: **0 cambios**.
