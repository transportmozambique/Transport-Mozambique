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

async function main() {
  console.log('🔍 Checking Intercity Routes\n');
  console.log('='.repeat(80) + '\n');

  const intercityVias = await prisma.via.findMany({
    where: {
      codigo: { in: ['V007', 'V020', 'V050'] }
    },
    include: {
      paragens: {
        include: {
          paragem: true
        },
        orderBy: {
          paragem: {
            geoLocation: 'asc'
          }
        }
      }
    }
  });

  for (const via of intercityVias) {
    const length = calculateRouteLength(via.geoLocationPath);
    
    console.log(`📍 ${via.codigo}: ${via.nome}`);
    console.log('='.repeat(80));
    console.log(`   Route Length: ${length.toFixed(1)} km`);
    console.log(`   Total Stops: ${via.paragens.length}`);
    console.log(`   Terminal Partida: ${via.terminalPartida}`);
    console.log(`   Terminal Chegada: ${via.terminalChegada}`);
    console.log(`\n   First 5 stops:`);
    
    via.paragens.slice(0, 5).forEach((vp, idx) => {
      console.log(`      ${idx + 1}. ${vp.paragem.codigo}: ${vp.paragem.nome}`);
    });
    
    console.log(`\n   Last 5 stops:`);
    via.paragens.slice(-5).forEach((vp, idx) => {
      console.log(`      ${via.paragens.length - 4 + idx}. ${vp.paragem.codigo}: ${vp.paragem.nome}`);
    });
    
    console.log('\n');
  }

  // Check all routes > 50km
  console.log('='.repeat(80));
  console.log('📊 ALL ROUTES > 50km\n');
  
  const allVias = await prisma.via.findMany({
    include: {
      paragens: true
    }
  });

  const longRoutes = allVias
    .map(v => ({
      codigo: v.codigo,
      nome: v.nome,
      length: calculateRouteLength(v.geoLocationPath),
      stops: v.paragens.length,
      terminalPartida: v.terminalPartida,
      terminalChegada: v.terminalChegada
    }))
    .filter(v => v.length > 50)
    .sort((a, b) => b.length - a.length);

  console.log(`Found ${longRoutes.length} routes over 50km:\n`);
  
  longRoutes.forEach((route, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${route.codigo.padEnd(6)} ${route.length.toFixed(1).padStart(6)} km  ${route.stops.toString().padStart(3)} stops`);
    console.log(`    ${route.terminalPartida} → ${route.terminalChegada}\n`);
  });

  console.log('='.repeat(80));
  console.log('✅ Verification complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
