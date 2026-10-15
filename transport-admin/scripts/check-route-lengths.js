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
    
    // Haversine formula
    const R = 6371; // Earth radius in km
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
  console.log('🔍 Checking Route Lengths\n');
  console.log('='.repeat(80) + '\n');

  const vias = await prisma.via.findMany({
    include: {
      _count: {
        select: { paragens: true }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  const routeLengths = vias.map(via => ({
    codigo: via.codigo,
    nome: via.nome,
    paragens: via._count.paragens,
    length: calculateRouteLength(via.geoLocationPath)
  }));

  // Sort by length
  routeLengths.sort((a, b) => b.length - a.length);

  console.log('Top 10 Longest Routes:\n');
  routeLengths.slice(0, 10).forEach((r, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${r.codigo.padEnd(8)} ${r.length.toFixed(2).padStart(8)} km  ${r.paragens.toString().padStart(3)} stops  ${r.nome.substring(0, 40)}`);
  });

  console.log('\n\nTop 10 Shortest Routes:\n');
  routeLengths.slice(-10).reverse().forEach((r, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${r.codigo.padEnd(8)} ${r.length.toFixed(2).padStart(8)} km  ${r.paragens.toString().padStart(3)} stops  ${r.nome.substring(0, 40)}`);
  });

  // Statistics
  const totalLength = routeLengths.reduce((sum, r) => sum + r.length, 0);
  const avgLength = totalLength / routeLengths.length;
  const minLength = Math.min(...routeLengths.map(r => r.length));
  const maxLength = Math.max(...routeLengths.map(r => r.length));
  
  const routesUnder70km = routeLengths.filter(r => r.length < 70);
  const routesOver70km = routeLengths.filter(r => r.length >= 70);

  console.log('\n' + '='.repeat(80));
  console.log('📊 STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total routes: ${routeLengths.length}`);
  console.log(`Average length: ${avgLength.toFixed(2)} km`);
  console.log(`Min length: ${minLength.toFixed(2)} km`);
  console.log(`Max length: ${maxLength.toFixed(2)} km`);
  console.log(`\nRoutes >= 70km: ${routesOver70km.length}`);
  console.log(`Routes < 70km: ${routesUnder70km.length}`);
  
  if (routesUnder70km.length > 0) {
    console.log(`\n⚠️  ${routesUnder70km.length} routes are under 70km!`);
  }

  console.log('='.repeat(80) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
