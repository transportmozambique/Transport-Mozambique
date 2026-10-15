const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStops() {
  console.log('🔍 Checking database stops...\n');
  
  // Get all stops
  const stops = await prisma.paragem.findMany({
    select: { nome: true },
    orderBy: { nome: 'asc' }
  });
  
  console.log(`Total stops in database: ${stops.length}\n`);
  console.log('Stops:');
  stops.forEach(s => console.log(`  - ${s.nome}`));
  
  // Get all terminals from routes
  console.log('\n\n🔍 Checking terminals from routes...\n');
  
  const routes = await prisma.via.findMany({
    select: {
      terminalPartida: true,
      terminalChegada: true,
    },
  });
  
  const terminals = new Set();
  routes.forEach(route => {
    if (route.terminalPartida) terminals.add(route.terminalPartida);
    if (route.terminalChegada) terminals.add(route.terminalChegada);
  });
  
  console.log(`Total unique terminals: ${terminals.size}\n`);
  console.log('Terminals:');
  Array.from(terminals).sort().forEach(t => console.log(`  - ${t}`));
  
  // Check specific neighborhoods
  console.log('\n\n🔍 Checking specific neighborhoods...\n');
  
  const neighborhoods = [
    'Baixa',
    'Polana',
    'Museu',
    'Albazine',
    'T3',
    'Machava',
    'Matola'
  ];
  
  for (const neighborhood of neighborhoods) {
    const stopsInNeighborhood = await prisma.paragem.findMany({
      where: {
        nome: { contains: neighborhood, mode: 'insensitive' }
      },
      select: { nome: true }
    });
    
    const terminalsInNeighborhood = Array.from(terminals).filter(t => 
      t.toLowerCase().includes(neighborhood.toLowerCase())
    );
    
    console.log(`${neighborhood}:`);
    console.log(`  Stops: ${stopsInNeighborhood.length}`);
    stopsInNeighborhood.forEach(s => console.log(`    - ${s.nome}`));
    console.log(`  Terminals: ${terminalsInNeighborhood.length}`);
    terminalsInNeighborhood.forEach(t => console.log(`    - ${t}`));
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkStops().catch(console.error);
