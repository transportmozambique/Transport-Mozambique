const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkViasBuses() {
  try {
    console.log('🔍 Checking vias and buses...\n');

    // Get all vias
    const allVias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        terminalPartida: true,
        terminalChegada: true,
        municipio: {
          select: {
            nome: true
          }
        },
        _count: {
          select: {
            transportes: true,
            paragens: true
          }
        }
      }
    });

    console.log(`📊 Total vias: ${allVias.length}\n`);

    // Group by municipio
    const viasByMunicipio = allVias.reduce((acc, via) => {
      const municipioNome = via.municipio.nome;
      if (!acc[municipioNome]) {
        acc[municipioNome] = [];
      }
      acc[municipioNome].push(via);
      return acc;
    }, {});

    for (const [municipio, vias] of Object.entries(viasByMunicipio)) {
      console.log(`\n📍 ${municipio}:`);
      console.log(`   Total vias: ${vias.length}`);
      
      vias.forEach(via => {
        const hasBuses = via._count.transportes > 0;
        const hasParagens = via._count.paragens > 0;
        const status = hasBuses ? '✅' : '❌';
        
        console.log(`   ${status} ${via.nome} (${via.codigo})`);
        console.log(`      ${via.terminalPartida} → ${via.terminalChegada}`);
        console.log(`      Transportes: ${via._count.transportes}, Paragens: ${via._count.paragens}`);
      });
    }

    // Summary
    const viasWithBuses = allVias.filter(v => v._count.transportes > 0);
    const viasWithoutBuses = allVias.filter(v => v._count.transportes === 0);
    const viasWithParagens = allVias.filter(v => v._count.paragens > 0);
    const viasWithoutParagens = allVias.filter(v => v._count.paragens === 0);

    console.log('\n\n📈 Resumo:');
    console.log(`   ✅ Vias com transportes: ${viasWithBuses.length}`);
    console.log(`   ❌ Vias sem transportes: ${viasWithoutBuses.length}`);
    console.log(`   ✅ Vias com paragens: ${viasWithParagens.length}`);
    console.log(`   ❌ Vias sem paragens: ${viasWithoutParagens.length}`);

    if (viasWithoutBuses.length > 0) {
      console.log('\n⚠️  Vias sem transportes:');
      viasWithoutBuses.forEach(via => {
        console.log(`   - ${via.nome} (${via.codigo}) - ${via.municipio.nome}`);
      });
    }

    if (viasWithoutParagens.length > 0) {
      console.log('\n⚠️  Vias sem paragens:');
      viasWithoutParagens.forEach(via => {
        console.log(`   - ${via.nome} (${via.codigo}) - ${via.municipio.nome}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkViasBuses();
