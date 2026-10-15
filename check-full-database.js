const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 FULL DATABASE CHECK\n');
  console.log('=' .repeat(80));
  
  // Check Stops (Paragem)
  const stops = await prisma.paragem.findMany({
    select: { id: true, nome: true, geoLocation: true }
  });
  console.log(`\n📍 STOPS (Paragem): ${stops.length}`);
  stops.forEach(s => console.log(`  ${s.id}. ${s.nome} - ${s.geoLocation || 'NO COORDINATES'}`));
  
  // Check Routes (Via)
  const routes = await prisma.via.findMany({
    select: { 
      id: true, 
      nome: true, 
      terminalPartida: true, 
      terminalChegada: true,
      codigo: true,
      cor: true
    }
  });
  console.log(`\n\n🛣️  ROUTES (Via): ${routes.length}`);
  routes.forEach(r => console.log(`  ${r.codigo}. ${r.nome}: ${r.terminalPartida} → ${r.terminalChegada}`));
  
  // Check Buses (Transporte)
  const buses = await prisma.transporte.findMany({
    select: { 
      id: true, 
      marca: true, 
      modelo: true, 
      matricula: true,
      viaId: true,
      condutor: true
    }
  });
  console.log(`\n\n🚌 BUSES (Transporte): ${buses.length}`);
  buses.forEach(b => console.log(`  ${b.id}. ${b.marca} ${b.modelo} - ${b.matricula} (Route: ${b.viaId || 'NONE'}, Driver: ${b.condutor || 'NONE'})`));
  
  // Check Drivers (Condutor)
  const drivers = await prisma.condutor.findMany({
    select: { id: true, nome: true, telefone: true }
  });
  console.log(`\n\n👨‍✈️ DRIVERS (Condutor): ${drivers.length}`);
  drivers.forEach(d => console.log(`  ${d.id}. ${d.nome} - ${d.telefone || 'NO PHONE'}`));
  
  // Check GeoLocations
  const geoLocations = await prisma.geoLocation.findMany({
    select: { 
      id: true, 
      geoLocation: true, 
      transporteId: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(`\n\n📍 GEO LOCATIONS (Recent 10): ${geoLocations.length} total`);
  geoLocations.forEach(g => console.log(`  ${g.id}. Bus ${g.transporteId}: ${g.geoLocation} (${g.createdAt.toISOString()})`));
  
  // Check Users (Utente)
  const users = await prisma.utente.findMany({
    select: { id: true, nome: true, telefone: true }
  });
  console.log(`\n\n👥 USERS (Utente): ${users.length}`);
  users.slice(0, 5).forEach(u => console.log(`  ${u.id}. ${u.nome} - ${u.telefone}`));
  
  // Check Missions
  const missions = await prisma.mISSION.findMany({
    select: { 
      id: true, 
      mISSIONUtente: true, 
      utenteId: true,
      paragemId: true
    },
    take: 5
  });
  console.log(`\n\n🎯 MISSIONS: ${missions.length}`);
  missions.forEach(m => console.log(`  ${m.id}. User ${m.utenteId} → Stop ${m.paragemId}`));
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log(`  Stops: ${stops.length}`);
  console.log(`  Routes: ${routes.length}`);
  console.log(`  Buses: ${buses.length}`);
  console.log(`  Drivers: ${drivers.length}`);
  console.log(`  Geo Locations: ${geoLocations.length}`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Missions: ${missions.length}`);
  
  // Check for missing data
  console.log('\n\n⚠️  MISSING DATA:');
  const stopsWithoutCoords = stops.filter(s => !s.geoLocation);
  console.log(`  Stops without coordinates: ${stopsWithoutCoords.length}`);
  stopsWithoutCoords.forEach(s => console.log(`    - ${s.nome}`));
  
  const busesWithoutRoute = buses.filter(b => !b.viaId);
  console.log(`\n  Buses without route: ${busesWithoutRoute.length}`);
  busesWithoutRoute.forEach(b => console.log(`    - ${b.matricula}`));
  
  const busesWithoutDriver = buses.filter(b => !b.condutor);
  console.log(`\n  Buses without driver: ${busesWithoutDriver.length}`);
  busesWithoutDriver.forEach(b => console.log(`    - ${b.matricula}`));
  
  await prisma.$disconnect();
}

checkDatabase().catch(console.error);
