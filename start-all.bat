@echo off
echo ========================================
echo  Sistema de Transportes de Mocambique
echo ========================================
echo.
echo Iniciando todas as aplicacoes...
echo.

echo [1/3] Iniciando Transport-Admin (porta 3001)...
start "Transport-Admin" cmd /k "cd transport-admin && npm run dev"
timeout /t 2 /nobreak >nul

echo [2/3] Iniciando Transport-Client (porta 3000)...
start "Transport-Client" cmd /k "cd transport-client && npm run dev"
timeout /t 2 /nobreak >nul

echo [3/3] Iniciando Transport-Driver (porta 3002)...
start "Transport-Driver" cmd /k "cd transport-driver && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  Todas as aplicacoes foram iniciadas!
echo ========================================
echo.
echo Acesse:
echo  - Admin:  http://localhost:3001
echo  - Client: http://localhost:3000
echo  - Driver: http://localhost:3002
echo.
echo Pressione qualquer tecla para sair...
pause >nul
