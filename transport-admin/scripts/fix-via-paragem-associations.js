const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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
  
  // Check distance to each point on the route
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
  
  // Return normalized position (0 to 1)
  return closestIndex / (pathCoords.length - 1);
}

async function main() {
  console.log('🔧 Fixing Via-Paragem Associations\n');
  console.log('=' .repeat(60) + '\n');

  // 1. Get all vias
  const vias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });
  
  console.log(`📊 Found ${vias.length} vias\n`);

  // 2. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  // 3. Delete all existing associations
  console.log('🗑️  Deleting existing via-paragem associations...');
  const deleted = await prisma.viaParagem.deleteMany({});
  console.log(`✅ Deleted ${deleted.count} associations\n`);

  // 4. Recreate associations with better logic
  console.log('🔗 Creating new associations with improved algorithm...\n');
  
  const MAX_DISTANCE_KM = 0.25; // 250 meters - better balance for urban areas
  let totalAssociations = 0;
  let viasWithNoStops = 0;
  let viasWithFewStops = 0;

  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    
    if (!via.geoLocationPath) {
      console.log(`⚠️  Via ${via.nome} has no route path, skipping...`);
      continue;
    }

    // Find all stops within distance threshold
    const nearbyStops = [];
    
    for (const paragem of allParagens) {
      const [lat, lon] = paragem.geoLocation.split(',').map(Number);
      const minDist = minDistanceToRoute(lat, lon, via.geoLocationPath);
      
      if (minDist <= MAX_DISTANCE_KM) {
        const position = findStopPositionOnRoute(lat, lon, via.geoLocationPath);
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
    const startTerminal = allParagens.find(p => p.nome === via.terminalPartida);
    const endTerminal = allParagens.find(p => p.nome === via.terminalChegada);

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

    // Track statistics
    if (nearbyStops.length === 0) {
      viasWithNoStops++;
      console.log(`⚠️  Via ${via.nome}: NO STOPS FOUND`);
    } else if (nearbyStops.length < 3) {
      viasWithFewStops++;
      console.log(`⚠️  Via ${via.nome}: Only ${nearbyStops.length} stops`);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`✅ Processed ${i + 1}/${vias.length} vias...`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Total associations created: ${totalAssociations}`);
  console.log(`📊 Average stops per via: ${(totalAssociations / vias.length).toFixed(1)}`);
  console.log(`⚠️  Vias with no stops: ${viasWithNoStops}`);
  console.log(`⚠️  Vias with < 3 stops: ${viasWithFewStops}`);
  console.log(`✅ Vias with good coverage: ${vias.length - viasWithNoStops - viasWithFewStops}`);
  console.log('='.repeat(60) + '\n');

  // 5. Show some examples
  console.log('📋 Sample Via-Paragem Associations:\n');
  
  const sampleVias = await prisma.via.findMany({
    take: 5,
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
      console.log(`   Route: ${via.paragens.map(vp => vp.paragem.nome).join(' → ')}`);
    }
    console.log('');
  }

  console.log('✅ Via-Paragem associations fixed!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
