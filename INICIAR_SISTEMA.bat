@echo off
setlocal
cd /d "%~dp0"
title HelpSystemPro Credito

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale o Node.js 24 LTS em https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Preparando o sistema pela primeira vez...
  call npm ci
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

echo Validando e preparando a interface...
call npm run build
if errorlevel 1 (
  echo A compilacao encontrou um problema. Consulte a mensagem acima.
  pause
  exit /b 1
)

echo Abrindo HelpSystemPro Credito em http://127.0.0.1:8091
start "" http://127.0.0.1:8091
call npm start

