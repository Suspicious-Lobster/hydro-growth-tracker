@echo off
echo 🌿 Hydro Growth Tracker - Startup Script
echo =========================================

echo.
echo 🔍 Checking system requirements...

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed! Please install Node.js v18+ from https://nodejs.org/
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

echo ✅ Node.js and npm are installed

echo.
echo 🔧 Setting up dependencies...

:: Install backend dependencies
echo Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

:: Install frontend dependencies
echo Installing frontend dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo 🏗️ Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Failed to build frontend
    pause
    exit /b 1
)

cd ..

echo.
echo 🚀 Starting Hydro Growth Tracker...
echo.
echo 📝 Instructions:
echo 1. Backend will start on http://localhost:5000
echo 2. Frontend will start on http://localhost:5173
echo 3. Open your browser to http://localhost:5173
echo 4. To stop the application, press Ctrl+C in both windows
echo.

:: Start backend in new window
start "Hydro Growth Tracker - Backend" cmd /k "cd backend && npm start"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in new window
start "Hydro Growth Tracker - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo 🎉 Hydro Growth Tracker is starting up!
echo 📱 Frontend: http://localhost:5173
echo 🖥️ Backend: http://localhost:5000
echo.
echo Press any key to exit this window...
pause >nul
