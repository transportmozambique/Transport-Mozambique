const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteEmptyVias() {
  try {
    console.log('🔍 Finding empty vias...\n');

    const vias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            paragens: true,
            transportes: true,
          },
        },
      },
    });

    const emptyVias = vias.filter(v => v._count.paragens === 0 && v._count.transportes === 0);
    
    console.log(`Found ${emptyVias.length} empty vias (out of ${vias.length} total)\n`);
    
    if (emptyVias.length === 0) {
      console.log('✅ No empty vias to delete!');
      return;
    }

    console.log('Empty vias to be deleted:');
    emptyVias.forEach((via, index) => {
      console.log(`${index + 1}. ${via.codigo} - ${via.nome}`);
    });

    console.log('\n⚠️  Starting deletion...\n');
    
    let deleted = 0;
    for (const via of emptyVias) {
      try {
        await prisma.via.delete({
          where: { id: via.id },
        });
        deleted++;
        console.log(`✅ Deleted: ${via.codigo} - ${via.nome}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${via.codigo}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully deleted ${deleted} out of ${emptyVias.length} empty vias`);
    console.log(`📊 Remaining vias: ${vias.length - deleted}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteEmptyVias();
