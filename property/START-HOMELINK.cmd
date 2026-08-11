@echo off
cd /d "%~dp0"
start "HomeLink Server - DO NOT CLOSE" /D "%~dp0frontend" cmd /k "npm run dev"
timeout /t 7 /nobreak >nul
start "" "http://localhost:5174"
exit /b 0
