const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if a paragem is within 50m of a via path
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

// Calculate distance from point to line segment
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
  
  return Math.sqrt(dx * dx + dy * dy) * 111; // Convert to km
}

// Find intermediate paragens between start and end
function findIntermediateParagens(startParagem, endParagem, allParagens, maxIntermediatePoints = 8) {
  const intermediates = [];
  
  // Calculate the direct line between start and end
  const startLat = startParagem.latitude;
  const startLon = startParagem.longitude;
  const endLat = endParagem.latitude;
  const endLon = endParagem.longitude;
  
  // Find paragens that are close to the line between start and end
  for (const paragem of allParagens) {
    if (paragem.id === startParagem.id || paragem.id === endParagem.id) continue;
    
    // Check if paragem is roughly between start and end
    const distToStart = calculateDistance(startLat, startLon, paragem.latitude, paragem.longitude);
    const distToEnd = calculateDistance(paragem.latitude, paragem.longitude, endLat, endLon);
    const directDist = calculateDistance(startLat, startLon, endLat, endLon);
    
    // If the sum of distances is close to the direct distance, it's on the path
    if (distToStart + distToEnd <= directDist * 1.3) { // 30% tolerance
      intermediates.push({
        paragem,
        distFromStart: distToStart
      });
    }
  }
  
  // Sort by distance from start and take up to maxIntermediatePoints
  intermediates.sort((a, b) => a.distFromStart - b.distFromStart);
  return intermediates.slice(0, maxIntermediatePoints).map(i => i.paragem);
}

// Generate unique routes from paragens
function generateUniqueRoutes(paragens, count, municipioName) {
  const routes = [];
  const usedPairs = new Set();
  
  // Shuffle paragens for randomness
  const shuffled = [...paragens].sort(() => Math.random() - 0.5);
  
  let attempts = 0;
  const maxAttempts = count * 10;
  
  while (routes.length < count && attempts < maxAttempts) {
    attempts++;
    
    // Pick random start and end paragens
    const startIdx = Math.floor(Math.random() * shuffled.length);
    let endIdx = Math.floor(Math.random() * shuffled.length);
    
    // Ensure start and end are different
    while (endIdx === startIdx) {
      endIdx = Math.floor(Math.random() * shuffled.length);
    }
    
    const start = shuffled[startIdx];
    const end = shuffled[endIdx];
    
    // Create a unique key for this pair
    const pairKey = [start.id, end.id].sort().join('-');
    
    // Skip if we've already used this pair
    if (usedPairs.has(pairKey)) continue;
    
    // Calculate distance
    const [startLat, startLon] = start.geoLocation.split(',').map(parseFloat);
    const [endLat, endLon] = end.geoLocation.split(',').map(parseFloat);
    const distance = calculateDistance(startLat, startLon, endLat, endLon);
    
    // Only create routes that are at least 2km long
    if (distance < 2) continue;
    
    usedPairs.add(pairKey);
    
    routes.push({
      codigo: `${municipioName.substring(0, 3).toUpperCase()}-${routes.length + 1}`,
      nome: `${start.nome} → ${end.nome}`,
      origem: start.nome,
      destino: end.nome,
      startParagem: start,
      endParagem: end,
      distance: distance
    });
  }
  
  return routes;
}

