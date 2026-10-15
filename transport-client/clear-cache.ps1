# Script para limpar todo o cache do Next.js
# Execute: .\clear-cache.ps1

Write-Host "🧹 Limpando cache do Next.js..." -ForegroundColor Yellow

# Parar processos Node (opcional - comente se não quiser)
# Write-Host "Parando processos Node..." -ForegroundColor Yellow
# Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Remover .next
if (Test-Path ".next") {
    Write-Host "Removendo .next..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force .next
    Write-Host "✅ .next removido" -ForegroundColor Green
} else {
    Write-Host "⚠️  .next não encontrado" -ForegroundColor Yellow
}

# Remover node_modules/.cache
if (Test-Path "node_modules/.cache") {
    Write-Host "Removendo node_modules/.cache..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force node_modules/.cache
    Write-Host "✅ node_modules/.cache removido" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules/.cache não encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Cache limpo com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Execute: npm run dev" -ForegroundColor White
Write-Host "2. Limpe o cache do navegador (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "3. Acesse: http://localhost:3000/search" -ForegroundColor White
Write-Host ""
