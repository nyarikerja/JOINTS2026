Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Menjalankan UdaraSiaga (Backend + Frontend)       " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Jalankan backend di jendela terpisah
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "Backend API  : http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "Frontend Web : http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Menjalankan Vite dev server di terminal ini..." -ForegroundColor Cyan

# 2. Jalankan frontend di terminal ini
Set-Location "$PSScriptRoot\frontend"
npm run dev
