const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function atribuirMotoristasAutomaticamente() {
  console.log('🚀 Iniciando atribuição automática de motoristas...\n');

  try {
    // 1. Buscar transportes sem motorista
    const transportesSemMotorista = await prisma.transporte.findMany({
      where: {
        motorista: null
      },
      include: {
        via: {
          select: {
            nome: true
          }
        }
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

        const nomeMotorista = motorista.nome.padEnd(35);
        const matricula = transporte.matricula.padEnd(12);
        const via = transporte.via.nome.substring(0, 25);
        
        console.log(`✓ ${String(i + 1).padStart(3)}/${quantidadeParaAtribuir} | ${nomeMotorista} → ${matricula} | ${via}`);
        sucessos++;
      } catch (error) {
        console.log(`✗ ${String(i + 1).padStart(3)}/${quantidadeParaAtribuir} | Erro: ${motorista.nome} → ${transporte.matricula}`);
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

    const totalTransportes = await prisma.transporte.count();
    const totalMotoristas = await prisma.motorista.count();
    const motoristasComTransporte = await prisma.motorista.count({
      where: { transporteId: { not: null } }
    });

    console.log('\n📊 Estatísticas Finais:');
    console.log(`   🚌 Total de transportes: ${totalTransportes}`);
    console.log(`   🚌 Transportes com motorista: ${totalTransportes - transportesAindaSemMotorista}`);
    console.log(`   🚌 Transportes sem motorista: ${transportesAindaSemMotorista}`);
    console.log(`   👤 Total de motoristas: ${totalMotoristas}`);
    console.log(`   👤 Motoristas com transporte: ${motoristasComTransporte}`);
    console.log(`   👤 Motoristas disponíveis: ${motoristasAindaDisponiveis}`);

    if (transportesAindaSemMotorista > 0 && motoristasAindaDisponiveis === 0) {
      console.log('\n⚠️  Atenção: Ainda há transportes sem motorista, mas não há mais motoristas disponíveis.');
      console.log(`💡 Sugestão: Registe mais ${transportesAindaSemMotorista} motoristas para completar a atribuição.`);
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
atribuirMotoristasAutomaticamente()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
