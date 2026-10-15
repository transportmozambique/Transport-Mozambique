const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find the minimum distance from a stop to any point on the route
function minDistanceToRoute(stopLat, stopLon, routePath) {
  const pathCoords = routePath.split(';').map(coord => {
    const [lon, lat] = coord.split(',').map(Number);
    return { lat, lon };
  });
  
  let minDistance = Infinity;
  
  for (const pathPoint of pathCoords) {
    const distance = calculateDistance(
      stopLat, stopLon,
      pathPoint.lat, pathPoint.lon
    );
    
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
}

// Find the position of a stop along the route (0 = start, 1 = end)
function findStopPositionOnRoute(stopLat, stopLon, routePath) {
  const pathCoords = routePath.split(';').map(coord => {
    const [lon, lat] = coord.split(',').map(Number);
    return { lat, lon };
  });
  
  let minDistance = Infinity;
  let closestIndex = 0;
  
  for (let i = 0; i < pathCoords.length; i++) {
    const distance = calculateDistance(
      stopLat, stopLon,
      pathCoords[i].lat, pathCoords[i].lon
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }
  
  return closestIndex / (pathCoords.length - 1);
}

async function main() {
  console.log('🔧 Associating Only Stops the Route Actually Passes Through\n');
  console.log('=' .repeat(60) + '\n');

  // 1. Get all vias
  const vias = await prisma.via.findMany();
  console.log(`📊 Found ${vias.length} vias\n`);

  // 2. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  // Parse coordinates once
  const paragensWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // 3. Delete all existing associations
  console.log('🗑️  Deleting existing via-paragem associations...');
  const deleted = await prisma.viaParagem.deleteMany({});
  console.log(`✅ Deleted ${deleted.count} associations\n`);

  // 4. Recreate associations with strict threshold
  console.log('🔗 Creating associations (50m threshold - route must pass through stop)...\n');
  
  const MAX_DISTANCE_KM = 0.05; // 50 meters - route must actually pass through the stop
  let totalAssociations = 0;
  let viasProcessed = 0;
  let viasWithFewStops = 0;

  for (const via of vias) {
    if (!via.geoLocationPath) {
      console.log(`⚠️  Via ${via.nome}: No route path, skipping...`);
      continue;
    }

    // Find all stops within strict distance threshold
    const nearbyStops = [];
    
    for (const paragem of paragensWithCoords) {
      const minDist = minDistanceToRoute(paragem.lat, paragem.lon, via.geoLocationPath);
      
      if (minDist <= MAX_DISTANCE_KM) {
        const position = findStopPositionOnRoute(paragem.lat, paragem.lon, via.geoLocationPath);
        nearbyStops.push({
          paragem,
          distance: minDist,
          position
        });
      }
    }

    // Sort stops by position along the route
    nearbyStops.sort((a, b) => a.position - b.position);

    // Ensure start and end terminals are included
    const startTerminal = paragensWithCoords.find(p => p.nome === via.terminalPartida);
    const endTerminal = paragensWithCoords.find(p => p.nome === via.terminalChegada);

    // Add start terminal if not already included
    if (startTerminal && !nearbyStops.find(s => s.paragem.id === startTerminal.id)) {
      nearbyStops.unshift({
        paragem: startTerminal,
        distance: 0,
        position: 0
      });
    }

    // Add end terminal if not already included
    if (endTerminal && !nearbyStops.find(s => s.paragem.id === endTerminal.id)) {
      nearbyStops.push({
        paragem: endTerminal,
        distance: 0,
        position: 1
      });
    }

    // Create associations
    for (const stopData of nearbyStops) {
      const paragem = stopData.paragem;
      const isTerminal = 
        paragem.nome === via.terminalPartida || 
        paragem.nome === via.terminalChegada;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: paragem.codigo,
            codigoVia: via.codigo,
            viaId: via.id,
            paragemId: paragem.id,
            terminalBoolean: isTerminal
          }
        });
        totalAssociations++;
      } catch (error) {
        // Ignore duplicates
      }
    }

    viasProcessed++;
    
    if (nearbyStops.length < 10) {
      viasWithFewStops++;
      console.log(`⚠️  Via ${via.nome}: ${nearbyStops.length} stops`);
    } else {
      console.log(`✅ Via ${via.nome}: ${nearbyStops.length} stops`);
    }

    if (viasProcessed % 10 === 0) {
      console.log(`\n📊 Progress: ${viasProcessed}/${vias.length} vias processed\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Vias processed: ${viasProcessed}`);
  console.log(`✅ Total associations created: ${totalAssociations}`);
  console.log(`📊 Average stops per via: ${(totalAssociations / viasProcessed).toFixed(1)}`);
  console.log(`⚠️  Vias with < 10 stops: ${viasWithFewStops}`);
  console.log('='.repeat(60) + '\n');

  // 5. Show some examples
  console.log('📋 Sample Via-Paragem Associations:\n');
  
  const sampleVias = await prisma.via.findMany({
    take: 10,
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  for (const via of sampleVias) {
    console.log(`🛣️  ${via.nome}`);
    console.log(`   Stops: ${via.paragens.length}`);
    if (via.paragens.length > 0) {
      const names = via.paragens.map(vp => vp.paragem.nome);
      if (names.length <= 8) {
        console.log(`   ${names.join(' → ')}`);
      } else {
        console.log(`   ${names[0]} → ${names[1]} → ... → ${names[names.length - 2]} → ${names[names.length - 1]}`);
      }
    }
    console.log('');
  }

  console.log('✅ Only stops the route passes through are now associated!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
