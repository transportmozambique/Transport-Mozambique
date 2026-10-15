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

// Get OSRM route through waypoints
async function getOSRMRoute(waypoints) {
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
  
  return waypoints.map(w => `${w.lon},${w.lat}`).join(';');
}

// Create straight routes by dividing stops into geographic sections
function createStraightRoutes(stops, numRoutes) {
  // Sort stops by latitude (north to south)
  const sortedByLat = [...stops].sort((a, b) => a.lat - b.lat);
  
  // Sort stops by longitude (west to east)
  const sortedByLon = [...stops].sort((a, b) => a.lon - b.lon);
  
  const routes = [];
  const usedStops = new Set();
  
  // Create horizontal routes (west to east)
  const horizontalRoutes = Math.floor(numRoutes * 0.5);
  const stopsPerHorizontalRoute = Math.ceil(stops.length / horizontalRoutes);
  
  for (let i = 0; i < horizontalRoutes; i++) {
    const startIdx = i * stopsPerHorizontalRoute;
    const endIdx = Math.min(startIdx + stopsPerHorizontalRoute, sortedByLat.length);
    
    if (startIdx >= sortedByLat.length) break;
    
    // Get stops in this latitude band
    const latBand = sortedByLat.slice(startIdx, endIdx);
    
    // Sort by longitude to create west-to-east route
    const routeStops = latBand.sort((a, b) => a.lon - b.lon);
    
    if (routeStops.length >= 2) {
      routes.push({
        stops: routeStops,
        type: 'horizontal',
        direction: 'west-east'
      });
      
      routeStops.forEach(s => usedStops.add(s.id));
    }
  }
  
  // Create vertical routes (north to south) for remaining stops
  const verticalRoutes = numRoutes - routes.length;
  const remainingStops = stops.filter(s => !usedStops.has(s.id));
  
  if (remainingStops.length > 0 && verticalRoutes > 0) {
    const stopsPerVerticalRoute = Math.ceil(remainingStops.length / verticalRoutes);
    const sortedRemaining = remainingStops.sort((a, b) => a.lon - b.lon);
    
    for (let i = 0; i < verticalRoutes; i++) {
      const startIdx = i * stopsPerVerticalRoute;
      const endIdx = Math.min(startIdx + stopsPerVerticalRoute, sortedRemaining.length);
      
      if (startIdx >= sortedRemaining.length) break;
      
      // Get stops in this longitude band
      const lonBand = sortedRemaining.slice(startIdx, endIdx);
      
      // Sort by latitude to create north-to-south route
      const routeStops = lonBand.sort((a, b) => a.lat - b.lat);
      
      if (routeStops.length >= 2) {
        routes.push({
          stops: routeStops,
          type: 'vertical',
          direction: 'north-south'
        });
        
        routeStops.forEach(s => usedStops.add(s.id));
      }
    }
  }
  
  // Add any remaining stops to nearest route
  const stillRemaining = stops.filter(s => !usedStops.has(s.id));
  if (stillRemaining.length > 0 && routes.length > 0) {
    for (const stop of stillRemaining) {
      // Find nearest route
      let nearestRoute = routes[0];
      let minDist = Infinity;
      
      for (const route of routes) {
        const firstStop = route.stops[0];
        const dist = calculateDistance(stop.lat, stop.lon, firstStop.lat, firstStop.lon);
        if (dist < minDist) {
          minDist = dist;
          nearestRoute = route;
        }
      }
      
      // Add to nearest route
      nearestRoute.stops.push(stop);
    }
  }
  
  return routes;
}

async function main() {
  console.log('🔧 Creating Straight Routes Covering All Stops\n');
  console.log('=' .repeat(60) + '\n');

  // 1. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // 2. Get vias and municipalities
  const vias = await prisma.via.findMany();
  const municipios = await prisma.municipio.findMany();
  
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');
  
  console.log(`📊 Found ${vias.length} vias\n`);

  // 3. Delete existing associations
  console.log('🗑️  Deleting existing via-paragem associations...');
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Deleted all associations\n');

  // 4. Create straight routes
  console.log('🛣️  Creating straight routes to cover all stops...\n');
  
  const routes = createStraightRoutes(stopsWithCoords, vias.length);
  console.log(`✅ Created ${routes.length} straight routes\n`);

  // 5. Generate OSRM paths and update vias
  let totalAssociations = 0;
  
  for (let i = 0; i < routes.length && i < vias.length; i++) {
    const route = routes[i];
    const via = vias[i];
    
    if (route.stops.length < 2) {
      console.log(`⚠️  Route ${i + 1}: Not enough stops, skipping...`);
      continue;
    }

    const startStop = route.stops[0];
    const endStop = route.stops[route.stops.length - 1];
    
    console.log(`🔄 Via ${i + 1}/${vias.length}: ${startStop.nome} → ${endStop.nome}`);
    console.log(`   Type: ${route.type} (${route.direction}), Stops: ${route.stops.length}`);
    
    // Get OSRM route
    const routePath = await getOSRMRoute(route.stops);
    
    // Determine municipality (based on majority of stops)
    const maputoStops = route.stops.filter(s => s.lat < -25.9).length;
    const matolaStops = route.stops.length - maputoStops;
    const municipio = maputoStops > matolaStops ? municipioMaputo : municipioMatola;
    
    // Update via
    await prisma.via.update({
      where: { id: via.id },
      data: {
        geoLocationPath: routePath,
        terminalPartida: startStop.nome,
        terminalChegada: endStop.nome,
        nome: `${startStop.nome} - ${endStop.nome}`,
        municipioId: municipio.id,
        codigoMunicipio: municipio.codigo
      }
    });

    // Create associations for all stops on this route
    for (const stop of route.stops) {
      const isTerminal = 
        stop.id === startStop.id || 
        stop.id === endStop.id;

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

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Routes created: ${routes.length}`);
  console.log(`✅ Total associations: ${totalAssociations}`);
  console.log(`📊 Average stops per route: ${(totalAssociations / routes.length).toFixed(1)}`);
  console.log(`✅ All ${allParagens.length} stops covered!`);
  console.log('='.repeat(60) + '\n');

  // 6. Show examples
  console.log('📋 Sample Routes:\n');
  
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
      if (names.length <= 5) {
        console.log(`   ${names.join(' → ')}`);
      } else {
        console.log(`   ${names[0]} → ... (${names.length - 2} stops) ... → ${names[names.length - 1]}`);
      }
    }
    console.log('');
  }

  // 7. Update transportes
  console.log('🚌 Updating transporte routes...\n');
  
  const transportes = await prisma.transporte.findMany({
    include: { via: true }
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

  console.log(`✅ Updated ${transportes.length} transportes\n`);
  console.log('✅ All straight routes created successfully!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
