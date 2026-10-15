// Test script to verify Albasine routes in database
// Run with: node test-albasine-query.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAlbasineQuery() {
  console.log('🔍 Testing Albasine route queries...\n');

  // Test 1: Find all routes with "Albasine" in any field
  console.log('=== TEST 1: All routes containing "Albasine" ===');
  const allAlbasineRoutes = await prisma.via.findMany({
    where: {
      OR: [
        { terminalPartida: { contains: 'Albasine', mode: 'insensitive' } },
        { terminalChegada: { contains: 'Albasine', mode: 'insensitive' } },
        { nome: { contains: 'Albasine', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      nome: true,
      terminalPartida: true,
      terminalChegada: true,
    }
  });

  console.log(`Found ${allAlbasineRoutes.length} routes:`);
  allAlbasineRoutes.forEach(route => {
    console.log(`  - ${route.nome}`);
    console.log(`    From: ${route.terminalPartida}`);
    console.log(`    To: ${route.terminalChegada}`);
    console.log('');
  });

  // Test 2: Extract destinations FROM Albasine (bidirectional)
  console.log('=== TEST 2: Destinations FROM Albasine (bidirectional) ===');
  const destinations = new Set();
  const normalizedOrigin = 'albasine';

  allAlbasineRoutes.forEach(route => {
    // If Albasine is departure → add arrival
    if (route.terminalPartida && route.terminalPartida.toLowerCase().includes(normalizedOrigin)) {
      destinations.add(route.terminalChegada);
      console.log(`  ✓ Added ${route.terminalChegada} (from partida match)`);
    }
    
    // If Albasine is arrival → add departure (REVERSE)
    if (route.terminalChegada && route.terminalChegada.toLowerCase().includes(normalizedOrigin)) {
      destinations.add(route.terminalPartida);
      console.log(`  ✓ Added ${route.terminalPartida} (from chegada match - REVERSE)`);
    }
  });

  const finalDestinations = Array.from(destinations)
    .filter(d => d && d.trim().length > 0 && !d.toLowerCase().includes(normalizedOrigin))
    .sort();

  console.log(`\nFinal destinations: ${finalDestinations.length}`);
  finalDestinations.forEach((dest, i) => {
    console.log(`  ${i + 1}. ${dest}`);
  });

  // Test 3: Check stops (paragens) with Albasine
  console.log('\n=== TEST 3: Stops containing "Albasine" ===');
  const albasineStops = await prisma.paragem.findMany({
    where: {
      nome: { contains: 'Albasine', mode: 'insensitive' }
    },
    select: {
      id: true,
      nome: true,
      geoLocation: true,
    }
  });

  console.log(`Found ${albasineStops.length} stops:`);
  albasineStops.forEach(stop => {
    console.log(`  - ${stop.nome} (${stop.geoLocation})`);
  });

  // Test 4: Check buses on Albasine routes
  console.log('\n=== TEST 4: Buses on Albasine routes ===');
  const albasineRouteIds = allAlbasineRoutes.map(r => r.id);
  const buses = await prisma.transporte.findMany({
    where: {
      viaId: { in: albasineRouteIds }
    },
    select: {
      id: true,
      matricula: true,
      marca: true,
      modelo: true,
      via: {
        select: {
          nome: true
        }
      }
    }
  });

  console.log(`Found ${buses.length} buses:`);
  buses.forEach(bus => {
    console.log(`  - ${bus.matricula} (${bus.marca} ${bus.modelo}) on ${bus.via.nome}`);
  });

  await prisma.$disconnect();
}

testAlbasineQuery()
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
