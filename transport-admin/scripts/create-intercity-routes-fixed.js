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

function isPointNearPath(point, pathCoords, maxDistance = 1.0) {
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
    
    totalDistance += calculateDistance(from.lat, from.lng, to.lat, to.lng);
  }
  
  return totalDistance;
}

async function main() {
  console.log('🔧 Creating Major Intercity Routes (Fixed)\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allParagens = await prisma.paragem.findMany();
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  console.log(`📊 Total stops: ${allParagens.length}\n`);

  // Define specific terminals using the codes we found
  const pontaDoOuro = stopsWithCoords.find(s => s.codigo === 'PAR-0416'); // Escola Secundária de Ponta do Ouro
  const maputoCentral = stopsWithCoords.find(s => s.codigo === 'PAR-0222'); // Avenida Eduardo Mondlane
  const matola = stopsWithCoords.find(s => s.codigo === 'PAR-0040'); // Estrada Matola gare - Circular
  const belaVista = stopsWithCoords.find(s => s.codigo === 'PAR-0409'); // Bela Vista (Cruzamento de Boane)

  console.log('📍 Selected Terminals:');
  console.log(`   Ponta do Ouro: ${pontaDoOuro.nome} (${pontaDoOuro.codigo})`);
  console.log(`   Maputo Central: ${maputoCentral.nome} (${maputoCentral.codigo})`);
  console.log(`   Matola: ${matola.nome} (${matola.codigo})`);
  console.log(`   Bela Vista: ${belaVista.nome} (${belaVista.codigo})\n`);

  // Get vias
  const vias = await prisma.via.findMany({
    orderBy: { codigo: 'asc' }
  });

  const municipios = await prisma.municipio.findMany();
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');

  // ============================================================================
  // Route 1: Ponta do Ouro → Maputo Central (V007 - ESTRADA NACIONAL)
  // ============================================================================
  console.log('🛣️  Route 1: Ponta do Ouro → Maputo Central (V007)\n');
  
  const v007 = vias.find(v => v.codigo === 'V007');
  
  if (v007) {
    console.log(`   Extending V007: ${v007.nome}`);
    console.log(`   From: ${pontaDoOuro.nome}`);
    console.log(`   To: ${maputoCentral.nome}`);
    
    // Create route
    const routeWaypoints = [pontaDoOuro, maputoCentral];
    const routePath = await getOSRMRoute(routeWaypoints);
    
    // Parse route coordinates
    const pathCoords = routePath
      .split(';')
      .map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat, lon: lng };
      })
      .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

    // Find all stops within 1km of the route
    const stopsOnRoute = stopsWithCoords.filter(stop => 
      isPointNearPath(stop, pathCoords, 1.0)
    );

    console.log(`   Found ${stopsOnRoute.length} stops along the route`);
    
    const routeLength = calculateRouteLength(routePath);
    console.log(`   Route length: ${routeLength.toFixed(1)} km`);

    // Update via
    await prisma.via.update({
      where: { id: v007.id },
      data: {
        geoLocationPath: routePath,
        terminalPartida: pontaDoOuro.nome,
        terminalChegada: maputoCentral.nome,
        nome: `${pontaDoOuro.nome} - ${maputoCentral.nome}`,
        municipioId: municipioMaputo.id,
        codigoMunicipio: municipioMaputo.codigo
      }
    });

    // Delete old associations
    await prisma.viaParagem.deleteMany({
      where: { viaId: v007.id }
    });

    // Create new associations
    for (const stop of stopsOnRoute) {
      const isTerminal = 
        stop.id === pontaDoOuro.id || 
        stop.id === maputoCentral.id;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: v007.codigo,
            viaId: v007.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log(`   ✅ V007 updated with ${stopsOnRoute.length} stops\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // ============================================================================
  // Route 2: Matola → Maputo Central (V020)
  // ============================================================================
  console.log('🛣️  Route 2: Matola → Maputo Central (V020)\n');
  
  const v020 = vias.find(v => v.codigo === 'V020');
  
  if (v020) {
    console.log(`   Using V020: ${v020.nome}`);
    console.log(`   From: ${matola.nome}`);
    console.log(`   To: ${maputoCentral.nome}`);
    
    const routeWaypoints = [matola, maputoCentral];
    const routePath = await getOSRMRoute(routeWaypoints);
    
    const pathCoords = routePath
      .split(';')
      .map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat, lon: lng };
      })
      .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

    const stopsOnRoute = stopsWithCoords.filter(stop => 
      isPointNearPath(stop, pathCoords, 1.0)
    );

    console.log(`   Found ${stopsOnRoute.length} stops along the route`);
    
    const routeLength = calculateRouteLength(routePath);
    console.log(`   Route length: ${routeLength.toFixed(1)} km`);

    await prisma.via.update({
      where: { id: v020.id },
      data: {
        geoLocationPath: routePath,
        terminalPartida: matola.nome,
        terminalChegada: maputoCentral.nome,
        nome: `${matola.nome} - ${maputoCentral.nome}`,
        municipioId: municipioMaputo.id,
        codigoMunicipio: municipioMaputo.codigo
      }
    });

    await prisma.viaParagem.deleteMany({
      where: { viaId: v020.id }
    });

    for (const stop of stopsOnRoute) {
      const isTerminal = 
        stop.id === matola.id || 
        stop.id === maputoCentral.id;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: v020.codigo,
            viaId: v020.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log(`   ✅ V020 updated with ${stopsOnRoute.length} stops\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // ============================================================================
  // Route 3: Bela Vista → Maputo Central (V050)
  // ============================================================================
  console.log('🛣️  Route 3: Bela Vista → Maputo Central (V050)\n');
  
  const v050 = vias.find(v => v.codigo === 'V050');
  
  if (v050) {
    console.log(`   Using V050: ${v050.nome}`);
    console.log(`   From: ${belaVista.nome}`);
    console.log(`   To: ${maputoCentral.nome}`);
    
    const routeWaypoints = [belaVista, maputoCentral];
    const routePath = await getOSRMRoute(routeWaypoints);
    
    const pathCoords = routePath
      .split(';')
      .map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat, lon: lng };
      })
      .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

    const stopsOnRoute = stopsWithCoords.filter(stop => 
      isPointNearPath(stop, pathCoords, 1.0)
    );

    console.log(`   Found ${stopsOnRoute.length} stops along the route`);
    
    const routeLength = calculateRouteLength(routePath);
    console.log(`   Route length: ${routeLength.toFixed(1)} km`);

    await prisma.via.update({
      where: { id: v050.id },
      data: {
        geoLocationPath: routePath,
        terminalPartida: belaVista.nome,
        terminalChegada: maputoCentral.nome,
        nome: `${belaVista.nome} - ${maputoCentral.nome}`,
        municipioId: municipioMaputo.id,
        codigoMunicipio: municipioMaputo.codigo
      }
    });

    await prisma.viaParagem.deleteMany({
      where: { viaId: v050.id }
    });

    for (const stop of stopsOnRoute) {
      const isTerminal = 
        stop.id === belaVista.id || 
        stop.id === maputoCentral.id;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: v050.codigo,
            viaId: v050.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log(`   ✅ V050 updated with ${stopsOnRoute.length} stops\n`);
  }

  console.log('='.repeat(80));
  console.log('✅ Major intercity routes created!\n');

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
  
  // Final verification
  console.log('='.repeat(80));
  console.log('📊 FINAL VERIFICATION\n');
  
  const updatedVias = await prisma.via.findMany({
    where: {
      codigo: { in: ['V007', 'V020', 'V050'] }
    },
    include: {
      paragens: true
    }
  });
  
  for (const via of updatedVias) {
    const length = calculateRouteLength(via.geoLocationPath);
    console.log(`${via.codigo}: ${via.nome}`);
    console.log(`   Length: ${length.toFixed(1)} km`);
    console.log(`   Stops: ${via.paragens.length}`);
    console.log(`   From: ${via.terminalPartida}`);
    console.log(`   To: ${via.terminalChegada}\n`);
  }
  
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
