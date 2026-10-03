@echo off
chcp 65001 >nul
rem DAILY: Vogelfotos fuer das Album laden (Phase 3c) - nur gemeinfreie oder CC0-Bilder von Wikimedia Commons.
rem Legt bis zu 3 Kandidaten je Vogel in public\bilder-roh\voegel ab (wird nicht hochgeladen). Claude waehlt danach aus.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\bilder-holen.ps1"
echo.
pause
