@echo off
setlocal
cd /d "%~dp0"
title Restaurar Backup - HelpSystemPro Credito

if "%~1"=="" (
  echo Feche o HelpSystemPro Credito antes de continuar.
  echo.
  echo Arraste um arquivo .db da pasta backups para cima deste arquivo BAT.
  echo Ou execute: RESTAURAR_BACKUP.bat "caminho-do-backup.db"
  pause
  exit /b 1
)

node scripts\restore-backup.js "%~1"
if errorlevel 1 (
  echo.
  echo A restauracao nao foi realizada.
  pause
  exit /b 1
)

echo.
echo Restauracao concluida. Agora voce pode iniciar o sistema novamente.
pause
