@echo off
title UdaraSiaga Launcher
echo ====================================================
echo  Menjalankan UdaraSiaga (Backend + Frontend)
echo ====================================================
echo.

start "UdaraSiaga Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
start "UdaraSiaga Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Backend  : http://127.0.0.1:8000/docs
echo Frontend : http://localhost:5173
echo.
echo Server backend dan frontend telah dijalankan di jendela terpisah.
