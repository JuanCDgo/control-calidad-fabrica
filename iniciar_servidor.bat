@echo off
title Servidor Central - Control de Calidad
color 0B
echo =========================================================
echo   INICIANDO CONTROL DE CALIDAD - FABRICA DE MUEBLES
echo =========================================================
echo.
cd /d "%~dp0"

set "PYTHON_BIN="
if exist "backend\python_portable\python.exe" (
    set "PYTHON_BIN=backend\python_portable\python.exe"
) else if exist "backend\.venv\Scripts\python.exe" (
    set "PYTHON_BIN=backend\.venv\Scripts\python.exe"
)

if "%PYTHON_BIN%"=="" (
    echo [ERROR] No se encontro Python portable ni entorno virtual en:
    echo   %~dp0backend\python_portable\python.exe
    echo   %~dp0backend\.venv\Scripts\python.exe
    echo Asegurate de ejecutar este archivo desde la carpeta del proyecto
    echo ^(o usando un acceso directo, sin mover el archivo .bat suelto^).
    pause
    exit /b 1
)

"%PYTHON_BIN%" backend\generate_certs.py

if exist "backend\certs\rootCA.crt" (
    powershell -NoProfile -Command "$c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('backend\certs\rootCA.crt'); $t = $c.Thumbprint; if ((Test-Path ('Cert:\CurrentUser\Root\' + $t)) -or (Test-Path ('Cert:\LocalMachine\Root\' + $t))) { exit 0 } else { exit 1 }"
    if errorlevel 1 (
        echo [SSL] Instalando certificado local en Windows para evitar alertas en Chrome/Edge...
        echo       ^(Si aparece una ventana de Windows, hace clic en "Si"^)
        certutil -user -addstore Root "%~dp0backend\certs\rootCA.crt"
        echo.
    )
)

netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [OK] El servidor ya estaba activo en https://localhost:8000
    echo      Abriendo navegador...
    start "" "https://localhost:8000"
    timeout /t 2 >nul
    exit /b 0
)

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 40; $i++) { try { $t = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8000); $t.Close(); Start-Process 'https://localhost:8000'; break } catch { Start-Sleep -Milliseconds 500 } }"

"%PYTHON_BIN%" backend\run_server.py
pause
