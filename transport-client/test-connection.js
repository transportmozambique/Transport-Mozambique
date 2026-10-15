const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('\n🔍 Testing transport-client database connection...\n');
    
    const [transportes, vias, paragens, motoristas, proprietarios] = await Promise.all([
      prisma.transporte.count(),
      prisma.via.count(),
      prisma.paragem.count(),
      prisma.motorista.count(),
      prisma.proprietario.count(),
    ]);

    console.log('✅ Connection successful!\n');
    console.log('📊 Database State:');
    console.log(`   Transportes: ${transportes}`);
    console.log(`   Vias: ${vias}`);
    console.log(`   Paragens: ${paragens}`);
    console.log(`   Motoristas: ${motoristas}`);
    console.log(`   Proprietários: ${proprietarios}`);
    console.log('');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
