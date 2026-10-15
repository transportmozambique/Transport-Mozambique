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
  console.log('🔧 Extending Very Short Routes (< 10km) to 10-30km\n');
  console.log('=' .repeat(80) + '\n');

  const MIN_ROUTE_LENGTH = 10; // km
  const TARGET_MIN_LENGTH = 10; // km
  const TARGET_MAX_LENGTH = 30; // km

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

  // 2. Get all paragens for finding extension points
  const allParagens = await prisma.paragem.findMany();
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // 3. Identify very short routes
  const veryShortRoutes = [];
  const okRoutes = [];

  for (const via of vias) {
    const routeLength = calculateRouteLength(via.geoLocationPath);
    if (routeLength < MIN_ROUTE_LENGTH) {
      veryShortRoutes.push({ via, routeLength });
    } else {
      okRoutes.push({ via, routeLength });
    }
  }

  console.log(`✅ Routes >= ${MIN_ROUTE_LENGTH}km: ${okRoutes.length}`);
  console.log(`⚠️  Routes < ${MIN_ROUTE_LENGTH}km: ${veryShortRoutes.length}\n`);

  if (veryShortRoutes.length === 0) {
    console.log('🎉 All routes are already >= 10km!\n');
    return;
  }

  console.log(`🔧 Extending ${veryShortRoutes.length} very short routes to ${TARGET_MIN_LENGTH}-${TARGET_MAX_LENGTH}km...\n`);

  let extendedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < veryShortRoutes.length; i++) {
    const { via, routeLength } = veryShortRoutes[i];
    
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

    // Find points that would extend the route to 10-30km range
    const targetExtension = TARGET_MIN_LENGTH + Math.random() * (TARGET_MAX_LENGTH - TARGET_MIN_LENGTH);
    const neededDistance = targetExtension - routeLength;

    let bestPoint = null;
    let bestDistance = Infinity;

    for (const stop of stopsWithCoords) {
      // Skip if already in current route
      if (currentStops.some(s => s.id === stop.id)) continue;

      const distToFirst = calculateDistance(firstStop.lat, firstStop.lon, stop.lat, stop.lon);
      const distToLast = calculateDistance(lastStop.lat, lastStop.lon, stop.lat, stop.lon);
      const minDist = Math.min(distToFirst, distToLast);
      
      // Find point closest to our target distance
      const distDiff = Math.abs(minDist - neededDistance);
      if (distDiff < bestDistance) {
        bestDistance = distDiff;
        bestPoint = { stop, distToFirst, distToLast };
      }
    }

    if (!bestPoint) {
      console.log(`⚠️  Via ${via.codigo}: Could not find extension point, skipping...`);
      failedCount++;
      continue;
    }

    // Determine which end to extend from
    let newWaypoints;
    let newTerminalPartida;
    let newTerminalChegada;

    if (bestPoint.distToFirst < bestPoint.distToLast) {
      // Extend from the beginning
      newWaypoints = [bestPoint.stop, ...currentStops];
      newTerminalPartida = bestPoint.stop.nome;
      newTerminalChegada = lastStop.nome;
    } else {
      // Extend from the end
      newWaypoints = [...currentStops, bestPoint.stop];
      newTerminalPartida = firstStop.nome;
      newTerminalChegada = bestPoint.stop.nome;
    }

    // Calculate estimated new length
    const estimatedNewLength = routeLength + Math.min(bestPoint.distToFirst, bestPoint.distToLast);

    console.log(`🔄 Via ${(i + 1).toString().padStart(3)}/${veryShortRoutes.length} (${via.codigo}): ${routeLength.toFixed(1)}km → ~${estimatedNewLength.toFixed(1)}km`);
    console.log(`   ${newTerminalPartida.substring(0, 35)} → ${newTerminalChegada.substring(0, 35)}`);

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

  let routesOver10km = 0;
  let routesUnder10km = 0;
  let routesOver30km = 0;
  const under10List = [];
  const lengthDistribution = {
    '0-5km': 0,
    '5-10km': 0,
    '10-20km': 0,
    '20-30km': 0,
    '30-50km': 0,
    '50km+': 0
  };

  for (const via of updatedVias) {
    const length = calculateRouteLength(via.geoLocationPath);
    
    if (length >= MIN_ROUTE_LENGTH) {
      routesOver10km++;
    } else {
      routesUnder10km++;
      under10List.push({ codigo: via.codigo, length });
    }

    if (length >= 30) {
      routesOver30km++;
    }

    // Distribution
    if (length < 5) lengthDistribution['0-5km']++;
    else if (length < 10) lengthDistribution['5-10km']++;
    else if (length < 20) lengthDistribution['10-20km']++;
    else if (length < 30) lengthDistribution['20-30km']++;
    else if (length < 50) lengthDistribution['30-50km']++;
    else lengthDistribution['50km+']++;
  }

  console.log('='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Routes >= ${MIN_ROUTE_LENGTH}km: ${routesOver10km}`);
  console.log(`⚠️  Routes < ${MIN_ROUTE_LENGTH}km: ${routesUnder10km}`);
  console.log(`📊 Routes >= 30km: ${routesOver30km}`);

  console.log('\n📊 Length Distribution:');
  Object.entries(lengthDistribution).forEach(([range, count]) => {
    const bar = '█'.repeat(Math.floor(count / 2));
    console.log(`   ${range.padEnd(10)}: ${count.toString().padStart(3)} ${bar}`);
  });

  if (under10List.length > 0 && under10List.length <= 20) {
    console.log(`\n⚠️  Routes still under ${MIN_ROUTE_LENGTH}km:`);
    under10List.forEach(r => {
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
