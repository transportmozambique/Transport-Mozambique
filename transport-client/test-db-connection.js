const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Test 1: Count records
    console.log('Test 1: Counting records...');
    const municipioCount = await prisma.municipio.count();
    const viaCount = await prisma.via.count();
    const transporteCount = await prisma.transporte.count();
    
    console.log(`✅ Municipios: ${municipioCount}`);
    console.log(`✅ Vias: ${viaCount}`);
    console.log(`✅ Transportes: ${transporteCount}\n`);
    
    // Test 2: Get sample data
    console.log('Test 2: Fetching sample data...');
    const municipios = await prisma.municipio.findMany({
      take: 3,
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });
    
    console.log('Sample Municipios:');
    municipios.forEach(m => {
      console.log(`  - ${m.nome} (${m.codigo})`);
    });
    console.log('');
    
    // Test 3: Get vias with municipioId
    console.log('Test 3: Fetching vias with municipioId...');
    const vias = await prisma.via.findMany({
      take: 5,
      select: {
        id: true,
        nome: true,
        municipioId: true,
        municipio: {
          select: {
            nome: true,
          },
        },
      },
    });
    
    console.log('Sample Vias:');
    vias.forEach(v => {
      console.log(`  - ${v.nome} (Municipio: ${v.municipio.nome})`);
    });
    console.log('');
    
    // Test 4: Complex query - municipios with buses
    console.log('Test 4: Testing complex query (municipios with buses)...');
    const municipiosWithBuses = await prisma.municipio.findMany({
      where: {
        vias: {
          some: {
            transportes: {
              some: {}
            }
          }
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });
    
    console.log(`✅ Found ${municipiosWithBuses.length} municipios with buses:`);
    municipiosWithBuses.forEach(m => {
      console.log(`  - ${m.nome}`);
    });
    console.log('');
    
    // Test 5: Vias grouped by municipio
    console.log('Test 5: Grouping vias by municipio...');
    const allVias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        municipioId: true,
        municipio: {
          select: {
            nome: true,
          },
        },
      },
    });
    
    const viasByMunicipio = {};
    allVias.forEach(via => {
      const municipioNome = via.municipio.nome;
      if (!viasByMunicipio[municipioNome]) {
        viasByMunicipio[municipioNome] = [];
      }
      viasByMunicipio[municipioNome].push(via.nome);
    });
    
    console.log('Vias by Municipio:');
    Object.entries(viasByMunicipio).forEach(([municipio, vias]) => {
      console.log(`  ${municipio}: ${vias.length} vias`);
      vias.slice(0, 3).forEach(via => {
        console.log(`    - ${via}`);
      });
      if (vias.length > 3) {
        console.log(`    ... and ${vias.length - 3} more`);
      }
    });
    
    console.log('\n✅ All tests passed! Database connection is working.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
