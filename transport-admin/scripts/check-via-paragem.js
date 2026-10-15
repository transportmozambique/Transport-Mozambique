const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.viaParagem.count();
  console.log(`\n📊 ViaParagem associations: ${count}\n`);
  
  // Sample some vias with their stops
  const vias = await prisma.via.findMany({
    take: 5,
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });
  
  console.log('📋 Sample Vias:\n');
  for (const via of vias) {
    console.log(`🛣️  ${via.nome}`);
    console.log(`   Stops: ${via.paragens.length}`);
    if (via.paragens.length > 0) {
      const names = via.paragens.map(vp => vp.paragem.nome);
      if (names.length <= 5) {
        console.log(`   ${names.join(' → ')}`);
      } else {
        console.log(`   ${names[0]} → ... (${names.length - 2} stops) ... → ${names[names.length - 1]}`);
      }
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
