const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Ensure ALL vias have at least one bus
 * Runs until all vias have buses
 */

async function ensureAllViasHaveBuses() {
  console.log('🚌 Ensuring ALL Vias Have Buses\n');
  console.log('=' .repeat(80));
  
  let iteration = 0;
  let totalBusesCreated = 0;

  while (true) {
    iteration++;
    console.log(`\n🔄 Iteration ${iteration}\n`);

    // Get all vias without buses
    const allVias = await prisma.via.findMany({
      include: {
        transportes: true,
        paragens: {
          include: {
            paragem: true
          },
          orderBy: {
            id: 'asc'
          }
        }
      }
    });

    const viasWithoutBuses = allVias.filter(via => via.transportes.length === 0);
    
    console.log(`📊 Vias without buses: ${viasWithoutBuses.length}`);

    if (viasWithoutBuses.length === 0) {
      console.log('\n✅ All vias have buses!');
      break;
    }

    // Get the highest existing codigo
    const lastTransporte = await prisma.transporte.findFirst({
      orderBy: {
        codigo: 'desc'
      }
    });

    let nextCodigo = lastTransporte ? lastTransporte.codigo + 1 : 1000;

    // Create buses for all empty vias
    for (const via of viasWithoutBuses) {
      console.log(`   Creating bus for: ${via.nome}`);

      const matricula = `BUS-${nextCodigo}`;

      let initialPosition = '-25.9655,32.5892';
      if (via.paragens.length > 0) {
        initialPosition = via.paragens[0].paragem.geoLocation;
      }

      const newBus = await prisma.transporte.create({
        data: {
          matricula: matricula,
          modelo: 'Mercedes-Benz',
          marca: 'Mercedes',
          cor: via.cor || '#3B82F6',
          lotacao: 50,
          codigo: nextCodigo,
          codigoVia: via.codigo,
          viaId: via.id,
          currGeoLocation: initialPosition
        }
      });

      try {
        await prisma.geoLocation.create({
          data: {
            geoLocationTransporte: initialPosition,
            geoDirection: 'forward',
            codigoTransporte: nextCodigo,
            transporteId: newBus.id
          }
        });
      } catch (error) {
        // GeoLocation may already exist
      }

      totalBusesCreated++;
      nextCodigo++;
    }

    console.log(`   ✅ Created ${viasWithoutBuses.length} buses in this iteration`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n✅ COMPLETE!\n`);
  console.log(`📊 Summary:`);
  console.log(`   - Total iterations: ${iteration}`);
  console.log(`   - Total buses created: ${totalBusesCreated}`);

  // Final verification
  const finalVias = await prisma.via.findMany({
    include: {
      transportes: true
    }
  });

  const finalEmpty = finalVias.filter(via => via.transportes.length === 0);
  const totalBuses = await prisma.transporte.count();

  console.log(`   - Total vias: ${finalVias.length}`);
  console.log(`   - Vias with buses: ${finalVias.length - finalEmpty.length}`);
  console.log(`   - Vias without buses: ${finalEmpty.length}`);
  console.log(`   - Total buses in database: ${totalBuses}\n`);

  if (finalEmpty.length === 0) {
    console.log('✅ SUCCESS: All vias now have at least one bus!\n');
  } else {
    console.log('⚠️  WARNING: Some vias still without buses:');
    finalEmpty.forEach(via => {
      console.log(`   - ${via.nome} (${via.codigo})`);
    });
  }

  await prisma.$disconnect();
}

ensureAllViasHaveBuses();
