@echo off
echo 🌿 Hydro Growth Tracker - Package Script
echo ==========================================

echo 📦 Installing dependencies...
call npm install
cd frontend
call npm install

echo 🧹 Running linter...
call npm run lint

cd ..

echo 🏗️ Building distributable installer (electron-builder)...
call npm run dist

echo ✅ Packaging complete!
echo.
echo 📁 Installers are in the dist\ folder.
echo.
echo Happy Growing! 🌱
