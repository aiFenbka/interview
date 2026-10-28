@echo off
cd /d "%~dp0"
if not exist node_modules\electron\cli.js (
  echo Install dependencies first: npm install
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 pause
