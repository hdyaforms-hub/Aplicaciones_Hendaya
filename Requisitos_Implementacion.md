# Requisitos de Implementación - Aplicación Web

Este documento detalla los requisitos técnicos de hardware, software y las instrucciones paso a paso para la implementación, despliegue y puesta en marcha del proyecto en un entorno de producción, así como consideraciones para su futuro crecimiento y escalabilidad.

---

## 1. Requisitos de Hardware (Servidor / Hosting)

El proyecto está construido sobre Next.js (Node.js) con Prisma ORM y requiere una base de datos relacional (PostgreSQL).

### Perfil Mínimo (Lanzamiento inicial y baja concurrencia)
Recomendado para pruebas de producción o etapas iniciales con un volumen de usuarios bajo/moderado.
- **CPU:** 2 vCores
- **Memoria RAM:** 4 GB
- **Almacenamiento:** 40 GB a 50 GB SSD
- **Red:** 100 Mbps - 1 Gbps

### Perfil Recomendado (Crecimiento y alta concurrencia)
Recomendado cuando el uso de la plataforma comienza a escalar en cantidad de transacciones, usuarios simultáneos y volumen de datos.
- **CPU:** 4 a 8 vCores
- **Memoria RAM:** 8 GB a 16 GB
- **Almacenamiento:** 100 GB a 250 GB SSD / NVMe
- **Red:** 1 Gbps

### Consideraciones de Crecimiento (Escalabilidad)
A medida que el proyecto crezca, se recomienda la siguiente estrategia para evitar cuellos de botella:
1. **Desacoplar la Base de Datos:** Mover PostgreSQL del servidor principal a un servidor dedicado o utilizar un servicio de base de datos gestionado (DBaaS) como AWS RDS, Google Cloud SQL o Azure Database for PostgreSQL.
2. **Balanceo de Carga:** Si la carga del servidor Node.js aumenta drásticamente, se deben levantar múltiples instancias del frontend/backend en varios servidores detrás de un Balanceador de Carga (Load Balancer).
3. **Almacenamiento Externo:** Si la aplicación maneja carga de archivos masiva, migrar el almacenamiento local a servicios en la nube (Object Storage) como Amazon S3 o Cloudflare R2.
4. **Caché:** Implementar un servidor de caché como Redis para aliviar la carga sobre la base de datos en consultas repetitivas.

---

## 2. Requisitos de Software

- **Sistema Operativo:** Ubuntu 22.04 LTS o 24.04 LTS (Distribución Linux recomendada para servidores web).
- **Motor de Base de Datos:** PostgreSQL 15 o superior.
- **Entorno de Ejecución:** Node.js v20.x (LTS).
- **Servidor Web / Proxy Inverso:** Nginx.
- **Gestor de Procesos de Node:** PM2.
- **Seguridad / Firewall:** UFW, Certbot (para certificados SSL gratuitos Let's Encrypt).

---

## 3. Instrucciones de Instalación y Despliegue (Línea de Comandos)

Los siguientes comandos asumen que se está utilizando un servidor con **Ubuntu 22.04 LTS / 24.04 LTS** con un usuario con permisos de `sudo`.

### 3.1. Actualización del Sistema e Instalación de Herramientas Básicas
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential unzip
```

### 3.2. Instalación de Node.js (Versión 20 LTS)
```bash
# Descargar e instalar el repositorio de NodeSource para Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar versiones instaladas
node -v
npm -v
```

### 3.3. Instalación y Configuración de PostgreSQL
```bash
# Instalar PostgreSQL y contribuciones
sudo apt install -y postgresql postgresql-contrib

# Habilitar el servicio para que inicie automáticamente
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Entrar a la consola de PostgreSQL para crear la Base de Datos y el Usuario
sudo -u postgres psql

# Dentro de la consola de psql ejecutar los siguientes comandos (cambiar 'mi_usuario', 'mi_password' y 'mi_basededatos'):
CREATE DATABASE mi_basededatos;
CREATE USER mi_usuario WITH ENCRYPTED PASSWORD 'mi_password';
GRANT ALL PRIVILEGES ON DATABASE mi_basededatos TO mi_usuario;
\c mi_basededatos;
GRANT ALL ON SCHEMA public TO mi_usuario;
\q
```

### 3.4. Instalación de PM2 (Gestor de Procesos)
PM2 mantendrá la aplicación Next.js viva y la reiniciará automáticamente si ocurre un error o el servidor se reinicia.
```bash
sudo npm install -g pm2
```

### 3.5. Preparación del Proyecto
Clonar el repositorio o copiar los archivos del proyecto al servidor (ejemplo en `/var/www/aplicacionweb`).
```bash
# Asumiendo que clonamos o copiamos a /var/www/aplicacionweb
sudo mkdir -p /var/www/aplicacionweb
# (Mover los archivos a esa ruta y asignar permisos)
sudo chown -R $USER:$USER /var/www/aplicacionweb
cd /var/www/aplicacionweb

# Instalar dependencias del proyecto
npm install

# Configurar Variables de Entorno (Crear archivo .env)
# IMPORTANTE: Configurar aquí la URL de conexión a la base de datos PostgreSQL
# DATABASE_URL="postgresql://mi_usuario:mi_password@localhost:5432/mi_basededatos?schema=public"
nano .env

# Generar el cliente Prisma y correr migraciones en la base de datos
npx prisma generate
npx prisma migrate deploy

# Construir la aplicación para producción
npm run build

# Iniciar la aplicación usando PM2 (asumiendo puerto 3000 o 3001)
pm2 start npm --name "aplicacionweb" -- run start

# Configurar PM2 para iniciar con el sistema
pm2 startup
# (Ejecutar el comando que PM2 devuelva en pantalla)
pm2 save
```

### 3.6. Instalación y Configuración de Nginx (Proxy Inverso)
Nginx interceptará las peticiones del puerto 80 (HTTP) y 443 (HTTPS) y las dirigirá a nuestra aplicación.
```bash
sudo apt install -y nginx

# Crear el archivo de configuración para el sitio
sudo nano /etc/nginx/sites-available/aplicacionweb
```

Dentro del archivo, colocar la siguiente configuración (cambiar `tudominio.com` por el dominio real o IP):
```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://localhost:3001; # Asegurarse que el puerto coincida con el de la app Next.js
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Habilitar el sitio y reiniciar Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/aplicacionweb /etc/nginx/sites-enabled/
# Verificar que la configuración sea correcta
sudo nginx -t
# Reiniciar Nginx
sudo systemctl restart nginx
```

### 3.7. Configuración de Firewall (UFW) y SSL (HTTPS)
Asegurar el servidor permitiendo solo conexiones SSH, HTTP y HTTPS.
```bash
# Configurar Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Instalar Certbot para generar certificado SSL gratuito
sudo apt install -y certbot python3-certbot-nginx

# Generar e instalar certificado (requiere dominio configurado y apuntando a la IP del servidor)
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Con estos pasos completados, la aplicación estará funcional, conectada a PostgreSQL, corriendo bajo un administrador de procesos (PM2), y protegida detrás de Nginx con certificados SSL.
