@echo off
setlocal
cd /d "%~dp0"

if not exist "data" mkdir "data"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this machine.
  echo Install Node.js LTS or package Gamma Calc as a Windows executable.
  pause
  exit /b 1
)

node server.mjs
