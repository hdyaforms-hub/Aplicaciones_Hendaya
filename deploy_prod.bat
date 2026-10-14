@echo off
echo ===== ACTUALIZANDO GITHUB =====
cd /d "d:\Programas\AplicacionWeb"
git add .
git commit -m "Actualizacion de seguridad, roles y limpieza de archivos temporales"
git push origin main

echo ===== COPIANDO ARCHIVOS A PRODUCCIÓN =====
robocopy "d:\Programas\AplicacionWeb" "d:\Sitios\Hendaya" /MIR /XD .git node_modules .next public\uploads /XF Iniciar_Sitio.bat create_shortcut.ps1 *.tmp*

echo ===== COMPILANDO SITIO DE PRODUCCIÓN =====
cd /d "d:\Sitios\Hendaya"
if exist ".next\cache" (
    echo Limpiando cache previa de compilacion...
    rmdir /s /q ".next\cache"
)
call npm install
call npx prisma generate
call npm run build

echo ===== ACTUALIZACIÓN COMPLETADA =====

