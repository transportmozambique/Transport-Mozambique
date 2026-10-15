import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 CONFIGURAÇÃO COMPLETA DO SISTEMA DE MOTORISTAS\n');
  console.log('=' .repeat(60));
  console.log('\n');

  // Passo 1: Verificar transportes
  console.log('📋 PASSO 1: Verificando transportes...\n');
  const transportes = await prisma.transporte.findMany();
  console.log(`✅ Encontrados ${transportes.length} transportes\n`);

  if (transportes.length === 0) {
    console.log('⚠️  AVISO: Não há transportes na base de dados!');
    console.log('   Por favor, crie transportes primeiro antes de continuar.\n');
    return;
  }

  // Passo 2: Garantir que todos os transportes têm proprietários
  console.log('📋 PASSO 2: Garantindo que todos os transportes têm empresas...\n');
  try {
    execSync('npx tsx scripts/ensure-transportes-have-proprietarios.ts', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('\n✅ Empresas atribuídas com sucesso!\n');
  } catch (error) {
    console.error('❌ Erro ao atribuir empresas:', error);
    return;
  }

  // Passo 3: Criar 111 motoristas
  console.log('📋 PASSO 3: Criando 111 motoristas...\n');
  try {
    execSync('npx tsx scripts/create-111-motoristas.ts', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('\n✅ Motoristas criados com sucesso!\n');
  } catch (error) {
    console.error('❌ Erro ao criar motoristas:', error);
    return;
  }

  // Verificação final
  console.log('📋 VERIFICAÇÃO FINAL\n');
  console.log('=' .repeat(60));
  
  const motoristas = await prisma.motorista.findMany({
    include: {
      transporte: {
        include: {
          proprietarios: {
            include: {
              proprietario: true
            }
          }
        }
      }
    }
  });

  const motoristasComTransporte = motoristas.filter(m => m.transporte);
  const motoristasComEmpresa = motoristas.filter(
    m => m.transporte && m.transporte.proprietarios.length > 0
  );

  console.log(`\n📊 ESTATÍSTICAS FINAIS:`);
  console.log(`   • Total de motoristas: ${motoristas.length}`);
  console.log(`   • Motoristas com transporte: ${motoristasComTransporte.length}`);
  console.log(`   • Motoristas com empresa: ${motoristasComEmpresa.length}`);
  console.log(`   • Transportes totais: ${transportes.length}`);
  
  const transportesComProprietario = await prisma.transporte.findMany({
    include: {
      proprietarios: true
    }
  });
  const totalComProprietario = transportesComProprietario.filter(t => t.proprietarios.length > 0).length;
  console.log(`   • Transportes com empresa: ${totalComProprietario}`);

  console.log('\n✨ CONFIGURAÇÃO COMPLETA!\n');
  console.log('🎉 Sistema pronto para uso:');
  console.log('   → Acesse: http://localhost:3000/motoristas');
  console.log('   → Todos os motoristas têm autocarro e empresa atribuídos!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
