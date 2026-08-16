@echo off
setlocal
cd /d "%~dp0"
title Backup - HelpSystemPro Credito

node scripts\create-backup.js
if errorlevel 1 (
  echo.
  echo Nao foi possivel criar o backup.
  pause
  exit /b 1
)

echo.
echo O arquivo foi salvo na pasta backups.
pause
