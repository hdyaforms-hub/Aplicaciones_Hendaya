/**
 * Script de inicialización: crea el rol Administrador y el primer usuario admin.
 * Uso: node seed_admin.js
 * Requiere: DATABASE_URL en el entorno (Railway la inyecta automáticamente)
 */
const { PrismaClient } = require('./src/generated/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

const ALL_PERMISSIONS = [
  "close_matriz_riesgo","create_formularios","fill_formularios","fill_nueva_matriz",
  "manage_anexos","manage_areas","manage_aspectos_ee","manage_colegios_matriz",
  "manage_correo","manage_evaluacion_detallada","manage_jefe_operacion","manage_listas",
  "manage_manipuladoras_masiva","manage_matriz_2026","manage_menu_reorder","manage_mitigacion",
  "manage_multa_servicios","manage_notificaciones","manage_nueva_matriz","manage_presupuesto",
  "manage_roles","manage_sucursales","manage_supervisor","manage_users","manage_utm",
  "manage_vehiculos","manage_zonales","view_anexos","view_auditoria","view_calidad",
  "view_calidad_subir_actas_estandar_pae","view_captura_certificacion","view_codigo_causa",
  "view_colegios","view_consumo_gas","view_detalle_matriz","view_estado_avance",
  "view_estado_avance_tp","view_formularios","view_hoja_b_estandar_pae",
  "view_inf_auditoria_mitigacion","view_ingreso_raciones","view_minutas",
  "view_operaciones_cargar_pae","view_operaciones_descargas_pae","view_pmpa",
  "view_preparaciones","view_productos","view_raciones","view_reports","view_respuestas",
  "view_retiro_report","view_retiro_saldos","view_retorno_productos","view_solicitud_gas",
  "view_solicitud_gas_report","view_solicitud_pan","view_solicitud_pan_report",
  "view_tablero","view_tablero_distancias","view_tablero_elementos","view_tablero_gas",
  "view_tablero_multas_ee","view_tablero_organigrama","view_tablero_pan",
  "view_tablero_retiro","view_trabajos_preventivos"
]

async function main() {
  const username = process.env.SEED_ADMIN_USER || 'admin'
  const password = process.env.SEED_ADMIN_PASS || 'CambiarEsta.Clave2026'

  // 1. Crear o actualizar rol Administrador
  let role = await prisma.role.findFirst({ where: { name: 'Administrador' } })
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: 'Administrador',
        description: 'Acceso total al sistema',
        permissions: JSON.stringify(ALL_PERMISSIONS)
      }
    })
    console.log('✓ Rol Administrador creado')
  } else {
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: JSON.stringify(ALL_PERMISSIONS) }
    })
    console.log('✓ Rol Administrador actualizado con todos los permisos')
  }

  // 2. Crear usuario admin si no existe
  const existing = await prisma.user.findFirst({ where: { username } })
  if (existing) {
    console.log(`✓ Usuario "${username}" ya existe, no se modificó`)
  } else {
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        username,
        name: 'Administrador del Sistema',
        passwordHash,
        roleId: role.id,
        isActive: true
      }
    })
    console.log(`✓ Usuario "${username}" creado`)
    console.log(`  Contraseña inicial: ${password}`)
    console.log('  ⚠ CAMBIA ESTA CONTRASEÑA después del primer login')
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
