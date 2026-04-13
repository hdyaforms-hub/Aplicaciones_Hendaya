-- 1. Crear login a nivel de servidor
USE master;
GO

CREATE LOGIN UserConection
WITH PASSWORD = 'P455w0rd.26$',
     CHECK_POLICY = ON;
GO

-- 2. Cambiar a la base de datos
USE AplicacionWeb;
GO

-- 3. Crear usuario dentro de la base
CREATE USER UserConection
FOR LOGIN UserConection;
GO

-- 4. Asignar permisos completos SOLO en esta base de datos
ALTER ROLE db_owner ADD MEMBER UserConection;
GO


/* Quitar algunos roles
ALTER ROLE db_datareader ADD MEMBER UserConection;
ALTER ROLE db_datawriter ADD MEMBER UserConection;
ALTER ROLE db_ddladmin ADD MEMBER UserConection;
*/