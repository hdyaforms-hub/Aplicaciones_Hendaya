export interface CarpetaUI {
    id: string              // ID interno en base de datos (no el onedriveId)
    nombre: string
    descripcion?: string | null
    icono: string
    parentId?: string | null
    rutaCompleta: string
    orden: number
    activa?: boolean
    subCarpetas?: CarpetaUI[]
    cantidadArchivos?: number
    puedeVer?: boolean
    puedeDescargar?: boolean
    puedeSubir?: boolean
    puedeAdministrar?: boolean
}

export interface ArchivoUI {
    id: string              // ID opaco en OneDrive para las operaciones proxy
    nombre: string
    tamanoMB: number
    fechaModificacion: string
    tipoMime: string
    tipoArchivo: 'pdf' | 'imagen' | 'video' | 'documento' | 'otro'
    version?: number
    carpetaId: string
    puedeDescargar: boolean
    puedeAdministrar?: boolean
    downloadUrl?: string
}

export interface DriveItem {
    id: string
    name: string
    size?: number
    lastModifiedDateTime: string
    file?: {
        mimeType: string
    }
    folder?: {
        childCount: number
    }
    '@microsoft.graph.downloadUrl'?: string
}

export interface DriveItemVersion {
    id: string
    lastModifiedDateTime: string
    size?: number
    lastModifiedBy?: {
        user?: {
            displayName?: string
            email?: string
        }
    }
}

export type NivelPermiso = 'ver' | 'descargar' | 'ver_descargar' | 'subir' | 'administrar'
export type TipoPrivilegio = 'rol' | 'usuario' | 'sucursal' | 'licitacion' | 'rbd'

export interface PrivilegioUI {
    id: string
    carpetaId: string
    carpetaNombre?: string
    tipo: TipoPrivilegio
    referenciaId: string
    referenciaNombre: string  // Nombre legible del Rol, Usuario, Sucursal, Licitación o Colegio
    permiso: NivelPermiso
    creadoEn?: string
}

export interface ConfiguracionDocumentalUI {
    configurado: boolean
    conectado: boolean
    authType?: 'certificate' | 'secret'
    clientIdPreview?: string    // Primeros 8 caracteres del Client ID
    tenantIdPreview?: string    // Primeros 8 caracteres del Tenant ID
    certThumbprintPreview?: string // Huella digital del certificado
    certKeyPath?: string        // Ruta de llave privada
    tieneCertificado?: boolean
    tieneSecret?: boolean       // Indica si existe secret guardado
    onedriveUserEmail?: string
    rootFolderId?: string | null
    rootFolderName?: string | null
    storageUsedGB?: number
    storageQuotaGB?: number
    userDisplayName?: string
    activo?: boolean
    mensajeError?: string
    envDiagnostics?: {
        hasTenantId: boolean
        hasClientId: boolean
        hasThumbprint: boolean
        hasPrivateKey: boolean
        hasUserEmail: boolean
    }
}
