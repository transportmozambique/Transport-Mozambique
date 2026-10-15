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

async function main() {
  console.log('🔧 Creating Major Intercity Routes\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allParagens = await prisma.paragem.findMany();
  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // Get municipalities
  const municipios = await prisma.municipio.findMany();
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');

  console.log(`📊 Total stops: ${allParagens.length}\n`);

  // Find key locations
  const pontaDoOuroStops = stopsWithCoords.filter(s => 
    s.nome.toLowerCase().includes('ponta do ouro') || 
    s.nome.toLowerCase().includes('punta do ouro')
  );

  const maputoCentralStops = stopsWithCoords.filter(s => 
    s.nome.toLowerCase().includes('maputo') && 
    (s.nome.toLowerCase().includes('central') || 
     s.nome.toLowerCase().includes('baixa') ||
     s.nome.toLowerCase().includes('praça'))
  );

  const matolaStops = stopsWithCoords.filter(s => 
    s.nome.toLowerCase().includes('matola') &&
    (s.nome.toLowerCase().includes('gare') || 
     s.nome.toLowerCase().includes('rio'))
  );

  const belaVistaStops = stopsWithCoords.filter(s => 
    s.nome.toLowerCase().includes('bela vista') ||
    s.nome.toLowerCase().includes('belavista')
  );

  console.log('📍 Key Locations Found:');
  console.log(`   Ponta do Ouro: ${pontaDoOuroStops.length} stops`);
  console.log(`   Maputo Central: ${maputoCentralStops.length} stops`);
  console.log(`   Matola: ${matolaStops.length} stops`);
  console.log(`   Bela Vista: ${belaVistaStops.length} stops\n`);

  // If we don't find specific stops, use geographic approximations
  let pontaDoOuro = pontaDoOuroStops[0] || stopsWithCoords.find(s => s.lat < -26.8); // Far south
  let maputoCentral = maputoCentralStops[0] || stopsWithCoords.find(s => 
    s.lat > -25.97 && s.lat < -25.95 && s.lon > 32.57 && s.lon < 32.59
  ); // Central Maputo
  let matola = matolaStops[0] || stopsWithCoords.find(s => 
    s.nome.toLowerCase().includes('matola')
  );
  let belaVista = belaVistaStops[0] || stopsWithCoords.find(s => 
    s.lat > -26.0 && s.lat < -25.95 && s.lon > 32.55 && s.lon < 32.57
  ); // Bela Vista area

  console.log('📍 Selected Terminals:');
  console.log(`   Ponta do Ouro: ${pontaDoOuro?.nome || 'Not found'}`);
  console.log(`   Maputo Central: ${maputoCentral?.nome || 'Not found'}`);
  console.log(`   Matola: ${matola?.nome || 'Not found'}`);
  console.log(`   Bela Vista: ${belaVista?.nome || 'Not found'}\n`);

  // Get vias to modify
  const vias = await prisma.via.findMany({
    orderBy: { codigo: 'asc' }
  });

  // Route 1: Ponta do Ouro → Maputo Central (V007)
  console.log('🛣️  Route 1: Ponta do Ouro → Maputo Central (V007)\n');
  
  const v007 = vias.find(v => v.codigo === 'V007');
  
  if (v007 && pontaDoOuro && maputoCentral) {
    console.log(`   Extending V007 from ${pontaDoOuro.nome} to ${maputoCentral.nome}`);
    
    // Create route with terminals
    const routeWaypoints = [pontaDoOuro, maputoCentral];
    const routePath = await getOSRMRoute(routeWaypoints);
    
    // Parse route to find stops along the way
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

  // Route 2: Matola → Maputo Central (V020 or similar)
  console.log('🛣️  Route 2: Matola → Maputo Central\n');
  
  const matolaVia = vias.find(v => v.codigo === 'V020') || vias.find(v => v.nome.includes('Matola'));
  
  if (matolaVia && matola && maputoCentral) {
    console.log(`   Using ${matolaVia.codigo} for Matola → Maputo Central`);
    console.log(`   From ${matola.nome} to ${maputoCentral.nome}`);
    
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

    await prisma.via.update({
      where: { id: matolaVia.id },
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
      where: { viaId: matolaVia.id }
    });

    for (const stop of stopsOnRoute) {
      const isTerminal = 
        stop.id === matola.id || 
        stop.id === maputoCentral.id;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: matolaVia.codigo,
            viaId: matolaVia.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log(`   ✅ ${matolaVia.codigo} updated with ${stopsOnRoute.length} stops\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Route 3: Bela Vista → Maputo Central
  console.log('🛣️  Route 3: Bela Vista → Maputo Central\n');
  
  const belaVistaVia = vias.find(v => v.codigo === 'V050') || vias[50];
  
  if (belaVistaVia && belaVista && maputoCentral) {
    console.log(`   Using ${belaVistaVia.codigo} for Bela Vista → Maputo Central`);
    console.log(`   From ${belaVista.nome} to ${maputoCentral.nome}`);
    
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

    await prisma.via.update({
      where: { id: belaVistaVia.id },
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
      where: { viaId: belaVistaVia.id }
    });

    for (const stop of stopsOnRoute) {
      const isTerminal = 
        stop.id === belaVista.id || 
        stop.id === maputoCentral.id;

      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: belaVistaVia.codigo,
            viaId: belaVistaVia.id,
            paragemId: stop.id,
            terminalBoolean: isTerminal
          }
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log(`   ✅ ${belaVistaVia.codigo} updated with ${stopsOnRoute.length} stops\n`);
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
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
