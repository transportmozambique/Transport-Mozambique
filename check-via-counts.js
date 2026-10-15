const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkViaCounts() {
  try {
    console.log('🔍 Checking via counts...\n');

    const vias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            paragens: true,
            transportes: true,
          },
        },
        municipio: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: {
        codigo: 'asc',
      },
    });

    console.log(`Found ${vias.length} vias\n`);

    let viasWithData = 0;
    let viasWithoutData = 0;

    vias.forEach((via) => {
      const hasData = via._count.paragens > 0 || via._count.transportes > 0;
      
      if (hasData) {
        viasWithData++;
        console.log(`✅ ${via.codigo} - ${via.nome}`);
        console.log(`   Município: ${via.municipio.nome}`);
        console.log(`   Paragens: ${via._count.paragens}, Transportes: ${via._count.transportes}\n`);
      } else {
        viasWithoutData++;
      }
    });

    console.log('\n📊 Summary:');
    console.log(`   Vias with data: ${viasWithData}`);
    console.log(`   Vias without data: ${viasWithoutData}`);

    if (viasWithoutData > 0) {
      console.log('\n⚠️  Some vias have no paragens or transportes assigned.');
      console.log('   This is why you see "Paragens: 0, Transportes: 0"');
      
      // Check if there are any ViaParagem entries at all
      const totalViaParagens = await prisma.viaParagem.count();
      const totalTransportes = await prisma.transporte.count();
      const transportesWithVia = await prisma.transporte.count({
        where: {
          viaId: {
            not: null,
          },
        },
      });

      console.log('\n📈 Database totals:');
      console.log(`   Total ViaParagem entries: ${totalViaParagens}`);
      console.log(`   Total Transportes: ${totalTransportes}`);
      console.log(`   Transportes with viaId: ${transportesWithVia}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkViaCounts();
