const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying All Vias\n');
  console.log('='.repeat(80) + '\n');

  // Get all vias with counts
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

  console.log(`Total Vias: ${vias.length}\n`);

  // Show first 20
  console.log('First 20 Vias:\n');
  vias.slice(0, 20).forEach(v => {
    console.log(`${v.codigo.padEnd(8)} ${v.nome.padEnd(50)} Paragens: ${v._count.paragens}`);
  });

  // Count vias with 0 paragens
  const viasWithNoStops = vias.filter(v => v._count.paragens === 0);
  const viasWithStops = vias.filter(v => v._count.paragens > 0);

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Vias with paragens: ${viasWithStops.length}`);
  console.log(`❌ Vias with 0 paragens: ${viasWithNoStops.length}`);
  
  if (viasWithNoStops.length > 0) {
    console.log('\n⚠️  Vias with 0 paragens:');
    viasWithNoStops.forEach(v => {
      console.log(`   - ${v.codigo}: ${v.nome}`);
    });
  } else {
    console.log('\n🎉 ALL VIAS HAVE PARAGENS!');
  }

  // Calculate statistics
  const totalParagens = vias.reduce((sum, v) => sum + v._count.paragens, 0);
  const avgParagens = totalParagens / vias.length;
  const minParagens = Math.min(...vias.map(v => v._count.paragens));
  const maxParagens = Math.max(...vias.map(v => v._count.paragens));

  console.log('\n📈 Statistics:');
  console.log(`   Total paragens associations: ${totalParagens}`);
  console.log(`   Average paragens per via: ${avgParagens.toFixed(1)}`);
  console.log(`   Min paragens: ${minParagens}`);
  console.log(`   Max paragens: ${maxParagens}`);

  // Find the via with max paragens
  const viaWithMaxParagens = vias.find(v => v._count.paragens === maxParagens);
  if (viaWithMaxParagens) {
    console.log(`   Via with most paragens: ${viaWithMaxParagens.codigo} (${viaWithMaxParagens.nome}) - ${maxParagens} paragens`);
  }

  console.log('='.repeat(80) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
