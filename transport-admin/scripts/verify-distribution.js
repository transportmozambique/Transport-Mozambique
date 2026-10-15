const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Verifying Transporte Distribution\n');
  console.log('='.repeat(80) + '\n');

  // Get municipalities
  const municipios = await prisma.municipio.findMany();
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');

  if (!municipioMaputo || !municipioMatola) {
    console.log('❌ Municipalities not found!');
    return;
  }

  // Count transportes by municipality (through via relationship)
  const transportesMaputo = await prisma.transporte.count({
    where: { 
      via: {
        municipioId: municipioMaputo.id
      }
    }
  });

  const transportesMatola = await prisma.transporte.count({
    where: { 
      via: {
        municipioId: municipioMatola.id
      }
    }
  });

  const total = transportesMaputo + transportesMatola;

  console.log('📊 CURRENT DISTRIBUTION:');
  console.log(`   Maputo: ${transportesMaputo} transportes (${Math.round(transportesMaputo / total * 100)}%)`);
  console.log(`   Matola: ${transportesMatola} transportes (${Math.round(transportesMatola / total * 100)}%)`);
  console.log(`   Total: ${total} transportes\n`);

  // Get some sample transportes from each municipality
  console.log('📋 Sample Transportes:\n');
  
  const sampleMaputo = await prisma.transporte.findMany({
    where: {
      via: {
        municipioId: municipioMaputo.id
      }
    },
    include: {
      via: true
    },
    take: 3
  });

  console.log('   Maputo Samples:');
  sampleMaputo.forEach(t => {
    console.log(`   - ${t.matricula} (${t.via.nome})`);
  });

  const sampleMatola = await prisma.transporte.findMany({
    where: {
      via: {
        municipioId: municipioMatola.id
      }
    },
    include: {
      via: true
    },
    take: 3
  });

  console.log('\n   Matola Samples:');
  sampleMatola.forEach(t => {
    console.log(`   - ${t.matricula} (${t.via.nome})`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Verification Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
