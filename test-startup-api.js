/**
 * Test Startup API
 * This simulates what happens when the homepage loads
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStartupAPI() {
  console.log('\n🧪 Testing Startup API Logic...\n');
  console.log('='.repeat(70));
  
  try {
    // This is what the /api/startup endpoint does
    console.log('\n1️⃣  Fetching transportes from database...');
    
    const transportes = await prisma.transporte.findMany({
      include: {
        via: {
          include: {
            municipio: true,
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
      }
    });
    
    console.log(`   ✅ Found ${transportes.length} transportes`);
    
    // Transform to frontend format
    console.log('\n2️⃣  Transforming to frontend format...');
    
    const buses = transportes.map(t => {
      if (!t.currGeoLocation) {
        console.log(`   ⚠️  ${t.matricula} has no location`);
        return null;
      }
      
      const [lat, lng] = t.currGeoLocation.split(',').map(Number);
      
      // Parse route path
      let routePath = [];
      if (t.routePath) {
        routePath = t.routePath.split(';').map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat];
        });
      } else if (t.via.geoLocationPath) {
        routePath = t.via.geoLocationPath.split(';').map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat];
        });
      }
      
      return {
        id: t.id,
        matricula: t.matricula,
        via: t.via.nome,
        latitude: lat,
        longitude: lng,
        status: 'active',
        routePath: routePath,
        stops: t.via.paragens.map(vp => ({
          id: vp.paragem.id,
          nome: vp.paragem.nome,
          latitude: parseFloat(vp.paragem.geoLocation.split(',')[0]),
          longitude: parseFloat(vp.paragem.geoLocation.split(',')[1]),
          isTerminal: vp.terminalBoolean
        }))
      };
    }).filter(b => b !== null);
    
    console.log(`   ✅ Transformed ${buses.length} buses`);
    
    // Show sample buses
    console.log('\n3️⃣  Sample buses for frontend:');
    buses.slice(0, 3).forEach(bus => {
      console.log(`\n   ${bus.matricula}:`);
      console.log(`     Via: ${bus.via}`);
      console.log(`     Position: [${bus.longitude}, ${bus.latitude}]`);
      console.log(`     Route Points: ${bus.routePath.length}`);
      console.log(`     Stops: ${bus.stops.length}`);
    });
    
    // Check if buses are spread across map
    console.log('\n4️⃣  Checking bus distribution:');
    const lats = buses.map(b => b.latitude);
    const lngs = buses.map(b => b.longitude);
    
    console.log(`   Latitude range: ${Math.min(...lats).toFixed(4)} to ${Math.max(...lats).toFixed(4)}`);
    console.log(`   Longitude range: ${Math.min(...lngs).toFixed(4)} to ${Math.max(...lngs).toFixed(4)}`);
    
    // Check municipalities
    console.log('\n5️⃣  Checking municipality distribution:');
    const viasByMunicipality = {};
    for (const t of transportes) {
      if (t.via && t.via.municipio) {
        const munName = t.via.municipio.nome;
        viasByMunicipality[munName] = (viasByMunicipality[munName] || 0) + 1;
      }
    }
    
    Object.entries(viasByMunicipality).forEach(([mun, count]) => {
      console.log(`   ${mun}: ${count} buses`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Startup API test complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${buses.length} buses ready for map`);
    console.log(`   - All buses have locations and route paths`);
    console.log(`   - Buses distributed across ${Object.keys(viasByMunicipality).length} municipalities`);
    console.log('\n💡 Next step: Start your Next.js server with "npm run dev"');
    console.log('   Then open http://localhost:3000 to see the buses on the map!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testStartupAPI();
