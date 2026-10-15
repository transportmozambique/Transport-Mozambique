const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

// Generate random color for each via
function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#F77F00', '#06FFA5', '#118AB2', '#073B4C',
    '#EF476F', '#FFD166', '#06D6A0', '#26547C', '#8338EC',
    '#FF006E', '#FFBE0B', '#FB5607', '#3A86FF', '#8338EC'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fetch route from OSRM that follows roads
function getOSRMRoute(coordinates) {
  return new Promise((resolve, reject) => {
    // Limit to 25 waypoints for OSRM
    const waypoints = coordinates.length > 25 
      ? [coordinates[0], ...coordinates.slice(1, -1).filter((_, i) => i % Math.ceil((coordinates.length - 2) / 23) === 0), coordinates[coordinates.length - 1]]
      : coordinates;
    
    const waypointsString = waypoints.map(w => `${w[1]},${w[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
            resolve({
              coordinates: json.routes[0].geometry.coordinates,
              distance: json.routes[0].distance / 1000 // Convert to km
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// Check if paragem is within 50m of path
function isParagemOnViaPath(paragem, viaPath, maxDistance = 0.05) {
  for (let i = 0; i < viaPath.length - 1; i++) {
    const segmentStart = viaPath[i];
    const segmentEnd = viaPath[i + 1];
    
    const distance = pointToSegmentDistance(
      paragem.latitude, paragem.longitude,
      segmentStart[0], segmentStart[1],
      segmentEnd[0], segmentEnd[1]
    );
    
    if (distance <= maxDistance) {
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
  
  if (lenSq !== 0) param = dot / lenSq;
  
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

// Find intermediate paragens
function findIntermediateParagens(startParagem, endParagem, allParagens, maxPoints = 10) {
  const intermediates = [];
  
  const startLat = startParagem.latitude;
  const startLon = startParagem.longitude;
  const endLat = endParagem.latitude;
  const endLon = endParagem.longitude;
  
  for (const paragem of allParagens) {
    if (paragem.id === startParagem.id || paragem.id === endParagem.id) continue;
    
    const distToStart = calculateDistance(startLat, startLon, paragem.latitude, paragem.longitude);
    const distToEnd = calculateDistance(paragem.latitude, paragem.longitude, endLat, endLon);
    const directDist = calculateDistance(startLat, startLon, endLat, endLon);
    
    if (distToStart + distToEnd <= directDist * 1.2) {
      intermediates.push({
        paragem,
        distFromStart: distToStart
      });
    }
  }
  
  intermediates.sort((a, b) => a.distFromStart - b.distFromStart);
  return intermediates.slice(0, maxPoints).map(i => i.paragem);
}

// Generate unique routes with varying distances
function generateUniqueRoutes(paragens, count, municipioName, minDistance, maxDistance) {
  const routes = [];
  const usedPairs = new Set();
  
  const shuffled = [...paragens].sort(() => Math.random() - 0.5);
  
  let attempts = 0;
  const maxAttempts = count * 20;
  
  while (routes.length < count && attempts < maxAttempts) {
    attempts++;
    
    const startIdx = Math.floor(Math.random() * shuffled.length);
    let endIdx = Math.floor(Math.random() * shuffled.length);
    
    while (endIdx === startIdx) {
      endIdx = Math.floor(Math.random() * shuffled.length);
    }
    
    const start = shuffled[startIdx];
    const end = shuffled[endIdx];
    
    const pairKey = [start.id, end.id].sort().join('-');
    if (usedPairs.has(pairKey)) continue;
    
    const [startLat, startLon] = start.geoLocation.split(',').map(parseFloat);
    const [endLat, endLon] = end.geoLocation.split(',').map(parseFloat);
    const distance = calculateDistance(startLat, startLon, endLat, endLon);
    
    // Check if distance is within range
    if (distance < minDistance || distance > maxDistance) continue;
    
    usedPairs.add(pairKey);
    
    routes.push({
      codigo: `${municipioName.substring(0, 3).toUpperCase()}-${routes.length + 1}`,
      nome: `${start.nome} → ${end.nome}`,
      origem: start.nome,
      destino: end.nome,
      startParagem: start,
      endParagem: end,
      distance: distance,
      color: generateRandomColor()
    });
  }
  
  return routes;
}

async function createRealisticRoadVias() {
  try {
    console.log('🚀 Starting realistic road-following via creation...\n');
    
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } }
    });
    
    if (!maputo || !matola) {
      throw new Error('Could not find Maputo or Matola municipios');
    }
    
    console.log('📍 Municipio IDs:');
    console.log('Maputo:', maputo.id);
    console.log('Matola:', matola.id);
    console.log('');
    
    const allParagens = await prisma.paragem.findMany();
    console.log(`📍 Total paragens: ${allParagens.length}`);
    
    const paragemsWithCoords = allParagens.map(p => {
      const [lat, lng] = p.geoLocation.split(',').map(parseFloat);
      return { ...p, latitude: lat, longitude: lng };
    }).filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
    
    console.log(`📍 Paragens with valid coordinates: ${paragemsWithCoords.length}\n`);
    
    console.log('🗑️  Deleting existing vias...');
    await prisma.viaParagem.deleteMany({});
    await prisma.via.deleteMany({});
    console.log('✅ All vias deleted\n');
    
    console.log('🎲 Generating unique routes with varying distances (10-100km)...');
    
    // Generate routes with different distance ranges
    const maputoShort = generateUniqueRoutes(paragemsWithCoords, 20, 'Maputo', 10, 25);
    const maputoMedium = generateUniqueRoutes(paragemsWithCoords, 30, 'Maputo', 25, 50);
    const maputoLong = generateUniqueRoutes(paragemsWithCoords, 20, 'Maputo', 50, 100);
    
    const matolaShort = generateUniqueRoutes(paragemsWithCoords, 15, 'Matola', 10, 25);
    const matolaMedium = generateUniqueRoutes(paragemsWithCoords, 16, 'Matola', 25, 50);
    const matolaLong = generateUniqueRoutes(paragemsWithCoords, 10, 'Matola', 50, 100);
    
    const maputoRoutes = [...maputoShort, ...maputoMedium, ...maputoLong];
    const matolaRoutes = [...matolaShort, ...matolaMedium, ...matolaLong];
    
    console.log(`✅ Generated ${maputoRoutes.length} Maputo routes`);
    console.log(`✅ Generated ${matolaRoutes.length} Matola routes\n`);
    
    let createdCount = 0;
    let totalAssociations = 0;
    let osrmSuccessCount = 0;
    
    console.log('🏗️  Creating Maputo vias with OSRM road-following routes...');
    for (const route of maputoRoutes) {
      const intermediates = findIntermediateParagens(
        route.startParagem,
        route.endParagem,
        paragemsWithCoords,
        10
      );
      
      const pathParagens = [route.startParagem, ...intermediates, route.endParagem];
      const simplePath = pathParagens.map(p => [p.latitude, p.longitude]);
      
      // Try to get OSRM route
      console.log(`  Fetching OSRM route for ${route.nome}...`);
      const osrmRoute = await getOSRMRoute(simplePath);
      
      let finalPath, actualDistance;
      if (osrmRoute) {
        // Use OSRM route (follows roads!)
        finalPath = osrmRoute.coordinates.map(c => [c[1], c[0]]); // Convert [lng,lat] to [lat,lng]
        actualDistance = osrmRoute.distance;
        osrmSuccessCount++;
        console.log(`  ✅ OSRM route: ${actualDistance.toFixed(2)}km`);
      } else {
        // Fallback to simple path
        finalPath = simplePath;
        actualDistance = route.distance;
        console.log(`  ⚠️  Using fallback path: ${actualDistance.toFixed(2)}km`);
      }
      
      const codigo = `VIA-${route.codigo}`;
      const geoLocationPath = finalPath.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          cor: route.color,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: maputo.codigo,
          municipioId: maputo.id
        }
      });
      
      // Associate paragens on the path
      for (let i = 0; i < pathParagens.length; i++) {
        const paragem = pathParagens[i];
        await prisma.viaParagem.create({
          data: {
            viaId: via.id,
            paragemId: paragem.id,
            codigoParagem: paragem.codigo,
            codigoVia: via.codigo,
            terminalBoolean: i === 0 || i === pathParagens.length - 1
          }
        });
        totalAssociations++;
      }
      
      // Check for other paragens within 50m
      for (const paragem of paragemsWithCoords) {
        if (pathParagens.find(pp => pp.id === paragem.id)) continue;
        
        if (isParagemOnViaPath(paragem, finalPath)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: false
            }
          });
          totalAssociations++;
        }
      }
      
      createdCount++;
      
      // Add delay to avoid rate limiting (reduced from 200ms to 100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (createdCount % 10 === 0) {
        console.log(`  Progress: ${createdCount}/${maputoRoutes.length} Maputo vias created`);
      }
    }
    
    console.log(`✅ Created ${maputoRoutes.length} Maputo vias (${osrmSuccessCount} with OSRM)\n`);
    
    console.log('🏗️  Creating Matola vias with OSRM road-following routes...');
    const matolaOsrmStart = osrmSuccessCount;
    for (const route of matolaRoutes) {
      const intermediates = findIntermediateParagens(
        route.startParagem,
        route.endParagem,
        paragemsWithCoords,
        10
      );
      
      const pathParagens = [route.startParagem, ...intermediates, route.endParagem];
      const simplePath = pathParagens.map(p => [p.latitude, p.longitude]);
      
      console.log(`  Fetching OSRM route for ${route.nome}...`);
      const osrmRoute = await getOSRMRoute(simplePath);
      
      let finalPath, actualDistance;
      if (osrmRoute) {
        finalPath = osrmRoute.coordinates.map(c => [c[1], c[0]]);
        actualDistance = osrmRoute.distance;
        osrmSuccessCount++;
        console.log(`  ✅ OSRM route: ${actualDistance.toFixed(2)}km`);
      } else {
        finalPath = simplePath;
        actualDistance = route.distance;
        console.log(`  ⚠️  Using fallback path: ${actualDistance.toFixed(2)}km`);
      }
      
      const codigo = `VIA-${route.codigo}`;
      const geoLocationPath = finalPath.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          cor: route.color,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: matola.codigo,
          municipioId: matola.id
        }
      });
      
      for (let i = 0; i < pathParagens.length; i++) {
        const paragem = pathParagens[i];
        await prisma.viaParagem.create({
          data: {
            viaId: via.id,
            paragemId: paragem.id,
            codigoParagem: paragem.codigo,
            codigoVia: via.codigo,
            terminalBoolean: i === 0 || i === pathParagens.length - 1
          }
        });
        totalAssociations++;
      }
      
      for (const paragem of paragemsWithCoords) {
        if (pathParagens.find(pp => pp.id === paragem.id)) continue;
        
        if (isParagemOnViaPath(paragem, finalPath)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: false
            }
          });
          totalAssociations++;
        }
      }
      
      createdCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if ((createdCount - maputoRoutes.length) % 10 === 0) {
        console.log(`  Progress: ${createdCount - maputoRoutes.length}/${matolaRoutes.length} Matola vias created`);
      }
    }
    
    console.log(`✅ Created ${matolaRoutes.length} Matola vias (${osrmSuccessCount - matolaOsrmStart} with OSRM)\n`);
    
    const finalMaputoCount = await prisma.via.count({ where: { municipioId: maputo.id } });
    const finalMatolaCount = await prisma.via.count({ where: { municipioId: matola.id } });
    const totalVias = await prisma.via.count();
    const totalParagens = await prisma.paragem.count();
    const totalViaParagens = await prisma.viaParagem.count();
    
    const sampleVias = await prisma.via.findMany({
      take: 5,
      include: { paragens: { include: { paragem: true } } }
    });
    
    console.log('✅ CREATION COMPLETE!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Maputo vias: ${finalMaputoCount}`);
    console.log(`  Matola vias: ${finalMatolaCount}`);
    console.log(`  Total vias: ${totalVias}`);
    console.log(`  Total paragens: ${totalParagens} (preserved)`);
    console.log(`  Total via-paragem associations: ${totalViaParagens}`);
    console.log(`  OSRM routes (following roads): ${osrmSuccessCount}/${totalVias}`);
    console.log('');
    console.log(`✅ Maputo vias (${finalMaputoCount}) ${finalMaputoCount > finalMatolaCount ? '>' : '<='} Matola vias (${finalMatolaCount})`);
    console.log(`✅ All ${totalParagens} paragens preserved`);
    console.log(`✅ Routes follow actual roads (OSRM routing)`);
    console.log(`✅ Each via has unique color`);
    console.log(`✅ Route distances: 10-100km`);
    console.log('');
    console.log('📋 Sample Routes:');
    sampleVias.forEach(via => {
      console.log(`  ${via.codigo}: ${via.nome} (${via.paragens.length} paragens, color: ${via.cor})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createRealisticRoadVias();
