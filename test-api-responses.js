require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n🧪 Testing API Responses...\n');
  console.log('='.repeat(70));
  
  // Test 1: Municipalities
  console.log('\n1️⃣  Testing /api/locations - Municipalities:');
  const municipios = await prisma.municipio.findMany({
    select: {
      id: true,
      nome: true,
      codigo: true,
    },
    orderBy: {
      nome: 'asc',
    },
  });
  console.log(`   Found ${municipios.length} municipalities:`);
  municipios.forEach(m => {
    console.log(`   - ${m.nome} (${m.codigo}) [ID: ${m.id}]`);
  });
  
  // Test 2: Buses with locations for homepage
  console.log('\n2️⃣  Testing /api/startup - Buses for Homepage:');
  const allTransportes = await prisma.transporte.findMany({
    take: 5
  });
  
  const transportes = await prisma.transporte.findMany({
    where: {
      currGeoLocation: { isSet: true },
      viaId: { isSet: true }
    },
    include: {
      via: {
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
      }
    },
    take: 5
  });
  
  console.log(`   Found ${transportes.length} buses with locations (showing first 5):`);
  transportes.forEach(t => {
    console.log(`\n   Bus: ${t.matricula}`);
    console.log(`     Location: ${t.currGeoLocation}`);
    console.log(`     Via: ${t.via.nome}`);
    console.log(`     Route Path: ${t.routePath ? 'YES' : 'NO'}`);
    console.log(`     Stops: ${t.via.paragens.length}`);
    
    // Parse location
    if (t.currGeoLocation) {
      const [lat, lng] = t.currGeoLocation.split(',').map(Number);
      console.log(`     Parsed: lat=${lat}, lng=${lng}`);
    }
    
    // Parse route path
    if (t.routePath) {
      const coords = t.routePath.split(';');
      console.log(`     Route points: ${coords.length}`);
      console.log(`     First point: ${coords[0]}`);
      console.log(`     Last point: ${coords[coords.length - 1]}`);
    } else if (t.via.geoLocationPath) {
      const coords = t.via.geoLocationPath.split(';');
      console.log(`     Via route points: ${coords.length}`);
    }
  });
  
  // Test 3: Check if buses are properly formatted for frontend
  console.log('\n3️⃣  Simulating Frontend Bus Format:');
  const bus = transportes[0];
  if (bus) {
    const [lat, lng] = bus.currGeoLocation.split(',').map(Number);
    
    // Parse route path
    let routePath = [];
    if (bus.routePath) {
      routePath = bus.routePath.split(';').map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return [lng, lat];
      });
    } else if (bus.via.geoLocationPath) {
      routePath = bus.via.geoLocationPath.split(';').map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return [lng, lat];
      });
    }
    
    const frontendBus = {
      id: bus.id,
      matricula: bus.matricula,
      via: bus.via.nome,
      latitude: lat,
      longitude: lng,
      status: 'active',
      routePath: routePath,
      stops: bus.via.paragens.map(vp => ({
        id: vp.paragem.id,
        nome: vp.paragem.nome,
        latitude: parseFloat(vp.paragem.geoLocation.split(',')[0]),
        longitude: parseFloat(vp.paragem.geoLocation.split(',')[1]),
        isTerminal: vp.terminalBoolean
      }))
    };
    
    console.log('\n   Frontend Bus Object:');
    console.log(JSON.stringify(frontendBus, null, 2));
  }
  
  console.log('\n' + '='.repeat(70));
  
  await prisma.$disconnect();
})();
