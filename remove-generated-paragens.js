const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeGeneratedParagens() {
  try {
    console.log('🗑️  Removing auto-generated paragens...\n');

    // Find all paragens that were auto-generated (they have codes like VIA-XXX-PXX)
    const generatedParagens = await prisma.paragem.findMany({
      where: {
        codigo: {
          contains: '-P'
        }
      },
      include: {
        vias: true
      }
    });

    console.log(`Found ${generatedParagens.length} auto-generated paragens\n`);

    if (generatedParagens.length === 0) {
      console.log('✅ No auto-generated paragens found!');
      return;
    }

    let deletedViaParagens = 0;
    let deletedParagens = 0;

    for (const paragem of generatedParagens) {
      try {
        // First, delete all ViaParagem relationships
        const viaParagens = await prisma.viaParagem.deleteMany({
          where: {
            paragemId: paragem.id
          }
        });
        
        deletedViaParagens += viaParagens.count;

        // Then delete the paragem itself
        await prisma.paragem.delete({
          where: {
            id: paragem.id
          }
        });

        deletedParagens++;
        
        if (deletedParagens % 100 === 0) {
          console.log(`   Deleted ${deletedParagens} paragens...`);
        }
      } catch (error) {
        console.error(`   ❌ Error deleting ${paragem.codigo}:`, error.message);
      }
    }

    console.log(`\n\n📊 Cleanup Summary:`);
    console.log(`   ViaParagem relationships deleted: ${deletedViaParagens}`);
    console.log(`   Paragens deleted: ${deletedParagens}`);

    // Verify counts
    const remainingParagens = await prisma.paragem.count();
    const remainingViaParagens = await prisma.viaParagem.count();
    
    console.log(`\n   📍 Remaining paragens in database: ${remainingParagens}`);
    console.log(`   🔗 Remaining ViaParagem relationships: ${remainingViaParagens}`);

    console.log('\n✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeGeneratedParagens();
