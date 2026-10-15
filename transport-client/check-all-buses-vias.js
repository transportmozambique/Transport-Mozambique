const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check all buses and their vias to identify duplicates
 */

async function checkAllBusesVias() {
  console.log('🔍 Checking All Buses and Their Vias\n');
  console.log('=' .repeat(80));
  
  try {
    // Get all transportes with their vias
    const transportes = await prisma.transporte.findMany({
      include: {
        via: {
          include: {
            paragens: {
              include: {
                paragem: true
              }
            }
          }
        }
      },
      orderBy: {
        matricula: 'asc'
      }
    });

    console.log(`\n📊 Total Buses: ${transportes.length}\n`);

    // Group buses by via
    const busesByVia = {};
    
    for (const transporte of transportes) {
      const viaId = transporte.viaId;
      if (!busesByVia[viaId]) {
        busesByVia[viaId] = {
          via: transporte.via,
          buses: []
        };
      }
      busesByVia[viaId].buses.push(transporte.matricula);
    }

    // Find vias with multiple buses
    const viasWithMultipleBuses = [];
    const viasWithSingleBus = [];

    for (const [viaId, data] of Object.entries(busesByVia)) {
      if (data.buses.length > 1) {
        viasWithMultipleBuses.push(data);
      } else {
        viasWithSingleBus.push(data);
      }
    }

    console.log('🚨 VIAS WITH MULTIPLE BUSES (Need to be split):\n');
    console.log('-'.repeat(80));
    
    let totalBusesNeedingUniqueVias = 0;
    
    for (const data of viasWithMultipleBuses) {
      console.log(`\n📍 ${data.via.nome} (${data.via.codigo})`);
      console.log(`   Route: ${data.via.terminalPartida} → ${data.via.terminalChegada}`);
      console.log(`   Buses: ${data.buses.length}`);
      console.log(`   Matriculas: ${data.buses.join(', ')}`);
      totalBusesNeedingUniqueVias += data.buses.length;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Vias with single bus: ${viasWithSingleBus.length}`);
    console.log(`🚨 Vias with multiple buses: ${viasWithMultipleBuses.length}`);
    console.log(`📊 Total buses needing unique vias: ${totalBusesNeedingUniqueVias}`);
    console.log(`📊 Total unique vias: ${Object.keys(busesByVia).length}\n`);

    // Summary by route
    console.log('\n📋 SUMMARY BY ROUTE:\n');
    console.log('-'.repeat(80));
    
    const routeSummary = {};
    
    for (const data of viasWithMultipleBuses) {
      const routeKey = `${data.via.terminalPartida} → ${data.via.terminalChegada}`;
      if (!routeSummary[routeKey]) {
        routeSummary[routeKey] = {
          vias: [],
          totalBuses: 0
        };
      }
      routeSummary[routeKey].vias.push(data.via.nome);
      routeSummary[routeKey].totalBuses += data.buses.length;
    }

    for (const [route, info] of Object.entries(routeSummary)) {
      console.log(`\n${route}`);
      console.log(`   Vias: ${info.vias.length}`);
      console.log(`   Total buses: ${info.totalBuses}`);
      console.log(`   Vias: ${info.vias.join(', ')}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 RECOMMENDATION:\n');
    console.log('   Each via with multiple buses needs to be split into separate vias');
    console.log('   with different routes (different streets and paragens).\n');
    console.log(`   Total vias to create: ${totalBusesNeedingUniqueVias - viasWithMultipleBuses.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllBusesVias();
