const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Calculate distance between two coordinates
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

// Calculate route length from geoLocationPath
function calculateRouteLength(geoLocationPath) {
  if (!geoLocationPath) return 0;
  
  const coordinates = geoLocationPath
    .split(';')
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return { lng, lat };
    })
    .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const from = coordinates[i];
    const to = coordinates[i + 1];
    
    const R = 6371;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance;
}

// Check if a point is near a line segment
function isPointNearPath(point, pathCoords, maxDistance = 0.5) {
  for (let i = 0; i < pathCoords.length - 1; i++) {
    const segStart = pathCoords[i];
    const segEnd = pathCoords[i + 1];
    
    // Calculate distance from point to line segment
    const dist = pointToSegmentDistance(
      point.lat, point.lon,
      segStart.lat, segStart.lon,
      segEnd.lat, segEnd.lon
    );
    
    if (dist <= maxDistance) {
      return true;
    }
  }
  return false;
}

// Calculate distance from point to line segment
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy) * 111; // Convert to km (rough approximation)
}

// Get OSRM route
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

async function main() {
  console.log('🔧 Fixing Routes: Adding Intermediate Stops & Reducing Long Routes\n');
  console.log('=' .repeat(80) + '\n');

  const MAX_ROUTE_LENGTH = 70; // km
  const MAX_LONG_ROUTES = 10; // Only 10 routes can be > 50km

  // 1. Get all vias with their paragens
  const vias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  // 2. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  console.log(`📊 Total vias: ${vias.length}`);
  console.log(`📊 Total stops: ${allParagens.length}\n`);

  // 3. Categorize routes by length
  const routesByLength = vias.map(via => ({
    via,
    length: calculateRouteLength(via.geoLocationPath),
    currentStops: via.paragens.length
  })).sort((a, b) => b.length - a.length);

  const veryLongRoutes = routesByLength.filter(r => r.length > 50);
  const longRoutes = routesByLength.filter(r => r.length > 30 && r.length <= 50);
  const mediumRoutes = routesByLength.filter(r => r.length >= 10 && r.length <= 30);

  console.log(`📊 Routes > 50km: ${veryLongRoutes.length}`);
  console.log(`📊 Routes 30-50km: ${longRoutes.length}`);
  console.log(`📊 Routes 10-30km: ${mediumRoutes.length}\n`);

  // 4. Reduce very long routes (> 50km) to only 10, cap at 70km
  console.log(`🔧 Processing ${veryLongRoutes.length} routes > 50km...\n`);

  const routesToShorten = veryLongRoutes.slice(MAX_LONG_ROUTES); // Routes beyond the first 10
  const routesToKeepLong = veryLongRoutes.slice(0, MAX_LONG_ROUTES);

  // Cap the kept long routes at 70km
  for (let i = 0; i < routesToKeepLong.length; i++) {
    const { via, length, currentStops } = routesToKeepLong[i];
    
    if (length > MAX_ROUTE_LENGTH) {
      console.log(`✂️  Via ${via.codigo}: Capping ${length.toFixed(1)}km → ${MAX_ROUTE_LENGTH}km`);
      
      // Get current stops and reduce to fit 70km
      const stops = via.paragens.map(vp => ({
        ...vp.paragem,
        lat: parseFloat(vp.paragem.geoLocation.split(',')[0]),
        lon: parseFloat(vp.paragem.geoLocation.split(',')[1])
      }));

      // Keep stops until we reach ~70km
      let cumulativeDistance = 0;
      const stopsToKeep = [stops[0]];
      
      for (let j = 1; j < stops.length; j++) {
        const dist = calculateDistance(
          stops[j-1].lat, stops[j-1].lon,
          stops[j].lat, stops[j].lon
        );
        
        if (cumulativeDistance + dist > MAX_ROUTE_LENGTH) {
          stopsToKeep.push(stops[j]); // Add last stop as terminal
          break;
        }
        
        cumulativeDistance += dist;
        stopsToKeep.push(stops[j]);
      }

      // Generate new route
      const newRoutePath = await getOSRMRoute(stopsToKeep);
      
      // Update via
      await prisma.via.update({
        where: { id: via.id },
        data: {
          geoLocationPath: newRoutePath,
          terminalChegada: stopsToKeep[stopsToKeep.length - 1].nome,
          nome: `${stopsToKeep[0].nome} - ${stopsToKeep[stopsToKeep.length - 1].nome}`
        }
      });

      // Delete old associations
      await prisma.viaParagem.deleteMany({
        where: { viaId: via.id }
      });

      // Create new associations
      for (const stop of stopsToKeep) {
        const isTerminal = 
          stop.id === stopsToKeep[0].id || 
          stop.id === stopsToKeep[stopsToKeep.length - 1].id;

        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: via.codigo,
            viaId: via.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
      }

      console.log(`   New stops: ${stopsToKeep.length}, New length: ~${cumulativeDistance.toFixed(1)}km\n`);
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Shorten routes beyond the first 10
  console.log(`\n🔧 Shortening ${routesToShorten.length} routes to 10-30km range...\n`);

  for (let i = 0; i < routesToShorten.length; i++) {
    const { via, length, currentStops } = routesToShorten[i];
    
    console.log(`✂️  Via ${via.codigo}: Shortening ${length.toFixed(1)}km → 10-30km`);
    
    // Get current stops
    const stops = via.paragens.map(vp => ({
      ...vp.paragem,
      lat: parseFloat(vp.paragem.geoLocation.split(',')[0]),
      lon: parseFloat(vp.paragem.geoLocation.split(',')[1])
    }));

    // Keep only stops that fit in 10-30km range
    const targetLength = 15 + Math.random() * 15; // Random between 15-30km
    let cumulativeDistance = 0;
    const stopsToKeep = [stops[0]];
    
    for (let j = 1; j < stops.length; j++) {
      const dist = calculateDistance(
        stops[j-1].lat, stops[j-1].lon,
        stops[j].lat, stops[j].lon
      );
      
      if (cumulativeDistance + dist > targetLength) {
        stopsToKeep.push(stops[j]); // Add last stop as terminal
        break;
      }
      
      cumulativeDistance += dist;
      stopsToKeep.push(stops[j]);
    }

    // Generate new route
    const newRoutePath = await getOSRMRoute(stopsToKeep);
    
    // Update via
    await prisma.via.update({
      where: { id: via.id },
      data: {
        geoLocationPath: newRoutePath,
        terminalChegada: stopsToKeep[stopsToKeep.length - 1].nome,
        nome: `${stopsToKeep[0].nome} - ${stopsToKeep[stopsToKeep.length - 1].nome}`
      }
    });

    // Delete old associations
    await prisma.viaParagem.deleteMany({
      where: { viaId: via.id }
    });

    // Create new associations
    for (const stop of stopsToKeep) {
      const isTerminal = 
        stop.id === stopsToKeep[0].id || 
        stop.id === stopsToKeep[stopsToKeep.length - 1].id;

      await prisma.viaParagem.create({
        data: {
          codigoParagem: stop.codigo,
          codigoVia: via.codigo,
          viaId: via.id,
          paragemId: stop.id,
          terminalBoolean: isTerminal
        }
      });
    }

    console.log(`   New stops: ${stopsToKeep.length}, New length: ~${cumulativeDistance.toFixed(1)}km\n`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // 5. Add intermediate stops to all routes
  console.log(`\n🔧 Adding intermediate stops to all routes...\n`);

  const allViasUpdated = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  let totalStopsAdded = 0;

  for (let i = 0; i < allViasUpdated.length; i++) {
    const via = allViasUpdated[i];
    
    if (!via.geoLocationPath) continue;

    // Parse route path
    const pathCoords = via.geoLocationPath
      .split(';')
      .map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat, lon: lng };
      })
      .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

    // Get current stops
    const currentStopIds = new Set(via.paragens.map(vp => vp.paragemId));

    // Find stops near the path that aren't already on the route
    const nearbyStops = stopsWithCoords.filter(stop => {
      if (currentStopIds.has(stop.id)) return false;
      return isPointNearPath(stop, pathCoords, 0.5); // Within 500m of path
    });

    if (nearbyStops.length > 0) {
      console.log(`➕ Via ${via.codigo}: Adding ${nearbyStops.length} intermediate stops`);
      
      // Add these stops to the route
      for (const stop of nearbyStops) {
        try {
          await prisma.viaParagem.create({
            data: {
              codigoParagem: stop.codigo,
              codigoVia: via.codigo,
              viaId: via.id,
              paragemId: stop.id,
              terminalBoolean: false
            }
          });
          totalStopsAdded++;
        } catch (error) {
          // Ignore duplicates
        }
      }
    }

    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Added ${totalStopsAdded} intermediate stops\n`);

  // 6. Final verification
  console.log('='.repeat(80));
  console.log('📊 FINAL VERIFICATION');
  console.log('='.repeat(80));

  const finalVias = await prisma.via.findMany({
    include: {
      _count: {
        select: { paragens: true }
      }
    }
  });

  let routesOver70km = 0;
  let routes50to70km = 0;
  let routes30to50km = 0;
  let routes10to30km = 0;
  let routesUnder10km = 0;

  for (const via of finalVias) {
    const length = calculateRouteLength(via.geoLocationPath);
    
    if (length > 70) routesOver70km++;
    else if (length > 50) routes50to70km++;
    else if (length > 30) routes30to50km++;
    else if (length >= 10) routes10to30km++;
    else routesUnder10km++;
  }

  const totalStopsCovered = finalVias.reduce((sum, v) => sum + v._count.paragens, 0);
  const uniqueStopsCovered = new Set();
  
  for (const via of await prisma.via.findMany({ include: { paragens: true } })) {
    via.paragens.forEach(vp => uniqueStopsCovered.add(vp.paragemId));
  }

  console.log(`✅ Routes > 70km: ${routesOver70km}`);
  console.log(`✅ Routes 50-70km: ${routes50to70km} (target: max ${MAX_LONG_ROUTES})`);
  console.log(`📊 Routes 30-50km: ${routes30to50km}`);
  console.log(`📊 Routes 10-30km: ${routes10to30km}`);
  console.log(`⚠️  Routes < 10km: ${routesUnder10km}`);
  console.log(`\n📊 Total stop associations: ${totalStopsCovered}`);
  console.log(`📊 Unique stops covered: ${uniqueStopsCovered.size}/${allParagens.length}`);
  console.log('='.repeat(80) + '\n');

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
  console.log('✅ Route optimization complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
