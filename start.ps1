# Hydro Growth Tracker - Startup Script (PowerShell)
# This script starts both backend and frontend servers

Write-Host "🌿 Hydro Growth Tracker - Startup Script" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

Write-Host ""
Write-Host "🔍 Checking system requirements..." -ForegroundColor Yellow

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed! Please install Node.js v18+ from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed! Please install npm." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "🔧 Setting up dependencies..." -ForegroundColor Yellow

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Blue
Set-Location "backend"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Blue
Set-Location "..\frontend"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location ".."

Write-Host ""
Write-Host "🏗️ Building frontend..." -ForegroundColor Yellow
Set-Location "frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build frontend" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location ".."

Write-Host ""
Write-Host "🚀 Starting Hydro Growth Tracker..." -ForegroundColor Green
Write-Host ""
Write-Host "📝 Instructions:" -ForegroundColor Cyan
Write-Host "1. Backend will start on http://localhost:5000" -ForegroundColor Gray
Write-Host "2. Frontend will start on http://localhost:5173" -ForegroundColor Gray
Write-Host "3. Open your browser to http://localhost:5173" -ForegroundColor Gray
Write-Host "4. To stop the application, press Ctrl+C in both windows" -ForegroundColor Gray
Write-Host ""

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm start" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "🎉 Hydro Growth Tracker is starting up!" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🖥️ Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Enter to exit this window..." -ForegroundColor Yellow
Read-Host
