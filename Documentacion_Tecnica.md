<div class="cover-container">
  <img src="C:\Users\ecastillo\.gemini\antigravity\brain\9d0b65c1-0080-4e98-8b9b-335e9b3fbdd5\cover_image_png_1782496531101.png" alt="Cover Image" class="cover-image" />
  <h1 class="cover-title">Documentación Técnica</h1>
  <p class="cover-subtitle">Aplicaciones Hendaya</p>
</div>

## 1. Introducción
El presente documento tiene como objetivo proporcionar la información técnica necesaria para comprender, mantener y extender la plataforma **Aplicaciones Hendaya**. Esta aplicación web gestiona múltiples procesos internos y operativos, ofreciendo una estructura modular.

## 2. Tecnologías y Lenguajes de Programación
El proyecto ha sido desarrollado utilizando un stack moderno basado en el ecosistema de JavaScript/TypeScript, garantizando escalabilidad y un rendimiento óptimo.

### 2.1. Frontend y Core
<div class="highlight-box">
<ul>
  <li><strong>Framework Principal:</strong> Next.js (versión 16.2), haciendo uso del App Router.</li>
  <li><strong>Librería de UI:</strong> React (versión 19).</li>
  <li><strong>Lenguaje Base:</strong> TypeScript, que proporciona tipado estático y mayor seguridad en el código.</li>
  <li><strong>Estilos:</strong> TailwindCSS v4, para un diseño responsive y utilitario.</li>
  <li><strong>Componentes de UI y Gráficos:</strong> Recharts para la visualización de datos.</li>
</ul>
</div>

### 2.2. Backend y Base de Datos
<div class="highlight-box">
<ul>
  <li><strong>Base de Datos:</strong> PostgreSQL.</li>
  <li><strong>ORM (Object-Relational Mapping):</strong> Prisma ORM v5, encargado de la gestión, migraciones y tipado estricto de la base de datos.</li>
  <li><strong>Autenticación y Seguridad:</strong> JWT (JSON Web Tokens) mediante la librería <code>jsonwebtoken</code> y <code>jose</code>, además de <code>bcryptjs</code> para el cifrado de contraseñas.</li>
  <li><strong>Envío de Correos:</strong> Nodemailer.</li>
</ul>
</div>

### 2.3. Otras Herramientas y Dependencias
<ul>
  <li><strong>Generación y Manejo de Archivos:</strong> 
    <ul>
      <li><code>jspdf</code>, <code>pdf-parse</code>, <code>pdfjs-dist</code> y <code>html2canvas-pro</code> para la manipulación y exportación de PDFs.</li>
      <li><code>exceljs</code>, <code>xlsx</code> para la generación y lectura de documentos de Excel.</li>
      <li><code>archiver</code>, <code>adm-zip</code>, <code>jszip</code> para el manejo de archivos comprimidos (.zip).</li>
    </ul>
  </li>
  <li><strong>Manejo de Fechas:</strong> <code>date-fns</code>.</li>
  <li><strong>Identificadores Únicos:</strong> <code>uuid</code>.</li>
</ul>

## 3. Repositorio y Entorno de Desarrollo
Para que otro desarrollador pueda tomar el control, realizar cambios o configurar un entorno local, debe seguir las siguientes instrucciones y utilizar los enlaces proporcionados.

- **Repositorio de GitHub:** 
  [https://github.com/hdyaforms-hub/Aplicaciones_Hendaya.git](https://github.com/hdyaforms-hub/Aplicaciones_Hendaya.git)

**Comandos de Clonación:**
```bash
git clone https://github.com/hdyaforms-hub/Aplicaciones_Hendaya.git
cd Aplicaciones_Hendaya
```

**Instalación de Dependencias:**
```bash
npm install
```

**Ejecución en Entorno Local:**
```bash
npm run dev
```
*(El proyecto se levantará en el puerto 3001 por defecto).*

## 4. Estructura de Módulos
La plataforma cuenta con un panel de administración (`dashboard`) que agrupa diversas funcionalidades mediante módulos. A continuación, se detalla qué hace cada uno:

<ul class="module-list">
  <li><span class="module-name">areas:</span> Gestión y administración de las diferentes áreas operativas de la empresa.</li>
  <li><span class="module-name">ayuda:</span> Módulo de soporte, documentación o preguntas frecuentes para el usuario.</li>
  <li><span class="module-name">calculadora:</span> Herramienta interna de cálculo, probablemente destinada al cálculo de raciones, porciones o presupuestos.</li>
  <li><span class="module-name">configuracion:</span> Ajustes generales del sistema, variables y parámetros globales.</li>
  <li><span class="module-name">formularios:</span> Motor para la definición, programación (FormSchedule) y envío (FormSubmission) de formularios dinámicos.</li>
  <li><span class="module-name">ingreso-raciones:</span> Módulo especializado para el registro y control de las raciones alimenticias ingresadas.</li>
  <li><span class="module-name">mantenedor:</span> Panel para el mantenimiento de entidades maestras (CRUDs generales de la base de datos).</li>
  <li><span class="module-name">matriz-riesgo:</span> Gestión de la matriz de riesgos, enfocado en la prevención y evaluación de riesgos.</li>
  <li><span class="module-name">productos:</span> Catálogo de productos, control de inventario y alertas asociadas (ej. retornos de productos).</li>
  <li><span class="module-name">reports:</span> Generación y exportación de reportes operativos, cruces de información y auditorías.</li>
  <li><span class="module-name">retiro-saldos:</span> Control de retiros y saldos, con cabecera y detalle para registrar transacciones de saldos.</li>
  <li><span class="module-name">roles:</span> Administración de los roles de acceso del sistema (RBAC) y definición de permisos.</li>
  <li><span class="module-name">solicitud-gas:</span> Flujo y gestión de solicitudes y consumos de gas.</li>
  <li><span class="module-name">solicitud-pan:</span> Flujo para la solicitud, distribución y control del pan.</li>
  <li><span class="module-name">tablero:</span> Panel principal o Dashboard inicial donde se visualizan los KPIs (Indicadores Clave de Rendimiento) y resúmenes.</li>
  <li><span class="module-name">trabajos-preventivos:</span> Registro y seguimiento de las actividades de mantenimiento y trabajo preventivo en colegios o sucursales.</li>
  <li><span class="module-name">users:</span> Módulo para la creación, edición, baja y gestión de los usuarios que acceden al sistema.</li>
</ul>

## 5. Resumen de Modelos de Base de Datos
La base de datos, orquestada por Prisma, incluye decenas de tablas altamente relacionales. Algunas de las más relevantes son:

- **Seguridad:** `User`, `Role`, `Area`, `Sucursal`.
- **Operaciones de Alimentación:** `IngRacion`, `SolicitudPan`, `Preparaciones`, `Minutas`, `Raciones`.
- **Mantenimiento y Riesgos:** `MatrizRiesgo2026`, `TrabajoPreventivo`.
- **Inventario y Recursos:** `Productos`, `SolicitudGas`, `Mat_ConsumoGas`.
- **Comunicaciones:** `EmailConfig`, `ListaCorreo`, `PlantillaCorreo`, `NotificacionPantalla`.

---
*Este documento sirve como un punto de partida técnico y arquitectónico para cualquier desarrollador que se integre al proyecto Aplicaciones_Hendaya.*
