const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const stops = await prisma.paragem.findMany();
  
  console.log('\n🔍 Searching for Central Maputo stops...\n');
  
  // Central Maputo is around -25.96, 32.58
  const stopsWithCoords = stops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });
  
  const centralStops = stopsWithCoords
    .filter(s => 
      s.lat > -26.0 && s.lat < -25.90 && 
      s.lon > 32.50 && s.lon < 32.65
    )
    .slice(0, 30);
  
  console.log('📍 Central Maputo area stops (broader search):');
  centralStops.forEach(s => {
    console.log(`   ${s.codigo}: ${s.nome}`);
    console.log(`      Location: ${s.geoLocation}\n`);
  });
  
  console.log('\n🔍 Searching for Ponta do Ouro stops...\n');
  
  // Ponta do Ouro is far south, around -26.8
  const pontaStops = stops
    .map(s => {
      const [lat, lon] = s.geoLocation.split(',').map(Number);
      return { ...s, lat, lon };
    })
    .filter(s => s.lat < -26.7)
    .slice(0, 10);
  
  console.log('📍 Ponta do Ouro area stops (south of -26.7):');
  pontaStops.forEach(s => {
    console.log(`   ${s.codigo}: ${s.nome}`);
    console.log(`      Location: ${s.geoLocation}\n`);
  });
  
  console.log('\n🔍 Searching for Matola stops...\n');
  
  const matolaStops = stops
    .filter(s => s.nome.toLowerCase().includes('matola'))
    .slice(0, 10);
  
  console.log('📍 Matola stops:');
  matolaStops.forEach(s => {
    console.log(`   ${s.codigo}: ${s.nome}`);
    console.log(`      Location: ${s.geoLocation}\n`);
  });
  
  console.log('\n🔍 Searching for Bela Vista stops...\n');
  
  const belaVistaStops = stops
    .filter(s => s.nome.toLowerCase().includes('bela vista') || s.nome.toLowerCase().includes('belavista'))
    .slice(0, 10);
  
  console.log('📍 Bela Vista stops:');
  belaVistaStops.forEach(s => {
    console.log(`   ${s.codigo}: ${s.nome}`);
    console.log(`      Location: ${s.geoLocation}\n`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
