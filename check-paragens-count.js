const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkParagensCount() {
  try {
    console.log('📊 Checking paragens count...\n');

    // Total paragens
    const totalParagens = await prisma.paragem.count();
    console.log(`Total paragens: ${totalParagens}`);

    // Paragens with OSM codes (from your JSON files)
    const osmParagens = await prisma.paragem.count({
      where: {
        codigo: {
          startsWith: 'OSM-'
        }
      }
    });
    console.log(`OSM paragens (from JSON files): ${osmParagens}`);

    // Paragens with VIA codes (auto-generated)
    const viaParagens = await prisma.paragem.count({
      where: {
        codigo: {
          contains: '-P'
        }
      }
    });
    console.log(`Auto-generated paragens (VIA-XXX-PXX): ${viaParagens}`);

    // Other paragens
    const otherParagens = totalParagens - osmParagens - viaParagens;
    console.log(`Other paragens: ${otherParagens}`);

    // Sample of paragens
    console.log('\n📍 Sample paragens:');
    const samples = await prisma.paragem.findMany({
      take: 10,
      select: {
        codigo: true,
        nome: true,
        geoLocation: true
      }
    });

    samples.forEach(p => {
      console.log(`   ${p.codigo}: ${p.nome} (${p.geoLocation})`);
    });

    // ViaParagem relationships
    const totalViaParagens = await prisma.viaParagem.count();
    console.log(`\n🔗 Total ViaParagem relationships: ${totalViaParagens}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkParagensCount();
