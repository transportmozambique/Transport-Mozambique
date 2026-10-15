require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  console.log('🔍 Checking Database Status...\n');

  // Check stops
  const stops = await prisma.paragem.findMany({
    select: {
      nome: true,
      codigo: true,
      geoLocation: true
    }
  });

  console.log(`📍 Total Stops: ${stops.length}\n`);
  
  console.log('Sample Stops (first 10):');
  stops.slice(0, 10).forEach(s => {
    console.log(`  - ${s.nome} (${s.codigo}): ${s.geoLocation}`);
  });

  // Check buses
  const buses = await prisma.transporte.findMany({
    select: {
      matricula: true,
      marca: true,
      modelo: true,
      currGeoLocation: true,
      via: {
        select: {
          nome: true,
          codigo: true
        }
      }
    }
  });

  console.log(`\n🚌 Total Buses: ${buses.length}\n`);
  
  console.log('Sample Buses (first 5):');
  buses.slice(0, 5).forEach(b => {
    console.log(`  - ${b.matricula} (${b.marca} ${b.modelo})`);
    console.log(`    Route: ${b.via.nome} (${b.via.codigo})`);
    console.log(`    Location: ${b.currGeoLocation || 'Not set'}`);
  });

  // Check routes
  const routes = await prisma.via.findMany({
    select: {
      nome: true,
      codigo: true,
      terminalPartida: true,
      terminalChegada: true,
      _count: {
        select: {
          transportes: true,
          paragens: true
        }
      }
    }
  });

  console.log(`\n🛣️  Total Routes: ${routes.length}\n`);
  
  console.log('Sample Routes (first 5):');
  routes.slice(0, 5).forEach(r => {
    console.log(`  - ${r.nome} (${r.codigo})`);
    console.log(`    ${r.terminalPartida} → ${r.terminalChegada}`);
    console.log(`    Buses: ${r._count.transportes}, Stops: ${r._count.paragens}`);
  });

  // Check if buses have current locations
  const busesWithLocation = buses.filter(b => b.currGeoLocation).length;
  const busesWithoutLocation = buses.length - busesWithLocation;

  console.log('\n📊 Bus Location Status:');
  console.log(`  ✅ With location: ${busesWithLocation}`);
  console.log(`  ❌ Without location: ${busesWithoutLocation}`);

  await prisma.$disconnect();
}

checkDatabaseStatus()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
