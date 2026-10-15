const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Add buses to vias that don't have any
 */

async function addBusesToEmptyVias() {
  console.log('🚌 Adding Buses to Empty Vias\n');
  console.log('=' .repeat(80));
  
  try {
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
    
    console.log(`\n📊 Found ${viasWithoutBuses.length} vias without buses\n`);

    if (viasWithoutBuses.length === 0) {
      console.log('✅ All vias already have buses!');
      return;
    }

    // Get the highest existing codigo to continue numbering
    const lastTransporte = await prisma.transporte.findFirst({
      orderBy: {
        codigo: 'desc'
      }
    });

    let nextCodigo = lastTransporte ? lastTransporte.codigo + 1 : 1000;

    let busesCreated = 0;

    for (const via of viasWithoutBuses) {
      console.log(`\n📍 ${via.nome} (${via.codigo})`);
      console.log(`   Creating bus...`);

      // Generate matricula
      const matricula = `BUS-${nextCodigo}`;

      // Get first stop coordinates for initial position
      let initialPosition = '-25.9655,32.5892'; // Default Maputo center
      if (via.paragens.length > 0) {
        initialPosition = via.paragens[0].paragem.geoLocation;
      }

      // Create the bus
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

      console.log(`   ✅ Created: ${newBus.matricula} (código: ${newBus.codigo})`);
      console.log(`   📍 Initial position: ${initialPosition}`);

      // Create initial GeoLocation record
      try {
        await prisma.geoLocation.create({
          data: {
            geoLocationTransporte: initialPosition,
            geoDirection: 'forward',
            codigoTransporte: nextCodigo,
            transporteId: newBus.id
          }
        });
        console.log(`   ✅ Created GeoLocation record`);
      } catch (error) {
        console.log(`   ⚠️  GeoLocation creation skipped (may already exist)`);
      }

      busesCreated++;
      nextCodigo++;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n✅ COMPLETE! Created ${busesCreated} buses\n`);

    // Verify
    const allViasAfter = await prisma.via.findMany({
      include: {
        transportes: true
      }
    });

    const viasStillEmpty = allViasAfter.filter(via => via.transportes.length === 0);
    
    console.log('📊 Summary:');
    console.log(`   - Buses created: ${busesCreated}`);
    console.log(`   - Vias now with buses: ${allViasAfter.length - viasStillEmpty.length}`);
    console.log(`   - Vias still without buses: ${viasStillEmpty.length}`);
    
    if (viasStillEmpty.length === 0) {
      console.log('\n✅ All vias now have at least one bus!\n');
    } else {
      console.log('\n⚠️  Some vias still without buses:');
      viasStillEmpty.forEach(via => {
        console.log(`   - ${via.nome}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  addBusesToEmptyVias();
}

module.exports = { addBusesToEmptyVias };
