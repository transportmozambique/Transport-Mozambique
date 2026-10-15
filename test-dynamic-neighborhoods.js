require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse geolocation string
function parseGeoLocation(geoStr) {
  if (!geoStr) return null;
  const parts = geoStr.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  
  if (parts[0] < 0 && parts[0] > -30) {
    return { lat: parts[0], lng: parts[1] };
  } else {
    return { lat: parts[1], lng: parts[0] };
  }
}

function determineRegion(lat, lng) {
  if (lng < 32.48) {
    return 'Matola';
  } else {
    return 'Maputo';
  }
}

function determineNeighborhood(stopName, lat, lng, region) {
  const name = stopName.toLowerCase();
  
  if (region === 'Maputo') {
    if (name.includes('baixa') || name.includes('praça') || name.includes('trabalhadores') || 
        name.includes('albert') || name.includes('laurentina') || (lat > -25.98 && lng > 32.56)) {
      return 'Baixa / Central';
    }
    if (name.includes('polana') || name.includes('sommerschield') || (lat > -25.97 && lat < -25.96 && lng > 32.58)) {
      return 'Polana / Museu';
    }
    if (name.includes('xipamanine') || (lat > -25.95 && lat < -25.94 && lng > 32.56)) {
      return 'Xipamanine';
    }
    if (name.includes('zimpeto') || (lat > -25.87 && lat < -25.86 && lng > 32.61)) {
      return 'Zimpeto';
    }
    if (name.includes('jardim') || (lat > -25.97 && lat < -25.96 && lng > 32.57)) {
      return 'Jardim';
    }
    return 'Baixa / Central';
  } else {
    if (name.includes('matola sede') || name.includes('sede') || (lat > -25.98 && lng < 32.46)) {
      return 'Matola Sede';
    }
    if (name.includes('machava') || (lat > -25.92 && lat < -25.90 && lng < 32.50)) {
      return 'Machava';
    }
    if (name.includes('matola gare') || name.includes('gare') || (lat > -25.83 && lat < -25.82 && lng < 32.46)) {
      return 'Matola Gare';
    }
    if (name.includes('fomento') || (lat > -25.93 && lat < -25.91 && lng < 32.49)) {
      return 'Fomento';
    }
    if (name.includes('liberdade') || (lat > -25.95 && lat < -25.93 && lng < 32.47)) {
      return 'Liberdade';
    }
    return 'Matola Sede';
  }
}

async function getNeighborhoodsByRegion(region) {
  const stopsWithRoutes = await prisma.paragem.findMany({
    where: {
      vias: {
        some: {}
      }
    },
    select: {
      nome: true,
      geoLocation: true
    }
  });

  const neighborhoodSet = new Set();

  for (const stop of stopsWithRoutes) {
    const coords = parseGeoLocation(stop.geoLocation);
    if (!coords) continue;

    const stopRegion = determineRegion(coords.lat, coords.lng);
    if (stopRegion !== region) continue;

    const neighborhood = determineNeighborhood(stop.nome, coords.lat, coords.lng, stopRegion);
    neighborhoodSet.add(neighborhood);
  }

  return Array.from(neighborhoodSet).sort();
}

async function getStopsByNeighborhood(neighborhood, region) {
  const stopsWithRoutes = await prisma.paragem.findMany({
    where: {
      vias: {
        some: {}
      }
    },
    select: {
      nome: true,
      geoLocation: true
    },
    orderBy: {
      nome: 'asc'
    }
  });

  const neighborhoodStops = [];

  for (const stop of stopsWithRoutes) {
    const coords = parseGeoLocation(stop.geoLocation);
    if (!coords) continue;

    const stopRegion = determineRegion(coords.lat, coords.lng);
    if (stopRegion !== region) continue;

    const stopNeighborhood = determineNeighborhood(stop.nome, coords.lat, coords.lng, stopRegion);
    if (stopNeighborhood === neighborhood) {
      neighborhoodStops.push(stop.nome);
    }
  }

  const uniqueStops = Array.from(new Set(neighborhoodStops)).sort();

  if (uniqueStops.length === 0) {
    return [neighborhood];
  }

  return uniqueStops;
}

async function testDynamicNeighborhoods() {
  try {
    console.log('🧪 Testing Dynamic Neighborhood Service\n');
    console.log('='.repeat(80));

    // Test 1: Get neighborhoods in Maputo
    console.log('\n📍 TEST 1: Get neighborhoods in Maputo');
    console.log('─'.repeat(80));
    const maputoNeighborhoods = await getNeighborhoodsByRegion('Maputo');
    console.log(`Found ${maputoNeighborhoods.length} neighborhoods:`);
    maputoNeighborhoods.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n}`);
    });

    // Test 2: Get neighborhoods in Matola
    console.log('\n📍 TEST 2: Get neighborhoods in Matola');
    console.log('─'.repeat(80));
    const matolaNeighborhoods = await getNeighborhoodsByRegion('Matola');
    console.log(`Found ${matolaNeighborhoods.length} neighborhoods:`);
    matolaNeighborhoods.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n}`);
    });

    // Test 3: Get stops in Baixa / Central
    if (maputoNeighborhoods.includes('Baixa / Central')) {
      console.log('\n🚏 TEST 3: Get stops in Baixa / Central, Maputo');
      console.log('─'.repeat(80));
      const baixaStops = await getStopsByNeighborhood('Baixa / Central', 'Maputo');
      console.log(`Found ${baixaStops.length} stops:`);
      baixaStops.slice(0, 10).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
      if (baixaStops.length > 10) {
        console.log(`  ... and ${baixaStops.length - 10} more`);
      }
    }

    // Test 4: Get stops in Matola Sede
    if (matolaNeighborhoods.includes('Matola Sede')) {
      console.log('\n🚏 TEST 4: Get stops in Matola Sede, Matola');
      console.log('─'.repeat(80));
      const matolaStops = await getStopsByNeighborhood('Matola Sede', 'Matola');
      console.log(`Found ${matolaStops.length} stops:`);
      matolaStops.slice(0, 10).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
      if (matolaStops.length > 10) {
        console.log(`  ... and ${matolaStops.length - 10} more`);
      }
    }

    // Test 5: Verify stops have routes
    console.log('\n🔗 TEST 5: Verify stops have ViaParagem relations');
    console.log('─'.repeat(80));
    
    const sampleStops = await prisma.paragem.findMany({
      where: {
        vias: {
          some: {}
        }
      },
      select: {
        nome: true,
        _count: {
          select: {
            vias: true
          }
        }
      },
      take: 5,
      orderBy: {
        vias: {
          _count: 'desc'
        }
      }
    });

    console.log('Top 5 stops by route count:');
    sampleStops.forEach((stop, i) => {
      console.log(`  ${i + 1}. ${stop.nome} - ${stop._count.vias} route(s)`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(80));
    console.log('\n💡 Summary:');
    console.log(`   - Maputo has ${maputoNeighborhoods.length} neighborhoods`);
    console.log(`   - Matola has ${matolaNeighborhoods.length} neighborhoods`);
    console.log(`   - All data is pulled dynamically from database`);
    console.log(`   - Only stops with ViaParagem relations are included`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testDynamicNeighborhoods();
