const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Attempting to wake up database...\n');
  
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Attempt ${attempts}/${maxAttempts}...`);
    
    try {
      const count = await prisma.via.count();
      console.log(`✅ Connected! Found ${count} vias\n`);
      
      // Get some stats
      const transportes = await prisma.transporte.count();
      const paragens = await prisma.paragem.count();
      const associations = await prisma.viaParagem.count();
      
      console.log('📊 Database Stats:');
      console.log(`   Vias: ${count}`);
      console.log(`   Transportes: ${transportes}`);
      console.log(`   Paragens: ${paragens}`);
      console.log(`   Associations: ${associations}\n`);
      
      console.log('✅ Database is awake and ready!\n');
      return;
    } catch (error) {
      console.log(`   ⚠️  Failed: ${error.message}`);
      
      if (attempts < maxAttempts) {
        console.log(`   Waiting 3 seconds before retry...\n`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  console.log('\n❌ Could not connect to database after 5 attempts');
  console.log('   The Neon database might be paused or unavailable');
  console.log('   Please check your Neon dashboard\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
