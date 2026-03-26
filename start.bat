@echo off
title CodeForge — AI Code Studio
color 0A

echo.
echo  ╔════════════════════════════════════╗
echo  ║        CodeForge Launcher          ║
echo  ╚════════════════════════════════════╝
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed.
  echo  Please install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: Install dependencies if node_modules missing
if not exist "node_modules" (
  echo  Installing dependencies...
  echo.
  call npm install
  echo.
)

echo  Starting server...
echo  Open your browser at: http://localhost:3000
echo.

:: Open browser after a short delay
start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Start the server
node server.js

pause
