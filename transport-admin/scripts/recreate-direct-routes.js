const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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

function isPointNearPath(point, pathCoords, maxDistance = 0.5) {
  for (let i = 0; i < pathCoords.length - 1; i++) {
    const segStart = pathCoords[i];
    const segEnd = pathCoords[i + 1];
    
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
  
  return Math.sqrt(dx * dx + dy * dy) * 111;
}

async function main() {
  console.log('🔧 Recreating Direct Routes for All Vias\n');
  console.log('='.repeat(80) + '\n');
  console.log('⚠️  This will create DIRECT routes between terminals');
  console.log('⚠️  Only stops within 500m of the direct route will be associated\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allStops = await prisma.paragem.findMany();
  const stopsWithCoords = allStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  console.log(`📊 Total stops: ${allStops.length}\n`);

  // Get all vias
  const allVias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total vias: ${allVias.length}\n`);

  let processedCount = 0;

  for (const via of allVias) {
    processedCount++;
    
    // Find terminals
    const terminals = via.paragens.filter(vp => vp.terminalBoolean);
    
    if (terminals.length < 2) {
      console.log(`⚠️  ${via.codigo}: No terminals defined, skipping`);
      continue;
    }

    const term1 = terminals[0].paragem;
    const term2 = terminals[terminals.length - 1].paragem;

    const [lat1, lon1] = term1.geoLocation.split(',').map(Number);
    const [lat2, lon2] = term2.geoLocation.split(',').map(Number);

    console.log(`${processedCount}/${allVias.length} ${via.codigo}: ${term1.nome} → ${term2.nome}`);

    // Create DIRECT route between terminals
    const routePath = await getOSRMRoute([
      { lat: lat1, lon: lon1 },
      { lat: lat2, lon: lon2 }
    ]);

    // Parse route coordinates
    const pathCoords = routePath
      .split(';')
      .map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat, lon: lng };
      })
      .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

    // Find stops within 500m of the DIRECT route
    const stopsOnRoute = stopsWithCoords.filter(stop => 
      isPointNearPath(stop, pathCoords, 0.5)
    );

    console.log(`   Found ${stopsOnRoute.length} stops within 500m of direct route`);

    // Update via
    await prisma.via.update({
      where: { id: via.id },
      data: {
        geoLocationPath: routePath
      }
    });

    // Delete old associations
    await prisma.viaParagem.deleteMany({
      where: { viaId: via.id }
    });

    // Create new associations
    for (const stop of stopsOnRoute) {
      const isTerminal = 
        stop.id === term1.id || 
        stop.id === term2.id;

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
      } catch (error) {
        // Ignore duplicates
      }
    }

    // Small delay to avoid overwhelming OSRM
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All routes recreated!\n');

  // Update transportes
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
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