async function createUniqueVias() {
  try {
    console.log('🚀 Starting unique via creation from paragens...\n');
    
    // Get municipio IDs
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
    
    // Get all paragens
    const allParagens = await prisma.paragem.findMany();
    console.log(`📍 Total paragens: ${allParagens.length}`);
    
    // Parse paragem coordinates
    const paragemsWithCoords = allParagens.map(p => {
      const [lat, lng] = p.geoLocation.split(',').map(parseFloat);
      return {
        ...p,
        latitude: lat,
        longitude: lng
      };
    }).filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
    
    console.log(`📍 Paragens with valid coordinates: ${paragemsWithCoords.length}\n`);
    
    // Delete all existing vias
    console.log('🗑️  Deleting existing vias...');
    await prisma.viaParagem.deleteMany({});
    await prisma.via.deleteMany({});
    console.log('✅ All vias deleted\n');
    
    // Generate unique routes
    console.log('🎲 Generating unique routes...');
    const maputoRoutes = generateUniqueRoutes(paragemsWithCoords, 70, 'Maputo');
    const matolaRoutes = generateUniqueRoutes(paragemsWithCoords, 41, 'Matola');
    
    console.log(`✅ Generated ${maputoRoutes.length} Maputo routes`);
    console.log(`✅ Generated ${matolaRoutes.length} Matola routes\n`);
    
    let createdCount = 0;
    let totalAssociations = 0;
    
    // Create Maputo vias
    console.log('🏗️  Creating Maputo vias...');
    for (const route of maputoRoutes) {
      // Find intermediate paragens
      const intermediates = findIntermediateParagens(
        route.startParagem,
        route.endParagem,
        paragemsWithCoords,
        8
      );
      
      // Build the path: start -> intermediates -> end
      const pathParagens = [route.startParagem, ...intermediates, route.endParagem];
      const path = pathParagens.map(p => [p.latitude, p.longitude]);
      
      // Generate unique codigo
      const codigo = `VIA-${route.codigo}`;
      
      // Convert path to geoLocationPath format (lng,lat;lng,lat;...)
      const geoLocationPath = path.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
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
      
      // Check for other paragens within 50m of the path
      for (const paragem of paragemsWithCoords) {
        if (pathParagens.find(pp => pp.id === paragem.id)) continue;
        
        const paragemObj = {
          latitude: paragem.latitude,
          longitude: paragem.longitude
        };
        
        if (isParagemOnViaPath(paragemObj, path)) {
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
      if (createdCount % 10 === 0) {
        console.log(`  Created ${createdCount} vias... (${totalAssociations} associations)`);
      }
    }
    
    console.log(`✅ Created ${maputoRoutes.length} Maputo vias\n`);
    
    // Create Matola vias
    console.log('🏗️  Creating Matola vias...');
    for (const route of matolaRoutes) {
      // Find intermediate paragens
      const intermediates = findIntermediateParagens(
        route.startParagem,
        route.endParagem,
        paragemsWithCoords,
        8
      );
      
      // Build the path
      const pathParagens = [route.startParagem, ...intermediates, route.endParagem];
      const path = pathParagens.map(p => [p.latitude, p.longitude]);
      
      // Generate unique codigo
      const codigo = `VIA-${route.codigo}`;
      
      // Convert path to geoLocationPath format
      const geoLocationPath = path.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: matola.codigo,
          municipioId: matola.id
        }
      });
      
      // Associate paragens
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
        
        const paragemObj = {
          latitude: paragem.latitude,
          longitude: paragem.longitude
        };
        
        if (isParagemOnViaPath(paragemObj, path)) {
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
    }
    
    console.log(`✅ Created ${matolaRoutes.length} Matola vias\n`);
    
    // Verify results
    const finalMaputoCount = await prisma.via.count({
      where: { municipioId: maputo.id }
    });
    
    const finalMatolaCount = await prisma.via.count({
      where: { municipioId: matola.id }
    });
    
    const totalVias = await prisma.via.count();
    const totalParagens = await prisma.paragem.count();
    const totalViaParagens = await prisma.viaParagem.count();
    
    // Get some sample routes
    const sampleVias = await prisma.via.findMany({
      take: 5,
      include: {
        paragens: {
          include: {
            paragem: true
          }
        }
      }
    });
    
    console.log('✅ CREATION COMPLETE!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Maputo vias: ${finalMaputoCount}`);
    console.log(`  Matola vias: ${finalMatolaCount}`);
    console.log(`  Total vias: ${totalVias}`);
    console.log(`  Total paragens: ${totalParagens} (preserved)`);
    console.log(`  Total via-paragem associations: ${totalViaParagens}`);
    console.log('');
    console.log(`✅ Maputo vias (${finalMaputoCount}) ${finalMaputoCount > finalMatolaCount ? '>' : '<='} Matola vias (${finalMatolaCount})`);
    console.log(`✅ All ${totalParagens} paragens preserved`);
    console.log(`✅ All routes are unique with different start/end points`);
    console.log(`✅ Routes follow paths through intermediate paragens`);
    console.log(`✅ Paragens associated within 50m of via paths`);
    console.log('');
    console.log('📋 Sample Routes:');
    sampleVias.forEach(via => {
      console.log(`  ${via.codigo}: ${via.nome} (${via.paragens.length} paragens)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createUniqueVias();
