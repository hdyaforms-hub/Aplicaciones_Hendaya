# Project Behavioral Rules & Guidelines

## Identity & Logo Guidelines

- **Logo Oficial de Hendaya**: El logo oficial de la empresa Hendaya es la marca tipográfica estilizada **HENDAYA** (letras en tono Cyan/Sky sobre fondo oscuro o contraste claro, tal como aparece en el menú lateral de navegación y en la pantalla de conexión/login).
- **Prohibición de Logos de Terceros**: NUNCA utilizar imágenes PNG de logos de terceros (como la imagen externa que decía "HENDAYA SAC"). Para PDF y elementos visuales, implementar siempre la marca tipográfica y estética corporativa oficial **HENDAYA**.

## Despliegue de Base de Datos y Creación de Módulos Nuevos

- **Creación Obligatoria de Tablas en Producción**: Cada vez que se cree un modelo o tabla nueva en Prisma/PostgreSQL, SIEMPRE se debe generar e incluir un script SQL/Node idempotente (`CREATE TABLE IF NOT EXISTS ...`) y mecanismo de auto-recuperación (`self-healing`) para que la base de datos de producción tenga las tablas creadas físicamente sin requerir migraciones destructivas.
- **Resguardo Absoluto de Datos en Producción**: NUNCA ejecutar comandos destructivos (`prisma migrate reset`, `DROP TABLE`, o borrado masivo de registros existentes) en el ambiente productivo. Las tablas y datos existentes deben preservarse intactos a menos que el usuario lo solicite de manera explícita e inequívoca.

