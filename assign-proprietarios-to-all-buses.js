const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignProprietariosToAllBuses() {
  try {
    console.log('🚀 Iniciando atribuição de proprietários a todos os autocarros...\n');

    // 1. Buscar todos os proprietários
    const proprietarios = await prisma.proprietario.findMany({
      select: {
        id: true,
        nome: true,
      }
    });

    if (proprietarios.length === 0) {
      console.log('❌ Nenhum proprietário encontrado no banco de dados!');
      console.log('   Crie proprietários primeiro antes de executar este script.');
      return;
    }

    console.log(`✅ Encontrados ${proprietarios.length} proprietários:`);
    proprietarios.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.nome} (${p.id})`);
    });
    console.log('');

    // 2. Buscar todos os transportes
    const transportes = await prisma.transporte.findMany({
      include: {
        proprietarios: true,
      }
    });

    console.log(`📊 Total de autocarros: ${transportes.length}`);

    // 3. Filtrar transportes sem proprietário
    const transportesSemProprietario = transportes.filter(
      t => t.proprietarios.length === 0
    );

    console.log(`🔍 Autocarros sem proprietário: ${transportesSemProprietario.length}`);
    console.log(`✅ Autocarros com proprietário: ${transportes.length - transportesSemProprietario.length}\n`);

    if (transportesSemProprietario.length === 0) {
      console.log('🎉 Todos os autocarros já têm proprietário atribuído!');
      return;
    }

    // 4. Atribuir proprietários (distribuir de forma equilibrada)
    console.log('📝 Atribuindo proprietários...\n');
    
    let atribuidos = 0;
    for (let i = 0; i < transportesSemProprietario.length; i++) {
      const transporte = transportesSemProprietario[i];
      // Distribuir proprietários de forma circular
      const proprietario = proprietarios[i % proprietarios.length];

      try {
        await prisma.transporteProprietario.create({
          data: {
            transporteId: transporte.id,
            proprietarioId: proprietario.id,
            codigoTransporte: transporte.codigo,
            idProprietario: proprietario.id,
          }
        });

        atribuidos++;
        console.log(`   ✅ ${transporte.matricula} → ${proprietario.nome}`);
      } catch (error) {
        console.log(`   ❌ Erro ao atribuir ${transporte.matricula}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Concluído! ${atribuidos} proprietários atribuídos com sucesso!`);
    console.log(`\n📊 Resumo Final:`);
    console.log(`   - Total de autocarros: ${transportes.length}`);
    console.log(`   - Autocarros com proprietário: ${transportes.length - transportesSemProprietario.length + atribuidos}`);
    console.log(`   - Autocarros sem proprietário: ${transportesSemProprietario.length - atribuidos}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
assignProprietariosToAllBuses();
