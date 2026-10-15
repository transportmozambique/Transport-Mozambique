@echo off
setlocal enabledelayedexpansion

set PGPATH=C:\Program Files\PostgreSQL\16\bin
set DBNAME=transport_db
set PGUSER=postgres
set PGPASSWORD=postgres

echo.
echo Setting up Local PostgreSQL Database
echo ================================================================================
echo.

:: Set password environment variable
set PGPASSWORD=%PGPASSWORD%

:: Test connection
echo Testing PostgreSQL connection...
"%PGPATH%\psql.exe" -U %PGUSER% -h localhost -c "SELECT 1;" >nul 2>&1

if errorlevel 1 (
    echo ERROR: Cannot connect to PostgreSQL
    echo.
    echo Please ensure:
    echo   1. PostgreSQL service is running
    echo   2. Password is correct default: postgres
    echo   3. Run: sc query postgresql-x64-16
    echo.
    pause
    exit /b 1
)

echo SUCCESS: Connected to PostgreSQL
echo.

:: Check if database exists
echo Checking if database '%DBNAME%' exists...
"%PGPATH%\psql.exe" -U %PGUSER% -h localhost -lqt | findstr /C:"%DBNAME%" >nul 2>&1

if not errorlevel 1 (
    echo Database '%DBNAME%' already exists
    echo.
    set /p RECREATE="Do you want to DROP and recreate it? (yes/no): "
    if /i "!RECREATE!"=="yes" (
        echo Dropping database...
        "%PGPATH%\psql.exe" -U %PGUSER% -h localhost -c "DROP DATABASE IF EXISTS %DBNAME%;"
        echo Database dropped
        
        echo Creating new database...
        "%PGPATH%\psql.exe" -U %PGUSER% -h localhost -c "CREATE DATABASE %DBNAME%;"
        echo Database created
    )
) else (
    echo Creating database '%DBNAME%'...
    "%PGPATH%\psql.exe" -U %PGUSER% -h localhost -c "CREATE DATABASE %DBNAME%;"
    
    if errorlevel 1 (
        echo ERROR: Failed to create database
        pause
        exit /b 1
    )
    
    echo SUCCESS: Database '%DBNAME%' created
)

echo.
echo ================================================================================
echo.
echo SUCCESS: Local PostgreSQL setup complete!
echo.
echo Connection String:
echo   postgresql://%PGUSER%:%PGPASSWORD%@localhost:5432/%DBNAME%?schema=public
echo.
echo Add this to your .env file:
echo   DATABASE_URL="postgresql://%PGUSER%:%PGPASSWORD%@localhost:5432/%DBNAME%?schema=public"
echo.
echo Next steps:
echo   1. Update .env file with the connection string above
echo   2. Run: npx prisma migrate deploy
echo   3. Run: node scripts/seed-with-geocoding.js
echo.
pause
