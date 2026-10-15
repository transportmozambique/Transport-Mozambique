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
  console.log('🔧 Creating ALL 111 Vias with Minimum 70km Routes\n');
  console.log('=' .repeat(80) + '\n');

  const MIN_ROUTE_LENGTH = 70; // km
  const TOTAL_VIAS = 111; // Use ALL vias

  // 1. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Total paragens: ${allParagens.length}`);

  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // Sort stops by latitude then longitude
  const sortedStops = stopsWithCoords.sort((a, b) => {
    if (Math.abs(a.lat - b.lat) > 0.01) return a.lat - b.lat;
    return a.lon - b.lon;
  });

  // 2. Get vias and municipalities
  const vias = await prisma.via.findMany({
    orderBy: { codigo: 'asc' }
  });
  const municipios = await prisma.municipio.findMany();
  
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');
  
  console.log(`📊 Total vias: ${vias.length}`);
  console.log(`📊 Stops per via (base): ${Math.floor(allParagens.length / TOTAL_VIAS)}\n`);

  // 3. Delete ALL existing associations
  console.log('🗑️  Deleting ALL via-paragem associations...');
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Deleted all associations\n');

  // 4. Distribute stops among ALL vias
  console.log(`🛣️  Creating routes for ALL ${TOTAL_VIAS} vias...\n`);
  
  const baseStopsPerVia = Math.floor(sortedStops.length / TOTAL_VIAS);
  const extraStops = sortedStops.length % TOTAL_VIAS;
  
  console.log(`📊 Base stops per via: ${baseStopsPerVia}`);
  console.log(`📊 Extra stops to distribute: ${extraStops}\n`);

  let totalAssociations = 0;
  let routesOver70km = 0;
  let routesUnder70km = 0;
  let currentStopIndex = 0;
  
  for (let i = 0; i < TOTAL_VIAS; i++) {
    const via = vias[i];
    
    // Calculate how many stops this via gets
    // First 'extraStops' vias get one extra stop
    const stopsForThisVia = baseStopsPerVia + (i < extraStops ? 1 : 0);
    
    // Get stops for this via
    const viaStops = sortedStops.slice(currentStopIndex, currentStopIndex + stopsForThisVia);
    currentStopIndex += stopsForThisVia;
    
    if (viaStops.length < 2) {
      console.log(`⚠️  Via ${i + 1}/${TOTAL_VIAS} (${via.codigo}): Not enough stops, skipping...`);
      continue;
    }

    // Sort stops by longitude for west-to-east route
    viaStops.sort((a, b) => a.lon - b.lon);
    
    // Calculate estimated route length
    const estimatedLength = calculateRouteLength(viaStops);
    
    const startStop = viaStops[0];
    const endStop = viaStops[viaStops.length - 1];
    
    const status = estimatedLength >= MIN_ROUTE_LENGTH ? '✅' : '⚠️';
    console.log(`${status} Via ${(i + 1).toString().padStart(3)}/${TOTAL_VIAS} (${via.codigo}): ${viaStops.length.toString().padStart(2)} stops, ~${estimatedLength.toFixed(1).padStart(6)} km - ${startStop.nome.substring(0, 30)} → ${endStop.nome.substring(0, 30)}`);
    
    if (estimatedLength >= MIN_ROUTE_LENGTH) {
      routesOver70km++;
    } else {
      routesUnder70km++;
    }
    
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
        console.error(`Error creating association: ${error.message}`);
      }
    }

    // Rate limiting - be gentle with OSRM
    if (i % 5 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Total vias updated: ${TOTAL_VIAS}`);
  console.log(`✅ Total associations created: ${totalAssociations}`);
  console.log(`✅ All ${allParagens.length} stops covered: ${totalAssociations === allParagens.length ? 'YES ✅' : 'NO ❌'}`);
  console.log(`📊 Average stops per via: ${(totalAssociations / TOTAL_VIAS).toFixed(1)}`);
  console.log(`\n✅ Routes >= ${MIN_ROUTE_LENGTH}km: ${routesOver70km}`);
  console.log(`⚠️  Routes < ${MIN_ROUTE_LENGTH}km: ${routesUnder70km}`);
  console.log('='.repeat(80) + '\n');

  // 5. Update transportes to use new routes
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
  console.log('✅ ALL vias now have routes!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
