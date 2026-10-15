@echo off
echo ========================================
echo Transport Admin Dashboard
echo Starting with optimized memory settings
echo ========================================
echo.

REM Clear any existing NODE_OPTIONS
set NODE_OPTIONS=

REM Start with cross-env (works on all platforms)
echo Starting server...
npm run dev

pause
