const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugViasAPI() {
  try {
    console.log('=== DEBUGGING VIAS API ===\n');
    
    // Simulate what the API does
    const vias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        cor: true,
        municipioId: true,
        terminalPartida: true,
        terminalChegada: true,
        geoLocationPath: true,
        municipio: {
          select: {
            nome: true,
          },
        },
        _count: {
          select: {
            paragens: true,
            transportes: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
    });
    
    console.log(`✅ Found ${vias.length} vias\n`);
    
    if (vias.length > 0) {
      console.log('📝 First via structure:');
      console.log(JSON.stringify(vias[0], null, 2));
      
      console.log('\n📝 Transformed structure (what API returns):');
      const transformed = {
        ...vias[0],
        municipio: vias[0].municipio.nome,
      };
      console.log(JSON.stringify(transformed, null, 2));
      
      console.log('\n📊 Sample vias (_count data):');
      vias.slice(0, 3).forEach((via, i) => {
        console.log(`${i + 1}. ${via.nome} (${via.codigo})`);
        console.log(`   Municipio: ${via.municipio.nome}`);
        console.log(`   Paragens: ${via._count.paragens}, Transportes: ${via._count.transportes}`);
        console.log(`   Has geoLocationPath: ${!!via.geoLocationPath}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 API Response format:');
    console.log('   { vias: [array of via objects with _count] }');
    console.log('\n✅ The data structure looks correct!');
    console.log('   Problem might be in frontend rendering or API connectivity.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugViasAPI();
