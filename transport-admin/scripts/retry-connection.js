const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function retryConnection(maxAttempts = 10, delayMs = 3000) {
  console.log('🔄 Attempting to connect to database...\n');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxAttempts}...`);
      await prisma.$connect();
      
      // Test with a simple query
      const count = await prisma.proprietario.count();
      
      console.log('\n✅ Database connection successful!');
      console.log(`✅ Found ${count} proprietários in database`);
      
      // Get current counts
      const [transportes, vias, paragens, motoristas] = await Promise.all([
        prisma.transporte.count(),
        prisma.via.count(),
        prisma.paragem.count(),
        prisma.motorista.count(),
      ]);
      
      console.log('\n📊 Current Database State:');
      console.log(`   Transportes: ${transportes}`);
      console.log(`   Vias: ${vias}`);
      console.log(`   Paragens: ${paragens}`);
      console.log(`   Motoristas: ${motoristas}`);
      console.log(`   Proprietários: ${count}`);
      console.log('');
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      if (attempt < maxAttempts) {
        console.log(`   ⏳ Waiting ${delayMs/1000} seconds before retry...\n`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.log('\n❌ All connection attempts failed.');
        console.log('\n💡 Possible solutions:');
        console.log('   1. Check your internet connection');
        console.log('   2. Visit https://console.neon.tech and check if database is active');
        console.log('   3. If database is paused, it should auto-resume on connection');
        console.log('   4. Check if firewall is blocking port 5432');
        console.log('');
        await prisma.$disconnect();
        process.exit(1);
      }
    }
  }
}

retryConnection();
