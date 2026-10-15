const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findViasWithoutParagens() {
  try {
    console.log('🔍 Finding vias without paragens...\n');

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

    const viasWithoutParagens = vias.filter(v => v._count.paragens === 0);
    
    console.log(`📊 Total vias: ${vias.length}`);
    console.log(`❌ Vias without paragens: ${viasWithoutParagens.length}`);
    console.log(`✅ Vias with paragens: ${vias.length - viasWithoutParagens.length}\n`);

    if (viasWithoutParagens.length === 0) {
      console.log('✅ All vias have paragens assigned!');
      return;
    }

    console.log('⚠️  Vias that need paragens assigned:\n');
    
    viasWithoutParagens.forEach((via, index) => {
      console.log(`${index + 1}. ${via.codigo} - ${via.nome}`);
      console.log(`   Município: ${via.municipio.nome}`);
      console.log(`   Rota: ${via.terminalPartida} → ${via.terminalChegada}`);
      console.log(`   Transportes: ${via._count.transportes}`);
      console.log(`   Path exists: ${via.geoLocationPath ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Group by municipality
    const byMunicipio = {};
    viasWithoutParagens.forEach(via => {
      const mun = via.municipio.nome;
      if (!byMunicipio[mun]) byMunicipio[mun] = [];
      byMunicipio[mun].push(via);
    });

    console.log('\n📍 Grouped by Município:');
    Object.keys(byMunicipio).forEach(mun => {
      console.log(`\n${mun}: ${byMunicipio[mun].length} vias`);
      byMunicipio[mun].forEach(via => {
        console.log(`  - ${via.codigo}: ${via.nome}`);
      });
    });

    // Check if these vias have paths
    const viasWithPaths = viasWithoutParagens.filter(v => v.geoLocationPath && v.geoLocationPath.length > 0);
    console.log(`\n🗺️  Vias with geographic paths: ${viasWithPaths.length}`);
    console.log(`   (These can have paragens generated from their paths)`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findViasWithoutParagens();
