#!/bin/bash

# Script para aplicar a migração que torna viaId opcional em Transporte
# Autor: Kiro AI
# Data: May 9, 2026

echo "🚀 Aplicando migração: viaId opcional em Transporte"
echo "=================================================="
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Erro: Execute este script no diretório transport-admin"
    exit 1
fi

echo "📋 Passo 1: Verificando schema do Prisma..."
if grep -q "viaId.*String?" prisma/schema.prisma; then
    echo "✅ Schema já está atualizado (viaId é opcional)"
else
    echo "❌ Schema não está atualizado. Por favor, verifique o arquivo prisma/schema.prisma"
    exit 1
fi

echo ""
echo "📋 Passo 2: Gerando migração do Prisma..."
npx prisma migrate dev --name make-via-optional-in-transporte

if [ $? -eq 0 ]; then
    echo "✅ Migração gerada com sucesso!"
else
    echo "❌ Erro ao gerar migração"
    exit 1
fi

echo ""
echo "📋 Passo 3: Regenerando Prisma Client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Client regenerado com sucesso!"
else
    echo "❌ Erro ao regenerar Prisma Client"
    exit 1
fi

echo ""
echo "=================================================="
echo "✅ Migração aplicada com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "  1. Testar a eliminação de vias com transportes"
echo "  2. Verificar que transportes ficam com viaId = null"
echo "  3. Atualizar UI para mostrar 'Sem via atribuída'"
echo "  4. Deploy em produção com: npx prisma migrate deploy"
echo ""
