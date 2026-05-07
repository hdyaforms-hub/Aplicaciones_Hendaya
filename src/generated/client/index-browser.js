
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  permissions: 'permissions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  username: 'username',
  email: 'email',
  passwordHash: 'passwordHash',
  name: 'name',
  roleId: 'roleId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PMPAScalarFieldEnum = {
  id: 'id',
  sucursal: 'sucursal',
  ano: 'ano',
  mes: 'mes',
  rbd: 'rbd',
  licId: 'licId',
  programa: 'programa',
  estrato: 'estrato',
  raceq: 'raceq',
  servicio: 'servicio',
  uploadedBy: 'uploadedBy',
  createdAt: 'createdAt'
};

exports.Prisma.ColegiosScalarFieldEnum = {
  id: 'id',
  colut: 'colut',
  colRBD: 'colRBD',
  colRBDDV: 'colRBDDV',
  insid: 'insid',
  institucion: 'institucion',
  sucursal: 'sucursal',
  nombreEstablecimiento: 'nombreEstablecimiento',
  direccionEstablecimiento: 'direccionEstablecimiento',
  comuna: 'comuna',
  uploadedBy: 'uploadedBy'
};

exports.Prisma.IngRacionScalarFieldEnum = {
  id: 'id',
  usuario: 'usuario',
  ubicacion: 'ubicacion',
  fechaSistema: 'fechaSistema',
  fechaIngreso: 'fechaIngreso',
  rbd: 'rbd',
  licId: 'licId',
  nombreEstablecimiento: 'nombreEstablecimiento',
  ano: 'ano',
  mes: 'mes',
  programa: 'programa',
  estrato: 'estrato',
  desayunoIng: 'desayunoIng',
  almuerzoIng: 'almuerzoIng',
  onceIng: 'onceIng',
  colacionIng: 'colacionIng',
  cenaIng: 'cenaIng',
  totalIng: 'totalIng',
  desayunoAsig: 'desayunoAsig',
  almuerzoAsig: 'almuerzoAsig',
  onceAsig: 'onceAsig',
  colacionAsig: 'colacionAsig',
  cenaAsig: 'cenaAsig',
  totalAsig: 'totalAsig',
  tasaPreparacion: 'tasaPreparacion',
  observacion: 'observacion'
};

exports.Prisma.ProductosScalarFieldEnum = {
  id: 'id',
  nombre: 'nombre',
  codigo: 'codigo',
  unidad: 'unidad',
  tipoProducto: 'tipoProducto'
};

exports.Prisma.EmailConfigScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  provider: 'provider',
  updatedBy: 'updatedBy',
  updatedAt: 'updatedAt'
};

