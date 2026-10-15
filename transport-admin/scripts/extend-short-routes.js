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
  console.log('🔧 Extending Short Routes to 70km+\n');
  console.log('=' .repeat(80) + '\n');

  const MIN_ROUTE_LENGTH = 70; // km

  // 1. Get all vias with their paragens
  const vias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        },
        orderBy: {
          id: 'asc'
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total vias: ${vias.length}\n`);

  // 2. Get all paragens for finding distant points
  const allParagens = await prisma.paragem.findMany();
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // 3. Identify short routes
  const shortRoutes = [];
  const longRoutes = [];

  for (const via of vias) {
    const routeLength = calculateRouteLength(via.geoLocationPath);
    if (routeLength < MIN_ROUTE_LENGTH) {
      shortRoutes.push({ via, routeLength });
    } else {
      longRoutes.push({ via, routeLength });
    }
  }

  console.log(`✅ Routes >= ${MIN_ROUTE_LENGTH}km: ${longRoutes.length}`);
  console.log(`⚠️  Routes < ${MIN_ROUTE_LENGTH}km: ${shortRoutes.length}\n`);

  if (shortRoutes.length === 0) {
    console.log('🎉 All routes are already >= 70km!\n');
    return;
  }

  console.log(`🔧 Extending ${shortRoutes.length} short routes...\n`);

  let extendedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < shortRoutes.length; i++) {
    const { via, routeLength } = shortRoutes[i];
    
    if (via.paragens.length === 0) {
      console.log(`⚠️  Via ${via.codigo}: No paragens, skipping...`);
      failedCount++;
      continue;
    }

    // Get current stops
    const currentStops = via.paragens.map(vp => ({
      ...vp.paragem,
      lat: parseFloat(vp.paragem.geoLocation.split(',')[0]),
      lon: parseFloat(vp.paragem.geoLocation.split(',')[1])
    }));

    const firstStop = currentStops[0];
    const lastStop = currentStops[currentStops.length - 1];

    // Find the most distant point from both terminals
    let maxDistance = 0;
    let distantPoint = null;

    for (const stop of stopsWithCoords) {
      const distToFirst = calculateDistance(firstStop.lat, firstStop.lon, stop.lat, stop.lon);
      const distToLast = calculateDistance(lastStop.lat, lastStop.lon, stop.lat, stop.lon);
      const minDist = Math.min(distToFirst, distToLast);
      
      if (minDist > maxDistance) {
        maxDistance = minDist;
        distantPoint = stop;
      }
    }

    if (!distantPoint) {
      console.log(`⚠️  Via ${via.codigo}: Could not find distant point, skipping...`);
      failedCount++;
      continue;
    }

    // Determine which end to extend from
    const distToFirst = calculateDistance(firstStop.lat, firstStop.lon, distantPoint.lat, distantPoint.lon);
    const distToLast = calculateDistance(lastStop.lat, lastStop.lon, distantPoint.lat, distantPoint.lon);

    let newWaypoints;
    let newTerminalPartida;
    let newTerminalChegada;

    if (distToFirst > distToLast) {
      // Extend from the beginning
      newWaypoints = [distantPoint, ...currentStops];
      newTerminalPartida = distantPoint.nome;
      newTerminalChegada = lastStop.nome;
    } else {
      // Extend from the end
      newWaypoints = [...currentStops, distantPoint];
      newTerminalPartida = firstStop.nome;
      newTerminalChegada = distantPoint.nome;
    }

    // Calculate estimated new length
    let estimatedNewLength = routeLength;
    if (distToFirst > distToLast) {
      estimatedNewLength += distToFirst;
    } else {
      estimatedNewLength += distToLast;
    }

    console.log(`🔄 Via ${(i + 1).toString().padStart(3)}/${shortRoutes.length} (${via.codigo}): ${routeLength.toFixed(1)}km → ~${estimatedNewLength.toFixed(1)}km`);
    console.log(`   ${newTerminalPartida.substring(0, 30)} → ${newTerminalChegada.substring(0, 30)}`);

    // Get new OSRM route
    const newRoutePath = await getOSRMRoute(newWaypoints);

    // Update via
    await prisma.via.update({
      where: { id: via.id },
      data: {
        geoLocationPath: newRoutePath,
        terminalPartida: newTerminalPartida,
        terminalChegada: newTerminalChegada,
        nome: `${newTerminalPartida} - ${newTerminalChegada}`
      }
    });

    extendedCount++;

    // Rate limiting
    if (i % 5 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 EXTENSION SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Routes extended: ${extendedCount}`);
  console.log(`❌ Failed to extend: ${failedCount}`);
  console.log('='.repeat(80) + '\n');

  // 4. Verify new route lengths
  console.log('🔍 Verifying new route lengths...\n');

  const updatedVias = await prisma.via.findMany({
    orderBy: { codigo: 'asc' }
  });

  let routesOver70km = 0;
  let routesUnder70km = 0;
  const under70List = [];

  for (const via of updatedVias) {
    const length = calculateRouteLength(via.geoLocationPath);
    
    if (length >= MIN_ROUTE_LENGTH) {
      routesOver70km++;
    } else {
      routesUnder70km++;
      under70List.push({ codigo: via.codigo, length });
    }
  }

  console.log('='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Routes >= ${MIN_ROUTE_LENGTH}km: ${routesOver70km}`);
  console.log(`⚠️  Routes < ${MIN_ROUTE_LENGTH}km: ${routesUnder70km}`);

  if (under70List.length > 0 && under70List.length <= 20) {
    console.log(`\n⚠️  Routes still under ${MIN_ROUTE_LENGTH}km:`);
    under70List.forEach(r => {
      console.log(`   ${r.codigo}: ${r.length.toFixed(1)} km`);
    });
  }

  console.log('='.repeat(80) + '\n');

  // 5. Update transportes
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
  console.log('✅ Route extension complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
