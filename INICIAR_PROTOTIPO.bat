@echo off
setlocal
cd /d "%~dp0"
title HelpSystemPro Credito

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale uma versao LTS em https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Preparando o projeto pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

echo Abrindo HelpSystemPro Credito em http://localhost:5173
start "" http://localhost:5173
call npm run dev

