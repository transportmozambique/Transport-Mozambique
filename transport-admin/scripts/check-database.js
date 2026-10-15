const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Database\n');
  
  const vias = await prisma.via.count();
  const transportes = await prisma.transporte.count();
  const paragens = await prisma.paragem.count();
  const associations = await prisma.viaParagem.count();
  const motoristas = await prisma.motorista.count();
  
  console.log('📊 Database Counts:');
  console.log(`   Vias: ${vias}`);
  console.log(`   Transportes: ${transportes}`);
  console.log(`   Paragens: ${paragens}`);
  console.log(`   ViaParagem associations: ${associations}`);
  console.log(`   Motoristas: ${motoristas}\n`);
  
  // Check if vias have routes
  const viasWithRoutes = await prisma.via.count({
    where: {
      geoLocationPath: {
        not: null
      }
    }
  });
  
  console.log(`📊 Vias with routes: ${viasWithRoutes}/${vias}\n`);
  
  // Sample a few vias
  const sampleVias = await prisma.via.findMany({
    take: 5,
    include: {
      paragens: true
    }
  });
  
  console.log('📊 Sample Vias:');
  sampleVias.forEach(via => {
    console.log(`   ${via.codigo}: ${via.nome} - ${via.paragens.length} stops`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
