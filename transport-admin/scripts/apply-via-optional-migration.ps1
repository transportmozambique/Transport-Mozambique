# Script para aplicar a migração que torna viaId opcional em Transporte
# Autor: Kiro AI
# Data: May 9, 2026

Write-Host "🚀 Aplicando migração: viaId opcional em Transporte" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (-Not (Test-Path "prisma/schema.prisma")) {
    Write-Host "❌ Erro: Execute este script no diretório transport-admin" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Passo 1: Verificando schema do Prisma..." -ForegroundColor Yellow
$schemaContent = Get-Content "prisma/schema.prisma" -Raw
if ($schemaContent -match "viaId\s+String\?") {
    Write-Host "✅ Schema já está atualizado (viaId é opcional)" -ForegroundColor Green
} else {
    Write-Host "❌ Schema não está atualizado. Por favor, verifique o arquivo prisma/schema.prisma" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Passo 2: Gerando migração do Prisma..." -ForegroundColor Yellow
npx prisma migrate dev --name make-via-optional-in-transporte

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migração gerada com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao gerar migração" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Passo 3: Regenerando Prisma Client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma Client regenerado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao regenerar Prisma Client" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✅ Migração aplicada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Testar a eliminação de vias com transportes"
Write-Host "  2. Verificar que transportes ficam com viaId = null"
Write-Host "  3. Atualizar UI para mostrar 'Sem via atribuída'"
Write-Host "  4. Deploy em produção com: npx prisma migrate deploy"
Write-Host ""
