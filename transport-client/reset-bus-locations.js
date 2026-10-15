const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetBusLocations() {
  try {
    console.log('🚌 Iniciando reposicionamento dos autocarros...\n');

    // Get all transportes with their vias
    const transportes = await prisma.transporte.findMany({
      where: {
        viaId: { not: null },
      },
      include: {
        via: {
          select: {
            id: true,
            nome: true,
            geoLocationPath: true,
            terminalPartida: true,
          },
        },
      },
    });

    if (transportes.length === 0) {
      console.log('⚠️  Nenhum transporte encontrado com via atribuída.');
      return;
    }

    console.log(`📊 Encontrados ${transportes.length} transportes para reposicionar.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const transporte of transportes) {
      try {
        if (!transporte.via || !transporte.via.geoLocationPath) {
          console.log(`⚠️  Transporte ${transporte.matricula}: Via sem caminho definido`);
          errorCount++;
          continue;
        }

        // Get the first coordinate from the path (start of via)
        const pathCoordinates = transporte.via.geoLocationPath.split(';');
        if (pathCoordinates.length === 0) {
          console.log(`⚠️  Transporte ${transporte.matricula}: Caminho vazio`);
          errorCount++;
          continue;
        }

        const startLocation = pathCoordinates[0]; // Format: "lng,lat"

        // Update transporte location
        await prisma.transporte.update({
          where: { id: transporte.id },
          data: {
            currGeoLocation: startLocation,
          },
        });

        console.log(`✅ ${transporte.matricula} (${transporte.via.nome}): ${startLocation}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${transporte.matricula}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 Resumo:');
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`   📊 Total: ${transportes.length}`);
    console.log('\n✨ Processo concluído!');
  } catch (error) {
    console.error('❌ Erro fatal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetBusLocations();
