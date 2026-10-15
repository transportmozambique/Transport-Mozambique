const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUnassignedParagens() {
  try {
    console.log('🔍 Checking for unassigned paragens...\n');

    // Get total paragens
    const totalParagens = await prisma.paragem.count();
    console.log(`📊 Total paragens in database: ${totalParagens}`);

    // Get paragens that are NOT assigned to any via
    const unassignedParagens = await prisma.paragem.findMany({
      where: {
        vias: {
          none: {}
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true
      }
    });

    console.log(`\n❌ Unassigned paragens: ${unassignedParagens.length}`);
    console.log(`✅ Assigned paragens: ${totalParagens - unassignedParagens.length}`);

    // Get total ViaParagem relationships
    const totalRelationships = await prisma.viaParagem.count();
    console.log(`\n🔗 Total ViaParagem relationships: ${totalRelationships}`);

    if (unassignedParagens.length > 0) {
      console.log(`\n📋 Sample of unassigned paragens (first 20):\n`);
      unassignedParagens.slice(0, 20).forEach((paragem, index) => {
        console.log(`${index + 1}. ${paragem.nome} (${paragem.codigo})`);
        console.log(`   Location: ${paragem.geoLocation}\n`);
      });

      if (unassignedParagens.length > 20) {
        console.log(`... and ${unassignedParagens.length - 20} more\n`);
      }
    } else {
      console.log('\n✅ All paragens are assigned to at least one via!');
    }

    // Get statistics by via
    const vias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            paragens: true
          }
        }
      },
      orderBy: {
        codigo: 'asc'
      }
    });

    console.log(`\n📊 Vias statistics:`);
    console.log(`Total vias: ${vias.length}\n`);

    const viasWithNoStops = vias.filter(v => v._count.paragens === 0);
    if (viasWithNoStops.length > 0) {
      console.log(`⚠️  Vias with 0 paragens: ${viasWithNoStops.length}`);
      viasWithNoStops.forEach(via => {
        console.log(`   - ${via.codigo}: ${via.nome}`);
      });
    } else {
      console.log(`✅ All vias have at least one paragem assigned`);
    }

    const avgStopsPerVia = vias.reduce((sum, v) => sum + v._count.paragens, 0) / vias.length;
    console.log(`\n📈 Average paragens per via: ${avgStopsPerVia.toFixed(1)}`);

    const minStops = Math.min(...vias.map(v => v._count.paragens));
    const maxStops = Math.max(...vias.map(v => v._count.paragens));
    console.log(`📉 Min paragens on a via: ${minStops}`);
    console.log(`📈 Max paragens on a via: ${maxStops}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUnassignedParagens();