exports.Prisma.ListaCorreoScalarFieldEnum = {
  id: 'id',
  nombre: 'nombre',
  descripcion: 'descripcion',
  para: 'para',
  cc: 'cc',
  sucursalId: 'sucursalId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificacionPantallaScalarFieldEnum = {
  id: 'id',
  codigoPantalla: 'codigoPantalla',
  listaCorreoId: 'listaCorreoId',
  activa: 'activa',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlantillaCorreoScalarFieldEnum = {
  id: 'id',
  codigoPantalla: 'codigoPantalla',
  asunto: 'asunto',
  cuerpo: 'cuerpo',
  updatedAt: 'updatedAt'
};

exports.Prisma.LicitacionScalarFieldEnum = {
  licId: 'licId',
  estado: 'estado',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SucursalScalarFieldEnum = {
  id: 'id',
  nombre: 'nombre',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PresupuestoScalarFieldEnum = {
  id: 'id',
  ano: 'ano',
  sucursalId: 'sucursalId',
  montoAnual: 'montoAnual',
  usuario: 'usuario',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SolicitudPanScalarFieldEnum = {
  id: 'id',
  ut: 'ut',
  licId: 'licId',
  rbd: 'rbd',
  nombreSolicitante: 'nombreSolicitante',
  fechaSolicitud: 'fechaSolicitud',
  solicitud: 'solicitud',
  cantidad: 'cantidad',
  fechaGestacion: 'fechaGestacion',
  servicio: 'servicio',
  motivo: 'motivo'
};

exports.Prisma.UTScalarFieldEnum = {
  codUT: 'codUT',
  licId: 'licId',
  estado: 'estado',
  sucursalId: 'sucursalId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SolicitudGasScalarFieldEnum = {
  id: 'id',
  ut: 'ut',
  licId: 'licId',
  rbd: 'rbd',
  nombreSolicitante: 'nombreSolicitante',
  fechaSolicitud: 'fechaSolicitud',
  distribuidor: 'distribuidor',
  tipoGas: 'tipoGas',
  cantidadLitro: 'cantidadLitro',
  cilindro: 'cilindro',
  cantidad: 'cantidad',
  observacion: 'observacion',
  createdAt: 'createdAt'
};

exports.Prisma.RetiroSaldoHeaderScalarFieldEnum = {
  id: 'id',
  folio: 'folio',
  tipoOperacion: 'tipoOperacion',
  rbd: 'rbd',
  nombreEstablecimiento: 'nombreEstablecimiento',
  ut: 'ut',
  licId: 'licId',
  sucursal: 'sucursal',
  fecha: 'fecha',
  supervisor: 'supervisor',
  nombreAutoriza: 'nombreAutoriza',
  rutAutoriza: 'rutAutoriza',
  firmaBase64: 'firmaBase64',
  createdAt: 'createdAt'
};

exports.Prisma.RetiroSaldoDetailScalarFieldEnum = {
  id: 'id',
  headerId: 'headerId',
  codigoProducto: 'codigoProducto',
  nombreProducto: 'nombreProducto',
  cantidad: 'cantidad',
  createdAt: 'createdAt'
};

exports.Prisma.Mat_ConsumoGasScalarFieldEnum = {
  id: 'id',
  rbd: 'rbd',
  litros: 'litros',
  cantidad: 'cantidad',
  meses: 'meses',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FormDefinitionScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  fields: 'fields',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive',
  formCode: 'formCode',
  formVersion: 'formVersion',
  formDate: 'formDate',
  areaId: 'areaId'
};

exports.Prisma.AreaScalarFieldEnum = {
  id: 'id',
  nombre: 'nombre',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FormScheduleScalarFieldEnum = {
  id: 'id',
  formId: 'formId',
  startDay: 'startDay',
  startTime: 'startTime',
  endDay: 'endDay',
  endTime: 'endTime',
  createdAt: 'createdAt'
};

exports.Prisma.FormSubmissionScalarFieldEnum = {
  id: 'id',
  formId: 'formId',
  data: 'data',
  submittedBy: 'submittedBy',
  submittedAt: 'submittedAt'
};

exports.Prisma.Mat_ConsumoGasHistoryScalarFieldEnum = {
  id: 'id',
  rbd: 'rbd',
  litros: 'litros',
  cantidad: 'cantidad',
  meses: 'meses',
  old_litros: 'old_litros',
  old_cantidad: 'old_cantidad',
  old_meses: 'old_meses',
  observacion: 'observacion',
  user: 'user',
  createdAt: 'createdAt'
};

exports.Prisma.AnexoScalarFieldEnum = {
  id: 'id',
  sucursal: 'sucursal',
  cargo: 'cargo',
  correo: 'correo',
  telefono1: 'telefono1',
  telefono2: 'telefono2',
  telefono3: 'telefono3',
  telefono4: 'telefono4',
  nombre: 'nombre',
  cumpleano: 'cumpleano',
  contacto: 'contacto',
  nota: 'nota',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MatrizRiesgo2026ScalarFieldEnum = {
  id: 'id',
  fecha: 'fecha',
  usuario: 'usuario',
  ut: 'ut',
  rbd: 'rbd',
  nombreEstablecimiento: 'nombreEstablecimiento',
  sucursal: 'sucursal',
  patio_servicio: 'patio_servicio',
  basurero_patio: 'basurero_patio',
  zonas_libres_residuos: 'zonas_libres_residuos',
  vias_acceso_pavimentas: 'vias_acceso_pavimentas',
  caseta_gas: 'caseta_gas',
  bombona_estado: 'bombona_estado',
  focos_insalubridad: 'focos_insalubridad',
  obs_patio: 'obs_patio',
  adjuntos_patio: 'adjuntos_patio',
  bodega_mp: 'bodega_mp',
  ventilacion_bodega: 'ventilacion_bodega',
  cielos_bodega: 'cielos_bodega',
  puertas_bodega: 'puertas_bodega',
  ventanas_bodega: 'ventanas_bodega',
  malla_bodega: 'malla_bodega',
  pisos_bodega: 'pisos_bodega',
  paredes_bodega: 'paredes_bodega',
  uniones_bodega: 'uniones_bodega',
  iluminacion_estado_bodega: 'iluminacion_estado_bodega',
  iluminacion_protegida_bodega: 'iluminacion_protegida_bodega',
  iluminacion_adecuada_bodega: 'iluminacion_adecuada_bodega',
  botiquin: 'botiquin',
  extintores: 'extintores',
  conexiones_electricas_bodega: 'conexiones_electricas_bodega',
  equipos_frio_sin_visor: 'equipos_frio_sin_visor',
  obs_bodega: 'obs_bodega',
  adjuntos_bodega: 'adjuntos_bodega',
  tamano_cocina: 'tamano_cocina',
  ventilacion_cocina: 'ventilacion_cocina',
  puertas_cocina: 'puertas_cocina',
  ventanas_cocina: 'ventanas_cocina',
  malla_cocina: 'malla_cocina',
  pisos_cocina: 'pisos_cocina',
  paredes_cocina: 'paredes_cocina',
  uniones_cocina: 'uniones_cocina',
  drenajes: 'drenajes',
  inclinacion_pisos: 'inclinacion_pisos',
  cielos_cocina: 'cielos_cocina',
  lava_fondos: 'lava_fondos',
  lavamanos_manipulacion: 'lavamanos_manipulacion',
  dispensador_jabon_papel: 'dispensador_jabon_papel',
  calefon: 'calefon',
  pre_wash: 'pre_wash',
  extractor_campana: 'extractor_campana',
  carros_bandejas: 'carros_bandejas',
  iluminacion_estado_cocina: 'iluminacion_estado_cocina',
  iluminacion_protegida_cocina: 'iluminacion_protegida_cocina',
  iluminacion_adecuada_cocina: 'iluminacion_adecuada_cocina',
  basureros_tapa_cocina: 'basureros_tapa_cocina',
  llaves_sifon_cocina: 'llaves_sifon_cocina',
  canerias_agua: 'canerias_agua',
  canerias_gas: 'canerias_gas',
  conexiones_electricas_cocina: 'conexiones_electricas_cocina',
  trampas_residuos: 'trampas_residuos',
  obs_cocina: 'obs_cocina',
  adjuntos_cocina: 'adjuntos_cocina',
  bano_exclusivo: 'bano_exclusivo',
  sin_conexion_directa: 'sin_conexion_directa',
  puertas_bano: 'puertas_bano',
  malla_bano: 'malla_bano',
  pisos_bano: 'pisos_bano',
  paredes_bano: 'paredes_bano',
  lavamanos_caliente_fria: 'lavamanos_caliente_fria',
  ducha: 'ducha',
  cortina: 'cortina',
  dispensadores_jabon_bano: 'dispensadores_jabon_bano',
  estanque_tapa_wc: 'estanque_tapa_wc',
  espejo: 'espejo',
  basurero_tapa_bano: 'basurero_tapa_bano',
  llaves_sifon_bano: 'llaves_sifon_bano',
  dispensador_papel: 'dispensador_papel',
  iluminaria_bano: 'iluminaria_bano',
  obs_bano: 'obs_bano',
  adjuntos_bano: 'adjuntos_bano',
  obs_generales: 'obs_generales',
  adjunto_sostenedor: 'adjunto_sostenedor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ColegiosMatrizScalarFieldEnum = {
  id: 'id',
  colRBD: 'colRBD',
  nombreEstablecimiento: 'nombreEstablecimiento',
  institucion: 'institucion',
  sucursal: 'sucursal',
  colut: 'colut',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MatrizConfigPreguntaScalarFieldEnum = {
  id: 'id',
  preguntaId: 'preguntaId',
  seccion: 'seccion',
  gravedad: 'gravedad',
  probabilidad: 'probabilidad',
  nivelRiesgo: 'nivelRiesgo',
  updatedAt: 'updatedAt'
};

exports.Prisma.MatrizConfigSemestreScalarFieldEnum = {
  id: 'id',
  anio: 'anio',
  fechaFin1: 'fechaFin1',
  updatedAt: 'updatedAt'
};

exports.Prisma.MatrizMitigacionScalarFieldEnum = {
  id: 'id',
  matrizId: 'matrizId',
  preguntaId: 'preguntaId',
  fechaSolucion: 'fechaSolucion',
  adjuntos: 'adjuntos',
  usuario: 'usuario',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TrabajoPreventivoScalarFieldEnum = {
  id: 'id',
  ut: 'ut',
  sucursal: 'sucursal',
  licitacion: 'licitacion',
  rbd: 'rbd',
  nombreEstablecimiento: 'nombreEstablecimiento',
  folioOT: 'folioOT',
  tipoTrabajo: 'tipoTrabajo',
  fechaTrabajo: 'fechaTrabajo',
  documentoAsociado: 'documentoAsociado',
  boletasFacturas: 'boletasFacturas',
  montoMateriales: 'montoMateriales',
  montoManoObra: 'montoManoObra',
  observacion: 'observacion',
  usuario: 'usuario',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RetornoProductosAlertaScalarFieldEnum = {
  id: 'id',
  titulo: 'titulo',
  observacion: 'observacion',
  horas: 'horas',
  estado: 'estado',
  color: 'color',
  archivos: 'archivos',
  usuarioCreacion: 'usuarioCreacion',
  fechaCreacion: 'fechaCreacion',
  usuarioCierre: 'usuarioCierre',
  fechaCierre: 'fechaCierre',
  conclusionFinal: 'conclusionFinal'
};

exports.Prisma.RetornoProductosSucursalEstadoScalarFieldEnum = {
  id: 'id',
  alertaId: 'alertaId',
  sucursalId: 'sucursalId',
  estado: 'estado',
  usuarioCierre: 'usuarioCierre',
  fechaCierre: 'fechaCierre'
};

exports.Prisma.RetornoProductosMovimientoScalarFieldEnum = {
  id: 'id',
  alertaId: 'alertaId',
  sucursalId: 'sucursalId',
  usuarioRegistro: 'usuarioRegistro',
  comentario: 'comentario',
  archivos: 'archivos',
  fechaRegistro: 'fechaRegistro'
};

exports.Prisma.RetornoProductosAlertaHistorialEliminadoScalarFieldEnum = {
  id: 'id',
  alertaIdOriginal: 'alertaIdOriginal',
  tituloAlerta: 'tituloAlerta',
  observacionAlerta: 'observacionAlerta',
  motivoEliminacion: 'motivoEliminacion',
  usuarioEliminador: 'usuarioEliminador',
  fechaEliminacion: 'fechaEliminacion'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Role: 'Role',
  User: 'User',
  PMPA: 'PMPA',
  Colegios: 'Colegios',
  IngRacion: 'IngRacion',
  Productos: 'Productos',
  EmailConfig: 'EmailConfig',
  ListaCorreo: 'ListaCorreo',
  NotificacionPantalla: 'NotificacionPantalla',
  PlantillaCorreo: 'PlantillaCorreo',
  Licitacion: 'Licitacion',
  Sucursal: 'Sucursal',
  Presupuesto: 'Presupuesto',
  SolicitudPan: 'SolicitudPan',
  UT: 'UT',
  SolicitudGas: 'SolicitudGas',
  RetiroSaldoHeader: 'RetiroSaldoHeader',
  RetiroSaldoDetail: 'RetiroSaldoDetail',
  Mat_ConsumoGas: 'Mat_ConsumoGas',
  FormDefinition: 'FormDefinition',
  Area: 'Area',
  FormSchedule: 'FormSchedule',
  FormSubmission: 'FormSubmission',
  Mat_ConsumoGasHistory: 'Mat_ConsumoGasHistory',
  Anexo: 'Anexo',
  MatrizRiesgo2026: 'MatrizRiesgo2026',
  ColegiosMatriz: 'ColegiosMatriz',
  MatrizConfigPregunta: 'MatrizConfigPregunta',
  MatrizConfigSemestre: 'MatrizConfigSemestre',
  MatrizMitigacion: 'MatrizMitigacion',
  TrabajoPreventivo: 'TrabajoPreventivo',
  RetornoProductosAlerta: 'RetornoProductosAlerta',
  RetornoProductosSucursalEstado: 'RetornoProductosSucursalEstado',
  RetornoProductosMovimiento: 'RetornoProductosMovimiento',
  RetornoProductosAlertaHistorialEliminado: 'RetornoProductosAlertaHistorialEliminado'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
