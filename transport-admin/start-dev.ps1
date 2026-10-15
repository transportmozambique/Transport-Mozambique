# PowerShell script to start the admin dashboard

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Transport Admin Dashboard" -ForegroundColor Cyan
Write-Host "Starting with optimized memory settings" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clear any existing NODE_OPTIONS
$env:NODE_OPTIONS = $null

# Start with cross-env (works on all platforms)
Write-Host "Starting server..." -ForegroundColor Green
npm run dev
