const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function calculateRouteLength(geoLocationPath) {
  if (!geoLocationPath) return 0;
  
  const coordinates = geoLocationPath
    .split(';')
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return { lng, lat };
    })
    .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const from = coordinates[i];
    const to = coordinates[i + 1];
    
    const R = 6371;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function main() {
  const viaCodigo = process.argv[2] || 'V027';
  
  console.log(`🔍 Analyzing Route for ${viaCodigo}\n`);
  console.log('='.repeat(80) + '\n');

  const via = await prisma.via.findUnique({
    where: { codigo: viaCodigo },
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  if (!via) {
    console.log(`❌ Via ${viaCodigo} not found!`);
    return;
  }

  console.log(`📍 ${via.codigo}: ${via.nome}`);
  console.log(`   Terminal Partida: ${via.terminalPartida}`);
  console.log(`   Terminal Chegada: ${via.terminalChegada}`);
  console.log(`   Total stops: ${via.paragens.length}\n`);

  if (!via.geoLocationPath) {
    console.log('❌ No route path defined!');
    return;
  }

  const routeLength = calculateRouteLength(via.geoLocationPath);
  console.log(`📏 Route Analysis:`);
  console.log(`   Actual route length: ${routeLength.toFixed(2)} km`);

  // Get terminal coordinates
  const terminals = via.paragens.filter(vp => vp.terminalBoolean);
  
  if (terminals.length >= 2) {
    const term1 = terminals[0].paragem;
    const term2 = terminals[terminals.length - 1].paragem;
    
    const [lat1, lon1] = term1.geoLocation.split(',').map(Number);
    const [lat2, lon2] = term2.geoLocation.split(',').map(Number);
    
    const directDistance = calculateDistance(lat1, lon1, lat2, lon2);
    const detourFactor = routeLength / directDistance;
    
    console.log(`   Direct distance (straight line): ${directDistance.toFixed(2)} km`);
    console.log(`   Detour factor: ${detourFactor.toFixed(2)}x`);
    
    if (detourFactor > 2.0) {
      console.log(`   ⚠️  Route is very winding! (${detourFactor.toFixed(1)}x longer than direct)`);
    } else if (detourFactor > 1.5) {
      console.log(`   ⚠️  Route has some detours (${detourFactor.toFixed(1)}x longer than direct)`);
    } else {
      console.log(`   ✅ Route is relatively direct`);
    }
  }

  console.log(`\n📊 Route Coordinates:`);
  console.log(`   Total coordinate points: ${via.geoLocationPath.split(';').length}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
