const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkViaTransportes() {
  try {
    console.log('🔍 Checking via transportes associations...\n');

    // Get all vias with their transporte counts
    const vias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            transportes: true,
          },
        },
      },
      orderBy: {
        codigo: 'asc',
      },
    });

    console.log(`📊 Total Vias: ${vias.length}\n`);

    // Count vias by transporte count
    const viasWithTransportes = vias.filter(v => v._count.transportes > 0);
    const viasWithoutTransportes = vias.filter(v => v._count.transportes === 0);

    console.log(`✅ Vias with transportes: ${viasWithTransportes.length}`);
    console.log(`❌ Vias without transportes: ${viasWithoutTransportes.length}\n`);

    // Show distribution
    const distribution = {};
    vias.forEach(via => {
      const count = via._count.transportes;
      distribution[count] = (distribution[count] || 0) + 1;
    });

    console.log('📈 Distribution of transportes per via:');
    Object.keys(distribution).sort((a, b) => Number(a) - Number(b)).forEach(count => {
      console.log(`  ${count} transportes: ${distribution[count]} vias`);
    });

    // Show first 5 vias with their transporte counts
    console.log('\n📋 First 5 vias:');
    for (const via of vias.slice(0, 5)) {
      console.log(`  ${via.codigo} - ${via.nome}: ${via._count.transportes} transportes`);
    }

    // Get total transportes count
    const totalTransportes = await prisma.transporte.count();
    const assignedTransportes = await prisma.transporte.count({
      where: {
        viaId: { not: null },
      },
    });

    console.log(`\n🚌 Total Transportes: ${totalTransportes}`);
    console.log(`✅ Assigned to vias: ${assignedTransportes}`);
    console.log(`❌ Not assigned: ${totalTransportes - assignedTransportes}`);

    // Check a specific via if you want (replace with actual via ID)
    const firstVia = vias[0];
    if (firstVia) {
      console.log(`\n🔍 Detailed check for via: ${firstVia.codigo}`);
      
      const viaWithTransportes = await prisma.via.findUnique({
        where: { id: firstVia.id },
        include: {
          transportes: {
            select: {
              id: true,
              codigo: true,
              matricula: true,
            },
          },
          _count: {
            select: {
              transportes: true,
            },
          },
        },
      });

      console.log(`  _count.transportes: ${viaWithTransportes._count.transportes}`);
      console.log(`  transportes.length: ${viaWithTransportes.transportes.length}`);
      console.log(`  First 3 transportes:`, viaWithTransportes.transportes.slice(0, 3).map(t => `#${t.codigo} ${t.matricula}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkViaTransportes();
