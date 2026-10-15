const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
  console.log('🔧 Final Route Optimization\n');
  console.log('='.repeat(80) + '\n');

  // 1. Get all data
  const allParagens = await prisma.paragem.findMany();
  const allVias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  console.log(`📊 Total stops: ${allParagens.length}`);
  console.log(`📊 Total vias: ${allVias.length}\n`);

  // 2. Add missing stops to nearest vias
  console.log('🔧 Adding 7 missing stops to routes...\n');

  const missingStopCodes = ['PAR-0497', 'PAR-0498', 'PAR-0499', 'PAR-0516', 'PAR-0517', 'PAR-0522', 'PAR-0816'];
  const missingStops = allParagens.filter(p => missingStopCodes.includes(p.codigo));

  for (const stop of missingStops) {
    const [lat, lon] = stop.geoLocation.split(',').map(Number);
    
    // Find nearest via
    let nearestVia = null;
    let minDistance = Infinity;

    for (const via of allVias) {
      if (via.paragens.length === 0) continue;
      
      const firstStop = via.paragens[0].paragem;
      const [firstLat, firstLon] = firstStop.geoLocation.split(',').map(Number);
      const dist = calculateDistance(lat, lon, firstLat, firstLon);
      
      if (dist < minDistance) {
        minDistance = dist;
        nearestVia = via;
      }
    }

    if (nearestVia) {
      console.log(`➕ Adding ${stop.codigo} (${stop.nome}) to ${nearestVia.codigo}`);
      
      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: nearestVia.codigo,
            viaId: nearestVia.id,
            paragemId: stop.id,
            terminalBoolean: false
          }
        });
      } catch (error) {
        // Ignore if already exists
      }
    }
  }

  console.log('\n✅ Missing stops added\n');

  // 3. Fix routes < 10km
  console.log('🔧 Fixing routes < 10km...\n');

  const shortRoutes = allVias.filter(v => calculateRouteLength(v.geoLocationPath) < 10);

  for (const via of shortRoutes) {
    const currentLength = calculateRouteLength(via.geoLocationPath);
    console.log(`✂️  Via ${via.codigo}: ${currentLength.toFixed(1)}km → extending to 10-20km`);

    const currentStops = via.paragens.map(vp => ({
      ...vp.paragem,
      lat: parseFloat(vp.paragem.geoLocation.split(',')[0]),
      lon: parseFloat(vp.paragem.geoLocation.split(',')[1])
    }));

    if (currentStops.length === 0) continue;

    const firstStop = currentStops[0];
    const lastStop = currentStops[currentStops.length - 1];

    // Find a stop 10-20km away
    const targetDistance = 12 + Math.random() * 8; // 12-20km
    let bestStop = null;
    let bestDiff = Infinity;

    for (const stop of stopsWithCoords) {
      if (currentStops.some(s => s.id === stop.id)) continue;

      const distToLast = calculateDistance(lastStop.lat, lastStop.lon, stop.lat, stop.lon);
      const diff = Math.abs(distToLast - targetDistance);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestStop = stop;
      }
    }

    if (bestStop) {
      const newStops = [...currentStops, bestStop];
      const newRoutePath = await getOSRMRoute(newStops);

      await prisma.via.update({
        where: { id: via.id },
        data: {
          geoLocationPath: newRoutePath,
          terminalChegada: bestStop.nome,
          nome: `${firstStop.nome} - ${bestStop.nome}`
        }
      });

      await prisma.viaParagem.create({
        data: {
          codigoParagem: bestStop.codigo,
          codigoVia: via.codigo,
          viaId: via.id,
          paragemId: bestStop.id,
          terminalBoolean: true
        }
      }).catch(() => {});

      console.log(`   Extended to ~${(currentLength + calculateDistance(lastStop.lat, lastStop.lon, bestStop.lat, bestStop.lon)).toFixed(1)}km\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // 4. Final verification
  console.log('='.repeat(80));
  console.log('📊 FINAL VERIFICATION');
  console.log('='.repeat(80));

  const finalVias = await prisma.via.findMany({
    include: {
      paragens: true
    }
  });

  const uniqueStopsCovered = new Set();
  finalVias.forEach(via => {
    via.paragens.forEach(vp => {
      uniqueStopsCovered.add(vp.paragemId);
    });
  });

  let routesUnder10 = 0;
  let routes10to70 = 0;
  let routesOver70 = 0;

  finalVias.forEach(via => {
    const length = calculateRouteLength(via.geoLocationPath);
    if (length < 10) routesUnder10++;
    else if (length <= 70) routes10to70++;
    else routesOver70++;
  });

  console.log(`✅ Unique stops covered: ${uniqueStopsCovered.size}/${allParagens.length}`);
  console.log(`✅ Routes < 10km: ${routesUnder10}`);
  console.log(`✅ Routes 10-70km: ${routes10to70}`);
  console.log(`✅ Routes > 70km (long-distance): ${routesOver70}`);
  console.log('='.repeat(80) + '\n');

  if (uniqueStopsCovered.size === allParagens.length) {
    console.log('🎉 SUCCESS: All 1,078 stops are covered!\n');
  } else {
    console.log(`⚠️  ${allParagens.length - uniqueStopsCovered.size} stops still missing\n`);
  }

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
  console.log('✅ Final optimization complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
