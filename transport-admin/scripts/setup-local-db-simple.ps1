# Simple PostgreSQL Setup Script
$PGPATH = "C:\Program Files\PostgreSQL\16\bin"
$DBNAME = "transport_db"
$PGUSER = "postgres"
$PGPASSWORD = "postgres"  # Default password during installation

Write-Host "`n🚀 Setting up Local PostgreSQL Database`n" -ForegroundColor Cyan

# Set password environment variable
$env:PGPASSWORD = $PGPASSWORD

# Test connection
Write-Host "🔍 Testing PostgreSQL connection..." -ForegroundColor Yellow
$testResult = & "$PGPATH\psql.exe" -U $PGUSER -h localhost -c "SELECT version();" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cannot connect to PostgreSQL" -ForegroundColor Red
    Write-Host "   Error: $testResult" -ForegroundColor Red
    Write-Host "`n💡 Please ensure:" -ForegroundColor Yellow
    Write-Host "   1. PostgreSQL service is running" -ForegroundColor White
    Write-Host "   2. You know the postgres user password (set during installation)" -ForegroundColor White
    Write-Host "   3. Run: Get-Service postgresql-x64-16" -ForegroundColor White
    exit 1
}

Write-Host "✅ Connected to PostgreSQL" -ForegroundColor Green

# Check if database exists
Write-Host "`n🗄️  Checking if database '$DBNAME' exists..." -ForegroundColor Yellow
$dbCheck = & "$PGPATH\psql.exe" -U $PGUSER -h localhost -lqt | Select-String -Pattern "^\s*$DBNAME\s"

if ($dbCheck) {
    Write-Host "✅ Database '$DBNAME' already exists" -ForegroundColor Green
    $response = Read-Host "`n⚠️  Do you want to DROP and recreate it? (yes/no)"
    if ($response -eq "yes") {
        Write-Host "🗑️  Dropping database..." -ForegroundColor Yellow
        & "$PGPATH\psql.exe" -U $PGUSER -h localhost -c "DROP DATABASE IF EXISTS $DBNAME;"
        Write-Host "✅ Database dropped" -ForegroundColor Green
        
        Write-Host "📦 Creating new database..." -ForegroundColor Yellow
        & "$PGPATH\psql.exe" -U $PGUSER -h localhost -c "CREATE DATABASE $DBNAME;"
        Write-Host "✅ Database created" -ForegroundColor Green
    }
} else {
    Write-Host "📦 Creating database '$DBNAME'..." -ForegroundColor Yellow
    & "$PGPATH\psql.exe" -U $PGUSER -h localhost -c "CREATE DATABASE $DBNAME;"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database '$DBNAME' created successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create database" -ForegroundColor Red
        exit 1
    }
}

# Display connection string
$connectionString = "postgresql://${PGUSER}:${PGPASSWORD}@localhost:5432/${DBNAME}?schema=public"

Write-Host "`n" + ("=" * 80) -ForegroundColor Gray
Write-Host "`n✅ Local PostgreSQL setup complete!" -ForegroundColor Green
Write-Host "`n🔗 Connection String:" -ForegroundColor Cyan
Write-Host "   $connectionString" -ForegroundColor Yellow
Write-Host "`n📝 Add this to your .env file:" -ForegroundColor Cyan
Write-Host '   DATABASE_URL="' -NoNewline -ForegroundColor White
Write-Host $connectionString -NoNewline -ForegroundColor Yellow
Write-Host '"' -ForegroundColor White
Write-Host ""
