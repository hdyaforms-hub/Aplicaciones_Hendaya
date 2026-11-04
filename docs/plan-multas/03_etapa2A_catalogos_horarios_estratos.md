# Etapa 2A — Catálogos: horarios por servicio y estratos excluidos

**Objetivo:** dos catálogos simples y configurables por licitación que usarán las reglas y el cálculo.
- **Horarios por servicio:** ventana horaria de cada servicio, para las reglas HORARIO y G-HORARIO.
- **Estratos excluidos:** estratos del PMPA que no se suman en las raciones. En sigs_actas, por defecto: 206, 208 y 209.

⚠️ **Los estratos excluidos SÍ cambian montos** (afectan las raciones de A, C y G). Por eso su efecto
en el cálculo va detrás del interruptor `CATALOGOS_ESTRATOS`, que nace apagado.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 2A del plan de integración de Multas: catálogos de horarios por servicio y estratos excluidos.

Referencia funcional (solo lógica) en sigs_actas, ruta SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f\app\main.py:
- horarios_servicio: tabla en init_db (~línea 150), get_horarios_dict (~1629) y endpoints /api/horarios (~2031).
- estratos_excluidos: tabla e inserción por defecto 206/208/209 (~145 y ~255), estratos_excluidos_activos (~2597), y cómo procesar_maestro (~2624) omite esas filas.

1) Modelos (aditivos):
   - MultaHorarioServicio { id, licId, servicioCodigo (MultaServicio.codigo), horaInicio "HH:MM", horaFin "HH:MM", toleranciaMin Int @default(0), activo, timestamps } @@unique([licId, servicioCodigo])
   - MultaEstratoExcluido { id, licId, estrato String, descripcion, activo, timestamps } @@unique([licId, estrato])

2) Mantenedores (enlazados desde las tarjetas del Hub, que dejan de estar en "Próximamente"):
   - /dashboard/mantenedor/multas/configuracion/horarios: CRUD por licitación, validando HH:MM y que inicio < fin. Botón "Cargar valores sugeridos" (desayuno 06:30–10:30, almuerzo 11:30–15:30, once 15:00–18:00), mapeando a los códigos de MultaServicio existentes; si algún servicio no calza, muéstralo para asignarlo a mano.
   - /dashboard/mantenedor/multas/configuracion/estratos: CRUD por licitación, con botón "Cargar sugeridos (206, 208, 209)".
   - Permiso: reutiliza manage_multas_config.

3) Uso de los estratos en el cálculo (detrás del interruptor):
   - Hoy calculateAll y getDetalleFolioParaCalculo suman pMPA.raceqJunaeb por rbd/año/mes/licitación/servicio. Crea en src/lib/multas/raciones.ts una función única `getRacionesFolio({rbd, anho, mes, licId, servicio, nivel?})` que haga esa suma y, SOLO si CATALOGOS_ESTRATOS está activo para la licitación, excluya los estratos activos del catálogo.
   - Reemplaza las sumas duplicadas por esa función, sin cambiar el resultado cuando el interruptor está apagado. Esto lo verificamos con los folios testigo.
   - En el modal de cálculo, si se excluyeron raciones, muestra "Raciones: X (se excluyeron Y por estratos 206/208…)".

4) Los horarios solo se guardan en esta etapa; las reglas que los usan llegan en la Etapa 5B.

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Con `CATALOGOS_ESTRATOS` apagado: folios testigo **0 cambios** (esto prueba que el refactor de raciones no alteró nada).
- Actívalo para una licitación, recalcula 2 o 3 folios con estratos excluidos y revisa a mano que las raciones bajen lo esperado.
- Vuelve a apagarlo antes de cerrar la etapa, o actualiza el snapshot si decides dejarlo activo.
