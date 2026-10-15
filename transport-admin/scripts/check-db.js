const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const counts = await Promise.all([
      prisma.transporte.count(),
      prisma.via.count(),
      prisma.paragem.count(),
      prisma.motorista.count(),
      prisma.proprietario.count(),
    ]);

    console.log('\n📊 DATABASE STATE:');
    console.log(`✅ Transportes: ${counts[0]}`);
    console.log(`✅ Vias: ${counts[1]}`);
    console.log(`✅ Paragens: ${counts[2]}`);
    console.log(`✅ Motoristas: ${counts[3]}`);
    console.log(`✅ Proprietários: ${counts[4]}`);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
