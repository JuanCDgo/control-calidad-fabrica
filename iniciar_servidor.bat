@echo off
title Servidor Central - Control de Calidad
color 0B
echo =========================================================
echo   INICIANDO CONTROL DE CALIDAD - FABRICA DE MUEBLES
echo =========================================================
echo.
cd /d "%~dp0"
backend\.venv\Scripts\python.exe backend\run_server.py
pause
