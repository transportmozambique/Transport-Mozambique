const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const viaId = 'cmovet5r700v314lnx42bx339';
  
  console.log(`Checking via: ${viaId}\n`);
  
  const via = await prisma.via.findUnique({
    where: { id: viaId },
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  if (!via) {
    console.log('❌ Via not found!');
    return;
  }

  console.log('📊 Via Details:');
  console.log(`   ID: ${via.id}`);
  console.log(`   Nome: ${via.nome}`);
  console.log(`   Código: ${via.codigo}`);
  console.log(`   Terminal Partida: ${via.terminalPartida}`);
  console.log(`   Terminal Chegada: ${via.terminalChegada}`);
  console.log(`   Paragens Count: ${via.paragens.length}`);
  console.log(`   Route Path Length: ${via.geoLocationPath ? via.geoLocationPath.length : 0} chars`);
  
  if (via.paragens.length > 0) {
    console.log('\n📍 Paragens:');
    via.paragens.forEach((vp, idx) => {
      console.log(`   ${idx + 1}. ${vp.paragem.nome} (${vp.paragem.codigo})`);
    });
  } else {
    console.log('\n⚠️  No paragens associated!');
  }

  // Check all vias with 0 paragens
  console.log('\n\n🔍 Checking all vias...\n');
  
  const allVias = await prisma.via.findMany({
    include: {
      _count: {
        select: { paragens: true }
      }
    }
  });

  const viasWithNoStops = allVias.filter(v => v._count.paragens === 0);
  const viasWithStops = allVias.filter(v => v._count.paragens > 0);

  console.log(`✅ Vias with stops: ${viasWithStops.length}`);
  console.log(`❌ Vias with NO stops: ${viasWithNoStops.length}`);

  if (viasWithNoStops.length > 0) {
    console.log('\n❌ Vias with 0 paragens:');
    viasWithNoStops.forEach(v => {
      console.log(`   - ${v.nome} (${v.codigo})`);
    });
  }

  // Check total associations
  const totalAssociations = await prisma.viaParagem.count();
  console.log(`\n📊 Total ViaParagem associations: ${totalAssociations}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
