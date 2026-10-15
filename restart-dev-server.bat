@echo off
echo Stopping any running Next.js processes...
taskkill /F /IM node.exe 2>nul

echo.
echo Clearing Next.js cache...
cd transport-client
if exist .next rmdir /s /q .next
echo Cache cleared!

echo.
echo Starting dev server...
npm run dev
