@echo off
echo ===== ACTUALIZANDO GITHUB =====
cd /d "d:\Programas\AplicacionWebSql"
git add .
git commit -m "Cambio: Renombrado Retorno de Productos a Retirada de productos en toda la aplicación."
git push origin main

echo ===== COPIANDO ARCHIVOS A PRODUCCIÓN =====
robocopy "d:\Programas\AplicacionWebSql" "d:\Sitios\Hendaya" /MIR /XD .git node_modules .next /XF Iniciar_Sitio.bat create_shortcut.ps1 *.tmp*

echo ===== COMPILANDO SITIO DE PRODUCCIÓN =====
cd /d "d:\Sitios\Hendaya"
call npm install
call npx prisma generate
call npm run build

echo ===== ACTUALIZACIÓN COMPLETADA =====
