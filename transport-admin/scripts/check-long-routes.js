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
  const vias = await prisma.via.findMany({
    include: {
      _count: {
        select: { paragens: true }
      }
    }
  });

  const over70 = vias
    .filter(v => calculateRouteLength(v.geoLocationPath) > 70)
    .sort((a, b) => calculateRouteLength(b.geoLocationPath) - calculateRouteLength(a.geoLocationPath));

  const over50 = vias
    .filter(v => {
      const len = calculateRouteLength(v.geoLocationPath);
      return len > 50 && len <= 70;
    })
    .sort((a, b) => calculateRouteLength(b.geoLocationPath) - calculateRouteLength(a.geoLocationPath));

  console.log('🔍 Routes > 70km:\n');
  over70.forEach(v => {
    const len = calculateRouteLength(v.geoLocationPath);
    console.log(`${v.codigo}: ${len.toFixed(1)}km, ${v._count.paragens} stops`);
    console.log(`   ${v.terminalPartida} → ${v.terminalChegada}\n`);
  });

  console.log('\n🔍 Routes 50-70km:\n');
  over50.forEach(v => {
    const len = calculateRouteLength(v.geoLocationPath);
    console.log(`${v.codigo}: ${len.toFixed(1)}km, ${v._count.paragens} stops`);
    console.log(`   ${v.terminalPartida} → ${v.terminalChegada}\n`);
  });

  console.log(`\nTotal routes > 70km: ${over70.length}`);
  console.log(`Total routes 50-70km: ${over50.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
