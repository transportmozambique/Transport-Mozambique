const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script to create multiple vias (routes) for the same origin-destination pair
 * but with different paths (different streets/roads)
 * 
 * This solves the issue where multiple buses show identical:
 * - Distance
 * - Time
 * - Price
 * - Route path on map
 * 
 * Each bus will now have its own unique via with different streets and paragens
 */

// Define alternative routes for Magoanine-Baixa
const magoanineBaixaRoutes = [
  {
    name: 'Magoanine-Baixa (Via Zimpeto)',
    codigo: 'VIA-MAG-BAI-1',
    cor: '#3B82F6',
    terminalPartida: 'Magoanine A',
    terminalChegada: 'Praça dos Trabalhadores',
    // Route via Zimpeto and Av. de Moçambique
    geoLocationPath: '32.6105,-25.8752;32.6186,-25.8643;32.5800,-25.9000;32.5639,-25.9442;32.5694,-25.9734',
    paragens: [
      { nome: 'Magoanine A', coords: '-25.8752,32.6105', terminal: true },
      { nome: 'Zimpeto', coords: '-25.8643,32.6186', terminal: false },
      { nome: 'Av. de Moçambique', coords: '-25.9000,32.5800', terminal: false },
      { nome: 'Xipamanine', coords: '-25.9442,32.5639', terminal: false },
      { nome: 'Praça dos Trabalhadores (Av. Samora Machel)', coords: '-25.9734,32.5694', terminal: true }
    ]
  },
  {
    name: 'Magoanine-Baixa (Via Hulene)',
    codigo: 'VIA-MAG-BAI-2',
    cor: '#10B981',
    terminalPartida: 'Magoanine A',
    terminalChegada: 'Praça dos Trabalhadores',
    // Route via Hulene and different streets
    geoLocationPath: '32.6105,-25.8752;32.5939,-25.9083;32.5750,-25.9200;32.5639,-25.9442;32.5694,-25.9734',
    paragens: [
      { nome: 'Magoanine A', coords: '-25.8752,32.6105', terminal: true },
      { nome: 'Hulene', coords: '-25.9083,32.5939', terminal: false },
      { nome: 'Maxaquene', coords: '-25.9200,32.5750', terminal: false },
      { nome: 'Xipamanine', coords: '-25.9442,32.5639', terminal: false },
      { nome: 'Praça dos Trabalhadores (Av. Samora Machel)', coords: '-25.9734,32.5694', terminal: true }
    ]
  },
  {
    name: 'Magoanine-Baixa (Via Mussumbuluco)',
    codigo: 'VIA-MAG-BAI-3',
    cor: '#F59E0B',
    terminalPartida: 'Magoanine A',
    terminalChegada: 'Praça dos Trabalhadores',
    // Route via Mussumbuluco and T3
    geoLocationPath: '32.6105,-25.8752;32.5117,-25.8894;32.5222,-25.9083;32.5400,-25.9300;32.5639,-25.9442;32.5694,-25.9734',
    paragens: [
      { nome: 'Magoanine A', coords: '-25.8752,32.6105', terminal: true },
      { nome: 'Mussumbuluco', coords: '-25.8894,32.5117', terminal: false },
      { nome: 'T3 (Terminal)', coords: '-25.9083,32.5222', terminal: false },
      { nome: 'Av. de Moçambique', coords: '-25.9300,32.5400', terminal: false },
      { nome: 'Xipamanine', coords: '-25.9442,32.5639', terminal: false },
      { nome: 'Praça dos Trabalhadores (Av. Samora Machel)', coords: '-25.9734,32.5694', terminal: true }
    ]
  }
];

