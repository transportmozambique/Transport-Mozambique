const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCounts() {
  try {
    const totalParagens = await prisma.paragem.count();
    const totalVias = await prisma.via.count();
    const totalViaParagens = await prisma.viaParagem.count();
    
    const assignedParagens = await prisma.paragem.count({
      where: {
        vias: {
          some: {}
        }
      }
    });
    
    const unassignedParagens = totalParagens - assignedParagens;
    
    // Get vias with their paragem counts
    const vias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            paragens: true,
            transportes: true
          }
        }
      },
      orderBy: {
        codigo: 'asc'
      }
    });
    
    console.log('📊 DATABASE STATISTICS\n');
    console.log(`Total Paragens: ${totalParagens}`);
    console.log(`  - Assigned: ${assignedParagens}`);
    console.log(`  - Unassigned: ${unassignedParagens}`);
    console.log(`\nTotal Vias: ${totalVias}`);
    console.log(`Total ViaParagem relationships: ${totalViaParagens}\n`);
    
    console.log('📋 VIAS WITH PARAGEM COUNTS:\n');
    vias.forEach(via => {
      console.log(`${via.codigo}: ${via._count.paragens} paragens, ${via._count.transportes} transportes`);
    });
    
    const viasWithNoParagens = vias.filter(v => v._count.paragens === 0);
    if (viasWithNoParagens.length > 0) {
      console.log(`\n⚠️  ${viasWithNoParagens.length} vias have 0 paragens:`);
      viasWithNoParagens.forEach(via => {
        console.log(`  - ${via.codigo}: ${via.nome}`);
      });
    } else {
      console.log('\n✅ All vias have at least one paragem!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCounts();
