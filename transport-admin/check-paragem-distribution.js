const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDistribution() {
  const paragens = await prisma.paragem.findMany({ take: 20 });
  
  console.log('Sample of 20 paragens:');
  paragens.forEach(p => {
    const [lat, lng] = p.geoLocation.split(',').map(parseFloat);
    console.log(`${p.nome}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  });
  
  // Get min/max coordinates
  const allParagens = await prisma.paragem.findMany();
  let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999;
  
  allParagens.forEach(p => {
    const [lat, lng] = p.geoLocation.split(',').map(parseFloat);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  
  console.log('\nParagem coordinate ranges:');
  console.log(`Latitude: ${minLat.toFixed(4)} to ${maxLat.toFixed(4)}`);
  console.log(`Longitude: ${minLng.toFixed(4)} to ${maxLng.toFixed(4)}`);
  console.log(`\nMaputo Centro reference: -25.9692, 32.5732`);
  
  await prisma.$disconnect();
}

checkDistribution();
