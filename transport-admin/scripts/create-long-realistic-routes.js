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

// Calculate total route distance
function calculateRouteDistance(stops) {
  let totalDistance = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += calculateDistance(
      stops[i].lat, stops[i].lon,
      stops[i + 1].lat, stops[i + 1].lon
    );
  }
  return totalDistance;
}

// Get OSRM route through multiple waypoints
async function getOSRMRouteMultipleWaypoints(waypoints) {
  try {
    // OSRM has a limit, so we'll sample waypoints if too many
    const maxWaypoints = 100;
    let sampledWaypoints = waypoints;
    
    if (waypoints.length > maxWaypoints) {
      // Keep first, last, and evenly sample the middle
      const step = Math.floor((waypoints.length - 2) / (maxWaypoints - 2));
      sampledWaypoints = [waypoints[0]];
      for (let i = step; i < waypoints.length - 1; i += step) {
        sampledWaypoints.push(waypoints[i]);
      }
      sampledWaypoints.push(waypoints[waypoints.length - 1]);
    }
    
    const coords = sampledWaypoints.map(w => `${w.lon},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      const routeDistance = data.routes[0].distance / 1000; // Convert to km
      return {
        path: coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';'),
        distance: routeDistance
      };
    }
  } catch (error) {
    console.log(`⚠️  OSRM failed: ${error.message}`);
  }
  
  // Fallback: connect waypoints directly
  const path = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
  const distance = calculateRouteDistance(waypoints);
  return { path, distance };
}

// Create a long route covering many stops
function createLongRoute(allStops, minDistanceKm = 100, minStops = 50) {
  const visitedStops = new Set();
  const routeStops = [];
  
  // Pick a random starting stop
  const startIdx = Math.floor(Math.random() * allStops.length);
  let currentStop = allStops[startIdx];
  
  routeStops.push(currentStop);
  visitedStops.add(currentStop.id);
  
  let totalDistance = 0;
  
  // Keep adding stops until we reach minimum distance and stops
  while (totalDistance < minDistanceKm || routeStops.length < minStops) {
    // Find next stop within reasonable distance (2-5 km away)
    const candidates = allStops.filter(stop => {
      if (visitedStops.has(stop.id)) return false;
      
      const distance = calculateDistance(
        currentStop.lat, currentStop.lon,
        stop.lat, stop.lon
      );
      
      return distance >= 1 && distance <= 5; // 1-5 km away
    });
    
    if (candidates.length === 0) {
      // If no candidates in range, pick any unvisited stop
      const unvisited = allStops.filter(s => !visitedStops.has(s.id));
      if (unvisited.length === 0) break;
      
      // Pick a random unvisited stop
      const nextStop = unvisited[Math.floor(Math.random() * unvisited.length)];
      const distance = calculateDistance(
        currentStop.lat, currentStop.lon,
        nextStop.lat, nextStop.lon
      );
      
      routeStops.push(nextStop);
      visitedStops.add(nextStop.id);
      totalDistance += distance;
      currentStop = nextStop;
    } else {
      // Pick a random candidate
      const nextStop = candidates[Math.floor(Math.random() * candidates.length)];
      const distance = calculateDistance(
        currentStop.lat, currentStop.lon,
        nextStop.lat, nextStop.lon
      );
      
      routeStops.push(nextStop);
      visitedStops.add(nextStop.id);
      totalDistance += distance;
      currentStop = nextStop;
    }
    
    // Safety limit
    if (routeStops.length > 200) break;
  }
  
  return { stops: routeStops, estimatedDistance: totalDistance };
}

async function main() {
  console.log('🔧 Creating Long Realistic Routes (100+ km each)\n');
  console.log('=' .repeat(60) + '\n');

  // 1. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  // Parse coordinates
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // Separate Maputo and Matola stops (approximate)
  const maputoStops = stopsWithCoords.filter(s => s.lat < -25.9);
  const matolaStops = stopsWithCoords.filter(s => s.lat >= -25.9);
  
  console.log(`📍 Maputo stops: ${maputoStops.length}`);
  console.log(`📍 Matola stops: ${matolaStops.length}\n`);

  // 2. Get all vias and municipalities
  const vias = await prisma.via.findMany();
  const municipios = await prisma.municipio.findMany();
  
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');
  
  console.log(`📊 Found ${vias.length} vias\n`);

  // 3. Delete existing via-paragem associations
  console.log('🗑️  Deleting existing via-paragem associations...');
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Deleted all associations\n');

  // 4. Generate long routes
  console.log('🛣️  Generating long realistic routes (100+ km each)...\n');
  
  const MIN_DISTANCE_KM = 100;
  const MIN_STOPS = 50;
  let totalAssociations = 0;
  let totalRouteDistance = 0;

  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    
    // Alternate between Maputo and Matola, with some cross-city routes
    let availableStops;
    let municipio;
    
    if (i % 3 === 0) {
      // Cross-city route (use all stops)
      availableStops = stopsWithCoords;
      municipio = i % 2 === 0 ? municipioMaputo : municipioMatola;
    } else if (i % 2 === 0) {
      // Maputo route
      availableStops = maputoStops.length > 0 ? maputoStops : stopsWithCoords;
      municipio = municipioMaputo;
    } else {
      // Matola route
      availableStops = matolaStops.length > 0 ? matolaStops : stopsWithCoords;
      municipio = municipioMatola;
    }
    
    // Create a long route
    const { stops: routeStops, estimatedDistance } = createLongRoute(
      availableStops, 
      MIN_DISTANCE_KM, 
      MIN_STOPS
    );
    
    if (routeStops.length < 10) {
      console.log(`⚠️  Via ${i + 1}/${vias.length}: Not enough stops, skipping...`);
      continue;
    }

    console.log(`🔄 Via ${i + 1}/${vias.length}: ${routeStops[0].nome} → ${routeStops[routeStops.length - 1].nome}`);
    console.log(`   Stops: ${routeStops.length}, Est. Distance: ${estimatedDistance.toFixed(1)} km`);
    
    // Get OSRM route
    const { path: routePath, distance: actualDistance } = await getOSRMRouteMultipleWaypoints(routeStops);
    
    console.log(`   Actual Distance: ${actualDistance.toFixed(1)} km\n`);
    totalRouteDistance += actualDistance;
    
    // Update via with new route
    await prisma.via.update({
      where: { id: via.id },
      data: {
        geoLocationPath: routePath,
        terminalPartida: routeStops[0].nome,
        terminalChegada: routeStops[routeStops.length - 1].nome,
        nome: `${routeStops[0].nome} - ${routeStops[routeStops.length - 1].nome}`,
        municipioId: municipio.id,
        codigoMunicipio: municipio.codigo
      }
    });

    // Create via-paragem associations
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
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Total vias updated: ${vias.length}`);
  console.log(`✅ Total associations created: ${totalAssociations}`);
  console.log(`📊 Average stops per via: ${(totalAssociations / vias.length).toFixed(1)}`);
  console.log(`📏 Total route distance: ${totalRouteDistance.toFixed(1)} km`);
  console.log(`📏 Average route distance: ${(totalRouteDistance / vias.length).toFixed(1)} km`);
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
      console.log(`   ${stopNames[0]} → ... (${stopNames.length - 2} stops) ... → ${stopNames[stopNames.length - 1]}`);
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
  console.log('✅ All long realistic routes created successfully!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
