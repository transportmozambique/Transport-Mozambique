const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeDuplicateStops() {
  try {
    console.log('🗑️  Removing duplicate stops...\n');

    // Find all stops with suffix patterns (OSM-XXX-1, OSM-XXX-2, etc.)
    const duplicateStops = await prisma.paragem.findMany({
      where: {
        codigo: {
          contains: '-1'
        }
      }
    });

    console.log(`Found ${duplicateStops.length} stops with -1 suffix\n`);

    let deletedViaParagens = 0;
    let deletedParagens = 0;

    for (const paragem of duplicateStops) {
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
        
        if (deletedParagens % 50 === 0) {
          console.log(`   Deleted ${deletedParagens} duplicate stops...`);
        }
      } catch (error) {
        console.error(`   ❌ Error deleting ${paragem.codigo}:`, error.message);
      }
    }

    console.log(`\n\n📊 Cleanup Summary:`);
    console.log(`   ViaParagem relationships deleted: ${deletedViaParagens}`);
    console.log(`   Duplicate stops deleted: ${deletedParagens}`);

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

removeDuplicateStops();
