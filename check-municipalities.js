require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n🏛️  Checking Municipalities and Stops Distribution...\n');
  console.log('='.repeat(70));
  
  // Get all municipalities
  const municipios = await prisma.municipio.findMany({
    select: {
      id: true,
      nome: true,
      codigo: true,
      endereco: true
    }
  });
  
  console.log(`\n📍 Municipalities (${municipios.length}):`);
  municipios.forEach(m => {
    console.log(`   - ${m.nome} (${m.codigo})`);
    console.log(`     Address: ${m.endereco || 'N/A'}`);
  });
  
  // Get vias per municipality
  console.log('\n🛣️  Vias per Municipality:');
  for (const mun of municipios) {
    const viaCount = await prisma.via.count({
      where: { municipioId: mun.id }
    });
    console.log(`   - ${mun.nome}: ${viaCount} vias`);
  }
  
  // Check if there are inter-municipal routes
  console.log('\n🔄 Checking for Inter-Municipal Routes:');
  const maputoMun = municipios.find(m => m.nome === 'Maputo');
  const matolaMun = municipios.find(m => m.nome === 'Matola');
  
  if (maputoMun && matolaMun) {
    // Get some sample vias from each municipality
    const maputoVias = await prisma.via.findMany({
      where: { municipioId: maputoMun.id },
      select: { nome: true, terminalPartida: true, terminalChegada: true },
      take: 5
    });
    
    const matolaVias = await prisma.via.findMany({
      where: { municipioId: matolaMun.id },
      select: { nome: true, terminalPartida: true, terminalChegada: true },
      take: 5
    });
    
    console.log(`\n   Maputo Vias (sample):`);
    maputoVias.forEach(v => {
      console.log(`     - ${v.nome}`);
      console.log(`       ${v.terminalPartida} → ${v.terminalChegada}`);
    });
    
    console.log(`\n   Matola Vias (sample):`);
    matolaVias.forEach(v => {
      console.log(`     - ${v.nome}`);
      console.log(`       ${v.terminalPartida} → ${v.terminalChegada}`);
    });
  }
  
  // Check transport locations
  console.log('\n🚌 Checking Transport Locations:');
  const transportesWithLocation = await prisma.transporte.count({
    where: {
      currGeoLocation: { not: null }
    }
  });
  
  const transportesTotal = await prisma.transporte.count();
  
  console.log(`   - Transportes with location: ${transportesWithLocation}/${transportesTotal}`);
  
  // Sample some transport locations
  const sampleTransportes = await prisma.transporte.findMany({
    select: {
      matricula: true,
      currGeoLocation: true,
      via: {
        select: {
          nome: true,
          municipio: {
            select: { nome: true }
          }
        }
      }
    },
    take: 5
  });
  
  console.log('\n   Sample Transportes:');
  sampleTransportes.forEach(t => {
    console.log(`     - ${t.matricula}: ${t.currGeoLocation || 'NO LOCATION'}`);
    console.log(`       Via: ${t.via.nome}`);
    console.log(`       Municipality: ${t.via.municipio.nome}`);
  });
  
  console.log('\n' + '='.repeat(70));
  
  await prisma.$disconnect();
})();
