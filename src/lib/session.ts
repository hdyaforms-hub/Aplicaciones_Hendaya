import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const secretKey = process.env.SESSION_SECRET || 'super-secret-key-change-me'
const key = new TextEncoder().encode(secretKey)

const isSecure = process.env.COOKIE_SECURE === 'true'

export async function encrypt(payload: any) {
    console.log(`Encrypting payload...`)
    const res = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1 day from now')
        .sign(key)
    console.log(`Payload encrypted.`)
    return res
}

export async function decrypt(input: string): Promise<any> {
    console.log(`Decrypting token...`)
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        })
        console.log(`Token decrypted.`)
        return payload
    } catch (error) {
        console.log(`Token decryption failed.`)
        return null
    }
}

export async function login(user: any) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    // Clonar y remover array masivo de permisos para no superar el límite de 4KB de cookies
    const userToSave = JSON.parse(JSON.stringify(user))
    if (userToSave?.role) {
        delete userToSave.role.permissions
    }
    const session = await encrypt({ user: userToSave, expires })

    const cookieStore = await cookies()
    cookieStore.set('session', session, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
    })
    return session
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.set('session', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
    })
}

export async function getSession() {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value
    if (!session) return null
    const parsed = await decrypt(session)
    if (!parsed || !parsed.user) return null

    if (parsed.user.role) {
        const isAdmin = parsed.user.role.name === 'Administrador' || parsed.user.role.name === 'admin'
        let perms: string[] = []

        if (isAdmin) {
            const adminBasePerms = [
                'manage_users',
                'manage_roles',
                'manage_correo',
                'manage_listas',
                'manage_notificaciones',
                'manage_global_config',
                'manage_menu_reorder',
                'view_dashboard_home',
                'view_tablero',
                'view_tablero_pan',
                'view_tablero_gas',
                'view_tablero_retiro',
                'view_tablero_elementos',
                'view_tablero_multas_ee',
                'view_tablero_organigrama',
                'view_tablero_distancias',
                'view_tablero_actas',
                'view_tablero_verificador_temperaturas',
                'view_tablero_widgets',
                'view_tablero_auditoria',
                'view_ingreso_raciones',
                'view_solicitud_pan',
                'view_solicitud_gas',
                'view_retiro_saldos',
                'view_areas',
                'view_operaciones',
                'view_trabajos_prev_corr_menu',
                'view_trabajos_preventivos',
                'manage_presupuesto',
                'view_estado_avance_tp',
                'view_elementos_esenciales',
                'view_operaciones_descargas_pae',
                'view_operaciones_cargar_pae',
                'view_manipuladoras',
                'view_captura_certificacion',
                'manage_manipuladoras_masiva',
                'view_calidad',
                'view_retorno_productos',
                'manage_retorno_productos',
                'view_calidad_subir_actas_estandar_pae',
                'view_verificador_temperaturas',
                'manage_verificador_temperaturas',
                'config_verificador_temperaturas',
                'view_multas_areas',
                'manage_calculos_ee',
                'manage_descargos',
                'view_prev_gravedad_preparacion',
                'manage_prev_gravedad_preparacion',
                'view_matriz_riesgo',
                'close_matriz_riesgo',
                'view_historico_matriz',
                'fill_nueva_matriz',
                'view_detalle_matriz',
                'edit_detalle_matriz',
                'view_inf_auditoria_mitigacion',
                'view_hoja_b_estandar_pae',
                'manage_mitigacion',
                'view_estado_avance',
                'view_auditoria',
                'view_productos',
                'manage_areas',
                'manage_actas_supervision',
                'manage_user_rbds',
                'manage_nueva_matriz',
                'manage_colegios_matriz',
                'view_pmpa',
                'view_colegios',
                'view_consumo_gas',
                'manage_vehiculos',
                'manage_zonales',
                'manage_jefe_operacion',
                'manage_supervisor',
                'manage_sucursales',
                'manage_utm',
                'manage_aspectos_ee',
                'manage_multa_servicios',
                'view_preparaciones',
                'view_minutas',
                'view_raciones',
                'view_codigo_causa',
                'view_reports',
                'view_solicitud_pan_report',
                'view_solicitud_gas_report',
                'view_retiro_report',
                'view_formularios',
                'create_formularios',
                'fill_formularios',
                'view_respuestas',
                'view_generar_actas',
                'view_descargar_actas',
                'manage_generar_actas',
                'view_conversacion',
                'view_sala_reuniones',
                'view_anexos',
                'manage_anexos',
                'view_documentos',
                'manage_doc_configuracion',
                'manage_doc_carpetas',
                'manage_doc_privilegios',
                'logistica:tablero:ver',
                'logistica:tablero:gestionar',
                'logistica:rutas:ver',
                'logistica:rutas:crear',
                'logistica:rutas:editar',
                'logistica:rutas:cancelar',
                'logistica:rutas:forzar_estado',
                'logistica:chofer:notificar',
                'logistica:porton:marcar',
                'logistica:despacho:completar',
                'logistica:metricas:ver',
                'logistica:rutas:exportar',
                'logistica:config:ver',
                'logistica:config:bodegas',
                'logistica:config:choferes',
                'logistica:config:camiones',
                'logistica:config:transportistas',
                'logistica:config:clientes',
                'logistica:integraciones:ver',
                'view_anonimizador',
                'manage_anonimizador'
            ]
            perms = adminBasePerms
        } else {
            // Usuario no admin: obtener permisos desde la BD o token
            if (Array.isArray(parsed.user.role.permissions) && parsed.user.role.permissions.length > 0) {
                perms = parsed.user.role.permissions
            } else if (parsed.user.id) {
                try {
                    const { rawPrisma } = await import('@/lib/prisma')
                    const dbUser = await rawPrisma.user.findUnique({
                        where: { id: parsed.user.id },
                        include: { role: true }
                    })
                    if (dbUser?.role?.permissions) {
                        try {
                            perms = JSON.parse(dbUser.role.permissions)
                        } catch {
                            perms = dbUser.role.permissions.split(',').map((p: string) => p.trim()).filter(Boolean)
                        }
                    }
                } catch (e) {
                    console.error('Error cargando permisos en getSession:', e)
                }
            }
        }

        parsed.user.role.permissions = perms
    }

    return parsed
}

export async function updateSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session')?.value
    if (!sessionCookie) return null

    const parsed = await decrypt(sessionCookie)
    if (!parsed) return null

    // We can still rotate JWT token expiration if needed, but not on the browser cookie
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    parsed.expires = expires

    const sessionToSave = JSON.parse(JSON.stringify(parsed))
    if (sessionToSave.user?.role) {
        delete sessionToSave.user.role.permissions
    }

    const res = NextResponse.next()
    res.cookies.set({
        name: 'session',
        value: await encrypt(sessionToSave),
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
    })
    return res
}
