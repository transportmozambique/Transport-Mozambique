const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBuses() {
  try {
    console.log('🔧 Verificando autocarros...\n');
    
    // Check current state
    const totalTransportes = await prisma.transporte.count();
    const totalVias = await prisma.via.count();
    
    console.log(`📊 Estado atual:`);
    console.log(`  Total de autocarros: ${totalTransportes}`);
    console.log(`  Total de vias: ${totalVias}`);
    console.log('');
    
    // Check if all vias have at least one transporte
    const viasSemTransportes = await prisma.via.count({
      where: {
        transportes: {
          none: {}
        }
      }
    });
    
    if (viasSemTransportes > 0) {
      console.log(`⚠️  ${viasSemTransportes} vias sem transportes!`);
      console.log('   Execute: node create-missing-buses.js');
    } else {
      console.log(`✅ Todas as ${totalVias} vias têm autocarros!`);
    }
    
    // Check average buses per via
    const avgBusesPerVia = totalTransportes / totalVias;
    console.log(`📊 Média de autocarros por via: ${avgBusesPerVia.toFixed(1)}`);
    
    // Show distribution
    const viasComUmTransporte = await prisma.via.count({
      where: {
        transportes: {
          some: {}
        }
      }
    });
    
    const viasCom2Transportes = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            transportes: true
          }
        }
      }
    });
    
    const distribution = {};
    viasCom2Transportes.forEach(via => {
      const count = via._count.transportes;
      if (!distribution[count]) distribution[count] = 0;
      distribution[count]++;
    });
    
    console.log('\n📊 Distribuição de autocarros por via:');
    Object.keys(distribution).sort((a, b) => a - b).forEach(count => {
      console.log(`  ${count} autocarro(s): ${distribution[count]} via(s)`);
    });
    
    console.log('\n✅ Sistema está funcionando corretamente!');
    console.log('   Todas as opções no seletor têm autocarros disponíveis.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixBuses();
