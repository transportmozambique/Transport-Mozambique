const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Rebalancing Transportes Distribution\n');
  console.log('='.repeat(80) + '\n');

  // Get municipalities
  const municipios = await prisma.municipio.findMany();
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');

  if (!municipioMaputo || !municipioMatola) {
    console.log('❌ Municipalities not found!');
    return;
  }

  // Get all vias
  const allVias = await prisma.via.findMany({
    include: {
      transportes: true
    }
  });

  // Separate vias by municipality
  const viasMaputo = allVias.filter(v => v.municipioId === municipioMaputo.id);
  const viasMatola = allVias.filter(v => v.municipioId === municipioMatola.id);

  console.log('📊 Current Distribution:');
  console.log(`   Maputo: ${viasMaputo.length} vias`);
  console.log(`   Matola: ${viasMatola.length} vias\n`);

  // Get all transportes
  const allTransportes = await prisma.transporte.findMany();
  console.log(`📊 Total Transportes: ${allTransportes.length}\n`);

  // Target distribution: 65% Maputo, 35% Matola
  const targetMaputo = Math.round(allTransportes.length * 0.65);
  const targetMatola = allTransportes.length - targetMaputo;

  console.log('🎯 Target Distribution:');
  console.log(`   Maputo: ${targetMaputo} transportes (65%)`);
  console.log(`   Matola: ${targetMatola} transportes (35%)\n`);

  // Assign transportes to vias
  let maputoCount = 0;
  let matolaCount = 0;

  for (let i = 0; i < allTransportes.length; i++) {
    const transporte = allTransportes[i];
    
    // Decide which municipality based on target distribution
    let targetVias;
    let targetMunicipio;
    
    if (maputoCount < targetMaputo) {
      targetVias = viasMaputo;
      targetMunicipio = municipioMaputo;
      maputoCount++;
    } else {
      targetVias = viasMatola;
      targetMunicipio = municipioMatola;
      matolaCount++;
    }

    // Pick a random via from the target municipality
    const randomVia = targetVias[Math.floor(Math.random() * targetVias.length)];

    // Update transporte - only update via and route
    await prisma.transporte.update({
      where: { id: transporte.id },
      data: {
        via: {
          connect: { id: randomVia.id }
        },
        codigoVia: randomVia.codigo,
        routePath: randomVia.geoLocationPath,
        currGeoLocation: randomVia.geoLocationPath ? randomVia.geoLocationPath.split(';')[0] : null
      }
    });

    if ((i + 1) % 10 === 0) {
      console.log(`   Processed ${i + 1}/${allTransportes.length} transportes...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Rebalancing Complete!\n');

  // Verify new distribution by counting transportes through via relationship
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

  console.log('📊 NEW DISTRIBUTION:');
  console.log(`   Maputo: ${transportesMaputo} transportes (${Math.round(transportesMaputo / allTransportes.length * 100)}%)`);
  console.log(`   Matola: ${transportesMatola} transportes (${Math.round(transportesMatola / allTransportes.length * 100)}%)\n`);

  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
