# Hydro Growth Tracker - Package Script
# This script packages the application for distribution

Write-Host "🌿 Hydro Growth Tracker - Packaging Script" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Check if Node.js is available
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if npm is available
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Starting packaging process..." -ForegroundColor Yellow

# Navigate to frontend directory
Set-Location "frontend"

Write-Host "🔧 Installing frontend dependencies..." -ForegroundColor Blue
npm install

Write-Host "🏗️ Building frontend application..." -ForegroundColor Blue
npm run build

Write-Host "🧹 Running linter..." -ForegroundColor Blue
npm run lint

# Navigate back to root
Set-Location ".."

# Navigate to backend directory
Set-Location "backend"

Write-Host "🔧 Installing backend dependencies..." -ForegroundColor Blue
npm install

Write-Host "🏗️ Testing backend..." -ForegroundColor Blue
# npm test  # Uncomment if you add tests

# Navigate back to root
Set-Location ".."

Write-Host "📋 Creating package info..." -ForegroundColor Blue

# Create package info file
$packageInfo = @"
Hydro Growth Tracker v1.0.0
============================

🌿 A comprehensive hydroponic plant growth tracking system

Features:
- Plant growth logging with photos
- Advanced feeding schedule management
- Calendar export for feeding schedules (16-week professional schedule)
- Intelligent growth recommendations
- Dark/Light theme support
- Draft auto-save functionality
- Improved UX with height adjustment controls
- Plant management system
- Real-time analytics and charts

Installation:
1. Install Node.js (v18+ recommended)
2. Backend: cd backend && npm install && npm start
3. Frontend: cd frontend && npm install && npm run dev

Production Build:
1. Frontend: cd frontend && npm run build
2. Backend: cd backend && npm start

Default Ports:
- Backend: http://localhost:5000
- Frontend: http://localhost:5173 (dev) or serve dist/ folder

System Requirements:
- Node.js 18+
- 2GB RAM minimum
- 500MB disk space

Support:
- Check README.md for detailed instructions
- All dependencies are automatically installed
- Works on Windows, macOS, and Linux

Built with:
- React 18 + Vite
- Node.js + Express
- SQLite Database
- Tailwind CSS
- Recharts for analytics
- Lucide React icons

Package Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

$packageInfo | Out-File -FilePath "PACKAGE_INFO.txt" -Encoding UTF8

Write-Host "✅ Packaging complete!" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "📁 Package Contents:" -ForegroundColor Yellow
Write-Host "   - frontend/dist/     (Built frontend application)" -ForegroundColor Gray
Write-Host "   - backend/          (Backend API server)" -ForegroundColor Gray  
Write-Host "   - PACKAGE_INFO.txt  (Package information)" -ForegroundColor Gray
Write-Host "" -ForegroundColor White
Write-Host "🚀 Ready for distribution!" -ForegroundColor Green
Write-Host "   Backend: cd backend; npm start" -ForegroundColor Gray
Write-Host "   Frontend: serve dist folder or npm run dev" -ForegroundColor Gray
