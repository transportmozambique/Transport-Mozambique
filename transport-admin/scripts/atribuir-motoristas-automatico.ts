import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function atribuirMotoristasAutomaticamente() {
  console.log('🚀 Iniciando atribuição automática de motoristas...\n');

  try {
    // 1. Buscar transportes sem motorista
    const transportesSemMotorista = await prisma.transporte.findMany({
      where: {
        motorista: null
      },
      orderBy: {
        codigo: 'asc'
      }
    });

    console.log(`📊 Encontrados ${transportesSemMotorista.length} transportes sem motorista`);

    // 2. Buscar motoristas disponíveis (ativos e sem transporte)
    const motoristasDisponiveis = await prisma.motorista.findMany({
      where: {
        status: 'ativo',
        transporteId: null
      },
      orderBy: {
        nome: 'asc'
      }
    });

    console.log(`👤 Encontrados ${motoristasDisponiveis.length} motoristas disponíveis\n`);

    // 3. Verificar se há motoristas suficientes
    if (motoristasDisponiveis.length === 0) {
      console.log('❌ Não há motoristas disponíveis para atribuição!');
      console.log('💡 Sugestão: Registe novos motoristas ou liberte motoristas existentes.\n');
      return;
    }

    // 4. Calcular quantos podem ser atribuídos
    const quantidadeParaAtribuir = Math.min(
      transportesSemMotorista.length,
      motoristasDisponiveis.length
    );

    console.log(`✅ Será possível atribuir ${quantidadeParaAtribuir} motoristas\n`);
    console.log('─'.repeat(80));

    // 5. Atribuir motoristas aos transportes
    let sucessos = 0;
    let erros = 0;

    for (let i = 0; i < quantidadeParaAtribuir; i++) {
      const transporte = transportesSemMotorista[i];
      const motorista = motoristasDisponiveis[i];

      try {
        await prisma.motorista.update({
          where: { id: motorista.id },
          data: { transporteId: transporte.id }
        });

        console.log(`✓ ${i + 1}/${quantidadeParaAtribuir} | ${motorista.nome.padEnd(30)} → ${transporte.matricula} (${transporte.marca} ${transporte.modelo})`);
        sucessos++;
      } catch (error) {
        console.log(`✗ ${i + 1}/${quantidadeParaAtribuir} | Erro ao atribuir ${motorista.nome} ao transporte ${transporte.matricula}`);
        erros++;
      }
    }

    console.log('─'.repeat(80));
    console.log('\n📈 Resumo da Atribuição:');
    console.log(`   ✅ Sucessos: ${sucessos}`);
    console.log(`   ❌ Erros: ${erros}`);
    
    // 6. Estatísticas finais
    const transportesAindaSemMotorista = await prisma.transporte.count({
      where: { motorista: null }
    });

    const motoristasAindaDisponiveis = await prisma.motorista.count({
      where: {
        status: 'ativo',
        transporteId: null
      }
    });

    console.log('\n📊 Estatísticas Finais:');
    console.log(`   🚌 Transportes ainda sem motorista: ${transportesAindaSemMotorista}`);
    console.log(`   👤 Motoristas ainda disponíveis: ${motoristasAindaDisponiveis}`);

    if (transportesAindaSemMotorista > 0 && motoristasAindaDisponiveis === 0) {
      console.log('\n⚠️  Atenção: Ainda há transportes sem motorista, mas não há mais motoristas disponíveis.');
      console.log('💡 Sugestão: Registe mais motoristas para completar a atribuição.');
    } else if (transportesAindaSemMotorista === 0) {
      console.log('\n🎉 Parabéns! Todos os transportes agora têm motorista atribuído!');
    }

    console.log('\n✅ Atribuição automática concluída!\n');

  } catch (error) {
    console.error('❌ Erro durante a atribuição automática:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
atribuirMotoristasAutomaticamente();
