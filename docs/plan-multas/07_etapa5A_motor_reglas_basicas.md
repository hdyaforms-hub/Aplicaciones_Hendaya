# Etapa 5A — Motor de reglas NC (infraestructura + reglas que usan solo el acta)

**Objetivo:** el núcleo de valor de sigs_actas. Detectar NC **mal imputados o defendibles** y generar
hallazgos con fundamento normativo. El motor es configurable: cada regla se activa o desactiva
por licitación y sus parámetros, severidad y textos se editan desde la interfaz.

**No cambia montos:** los hallazgos son información para el descargo; no rebajan la multa calculada.

## Reglas de esta etapa (solo necesitan datos del acta)
`J-GK-NA-1`, `G-J-1`, `K-J-1`, `K-MARGEN-1`, `A-IGUAL-1`, `C-CONF-1`, `NC-VACIO-1`, `NC-PEND-1`,
`DESABASTO-1`, `F-CALIBRE-C8`, `M-PLAZO-1`, `B-CELULAR-1`, `SERVICIO-VACIO`.

## Prompt

```text
Lee AI_RULES.md, docs/plan-multas/00_LEEME.md (sección "Reglas comunes") y docs/plan-multas/ESTADO_ACTUAL.md antes de empezar.

Etapa 5A del plan de integración de Multas: motor de reglas de análisis de NC.

Referencia en sigs_actas (SIGS = C:\Desarrollo\Programas\1.-MDaigre\Multas\sigs_actas_real_v3_8_2_variante_f):
- app/analisis_nc.py completo: _hallazgo (~76) define la estructura del hallazgo; analizar_acta (~876) orquesta. Reglas de esta etapa: regla_j_impone_na_gk (~534), regla_gramaje_sin_balanza (~344), regla_temperatura_sin_termometro (~369), regla_temperatura_marginal (~393), regla_a_preparaciones_iguales (~425), regla_c_conforme (~707), regla_nc_sin_evidencia (~456), regla_desabastecimiento_no_imputable (~571), regla_f_calibre_es_c8 (~612), regla_m_antes_junio_2025 (~641), regla_b_celular_manipuladora (~677), además de NC-PEND-1 y SERVICIO-VACIO dentro de analizar_acta.
- app/main.py: _REGLAS_DEFAULT (~445) y reglas_config (~311), para el modelo de reglas configurables; endpoints /api/reglas (~4957).
- CONTEXTO_PROYECTO_SIGS_PAE_v3.md §4 y §11 ("Combinaciones críticas").

1) Modelos (aditivos):
   - MultaReglaAnalisis { id, licId, codigo @db.VarChar(30), aspecto (A..M o GENERAL), nombre, descripcion @db.Text, fundamento @db.Text (cita normativa, ej. IT-DAE-SUP026 p.14), severidad (alta|media|baja), tipo (impugnar|verificar|atenuante|informativo), activa Boolean, parametros @db.Text (JSON), orden Int, updatedBy, timestamps } @@unique([licId, codigo])
   - MultaHallazgo { id, folio, licId, codigoRegla, aspecto, severidad, tipo, titulo, detalle @db.Text, evidencia @db.Text (JSON con los valores que dispararon la regla), origen ('regla'|'ia'|'manual'), estadoRevision ('pendiente'|'aceptado'|'descartado') @default("pendiente"), notaRevision, revisadoPor, revisadoEn, versionMotor String, createdAt } con índices por folio y por codigoRegla.

2) Motor en src/lib/multas/reglas/:
   - types.ts: ContextoActa (cabecera, detalles con letra/estado/observación, variables resueltas, y espacio para datos externos que llenará la Etapa 5B) y ReglaDef { codigo, aspecto, requiere: string[] (ej. ['acta'] o ['horarios','dotacion']), parametrosDefault, evaluar(ctx, params) => HallazgoDraft[] }.
   - registry.ts: registro en código de todas las reglas (la lógica vive en código; su activación, parámetros y textos vienen de MultaReglaAnalisis).
   - motor.ts: `analizarFolio(folio)` → carga el contexto, ejecuta las reglas activas de la licitación, reemplaza los hallazgos de origen 'regla' de ese folio preservando el estadoRevision de los que se mantienen (mismo código y aspecto) y devuelve el resultado. Una regla que lanza una excepción se registra y NO detiene a las demás.
   - Una función pura por regla, en un archivo por aspecto (reglas/aspectoJ.ts, etc.). Todos los umbrales van a parámetros (ej. K-MARGEN-1 { toleranciaC: 1 }, M-PLAZO-1 { fechaCorte: "2025-06-01" }, DESABASTO-1 { palabrasClave: [...] }).
   - Pruebas unitarias de cada regla con textos reales (usa el framework que se decidió en la Etapa 4).

3) Configuración (tarjeta REGLAS_NC del Hub) → /dashboard/mantenedor/multas/configuracion/reglas:
   - Tabla de reglas por licitación: activa, severidad, tipo, nombre, fundamento, y parámetros editables con un formulario generado según el tipo de cada parámetro (número, fecha, lista de textos). No uses un textarea JSON crudo salvo como modo avanzado.
   - Botón "Cargar reglas por defecto" para la licitación (inserta las que faltan sin pisar las editadas).
   - Botón "Probar regla en folio X": muestra los hallazgos sin guardarlos (similar a testFormula de aspectos-ee).

4) Operación (si REGLAS_NC está activo):
   - Pestaña o panel "Hallazgos" en CalculoModal y en el detalle de DescargosClient: lista por aspecto con severidad, fundamento y evidencia, más botones Aceptar/Descartar con nota (auditoría).
   - Botón "Analizar" por folio y "Analizar selección / todos los filtrados" (en lotes de 50, igual que calculateAll) en la pantalla de Cálculos.
   - Columna o ícono en la grilla de Cálculos: cantidad de hallazgos altos.
   - Nueva página Áreas → Multas → "Análisis de NC" (permiso view_multas_analisis_nc), con filtros por licitación, período, sucursal, regla, severidad y estado de revisión. Exportable a Excel.

5) Permisos nuevos: manage_multas_reglas (configurar) y view_multas_analisis_nc (operar).

Muéstrame el plan antes de escribir código.
```

## Cómo revisar
- Folios conocidos: 2026006471 (G, J, K y M) debe disparar `J-GK-NA-1`; 2026001652 debe disparar `F-CALIBRE-C8`; 2025012484 debe disparar `K-MARGEN-1`.
- Cambia un parámetro (ej. la tolerancia de K a 0,5 °C), prueba la regla en el folio y verifica que el resultado cambie.
- Folios testigo: **0 cambios en montos**.
