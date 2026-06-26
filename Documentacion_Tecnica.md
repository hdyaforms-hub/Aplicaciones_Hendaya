# Documentación Técnica: Aplicaciones Hendaya

## 1. Introducción
El presente documento tiene como objetivo proporcionar la información técnica necesaria para comprender, mantener y extender la plataforma "Aplicaciones Hendaya". Esta aplicación web gestiona múltiples procesos internos y operativos, ofreciendo una estructura modular.

## 2. Tecnologías y Lenguajes de Programación
El proyecto ha sido desarrollado utilizando un stack moderno basado en el ecosistema de JavaScript/TypeScript, garantizando escalabilidad y un rendimiento óptimo.

### 2.1. Frontend y Core
- **Framework Principal:** Next.js (versión 16.2), haciendo uso del App Router.
- **Librería de UI:** React (versión 19).
- **Lenguaje Base:** TypeScript, que proporciona tipado estático y mayor seguridad en el código.
- **Estilos:** TailwindCSS v4, para un diseño responsive y utilitario.
- **Componentes de UI y Gráficos:** Recharts para la visualización de datos.

### 2.2. Backend y Base de Datos
- **Base de Datos:** PostgreSQL (indicado en el archivo Prisma schema).
- **ORM (Object-Relational Mapping):** Prisma ORM v5, encargado de la gestión, migraciones y tipado estricto de la base de datos.
- **Autenticación y Seguridad:** JWT (JSON Web Tokens) mediante la librería `jsonwebtoken` y `jose`, además de `bcryptjs` para el cifrado de contraseñas.
- **Envío de Correos:** Nodemailer.

### 2.3. Otras Herramientas y Dependencias
- **Generación y Manejo de Archivos:** 
  - `jspdf`, `pdf-parse`, `pdfjs-dist` y `html2canvas-pro` para la manipulación y exportación de PDFs.
  - `exceljs`, `xlsx` para la generación y lectura de documentos de Excel.
  - `archiver`, `adm-zip`, `jszip` para el manejo de archivos comprimidos (.zip).
- **Manejo de Fechas:** `date-fns`.
- **Identificadores Únicos:** `uuid`.

## 3. Repositorio y Entorno de Desarrollo
Para que otro desarrollador pueda tomar el control, realizar cambios o configurar un entorno local, debe seguir las siguientes instrucciones y utilizar los enlaces proporcionados.

- **Repositorio de GitHub:** 
  `https://github.com/hdyaforms-hub/Aplicaciones_Hendaya.git`
- **Comandos de Clonación:**
  ```bash
  git clone https://github.com/hdyaforms-hub/Aplicaciones_Hendaya.git
  cd Aplicaciones_Hendaya
  ```
- **Instalación de Dependencias:**
  ```bash
  npm install
  ```
- **Ejecución en Entorno Local:**
  ```bash
  npm run dev
  ```
  *(El proyecto se levantará en el puerto 3001 por defecto).*

## 4. Estructura de Módulos (Directorio `src/app/dashboard`)
La plataforma cuenta con un panel de administración (`dashboard`) que agrupa diversas funcionalidades mediante módulos. A continuación, se detalla qué hace cada uno:

- **areas:** Gestión y administración de las diferentes áreas operativas de la empresa.
- **ayuda:** Módulo de soporte, documentación o preguntas frecuentes para el usuario.
- **calculadora:** Herramienta interna de cálculo, probablemente destinada al cálculo de raciones, porciones o presupuestos.
- **configuracion:** Ajustes generales del sistema, variables y parámetros globales.
- **formularios:** Motor para la definición, programación (`FormSchedule`) y envío (`FormSubmission`) de formularios dinámicos.
- **ingreso-raciones:** Módulo especializado para el registro y control de las raciones alimenticias ingresadas.
- **mantenedor:** Panel para el mantenimiento de entidades maestras (CRUDs generales de la base de datos).
- **matriz-riesgo:** Gestión de la matriz de riesgos (con entidades como `MatrizRiesgo2026`, `MatrizConfigPregunta`, `MatrizMitigacion`), enfocado en la prevención y evaluación de riesgos.
- **productos:** Catálogo de productos, control de inventario y alertas asociadas (ej. retornos de productos).
- **reports:** Generación y exportación de reportes operativos, cruces de información y auditorías.
- **retiro-saldos:** Control de retiros y saldos, con cabecera y detalle para registrar transacciones de saldos.
- **roles:** Administración de los roles de acceso del sistema (RBAC) y definición de permisos.
- **solicitud-gas:** Flujo y gestión de solicitudes y consumos de gas.
- **solicitud-pan:** Flujo para la solicitud, distribución y control del pan.
- **tablero:** Panel principal o Dashboard inicial donde se visualizan los KPIs (Indicadores Clave de Rendimiento) y resúmenes.
- **trabajos-preventivos:** Registro y seguimiento de las actividades de mantenimiento y trabajo preventivo en colegios o sucursales.
- **users:** Módulo para la creación, edición, baja y gestión de los usuarios que acceden al sistema.

## 5. Resumen de Modelos de Base de Datos Principales
La base de datos, orquestada por Prisma, incluye decenas de tablas altamente relacionales. Algunas de las más relevantes son:
- **Seguridad:** `User`, `Role`, `Area`, `Sucursal`.
- **Operaciones de Alimentación:** `IngRacion`, `SolicitudPan`, `Preparaciones`, `Minutas`, `Raciones`.
- **Mantenimiento y Riesgos:** `MatrizRiesgo2026`, `TrabajoPreventivo`.
- **Inventario y Recursos:** `Productos`, `SolicitudGas`, `Mat_ConsumoGas`.
- **Comunicaciones:** `EmailConfig`, `ListaCorreo`, `PlantillaCorreo`, `NotificacionPantalla`.

Este documento sirve como un punto de partida técnico y arquitectónico para cualquier desarrollador que se integre al proyecto `Aplicaciones_Hendaya`.
