const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check which vias don't have buses assigned
 */

async function checkViasWithoutBuses() {
  console.log('🔍 Checking Vias Without Buses\n');
  console.log('=' .repeat(80));
  
  try {
    // Get all vias with their transportes
    const allVias = await prisma.via.findMany({
      include: {
        transportes: true,
        paragens: {
          include: {
            paragem: true
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    console.log(`\n📊 Total Vias: ${allVias.length}\n`);

    const viasWithBuses = allVias.filter(via => via.transportes.length > 0);
    const viasWithoutBuses = allVias.filter(via => via.transportes.length === 0);

    console.log(`✅ Vias with buses: ${viasWithBuses.length}`);
    console.log(`❌ Vias without buses: ${viasWithoutBuses.length}\n`);

    if (viasWithoutBuses.length > 0) {
      console.log('🚨 VIAS WITHOUT BUSES:\n');
      console.log('-'.repeat(80));
      
      for (const via of viasWithoutBuses) {
        console.log(`\n📍 ${via.nome} (${via.codigo})`);
        console.log(`   Route: ${via.terminalPartida} → ${via.terminalChegada}`);
        console.log(`   Paragens: ${via.paragens.length}`);
        console.log(`   Color: ${via.cor}`);
      }
    }

    // Get total buses
    const totalBuses = await prisma.transporte.count();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n📊 Total Buses in Database: ${totalBuses}`);
    console.log(`📊 Vias with buses: ${viasWithBuses.length}`);
    console.log(`📊 Vias without buses: ${viasWithoutBuses.length}`);
    console.log(`📊 Average buses per via: ${(totalBuses / viasWithBuses.length).toFixed(1)}\n`);

    // Show distribution
    console.log('📊 Bus Distribution:\n');
    const distribution = {};
    for (const via of viasWithBuses) {
      const count = via.transportes.length;
      if (!distribution[count]) {
        distribution[count] = 0;
      }
      distribution[count]++;
    }

    for (const [count, vias] of Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      console.log(`   ${count} bus(es): ${vias} via(s)`);
    }

    return viasWithoutBuses;

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  checkViasWithoutBuses();
}

module.exports = { checkViasWithoutBuses };
