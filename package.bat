@echo off
echo 🌿 Hydro Growth Tracker - Package Script
echo ==========================================

echo 📦 Starting packaging process...

echo 🔧 Installing frontend dependencies...
cd frontend
call npm install

echo 🏗️ Building frontend application...
call npm run build

echo 🧹 Running linter...
call npm run lint

cd ..

echo 🔧 Installing backend dependencies...
cd backend
call npm install

cd ..

echo ✅ Packaging complete!
echo.
echo 📁 Package Contents:
echo    - frontend/dist/     (Built frontend application)
echo    - backend/          (Backend API server)
echo.
echo 🚀 Ready for distribution!
echo    Backend: cd backend ^& npm start
echo    Frontend: serve dist folder or npm run dev
echo.
echo Happy Growing! 🌱
