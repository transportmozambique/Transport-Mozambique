require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Create buses going in BOTH directions for each route
 * This ensures users can always find buses regardless of their travel direction
 */

async function createBidirectionalBuses() {
  console.log('🔄 Creating bidirectional buses for all routes...\n');

  try {
    // Get current max codigo ONCE at the start
    const allTransportes = await prisma.transporte.findMany({
      select: { codigo: true },
      orderBy: { codigo: 'desc' },
      take: 1
    });
    let nextCodigo = allTransportes.length > 0 ? allTransportes[0].codigo + 1 : 1;
    console.log(`📊 Starting from codigo: ${nextCodigo}\n`);

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
        },
        transportes: true
      }
    });

    console.log(`📊 Found ${vias.length} vias\n`);

    let totalBusesCreated = 0;

    for (const via of vias) {
      console.log(`\n📍 Processing: ${via.nome} (${via.codigo})`);
      console.log(`   Direction: ${via.terminalPartida} → ${via.terminalChegada}`);
      console.log(`   Existing buses: ${via.transportes.length}`);

      // We want buses at different positions going in BOTH directions
      // Forward: 3 buses, Backward: 2 buses (total 5 per via)
      const forwardBuses = via.transportes.length;
      const backwardBusesToCreate = Math.max(0, 2); // Always create 2 backward buses

      if (backwardBusesToCreate > 0) {
        console.log(`   Creating ${backwardBusesToCreate} backward-direction buses...`);

        const baseMatricula = via.codigo.replace('VIA-', '');
        
        for (let i = 0; i < backwardBusesToCreate; i++) {
          // Use incrementing codigo
          const busCode = nextCodigo++;
          
          // Generate unique matricula with 'R' suffix for reverse
          const busNumber = forwardBuses + i + 1;
          const matricula = `${baseMatricula}-R${String(busNumber).padStart(2, '0')}`;
          
          // Position bus at END of route (going backward)
          // Backward bus 1: 75% position (going back)
          // Backward bus 2: 50% position (going back)
          const positionIndex = Math.floor(((backwardBusesToCreate - i - 1) / backwardBusesToCreate) * via.paragens.length);
          const stopAtPosition = via.paragens[Math.min(positionIndex, via.paragens.length - 1)];
          
          const currGeoLocation = stopAtPosition.paragem.geoLocation;

          // Reverse the route path for backward direction
          let reversedRoutePath = null;
          if (via.geoLocationPath) {
            const coords = via.geoLocationPath.split(';');
            reversedRoutePath = coords.reverse().join(';');
          }

          // Create backward bus
          await prisma.transporte.create({
            data: {
              matricula: matricula,
              modelo: 'Chapa',
              marca: 'Toyota',
              cor: 'Branco',
              lotacao: 15,
              codigo: busCode,
              codigoVia: via.codigo,
              viaId: via.id,
              currGeoLocation: currGeoLocation,
              routePath: reversedRoutePath || via.geoLocationPath
            }
          });

          console.log(`   ✅ Created backward: ${matricula} (codigo: ${busCode}) at ${stopAtPosition.paragem.nome}`);
          totalBusesCreated++;
        }
      } else {
        console.log(`   ✅ Sufficient backward buses already exist`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total vias processed: ${vias.length}`);
    console.log(`🔄 Backward buses created: ${totalBusesCreated}`);
    console.log(`📈 Total buses now: ${await prisma.transporte.count()}`);
    console.log('='.repeat(60));

    // Show distribution
    console.log('\n📊 Bus distribution per via (after adding backward buses):');
    const distribution = await prisma.via.findMany({
      include: {
        _count: {
          select: { transportes: true }
        }
      },
      orderBy: {
        codigo: 'asc'
      },
      take: 20 // Show first 20
    });

    distribution.forEach(via => {
      const count = via._count.transportes;
      const bar = '█'.repeat(Math.min(count, 10));
      console.log(`   ${via.codigo.padEnd(20)} ${bar} ${count}`);
    });

    console.log('\n💡 Note: Backward buses have "R" in their matricula (e.g., MAT-BAI-R01)');
    console.log('   These buses travel in the opposite direction of the via.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBidirectionalBuses();
