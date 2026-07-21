import { join } from 'path'

/**
 * Carpeta base donde se almacenan los archivos subidos por los usuarios.
 *
 * - En Railway: se monta un volumen persistente y se define UPLOADS_DIR=/data/uploads
 *   Los archivos sobreviven a los deploys.
 * - En local (Windows): si UPLOADS_DIR no está definida, se usa public/uploads
 *   para no romper el flujo de desarrollo de siempre.
 *
 * Las rutas guardadas en la base de datos siguen siendo del tipo
 * "/uploads/<subcarpeta>/<archivo>" — no cambian. Lo que cambia es DÓNDE
 * viven físicamente los archivos y QUIÉN los sirve (ver src/app/uploads/[...path]/route.ts).
 */
export const UPLOADS_DIR =
    process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads')

/**
 * Devuelve la ruta física absoluta para una subruta de uploads.
 * Ejemplo: uploadPath('elementos-esenciales', 'archivo.pdf')
 */
export function uploadPath(...segments: string[]): string {
    return join(UPLOADS_DIR, ...segments)
}
