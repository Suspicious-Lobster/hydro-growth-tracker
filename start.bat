@echo off
color 0A
echo.
echo     ██╗  ██╗██╗   ██╗██████╗ ██████╗  ██████╗ 
echo     ██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██╔═══██╗
echo     ███████║ ╚████╔╝ ██║  ██║██████╔╝██║   ██║
echo     ██╔══██║  ╚██╔╝  ██║  ██║██╔══██╗██║   ██║
echo     ██║  ██║   ██║   ██████╔╝██║  ██║╚██████╔╝
echo     ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ 
echo.
echo      ██████╗ ██████╗  ██████╗ ██╗    ██╗████████╗██╗  ██╗
echo     ██╔════╝ ██╔══██╗██╔═══██╗██║    ██║╚══██╔══╝██║  ██║
echo     ██║  ███╗██████╔╝██║   ██║██║ █╗ ██║   ██║   ███████║
echo     ██║   ██║██╔══██╗██║   ██║██║███╗██║   ██║   ██╔══██║
echo     ╚██████╔╝██║  ██║╚██████╔╝╚███╔███╔╝   ██║   ██║  ██║
echo      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝    ╚═╝   ╚═╝  ╚═╝
echo.
echo     ████████╗██████╗  █████╗  ██████╗██╗  ██╗███████╗██████╗ 
echo     ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
echo        ██║   ██████╔╝███████║██║     █████╔╝ █████╗  ██████╔╝
echo        ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
echo        ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║
echo        ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
echo.
echo                         � Professional Hydroponic Tracking 🌱
echo                              Version 1.0.0 - Production Ready
echo ==================================================================================

echo.
echo 🔍 Checking system requirements...

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed! Please install Node.js v18+ from https://nodejs.org/
    echo.
    echo 📥 Download Node.js: https://nodejs.org/en/download/
    echo.
    pause
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed! Please install npm.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js %NODE_VERSION% detected
echo ✅ npm %NPM_VERSION% detected

echo.
echo 🔧 Setting up dependencies...

:: Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

:: Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo 🏗️ Building production frontend...
cd frontend
call npm run build --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to build frontend
    pause
    exit /b 1
)

cd ..

echo.
echo 🚀 Starting Hydro Growth Tracker...
echo.
echo ┌─────────────────────────────────────────────────────────────────┐
echo │                        🌿 QUICK START GUIDE 🌿                  │
echo ├─────────────────────────────────────────────────────────────────┤
echo │  1. Backend API will start on http://localhost:5000             │
echo │  2. Frontend app will start on http://localhost:5173            │
echo │  3. Your browser will open automatically                        │
echo │  4. To stop: Press Ctrl+C in both terminal windows             │
echo │                                                                 │
echo │  📊 Dashboard: Track plant growth with real-time charts        │
echo │  📝 Add Logs: Record height, nutrients, and photos             │
echo │  📅 Schedule: 16-week professional feeding calendar            │
echo │  🌙 Themes: Switch between light and dark modes                │
echo │  💾 Auto-save: Never lose your data with draft protection      │
echo └─────────────────────────────────────────────────────────────────┘
echo.

:: Start backend in new styled window
start "🌿 Hydro Growth Tracker - Backend API Server 🖥️" cmd /k "color 0B && echo ======================================== && echo   HYDRO GROWTH TRACKER - BACKEND API    && echo ======================================== && echo 🚀 Starting backend server... && echo 📡 API running on http://localhost:5000 && echo 🗄️ SQLite database ready && echo. && cd backend && npm start"

:: Wait for backend to initialize
echo 🔄 Initializing backend server...
timeout /t 4 /nobreak >nul

:: Start frontend in new styled window  
start "🌿 Hydro Growth Tracker - Frontend Development Server 🌐" cmd /k "color 0A && echo ======================================== && echo  HYDRO GROWTH TRACKER - FRONTEND DEV     && echo ======================================== && echo 🚀 Starting frontend server... && echo 🌐 App running on http://localhost:5173 && echo 🎨 Hot reload enabled && echo. && cd frontend && npm run dev"

echo.
echo 🎉 Hydro Growth Tracker is starting up!
echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                        🌱 NOW RUNNING 🌱                          ║
echo ╠══════════════════════════════════════════════════════════════════╣
echo ║  🌐 Frontend: http://localhost:5173                              ║
echo ║  🖥️  Backend:  http://localhost:5000                              ║
echo ║  📊 Status:   Production Ready                                   ║
echo ║  💾 Database: SQLite (Offline)                                   ║
echo ║  🔒 Privacy:  All data stored locally                            ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo 🌿 Happy Growing! Your plants are in good hands.
echo.
echo Press any key to close this window...
pause >nul
