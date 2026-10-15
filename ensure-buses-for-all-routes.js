require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Ensure every via has multiple buses at different positions
 * This guarantees that users will always find available transports
 */

async function ensureBusesForAllRoutes() {
  console.log('🚌 Ensuring sufficient buses for all routes...\n');

  try {
    // Get all vias
    const vias = await prisma.via.findMany({
      include: {
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

    console.log(`📊 Found ${vias.length} vias\n`);

    let totalBusesCreated = 0;
    let totalBusesUpdated = 0;

    for (const via of vias) {
      console.log(`\n📍 Processing: ${via.nome} (${via.codigo})`);
      console.log(`   Stops: ${via.paragens.length}`);

      // Get existing buses for this via
      const existingBuses = await prisma.transporte.findMany({
        where: { viaId: via.id }
      });

      console.log(`   Existing buses: ${existingBuses.length}`);

      // We want at least 5 buses per via, distributed along the route
      const targetBusCount = 5;
      const busesToCreate = Math.max(0, targetBusCount - existingBuses.length);

      if (busesToCreate > 0) {
        console.log(`   Creating ${busesToCreate} new buses...`);

        // Generate unique matriculas
        const baseMatricula = via.codigo.replace('VIA-', '');
        
        for (let i = 0; i < busesToCreate; i++) {
          const busNumber = existingBuses.length + i + 1;
          const matricula = `${baseMatricula}-${String(busNumber).padStart(3, '0')}`;
          
          // Generate unique codigo (integer)
          const maxCodigo = await prisma.transporte.findFirst({
            orderBy: { codigo: 'desc' },
            select: { codigo: true }
          });
          const nextCodigo = (maxCodigo?.codigo || 0) + 1;
          
          // Position bus at different points along the route
          const positionIndex = Math.floor((i / busesToCreate) * via.paragens.length);
          const stopAtPosition = via.paragens[Math.min(positionIndex, via.paragens.length - 1)];
          
          const currGeoLocation = stopAtPosition.paragem.geoLocation;

          // Create bus
          await prisma.transporte.create({
            data: {
              matricula: matricula,
              modelo: 'Chapa',
              marca: 'Toyota',
              cor: 'Branco',
              lotacao: 15,
              codigo: nextCodigo,
              codigoVia: via.codigo,
              viaId: via.id,
              currGeoLocation: currGeoLocation,
              routePath: via.geoLocationPath // Use via's route path
            }
          });

          console.log(`   ✅ Created: ${matricula} (codigo: ${nextCodigo}) at ${stopAtPosition.paragem.nome}`);
          totalBusesCreated++;
        }
      } else {
        console.log(`   ✅ Sufficient buses already exist`);
      }

      // Update existing buses to ensure they have routePath
      for (const bus of existingBuses) {
        if (!bus.routePath && via.geoLocationPath) {
          await prisma.transporte.update({
            where: { id: bus.id },
            data: { routePath: via.geoLocationPath }
          });
          console.log(`   🔄 Updated ${bus.matricula} with route path`);
          totalBusesUpdated++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total vias processed: ${vias.length}`);
    console.log(`🆕 New buses created: ${totalBusesCreated}`);
    console.log(`🔄 Buses updated: ${totalBusesUpdated}`);
    console.log(`📈 Total buses now: ${await prisma.transporte.count()}`);
    console.log('='.repeat(60));

    // Verify coverage
    console.log('\n🔍 Verifying coverage...\n');
    
    const viasWithoutBuses = await prisma.via.findMany({
      where: {
        transportes: {
          none: {}
        }
      }
    });

    if (viasWithoutBuses.length > 0) {
      console.log(`⚠️  WARNING: ${viasWithoutBuses.length} vias still have no buses:`);
      viasWithoutBuses.forEach(via => {
        console.log(`   - ${via.nome} (${via.codigo})`);
      });
    } else {
      console.log('✅ All vias have buses!');
    }

    // Show distribution
    console.log('\n📊 Bus distribution per via:');
    const distribution = await prisma.via.findMany({
      include: {
        _count: {
          select: { transportes: true }
        }
      },
      orderBy: {
        codigo: 'asc'
      }
    });

    distribution.forEach(via => {
      const count = via._count.transportes;
      const bar = '█'.repeat(count);
      console.log(`   ${via.codigo.padEnd(15)} ${bar} ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureBusesForAllRoutes();
