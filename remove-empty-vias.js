const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeEmptyVias() {
  try {
    console.log('🔍 Finding vias with 0 paragens...\n');

    // Find all vias with their paragens count
    const allVias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            paragens: true,
            transportes: true
          }
        }
      }
    });

    console.log(`Total vias in database: ${allVias.length}`);

    // Filter vias with 0 paragens
    const emptyVias = allVias.filter(via => via._count.paragens === 0);

    console.log(`Vias with 0 paragens: ${emptyVias.length}\n`);

    if (emptyVias.length === 0) {
      console.log('✅ No empty vias found! All vias have paragens assigned.');
      return;
    }

    console.log('Empty vias to be deleted:');
    emptyVias.forEach(via => {
      console.log(`   - ${via.codigo}: ${via.nome} (Transportes: ${via._count.transportes})`);
    });

    console.log('\n🗑️  Deleting empty vias...\n');

    let deletedCount = 0;
    let transportesReassigned = 0;

    for (const via of emptyVias) {
      try {
        // First, check if there are any transportes on this via
        if (via._count.transportes > 0) {
          console.log(`   ⚠️  Via ${via.codigo} has ${via._count.transportes} transportes - they will be orphaned`);
          transportesReassigned += via._count.transportes;
        }

        // Delete the via (transportes will have their viaId set to null due to cascade)
        await prisma.via.delete({
          where: {
            id: via.id
          }
        });

        deletedCount++;
        console.log(`   ✅ Deleted: ${via.codigo} - ${via.nome}`);
      } catch (error) {
        console.error(`   ❌ Error deleting ${via.codigo}:`, error.message);
      }
    }

    console.log(`\n\n📊 Deletion Summary:`);
    console.log(`   Vias deleted: ${deletedCount}`);
    console.log(`   Transportes affected: ${transportesReassigned}`);

    // Verify final counts
    const remainingVias = await prisma.via.count();
    const viasWithParagens = await prisma.via.count({
      where: {
        paragens: {
          some: {}
        }
      }
    });

    console.log(`\n   📍 Remaining vias in database: ${remainingVias}`);
    console.log(`   ✅ Vias with paragens: ${viasWithParagens}`);
    console.log(`   ⚠️  Vias without paragens: ${remainingVias - viasWithParagens}`);

    console.log('\n✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeEmptyVias();
