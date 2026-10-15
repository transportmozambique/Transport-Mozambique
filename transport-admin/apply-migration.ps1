# Script Automatizado para Aplicar Migração
# Autor: Kiro AI
# Data: May 9, 2026

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Migração: viaId Opcional" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
if (-Not (Test-Path "prisma/schema.prisma")) {
    Write-Host "❌ ERRO: Execute este script no diretório transport-admin" -ForegroundColor Red
    Write-Host ""
    Write-Host "Comando correto:" -ForegroundColor Yellow
    Write-Host "  cd transport-admin" -ForegroundColor White
    Write-Host "  .\apply-migration.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "📋 Verificando schema do Prisma..." -ForegroundColor Yellow
$schemaContent = Get-Content "prisma/schema.prisma" -Raw

if ($schemaContent -match "viaId\s+String\?") {
    Write-Host "✅ Schema atualizado (viaId é opcional)" -ForegroundColor Green
} else {
    Write-Host "❌ ERRO: Schema não está atualizado" -ForegroundColor Red
    Write-Host ""
    Write-Host "O campo viaId deve ser opcional (String?) no arquivo:" -ForegroundColor Yellow
    Write-Host "  prisma/schema.prisma" -ForegroundColor White
    Write-Host ""
    Write-Host "Procure por:" -ForegroundColor Yellow
    Write-Host "  model Transporte {" -ForegroundColor White
    Write-Host "    viaId  String?  // ← Deve ter '?'" -ForegroundColor White
    Write-Host "    via    Via?     // ← Deve ter '?'" -ForegroundColor White
    Write-Host "  }" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "⚠️  ATENÇÃO: Esta migração irá:" -ForegroundColor Yellow
Write-Host "  • Tornar o campo viaId opcional na tabela Transporte" -ForegroundColor White
Write-Host "  • Permitir que transportes existam sem via atribuída" -ForegroundColor White
Write-Host "  • Permitir eliminar vias sem remover transportes" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Deseja continuar? (S/N)"
if ($confirmation -ne "S" -and $confirmation -ne "s") {
    Write-Host ""
    Write-Host "❌ Migração cancelada pelo usuário" -ForegroundColor Red
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Executando Migração" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Passo 1/3: Criando e aplicando migração..." -ForegroundColor Yellow
npx prisma migrate dev --name make-via-optional-in-transporte

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ ERRO: Falha ao aplicar migração" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possíveis soluções:" -ForegroundColor Yellow
    Write-Host "  1. Verificar se o banco de dados está rodando" -ForegroundColor White
    Write-Host "  2. Verificar credenciais no arquivo .env" -ForegroundColor White
    Write-Host "  3. Executar: npx prisma migrate status" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "📋 Passo 2/3: Verificando Prisma Client..." -ForegroundColor Yellow
if (Test-Path "node_modules/@prisma/client") {
    Write-Host "✅ Prisma Client regenerado com sucesso" -ForegroundColor Green
} else {
    Write-Host "⚠️  Regenerando Prisma Client manualmente..." -ForegroundColor Yellow
    npx prisma generate
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERRO: Falha ao regenerar Prisma Client" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Prisma Client regenerado" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Passo 3/3: Verificando migração..." -ForegroundColor Yellow

# Procurar pelo arquivo de migração mais recente
$migrationFiles = Get-ChildItem -Path "prisma/migrations" -Directory | 
    Where-Object { $_.Name -like "*make-via-optional*" } | 
    Sort-Object CreationTime -Descending | 
    Select-Object -First 1

if ($migrationFiles) {
    Write-Host "✅ Migração criada: $($migrationFiles.Name)" -ForegroundColor Green
    
    $sqlFile = Join-Path $migrationFiles.FullName "migration.sql"
    if (Test-Path $sqlFile) {
        Write-Host ""
        Write-Host "📄 SQL Aplicado:" -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor Gray
        Get-Content $sqlFile | ForEach-Object { Write-Host $_ -ForegroundColor White }
        Write-Host "----------------------------------------" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Arquivo de migração não encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Migração Concluída com Sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Reiniciar o servidor: npm run dev" -ForegroundColor White
Write-Host "  2. Testar eliminação de via com transportes" -ForegroundColor White
Write-Host "  3. Verificar que transportes ficam com 'Sem via atribuída'" -ForegroundColor White
Write-Host ""

Write-Host "🎉 Agora você pode eliminar vias sem remover transportes!" -ForegroundColor Green
Write-Host ""
