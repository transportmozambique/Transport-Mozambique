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

// Get OSRM route through multiple waypoints
async function getOSRMRouteMultipleWaypoints(waypoints) {
  try {
    const coords = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      return coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
    }
  } catch (error) {
    console.log(`⚠️  OSRM failed: ${error.message}`);
  }
  
  // Fallback: connect waypoints directly
  return waypoints.map(w => `${w.lon},${w.lat}`).join(';');
}

// Find nearest unvisited stop
function findNearestStop(currentStop, availableStops, visitedStops) {
  let nearest = null;
  let minDistance = Infinity;
  
  for (const stop of availableStops) {
    if (visitedStops.has(stop.id)) continue;
    
    const distance = calculateDistance(
      currentStop.lat, currentStop.lon,
      stop.lat, stop.lon
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = stop;
    }
  }
  
  return nearest;
}

// Create a route that visits multiple stops
function createRouteWithStops(allStops, numStops = 10) {
  const visitedStops = new Set();
  const routeStops = [];
  
  // Pick a random starting stop
  const startIdx = Math.floor(Math.random() * allStops.length);
  let currentStop = allStops[startIdx];
  
  routeStops.push(currentStop);
  visitedStops.add(currentStop.id);
  
  // Add stops using nearest neighbor
  for (let i = 1; i < numStops; i++) {
    const nextStop = findNearestStop(currentStop, allStops, visitedStops);
    if (!nextStop) break;
    
    routeStops.push(nextStop);
    visitedStops.add(nextStop.id);
    currentStop = nextStop;
  }
  
  return routeStops;
}

async function main() {
  console.log('🔧 Regenerating Routes to Pass Through Stops\n');
  console.log('=' .repeat(60) + '\n');

  // 1. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  // Parse coordinates
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // 2. Get all vias
  const vias = await prisma.via.findMany();
  console.log(`📊 Found ${vias.length} vias\n`);

  // 3. Delete existing via-paragem associations
  console.log('🗑️  Deleting existing via-paragem associations...');
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Deleted all associations\n');

  // 4. Regenerate each via with a route through multiple stops
  console.log('🛣️  Regenerating routes through multiple stops...\n');
  
  const STOPS_PER_ROUTE = 8; // Each route will pass through 8-12 stops
  let totalAssociations = 0;

  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    
    // Create a route with multiple stops
    const numStops = STOPS_PER_ROUTE + Math.floor(Math.random() * 5); // 8-12 stops
    const routeStops = createRouteWithStops(stopsWithCoords, numStops);
    
    if (routeStops.length < 2) {
      console.log(`⚠️  Via ${via.nome}: Not enough stops, skipping...`);
      continue;
    }

    // Get OSRM route through all waypoints
    console.log(`🔄 Via ${i + 1}/${vias.length}: ${routeStops[0].nome} → ... → ${routeStops[routeStops.length - 1].nome} (${routeStops.length} stops)`);
    
    // OSRM has a limit of ~100 waypoints, so we'll use key stops
    const waypointsForOSRM = routeStops.length > 25 
      ? [routeStops[0], ...routeStops.filter((_, idx) => idx % 3 === 0).slice(1, -1), routeStops[routeStops.length - 1]]
      : routeStops;
    
    const routePath = await getOSRMRouteMultipleWaypoints(waypointsForOSRM);
    
    // Update via with new route
    await prisma.via.update({
      where: { id: via.id },
      data: {
        geoLocationPath: routePath,
        terminalPartida: routeStops[0].nome,
        terminalChegada: routeStops[routeStops.length - 1].nome,
        nome: `${routeStops[0].nome} - ${routeStops[routeStops.length - 1].nome}`
      }
    });

    // Create via-paragem associations for all stops on this route
    for (const stop of routeStops) {
      const isTerminal = 
        stop.id === routeStops[0].id || 
        stop.id === routeStops[routeStops.length - 1].id;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: via.codigo,
            viaId: via.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
        totalAssociations++;
      } catch (error) {
        // Ignore duplicates
      }
    }

    // Rate limiting for OSRM
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Total vias updated: ${vias.length}`);
  console.log(`✅ Total associations created: ${totalAssociations}`);
  console.log(`📊 Average stops per via: ${(totalAssociations / vias.length).toFixed(1)}`);
  console.log('='.repeat(60) + '\n');

  // 5. Show some examples
  console.log('📋 Sample Routes:\n');
  
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
      const stopNames = via.paragens.map(vp => vp.paragem.nome);
      if (stopNames.length <= 5) {
        console.log(`   Route: ${stopNames.join(' → ')}`);
      } else {
        console.log(`   Route: ${stopNames[0]} → ... (${stopNames.length - 2} stops) ... → ${stopNames[stopNames.length - 1]}`);
      }
    }
    console.log('');
  }

  // 6. Update transportes with new route paths
  console.log('🚌 Updating transporte routes...\n');
  
  const transportes = await prisma.transporte.findMany({
    include: {
      via: true
    }
  });

  for (const transporte of transportes) {
    if (transporte.via && transporte.via.geoLocationPath) {
      await prisma.transporte.update({
        where: { id: transporte.id },
        data: {
          routePath: transporte.via.geoLocationPath,
          currGeoLocation: transporte.via.geoLocationPath.split(';')[0]
        }
      });
    }
  }

  console.log(`✅ Updated ${transportes.length} transportes with new routes\n`);
  console.log('✅ All routes regenerated successfully!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
