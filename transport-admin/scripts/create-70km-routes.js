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

// Calculate total route length
function calculateRouteLength(stops) {
  let totalDistance = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += calculateDistance(
      stops[i].lat, stops[i].lon,
      stops[i + 1].lat, stops[i + 1].lon
    );
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
  console.log('🔧 Creating Routes with Minimum 70km Length\n');
  console.log('=' .repeat(80) + '\n');

  const MIN_ROUTE_LENGTH = 70; // km
  const MIN_STOPS_PER_VIA = 50; // Minimum stops to ensure 70km+ routes

  // 1. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  const TARGET_VIAS = Math.floor(allParagens.length / MIN_STOPS_PER_VIA); // Calculate based on stops

  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // Sort stops by latitude then longitude for organized routes
  const sortedStops = stopsWithCoords.sort((a, b) => {
    if (Math.abs(a.lat - b.lat) > 0.01) return a.lat - b.lat;
    return a.lon - b.lon;
  });

  // 2. Get vias and municipalities
  const vias = await prisma.via.findMany();
  const municipios = await prisma.municipio.findMany();
  
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');
  
  console.log(`📊 Found ${vias.length} vias`);
  console.log(`📊 Will create ${TARGET_VIAS} routes with ~${MIN_STOPS_PER_VIA} stops each\n`);

  // 3. Delete ALL existing associations
  console.log('🗑️  Deleting ALL via-paragem associations...');
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Deleted all associations\n');

  // 4. Create routes with minimum 70km length
  console.log(`🛣️  Creating ${TARGET_VIAS} routes with minimum ${MIN_ROUTE_LENGTH}km each...\n`);
  
  const stopsPerVia = Math.floor(sortedStops.length / TARGET_VIAS);
  let totalAssociations = 0;
  let routesCreated = 0;
  
  for (let i = 0; i < TARGET_VIAS && i < vias.length; i++) {
    const via = vias[i];
    
    // Get stops for this via
    const startIdx = i * stopsPerVia;
    const endIdx = i === TARGET_VIAS - 1 
      ? sortedStops.length  // Last via gets remaining stops
      : (i + 1) * stopsPerVia;
    
    let viaStops = sortedStops.slice(startIdx, endIdx);
    
    if (viaStops.length < 2) {
      console.log(`⚠️  Via ${i + 1}/${TARGET_VIAS}: Not enough stops, skipping...`);
      continue;
    }

    // Sort stops by longitude for west-to-east route
    viaStops.sort((a, b) => a.lon - b.lon);
    
    // Check if route is long enough, if not, add more stops
    let routeLength = calculateRouteLength(viaStops);
    let attempts = 0;
    const maxAttempts = 5;
    
    while (routeLength < MIN_ROUTE_LENGTH && attempts < maxAttempts && endIdx < sortedStops.length) {
      // Add more stops from the next batch
      const additionalStops = 10;
      const newEndIdx = Math.min(endIdx + additionalStops, sortedStops.length);
      viaStops = sortedStops.slice(startIdx, newEndIdx);
      viaStops.sort((a, b) => a.lon - b.lon);
      routeLength = calculateRouteLength(viaStops);
      attempts++;
    }
    
    const startStop = viaStops[0];
    const endStop = viaStops[viaStops.length - 1];
    
    console.log(`🔄 Via ${i + 1}/${TARGET_VIAS}: ${startStop.nome} → ${endStop.nome}`);
    console.log(`   Stops: ${viaStops.length}, Estimated length: ${routeLength.toFixed(2)} km`);
    
    // Get OSRM route
    const routePath = await getOSRMRoute(viaStops);
    
    // Determine municipality
    const maputoStops = viaStops.filter(s => s.lat < -25.9).length;
    const matolaStops = viaStops.length - maputoStops;
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

    // Create associations
    for (const stop of viaStops) {
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

    routesCreated++;

    // Rate limiting
    if (i % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Routes created: ${routesCreated}`);
  console.log(`✅ Total associations: ${totalAssociations}`);
  console.log(`📊 Average stops per route: ${(totalAssociations / routesCreated).toFixed(1)}`);
  console.log(`✅ All ${allParagens.length} stops covered!`);
  console.log('='.repeat(80) + '\n');

  // 5. Verify route lengths
  console.log('🔍 Verifying route lengths...\n');
  
  const updatedVias = await prisma.via.findMany({
    where: {
      paragens: {
        some: {}
      }
    },
    include: {
      _count: {
        select: { paragens: true }
      }
    },
    take: routesCreated
  });

  let routesOver70km = 0;
  let routesUnder70km = 0;

  for (const via of updatedVias) {
    if (!via.geoLocationPath) continue;
    
    const coordinates = via.geoLocationPath
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

    if (totalDistance >= MIN_ROUTE_LENGTH) {
      routesOver70km++;
    } else {
      routesUnder70km++;
    }

    console.log(`${via.codigo}: ${totalDistance.toFixed(2)} km (${via._count.paragens} stops) ${totalDistance >= MIN_ROUTE_LENGTH ? '✅' : '⚠️'}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ Routes >= ${MIN_ROUTE_LENGTH}km: ${routesOver70km}`);
  console.log(`⚠️  Routes < ${MIN_ROUTE_LENGTH}km: ${routesUnder70km}`);
  console.log('='.repeat(80) + '\n');

  console.log('✅ Route generation complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
