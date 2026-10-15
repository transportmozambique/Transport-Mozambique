# PostgreSQL Setup Script for Transport System
# This script creates a local PostgreSQL database

$PGPATH = "C:\Program Files\PostgreSQL\16\bin"
$PGDATA = "C:\PostgreSQL\data"
$PGPORT = "5432"
$PGUSER = "postgres"
$PGPASSWORD = "postgres123"
$DBNAME = "transport_db"

Write-Host "`n🚀 Setting up Local PostgreSQL Database`n" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# Step 1: Check if data directory exists
Write-Host "`n📁 Checking data directory..." -ForegroundColor Yellow
if (Test-Path $PGDATA) {
    Write-Host "✅ Data directory exists: $PGDATA" -ForegroundColor Green
} else {
    Write-Host "📁 Creating data directory: $PGDATA" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $PGDATA -Force | Out-Null
    
    Write-Host "🔧 Initializing PostgreSQL database cluster..." -ForegroundColor Yellow
    & "$PGPATH\initdb.exe" -D $PGDATA -U $PGUSER --pwfile=<(echo $PGPASSWORD) --encoding=UTF8 --locale=C
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database cluster initialized" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to initialize database cluster" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Check if PostgreSQL service is running
Write-Host "`n🔍 Checking PostgreSQL service..." -ForegroundColor Yellow
$service = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -eq "Running") {
        Write-Host "✅ PostgreSQL service is running" -ForegroundColor Green
    } else {
        Write-Host "🔄 Starting PostgreSQL service..." -ForegroundColor Yellow
        Start-Service -Name "postgresql-x64-16"
        Start-Sleep -Seconds 3
        Write-Host "✅ PostgreSQL service started" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  PostgreSQL service not found. It may still be installing." -ForegroundColor Yellow
    Write-Host "   Please wait for installation to complete and run this script again." -ForegroundColor Yellow
    exit 1
}

# Step 3: Create database
Write-Host "`n🗄️  Creating database '$DBNAME'..." -ForegroundColor Yellow

$env:PGPASSWORD = $PGPASSWORD

# Check if database exists
$dbExists = & "$PGPATH\psql.exe" -U $PGUSER -h localhost -p $PGPORT -lqt | Select-String -Pattern $DBNAME

if ($dbExists) {
    Write-Host "✅ Database '$DBNAME' already exists" -ForegroundColor Green
} else {
    & "$PGPATH\psql.exe" -U $PGUSER -h localhost -p $PGPORT -c "CREATE DATABASE $DBNAME;"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database '$DBNAME' created successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create database" -ForegroundColor Red
        exit 1
    }
}

# Step 4: Display connection string
Write-Host "`n📝 Connection Details:" -ForegroundColor Cyan
Write-Host "   Host: localhost" -ForegroundColor White
Write-Host "   Port: $PGPORT" -ForegroundColor White
Write-Host "   Database: $DBNAME" -ForegroundColor White
Write-Host "   User: $PGUSER" -ForegroundColor White
Write-Host "   Password: $PGPASSWORD" -ForegroundColor White

$connectionString = "postgresql://${PGUSER}:${PGPASSWORD}@localhost:${PGPORT}/${DBNAME}?schema=public"
Write-Host "`n🔗 Connection String:" -ForegroundColor Cyan
Write-Host "   $connectionString" -ForegroundColor Yellow

Write-Host "`n✅ Local PostgreSQL setup complete!" -ForegroundColor Green
Write-Host "`n💡 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Update your .env file with the connection string above" -ForegroundColor White
Write-Host "   2. Run: npx prisma migrate deploy" -ForegroundColor White
Write-Host "   3. Run: node scripts/seed-with-geocoding.js" -ForegroundColor White
Write-Host ""
