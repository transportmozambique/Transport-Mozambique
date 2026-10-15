const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Route waypoints with stops (from street-based location system)
const routeStops = {
  'VIA-1A': [
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Av. 25 de Setembro', coords: '-25.9700,32.5720', isTerminal: false },
    { nome: 'Av. Julius Nyerere', coords: '-25.9650,32.5750', isTerminal: false },
    { nome: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650', isTerminal: false },
    { nome: 'Av. de Moçambique', coords: '-25.9500,32.5500', isTerminal: false },
    { nome: 'Chamissava', coords: '-26.0371,32.5186', isTerminal: true }
  ],
  'VIA-MAT-BAI': [
    { nome: 'Terminal Matola Sede', coords: '-25.9794,32.4589', isTerminal: true },
    { nome: 'Godinho', coords: '-25.9528,32.4655', isTerminal: false },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Museu', coords: '-25.9723,32.5836', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-T3-BAI': [
    { nome: 'T3 (Terminal)', coords: '-25.9083,32.5222', isTerminal: true },
    { nome: 'Mussumbuluco', coords: '-25.8894,32.5117', isTerminal: false },
    { nome: 'Av. de Moçambique', coords: '-25.9300,32.5400', isTerminal: false },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-POL-BAI': [
    { nome: 'Polana Cimento', coords: '-25.9650,32.5850', isTerminal: true },
    { nome: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800', isTerminal: false },
    { nome: 'Av. 25 de Setembro', coords: '-25.9700,32.5720', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-MAG-BAI': [
    { nome: 'Magoanine A', coords: '-25.8752,32.6105', isTerminal: true },
    { nome: 'Zimpeto', coords: '-25.8643,32.6186', isTerminal: false },
    { nome: 'Av. de Moçambique', coords: '-25.9000,32.5800', isTerminal: false },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-17': [
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Hulene', coords: '-25.9083,32.5939', isTerminal: false },
    { nome: 'Magoanine', coords: '-25.8752,32.6105', isTerminal: false },
    { nome: 'Terminal Zimpeto', coords: '-25.8643,32.6186', isTerminal: true }
  ],
  'VIA-21': [
    { nome: 'Terminal Museu', coords: '-25.9723,32.5836', isTerminal: true },
    { nome: 'Av. Julius Nyerere', coords: '-25.9600,32.5900', isTerminal: false },
    { nome: 'Jardim', coords: '-25.9688,32.5714', isTerminal: false },
    { nome: 'Zimpeto', coords: '-25.8643,32.6186', isTerminal: false },
    { nome: 'Albasine', coords: '-25.8373,32.6382', isTerminal: true }
  ],
  'VIA-53': [
    { nome: 'Laurentina', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Museu', coords: '-25.9723,32.5836', isTerminal: false },
    { nome: 'Jardim', coords: '-25.9688,32.5714', isTerminal: false },
    { nome: 'Zimpeto', coords: '-25.8643,32.6186', isTerminal: false },
    { nome: 'Albasine', coords: '-25.8373,32.6382', isTerminal: true }
  ],
  'VIA-MACH-MUS': [
    { nome: 'Machava Sede', coords: '-25.9125,32.4914', isTerminal: true },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650', isTerminal: false },
    { nome: 'Terminal Museu', coords: '-25.9723,32.5836', isTerminal: true }
  ],
  'VIA-TCH-BAI': [
    { nome: 'Tchumene', coords: '-25.8856,32.4042', isTerminal: true },
    { nome: 'Malhampsene', coords: '-25.8885,32.4336', isTerminal: false },
    { nome: 'Matola Gare', coords: '-25.8271,32.4512', isTerminal: false },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Museu', coords: '-25.9723,32.5836', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-MAT-MUS': [
    { nome: 'Terminal Matola Sede', coords: '-25.9794,32.4589', isTerminal: true },
    { nome: 'Godinho', coords: '-25.9528,32.4655', isTerminal: false },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Terminal Museu', coords: '-25.9723,32.5836', isTerminal: true }
  ],
  'VIA-MAL-MUS': [
    { nome: 'Malhampsene', coords: '-25.8885,32.4336', isTerminal: true },
    { nome: 'Matola Gare', coords: '-25.8271,32.4512', isTerminal: false },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Terminal Museu', coords: '-25.9723,32.5836', isTerminal: true }
  ],
  'VIA-MGARE-BAI': [
    { nome: 'Matola Gare', coords: '-25.8271,32.4512', isTerminal: true },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Museu', coords: '-25.9723,32.5836', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-37': [
    { nome: 'Terminal Museu', coords: '-25.9723,32.5836', isTerminal: true },
    { nome: 'Av. Julius Nyerere', coords: '-25.9600,32.5900', isTerminal: false },
    { nome: 'Av. de Moçambique', coords: '-25.9300,32.5600', isTerminal: false },
    { nome: 'Magoanine', coords: '-25.8752,32.6105', isTerminal: false },
    { nome: 'Terminal Zimpeto', coords: '-25.8643,32.6186', isTerminal: true }
  ],
  'VIA-39A': [
    { nome: 'Albert Lithule', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Hulene', coords: '-25.9083,32.5939', isTerminal: false },
    { nome: 'Magoanine', coords: '-25.8752,32.6105', isTerminal: false },
    { nome: 'Terminal Zimpeto', coords: '-25.8643,32.6186', isTerminal: true }
  ],
  'VIA-39B': [
    { nome: 'Albert Lithule', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Hulene', coords: '-25.9083,32.5939', isTerminal: false },
    { nome: 'Magoanine', coords: '-25.8752,32.6105', isTerminal: false },
    { nome: 'Boquisso', coords: '-25.8200,32.6500', isTerminal: true }
  ],
  'VIA-47': [
    { nome: 'Albert Lithule', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Matola Gare', coords: '-25.8271,32.4512', isTerminal: false },
    { nome: 'Malhampsene', coords: '-25.8885,32.4336', isTerminal: false },
    { nome: 'Tchumene', coords: '-25.8856,32.4042', isTerminal: true }
  ],
  'VIA-51A': [
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Matola Gare', coords: '-25.8271,32.4512', isTerminal: false },
    { nome: 'Boane', coords: '-26.0500,32.3200', isTerminal: true }
  ],
  'VIA-51C': [
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Matola Gare', coords: '-25.8271,32.4512', isTerminal: false },
    { nome: 'Mafuiane', coords: '-26.1000,32.2800', isTerminal: true }
  ],
  'VIA-11': [
    { nome: 'Albert Lithule', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Hulene', coords: '-25.9083,32.5939', isTerminal: false },
    { nome: 'Michafutene', coords: '-25.8500,32.6800', isTerminal: true }
  ],
  'VIA-20': [
    { nome: 'Albert Lithule', coords: '-25.9734,32.5694', isTerminal: true },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Hulene', coords: '-25.9083,32.5939', isTerminal: false },
    { nome: 'Matendene', coords: '-25.8300,32.6600', isTerminal: true }
  ],
  'VIA-POL-MAT': [
    { nome: 'Polana Shopping', coords: '-25.9650,32.5850', isTerminal: true },
    { nome: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800', isTerminal: false },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Terminal Matola Sede', coords: '-25.9794,32.4589', isTerminal: true }
  ],
  'VIA-T3-MUS': [
    { nome: 'T3 Mercado', coords: '-25.9083,32.5222', isTerminal: true },
    { nome: 'Av. de Moçambique', coords: '-25.9300,32.5400', isTerminal: false },
    { nome: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650', isTerminal: false },
    { nome: 'Terminal Museu', coords: '-25.9723,32.5836', isTerminal: true }
  ],
  'VIA-MAG-ZIM': [
    { nome: 'Magoanine B', coords: '-25.8752,32.6105', isTerminal: true },
    { nome: 'Terminal Zimpeto', coords: '-25.8643,32.6186', isTerminal: true }
  ],
  'VIA-FOM-BAI': [
    { nome: 'Fomento (Paragem)', coords: '-25.9200,32.4800', isTerminal: true },
    { nome: 'Portagem', coords: '-25.9392,32.5147', isTerminal: false },
    { nome: 'Museu', coords: '-25.9723,32.5836', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-SOM-BAI': [
    { nome: 'Sommerschield', coords: '-25.9600,32.5900', isTerminal: true },
    { nome: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800', isTerminal: false },
    { nome: 'Av. 25 de Setembro', coords: '-25.9700,32.5720', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-MAX-BAI': [
    { nome: 'Maxaquene', coords: '-25.9500,32.5700', isTerminal: true },
    { nome: 'Xipamanine', coords: '-25.9442,32.5639', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ],
  'VIA-AER-BAI': [
    { nome: 'Aeroporto', coords: '-25.9208,32.5728', isTerminal: true },
    { nome: 'Av. Julius Nyerere', coords: '-25.9600,32.5750', isTerminal: false },
    { nome: 'Av. 25 de Setembro', coords: '-25.9700,32.5720', isTerminal: false },
    { nome: 'Praça dos Trabalhadores', coords: '-25.9734,32.5694', isTerminal: true }
  ]
};

async function populateRouteStops() {
  console.log('🚏 Populating Route Stops\n');
  console.log('=' .repeat(80));
  
  try {
    let totalStopsCreated = 0;
    let totalRelationsCreated = 0;
    
    for (const [routeCode, stops] of Object.entries(routeStops)) {
      console.log(`\n📍 Processing ${routeCode}...`);
      
      // Find the route
      const route = await prisma.via.findUnique({
        where: { codigo: routeCode },
        include: { paragens: true }
      });
      
      if (!route) {
        console.log(`   ⚠️  Route ${routeCode} not found in database`);
        continue;
      }
      
      console.log(`   ✓ Found route: ${route.nome}`);
      
      // Delete existing stop relations for this route
      if (route.paragens.length > 0) {
        await prisma.viaParagem.deleteMany({
          where: { viaId: route.id }
        });
        console.log(`   🗑️  Removed ${route.paragens.length} existing stop relations`);
      }
      
      // Create or find each stop and link to route
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        
        // Try to find existing stop by name (case-insensitive)
        let paragem = await prisma.paragem.findFirst({
          where: {
            nome: {
              equals: stop.nome,
              mode: 'insensitive'
            }
          }
        });
        
        // If not found, create new stop
        if (!paragem) {
          const stopCode = `PAR-${routeCode}-${i + 1}`;
          paragem = await prisma.paragem.create({
            data: {
              nome: stop.nome,
              codigo: stopCode,
              geoLocation: stop.coords
            }
          });
          console.log(`   ✅ Created stop: ${stop.nome}`);
          totalStopsCreated++;
        } else {
          console.log(`   ♻️  Using existing stop: ${stop.nome}`);
        }
        
        // Create ViaParagem relation
        await prisma.viaParagem.create({
          data: {
            codigoParagem: paragem.codigo,
            codigoVia: route.codigo,
            terminalBoolean: stop.isTerminal,
            viaId: route.id,
            paragemId: paragem.id
          }
        });
        totalRelationsCreated++;
      }
      
      console.log(`   ✓ Linked ${stops.length} stops to ${route.nome}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Route stops population complete!`);
    console.log(`   📊 New stops created: ${totalStopsCreated}`);
    console.log(`   🔗 Stop relations created: ${totalRelationsCreated}`);
    console.log(`   📍 Routes processed: ${Object.keys(routeStops).length}/28\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  populateRouteStops();
}

module.exports = { populateRouteStops, routeStops };
