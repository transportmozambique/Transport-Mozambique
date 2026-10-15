const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import route paths from USSD file (they're identical)
// For now, we'll duplicate them here for the standalone script
const routePathsWithStreets = {
  'VIA-1A': {
    name: 'Rota 1a: Baixa - Chamissava',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9650,32.5750' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9500,32.5500' },
      { location: 'Chamissava', street: 'Estrada de Chamissava', coords: '-26.0371,32.5186' }
    ]
  },
  'VIA-MAT-BAI': {
    name: 'Matola Sede - Baixa',
    waypoints: [
      { location: 'Terminal Matola Sede', street: 'Av. União Africana', coords: '-25.9794,32.4589' },
      { location: 'Godinho', street: 'Av. União Africana', coords: '-25.9528,32.4655' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-T3-BAI': {
    name: 'Rota T3-Baixa',
    waypoints: [
      { location: 'T3 (Terminal)', street: 'Estrada Circular', coords: '-25.9083,32.5222' },
      { location: 'Mussumbuluco', street: 'Estrada Circular', coords: '-25.8894,32.5117' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9300,32.5400' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-POL-BAI': {
    name: 'Rota Polana-Baixa',
    waypoints: [
      { location: 'Polana Cimento', street: 'Av. Julius Nyerere', coords: '-25.9650,32.5850' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-MAG-BAI': {
    name: 'Rota Magoanine-Baixa',
    waypoints: [
      { location: 'Magoanine A', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Zimpeto', street: 'Estrada Circular', coords: '-25.8643,32.6186' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9000,32.5800' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-17': {
    name: 'Rota 17: Baixa - Zimpeto',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-21': {
    name: 'Rota 21: Museu - Albasine',
    waypoints: [
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5900' },
      { location: 'Jardim', street: 'Av. de Moçambique', coords: '-25.9688,32.5714' },
      { location: 'Zimpeto', street: 'Estrada Circular', coords: '-25.8643,32.6186' },
      { location: 'Albasine', street: 'Estrada de Albasine', coords: '-25.8373,32.6382' }
    ]
  },
  'VIA-53': {
    name: 'Rota 53: Baixa - Albasine',
    waypoints: [
      { location: 'Laurentina', street: 'Av. 24 de Julho', coords: '-25.9734,32.5694' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Jardim', street: 'Av. de Moçambique', coords: '-25.9688,32.5714' },
      { location: 'Zimpeto', street: 'Estrada Circular', coords: '-25.8643,32.6186' },
      { location: 'Albasine', street: 'Estrada de Albasine', coords: '-25.8373,32.6382' }
    ]
  },
  'VIA-MACH-MUS': {
    name: 'Machava Sede - Museu',
    waypoints: [
      { location: 'Machava Sede', street: 'Av. das Indústrias', coords: '-25.9125,32.4914' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-TCH-BAI': {
    name: 'Tchumene - Baixa',
    waypoints: [
      { location: 'Tchumene', street: 'Estrada Nacional N4', coords: '-25.8856,32.4042' },
      { location: 'Malhampsene', street: 'Estrada Nacional N4', coords: '-25.8885,32.4336' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-MAT-MUS': {
    name: 'Matola Sede - Museu',
    waypoints: [
      { location: 'Terminal Matola Sede', street: 'Av. União Africana', coords: '-25.9794,32.4589' },
      { location: 'Godinho', street: 'Av. União Africana', coords: '-25.9528,32.4655' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-MAL-MUS': {
    name: 'Malhampsene - Museu',
    waypoints: [
      { location: 'Malhampsene', street: 'Estrada Nacional N4', coords: '-25.8885,32.4336' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-MGARE-BAI': {
    name: 'Matola Gare - Baixa',
    waypoints: [
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-37': {
    name: 'Rota 37: Museu - Zimpeto',
    waypoints: [
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5900' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9300,32.5600' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-39A': {
    name: 'Rota 39a: Baixa - Zimpeto',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-39B': {
    name: 'Rota 39b: Baixa - Boquisso',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Magoanine', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Boquisso', street: 'Estrada de Boquisso', coords: '-25.8200,32.6500' }
    ]
  },
  'VIA-47': {
    name: 'Rota 47: Baixa - Tchumene',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Malhampsene', street: 'Estrada Nacional N4', coords: '-25.8885,32.4336' },
      { location: 'Tchumene', street: 'Estrada Nacional N4', coords: '-25.8856,32.4042' }
    ]
  },
  'VIA-51A': {
    name: 'Rota 51a: Baixa - Boane',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Boane', street: 'Estrada Nacional N2', coords: '-26.0500,32.3200' }
    ]
  },
  'VIA-51C': {
    name: 'Rota 51c: Baixa - Mafuiane',
    waypoints: [
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Matola Gare', street: 'Estrada da Matola', coords: '-25.8271,32.4512' },
      { location: 'Mafuiane', street: 'Estrada Nacional N2', coords: '-26.1000,32.2800' }
    ]
  },
  'VIA-11': {
    name: 'Rota 11: Baixa - Michafutene',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Michafutene', street: 'Estrada de Michafutene', coords: '-25.8500,32.6800' }
    ]
  },
  'VIA-20': {
    name: 'Rota 20: Baixa - Matendene',
    waypoints: [
      { location: 'Albert Lithule', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Hulene', street: 'Av. de Moçambique', coords: '-25.9083,32.5939' },
      { location: 'Matendene', street: 'Estrada de Matendene', coords: '-25.8300,32.6600' }
    ]
  },
  'VIA-POL-MAT': {
    name: 'Rota Polana-Matola',
    waypoints: [
      { location: 'Polana Shopping', street: 'Av. Julius Nyerere', coords: '-25.9650,32.5850' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Terminal Matola Sede', street: 'Av. União Africana', coords: '-25.9794,32.4589' }
    ]
  },
  'VIA-T3-MUS': {
    name: 'Rota T3-Museu',
    waypoints: [
      { location: 'T3 Mercado', street: 'Estrada Circular', coords: '-25.9083,32.5222' },
      { location: 'Av. de Moçambique', street: 'Av. de Moçambique', coords: '-25.9300,32.5400' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9600,32.5650' },
      { location: 'Terminal Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' }
    ]
  },
  'VIA-MAG-ZIM': {
    name: 'Rota Magoanine-Zimpeto',
    waypoints: [
      { location: 'Magoanine B', street: 'Estrada Circular', coords: '-25.8752,32.6105' },
      { location: 'Terminal Zimpeto', street: 'Estrada do Zimpeto', coords: '-25.8643,32.6186' }
    ]
  },
  'VIA-FOM-BAI': {
    name: 'Rota Fomento-Baixa',
    waypoints: [
      { location: 'Fomento (Paragem)', street: 'Av. das Indústrias', coords: '-25.9200,32.4800' },
      { location: 'Portagem', street: 'Estrada da Matola', coords: '-25.9392,32.5147' },
      { location: 'Museu', street: 'Av. 24 de Julho', coords: '-25.9723,32.5836' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-SOM-BAI': {
    name: 'Rota Sommerschield-Baixa',
    waypoints: [
      { location: 'Sommerschield', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5900' },
      { location: 'Av. Eduardo Mondlane', street: 'Av. Eduardo Mondlane', coords: '-25.9680,32.5800' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-MAX-BAI': {
    name: 'Rota Maxaquene-Baixa',
    waypoints: [
      { location: 'Maxaquene', street: 'Av. de Moçambique', coords: '-25.9500,32.5700' },
      { location: 'Xipamanine', street: 'Av. de Moçambique', coords: '-25.9442,32.5639' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  },
  'VIA-AER-BAI': {
    name: 'Rota Aeroporto-Baixa',
    waypoints: [
      { location: 'Aeroporto', street: 'Av. Acordos de Lusaka', coords: '-25.9208,32.5728' },
      { location: 'Av. Julius Nyerere', street: 'Av. Julius Nyerere', coords: '-25.9600,32.5750' },
      { location: 'Av. 25 de Setembro', street: 'Av. 25 de Setembro', coords: '-25.9700,32.5720' },
      { location: 'Praça dos Trabalhadores', street: 'Av. Samora Machel', coords: '-25.9734,32.5694' }
    ]
  }
};

// Calculate which waypoint the bus is currently at based on progress
function getCurrentStreetLocation(routeCode, progress) {
  const route = routePathsWithStreets[routeCode];
  if (!route || !route.waypoints || route.waypoints.length === 0) {
    return { street: 'Em rota', location: 'Desconhecido', coords: null };
  }
  
  // Calculate which waypoint based on progress (0-1)
  const index = Math.floor(progress * (route.waypoints.length - 1));
  const nextIndex = Math.min(index + 1, route.waypoints.length - 1);
  
  const currentWaypoint = route.waypoints[index];
  const nextWaypoint = route.waypoints[nextIndex];
  
  // If close to next waypoint, show "próximo de"
  const localProgress = (progress * (route.waypoints.length - 1)) - index;
  
  if (localProgress < 0.3) {
    return {
      street: currentWaypoint.street,
      location: currentWaypoint.location,
      coords: currentWaypoint.coords,
      description: `Em ${currentWaypoint.street}`
    };
  } else if (localProgress > 0.7 && nextIndex !== index) {
    return {
      street: currentWaypoint.street,
      location: `Próximo de ${nextWaypoint.location}`,
      coords: currentWaypoint.coords,
      description: `Em ${currentWaypoint.street}, próximo de ${nextWaypoint.location}`
    };
  } else {
    return {
      street: currentWaypoint.street,
      location: `Entre ${currentWaypoint.location} e ${nextWaypoint.location}`,
      coords: currentWaypoint.coords,
      description: `Em ${currentWaypoint.street}`
    };
  }
}

async function updateBusesWithStreetLocations() {
  console.log('🚌 Updating buses with street-based locations\n');
  console.log('=' .repeat(80));
  
  try {
    // Get all buses
    const buses = await prisma.transporte.findMany({
      select: {
        id: true,
        matricula: true,
        codigo: true,
        via: {
          select: {
            codigo: true,
            nome: true
          }
        }
      }
    });
    
    console.log(`\nFound ${buses.length} buses\n`);
    
    let updatedCount = 0;
    
    for (const bus of buses) {
      // Simulate bus progress along route (0-100%)
      const progress = Math.random();
      
      // Get current street location
      const streetLocation = getCurrentStreetLocation(bus.via.codigo, progress);
      
      if (streetLocation.coords) {
        // Update bus with street-based location
        await prisma.transporte.update({
          where: { id: bus.id },
          data: {
            currGeoLocation: streetLocation.coords
          }
        });
        
        // Update or create GeoLocation record
        try {
          await prisma.geoLocation.upsert({
            where: { 
              transporteId: bus.id 
            },
            update: {
              geoLocationTransporte: streetLocation.coords,
              geoDirection: progress > 0.5 ? 'forward' : 'backward'
            },
            create: {
              geoLocationTransporte: streetLocation.coords,
              geoDirection: progress > 0.5 ? 'forward' : 'backward',
              codigoTransporte: bus.codigo,
              transporteId: bus.id
            }
          });
        } catch (error) {
          // GeoLocation might have unique constraint issues, skip
        }
        
        console.log(`✅ ${bus.matricula} (${bus.via.nome})`);
        console.log(`   📍 ${streetLocation.description}`);
        console.log(`   🎯 ${streetLocation.location}`);
        console.log(`   📊 ${(progress * 100).toFixed(0)}% do percurso\n`);
        
        updatedCount++;
      } else {
        console.log(`⚠️  ${bus.matricula}: Route ${bus.via.codigo} not configured with streets\n`);
      }
    }
    
    console.log('=' .repeat(80));
    console.log(`\n✅ Updated ${updatedCount}/${buses.length} buses with street locations`);
    console.log(`⚠️  ${buses.length - updatedCount} buses on routes without street configuration`);
    
    // Save route paths to file for reference
    const fs = require('fs');
    let routeDoc = '# Route Paths with Street Names\n\n';
    routeDoc += 'Detailed route paths showing streets and waypoints for all 28 routes.\n\n';
    routeDoc += `**Total Routes Configured**: ${Object.keys(routePathsWithStreets).length}/28\n\n`;
    
    for (const [code, route] of Object.entries(routePathsWithStreets)) {
      routeDoc += `## ${route.name} (${code})\n\n`;
      routeDoc += '| Waypoint | Street/Avenue | Coordinates |\n';
      routeDoc += '|----------|---------------|-------------|\n';
      route.waypoints.forEach(wp => {
        routeDoc += `| ${wp.location} | ${wp.street} | ${wp.coords} |\n`;
      });
      routeDoc += '\n';
    }
    
    fs.writeFileSync('ROUTE_PATHS_WITH_STREETS.md', routeDoc);
    console.log('✅ Created ROUTE_PATHS_WITH_STREETS.md\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    routePathsWithStreets,
    getCurrentStreetLocation
  };
}

// Run if called directly
if (require.main === module) {
  updateBusesWithStreetLocations();
}
