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
  console.log('🔧 Fixing ALL Vias with Straight Routes\n');
  console.log('=' .repeat(60) + '\n');

  // 1. Get all paragens
  const allParagens = await prisma.paragem.findMany();
  console.log(`📊 Found ${allParagens.length} paragens\n`);

  const stopsWithCoords = allParagens.map(p => {
    const [lat, lon] = p.geoLocation.split(',').map(Number);
    return { ...p, lat, lon };
  });

  // Sort stops by latitude then longitude for straight routes
  const sortedStops = stopsWithCoords.sort((a, b) => {
    if (Math.abs(a.lat - b.lat) > 0.01) return a.lat - b.lat;
    return a.lon - b.lon;
  });

  // 2. Get all vias
  const vias = await prisma.via.findMany();
  const municipios = await prisma.municipio.findMany();
  
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');
  
  console.log(`📊 Found ${vias.length} vias\n`);

  // 3. Delete ALL existing associations
  console.log('🗑️  Deleting ALL via-paragem associations...');
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Deleted all associations\n');

  // 4. Divide stops evenly among all vias
  console.log('🛣️  Creating straight routes for ALL vias...\n');
  
  const stopsPerVia = Math.floor(sortedStops.length / vias.length);
  let totalAssociations = 0;
  
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    
    // Get stops for this via
    const startIdx = i * stopsPerVia;
    const endIdx = i === vias.length - 1 
      ? sortedStops.length  // Last via gets remaining stops
      : (i + 1) * stopsPerVia;
    
    const viaStops = sortedStops.slice(startIdx, endIdx);
    
    if (viaStops.length < 2) {
      console.log(`⚠️  Via ${i + 1}/${vias.length}: Not enough stops, skipping...`);
      continue;
    }

    // Sort stops by longitude for west-to-east route
    viaStops.sort((a, b) => a.lon - b.lon);
    
    const startStop = viaStops[0];
    const endStop = viaStops[viaStops.length - 1];
    
    console.log(`🔄 Via ${i + 1}/${vias.length}: ${startStop.nome} → ${endStop.nome} (${viaStops.length} stops)`);
    
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

    // Rate limiting
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Vias updated: ${vias.length}`);
  console.log(`✅ Total associations: ${totalAssociations}`);
  console.log(`📊 Average stops per via: ${(totalAssociations / vias.length).toFixed(1)}`);
  console.log(`✅ All ${allParagens.length} stops covered!`);
  console.log('='.repeat(60) + '\n');

  // 5. Show examples
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

  // 6. Update transportes
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
  console.log('✅ ALL vias now have straight routes!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