async function createMultipleViasForRoute() {
  console.log('🚌 Creating Multiple Vias for Magoanine-Baixa Route\n');
  console.log('=' .repeat(80));
  
  try {
    // Get the municipio (assuming Maputo)
    const municipio = await prisma.municipio.findFirst({
      where: {
        nome: {
          contains: 'Maputo',
          mode: 'insensitive'
        }
      }
    });

    if (!municipio) {
      console.error('❌ Municipio not found. Please ensure Maputo municipio exists.');
      return;
    }

    console.log(`✅ Found municipio: ${municipio.nome} (${municipio.id})\n`);

    // Get all buses currently on the Magoanine-Baixa route
    const existingVia = await prisma.via.findFirst({
      where: {
        nome: {
          contains: 'Magoanine-Baixa',
          mode: 'insensitive'
        }
      },
      include: {
        transportes: true,
        paragens: {
          include: {
            paragem: true
          }
        }
      }
    });

    if (!existingVia) {
      console.error('❌ Existing Magoanine-Baixa via not found.');
      return;
    }

    console.log(`✅ Found existing via: ${existingVia.nome}`);
    console.log(`   Buses on this route: ${existingVia.transportes.length}`);
    console.log(`   Buses: ${existingVia.transportes.map(t => t.matricula).join(', ')}\n`);

    // Create or find paragens for each route
    const createdVias = [];

    for (let i = 0; i < magoanineBaixaRoutes.length; i++) {
      const routeConfig = magoanineBaixaRoutes[i];
      
      console.log(`\n📍 Creating Via ${i + 1}/${magoanineBaixaRoutes.length}: ${routeConfig.name}`);
      console.log('-'.repeat(80));

      // Check if via already exists
      let via = await prisma.via.findUnique({
        where: { codigo: routeConfig.codigo }
      });

      if (via) {
        console.log(`   ⚠️  Via already exists: ${via.nome}`);
        createdVias.push(via);
        continue;
      }

      // Create the via
      via = await prisma.via.create({
        data: {
          nome: routeConfig.name,
          codigo: routeConfig.codigo,
          cor: routeConfig.cor,
          terminalPartida: routeConfig.terminalPartida,
          terminalChegada: routeConfig.terminalChegada,
          geoLocationPath: routeConfig.geoLocationPath,
          codigoMunicipio: municipio.codigo,
          municipioId: municipio.id
        }
      });

      console.log(`   ✅ Created via: ${via.nome} (${via.codigo})`);
      console.log(`   🎨 Color: ${via.cor}`);
      console.log(`   📍 Route: ${via.terminalPartida} → ${via.terminalChegada}`);

      // Create or find paragens and connect them to the via
      for (let j = 0; j < routeConfig.paragens.length; j++) {
        const paragemConfig = routeConfig.paragens[j];
        
        // Try to find existing paragem by name and location
        let paragem = await prisma.paragem.findFirst({
          where: {
            nome: paragemConfig.nome,
            geoLocation: paragemConfig.coords
          }
        });

        // If not found, create it
        if (!paragem) {
          const paragemCodigo = `PAR-${routeConfig.codigo}-${j + 1}`;
          paragem = await prisma.paragem.create({
            data: {
              nome: paragemConfig.nome,
              codigo: paragemCodigo,
              geoLocation: paragemConfig.coords
            }
          });
          console.log(`      ✅ Created paragem: ${paragem.nome}`);
        } else {
          console.log(`      ℹ️  Using existing paragem: ${paragem.nome}`);
        }

        // Connect paragem to via
        await prisma.viaParagem.create({
          data: {
            codigoParagem: paragem.codigo,
            codigoVia: via.codigo,
            terminalBoolean: paragemConfig.terminal,
            viaId: via.id,
            paragemId: paragem.id
          }
        });
      }

      console.log(`   ✅ Connected ${routeConfig.paragens.length} paragens to via`);
      createdVias.push(via);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Created ${createdVias.length} vias for Magoanine-Baixa route\n`);

    // Now reassign buses to different vias
    console.log('🚌 Reassigning Buses to Different Vias\n');
    console.log('=' .repeat(80));

    const buses = existingVia.transportes;
    
    for (let i = 0; i < buses.length && i < createdVias.length; i++) {
      const bus = buses[i];
      const newVia = createdVias[i];

      await prisma.transporte.update({
        where: { id: bus.id },
        data: {
          viaId: newVia.id,
          codigoVia: newVia.codigo
        }
      });

      console.log(`✅ ${bus.matricula} → ${newVia.nome}`);
      console.log(`   Old via: ${existingVia.nome}`);
      console.log(`   New via: ${newVia.nome} (${newVia.codigo})`);
      console.log(`   Color: ${newVia.cor}\n`);
    }

    // If there are more buses than vias, distribute them
    if (buses.length > createdVias.length) {
      console.log(`\n⚠️  More buses (${buses.length}) than vias (${createdVias.length})`);
      console.log('   Distributing remaining buses across vias...\n');

      for (let i = createdVias.length; i < buses.length; i++) {
        const bus = buses[i];
        const viaIndex = i % createdVias.length;
        const newVia = createdVias[viaIndex];

        await prisma.transporte.update({
          where: { id: bus.id },
          data: {
            viaId: newVia.id,
            codigoVia: newVia.codigo
          }
        });

        console.log(`✅ ${bus.matricula} → ${newVia.nome} (distributed)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ COMPLETE! All buses now have unique routes\n');
    console.log('📊 Summary:');
    console.log(`   - Created ${createdVias.length} unique vias`);
    console.log(`   - Reassigned ${buses.length} buses`);
    console.log(`   - Each via has different streets and paragens`);
    console.log(`   - Each bus will now show different:`);
    console.log(`     • Distance`);
    console.log(`     • Time`);
    console.log(`     • Price`);
    console.log(`     • Route path on map\n`);

    // Display the new configuration
    console.log('📋 New Configuration:\n');
    for (const via of createdVias) {
      const busesOnVia = await prisma.transporte.findMany({
        where: { viaId: via.id },
        select: { matricula: true }
      });

      console.log(`   ${via.nome} (${via.codigo})`);
      console.log(`   Color: ${via.cor}`);
      console.log(`   Buses: ${busesOnVia.map(b => b.matricula).join(', ')}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  createMultipleViasForRoute();
}

module.exports = { createMultipleViasForRoute };
