/**
 * Complete System Setup Script
 * 
 * This script:
 * 1. Creates Maputo and Matola municipalities
 * 2. Creates 111+ realistic bus routes (vias) with proper road paths
 * 3. Connects stops to routes based on geographic proximity
 * 4. Assigns each transport to a specific via
 * 5. Sets initial transport locations
 * 
 * Run: node setup-complete-system.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Retry logic for database operations
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`⚠️  Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find stops within radius of a point
function findStopsNearPoint(allStops, lat, lon, radiusKm) {
  return allStops.filter(stop => {
    const [stopLat, stopLon] = stop.geoLocation.split(',').map(Number);
    const distance = calculateDistance(lat, lon, stopLat, stopLon);
    return distance <= radiusKm;
  });
}

// Find stops along a route corridor
function findStopsAlongRoute(allStops, startLat, startLon, endLat, endLon, corridorWidthKm = 1.5) {
  const routeStops = [];
  
  for (const stop of allStops) {
    const [stopLat, stopLon] = stop.geoLocation.split(',').map(Number);
    
    // Calculate perpendicular distance from stop to route line
    const distance = pointToLineDistance(
      stopLat, stopLon,
      startLat, startLon,
      endLat, endLon
    );
    
    if (distance <= corridorWidthKm) {
      // Calculate position along route (0 to 1)
      const position = calculatePositionAlongLine(
        stopLat, stopLon,
        startLat, startLon,
        endLat, endLon
      );
      
      routeStops.push({
        ...stop,
        position,
        distanceFromRoute: distance
      });
    }
  }
  
  // Sort by position along route
  return routeStops.sort((a, b) => a.position - b.position);
}

// Calculate perpendicular distance from point to line
function pointToLineDistance(px, py, x1, y1, x2, y2) {
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
  
  return Math.sqrt(dx * dx + dy * dy) * 111; // Convert to km (approximate)
}

// Calculate position along line (0 to 1)
function calculatePositionAlongLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return 0;
  
  const param = dot / lenSq;
  return Math.max(0, Math.min(1, param));
}

// Generate route path using OSRM (road-following)
async function getOSRMRoute(waypoints) {
  try {
    const waypointsString = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('OSRM request failed');
    
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const coordinates = data.routes[0].geometry.coordinates;
      // Convert to lat,lon format
      return coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
    }
  } catch (error) {
    console.log(`  ⚠️  OSRM failed, using direct path: ${error.message}`);
  }
  
  // Fallback: direct path
  return waypoints.map(w => `${w.lon},${w.lat}`).join(';');
}

// Major route definitions for Maputo and Matola
const MAJOR_ROUTES = [
  // Maputo Centro routes
  { start: { lat: -25.9655, lon: 32.5892, name: "Maputo Centro" }, end: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, municipality: "Maputo", count: 15 },
  { start: { lat: -25.9655, lon: 32.5892, name: "Maputo Centro" }, end: { lat: -25.9087, lon: 32.4342, name: "Machava" }, municipality: "Maputo", count: 12 },
  { start: { lat: -25.9655, lon: 32.5892, name: "Maputo Centro" }, end: { lat: -25.7400, lon: 32.6730, name: "Marracuene" }, municipality: "Maputo", count: 10 },
  { start: { lat: -25.9655, lon: 32.5892, name: "Maputo Centro" }, end: { lat: -26.0454, lon: 32.3272, name: "Boane" }, municipality: "Maputo", count: 8 },
  
  // Matola internal routes
  { start: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, end: { lat: -25.8495, lon: 32.4219, name: "Tchumene" }, municipality: "Matola", count: 10 },
  { start: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, end: { lat: -25.9134, lon: 32.4993, name: "Machava Sede" }, municipality: "Matola", count: 8 },
  { start: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, end: { lat: -25.8988, lon: 32.5114, name: "Patrice Lumumba" }, municipality: "Matola", count: 7 },
  
  // Zimpeto routes
  { start: { lat: -25.8353, lon: 32.5491, name: "Zimpeto" }, end: { lat: -25.9793, lon: 32.4648, name: "Cidade da Matola" }, municipality: "Maputo", count: 6 },
  { start: { lat: -25.8353, lon: 32.5491, name: "Zimpeto" }, end: { lat: -25.8988, lon: 32.5114, name: "Patrice Lumumba" }, municipality: "Maputo", count: 5 },
  
  // Circular routes
  { start: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, end: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, municipality: "Matola", count: 8, circular: true },
  { start: { lat: -25.9134, lon: 32.4993, name: "Machava Sede" }, end: { lat: -25.9134, lon: 32.4993, name: "Machava Sede" }, municipality: "Matola", count: 6, circular: true },
  
  // Long distance routes
  { start: { lat: -25.9655, lon: 32.5892, name: "Maputo Centro" }, end: { lat: -25.4034, lon: 32.8077, name: "Manhiça" }, municipality: "Maputo", count: 4 },
  { start: { lat: -25.9655, lon: 32.5892, name: "Maputo Centro" }, end: { lat: -26.8409, lon: 32.8783, name: "Ponta do Ouro" }, municipality: "Maputo", count: 2 },
  
  // Additional Matola routes
  { start: { lat: -25.8495, lon: 32.4219, name: "Tchumene" }, end: { lat: -25.9134, lon: 32.4993, name: "Machava Sede" }, municipality: "Matola", count: 5 },
  { start: { lat: -25.7817, lon: 32.5527, name: "Intaka" }, end: { lat: -25.8270, lon: 32.4512, name: "Matola Gare" }, municipality: "Matola", count: 4 },
];

async function setupCompleteSystem() {
  console.log('🚀 Starting Complete System Setup...\n');
  
  // Step 1: Create Municipalities
  console.log('=' .repeat(70));
  console.log('STEP 1: Creating Municipalities');
  console.log('='.repeat(70));
  
  let maputoMun = await retryOperation(async () => {
    return await prisma.municipio.findFirst({ where: { nome: "Maputo" } });
  });
  
  if (!maputoMun) {
    maputoMun = await retryOperation(async () => {
      return await prisma.municipio.create({
        data: {
          nome: "Maputo",
          codigo: "MUN-MPT-001",
          endereco: "Cidade de Maputo, Moçambique"
        }
      });
    });
    console.log('✅ Created Maputo municipality');
  } else {
    console.log('✅ Found Maputo municipality');
  }
  
  let matolaMun = await retryOperation(async () => {
    return await prisma.municipio.findFirst({ where: { nome: "Matola" } });
  });
  
  if (!matolaMun) {
    matolaMun = await retryOperation(async () => {
      return await prisma.municipio.create({
        data: {
          nome: "Matola",
          codigo: "MUN-MTL-001",
          endereco: "Cidade da Matola, Moçambique"
        }
      });
    });
    console.log('✅ Created Matola municipality');
  } else {
    console.log('✅ Found Matola municipality');
  }
  
  // Step 2: Load all stops
  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: Loading Stops');
  console.log('='.repeat(70));
  
  const allStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true
      }
    });
  });
  console.log(`✅ Loaded ${allStops.length} stops\n`);
  
  // Step 3: Create Vias
  console.log('='.repeat(70));
  console.log('STEP 3: Creating Vias (Routes)');
  console.log('='.repeat(70));
  
  let viaCounter = 1;
  const createdVias = [];
  
  for (const routeDef of MAJOR_ROUTES) {
    console.log(`\n📍 Creating routes: ${routeDef.start.name} → ${routeDef.end.name}`);
    console.log(`   Municipality: ${routeDef.municipality}, Count: ${routeDef.count}`);
    
    const municipality = routeDef.municipality === "Maputo" ? maputoMun : matolaMun;
    
    // Find stops along this route
    let routeStops;
    if (routeDef.circular) {
      // For circular routes, find stops near the center point
      routeStops = findStopsNearPoint(
        allStops,
        routeDef.start.lat,
        routeDef.start.lon,
        3 // 3km radius
      );
    } else {
      routeStops = findStopsAlongRoute(
        allStops,
        routeDef.start.lat,
        routeDef.start.lon,
        routeDef.end.lat,
        routeDef.end.lon,
        1.5 // 1.5km corridor width
      );
    }
    
    console.log(`   Found ${routeStops.length} stops along route`);
    
    if (routeStops.length < 2) {
      console.log(`   ⚠️  Not enough stops, skipping...`);
      continue;
    }
    
    // Create multiple vias for this route (variations)
    for (let i = 0; i < routeDef.count; i++) {
      const viaCode = `VIA-${String(viaCounter).padStart(3, '0')}`;
      const viaName = `${routeDef.start.name} - ${routeDef.end.name} (${i + 1})`;
      
      // Select a subset of stops for this specific via (add variation)
      const stopSubset = routeStops.filter((_, idx) => {
        // Include all terminal stops and a random selection of intermediate stops
        if (idx === 0 || idx === routeStops.length - 1) return true;
        return Math.random() > 0.3; // 70% chance to include each stop
      });
      
      if (stopSubset.length < 2) {
        stopSubset.push(...routeStops.slice(0, 2)); // Ensure at least 2 stops
      }
      
      // Generate waypoints for OSRM (use fewer waypoints for speed)
      const waypointIndices = [0, Math.floor(stopSubset.length / 2), stopSubset.length - 1];
      const waypoints = waypointIndices.map(idx => {
        const stop = stopSubset[Math.min(idx, stopSubset.length - 1)];
        const [lat, lon] = stop.geoLocation.split(',').map(Number);
        return { lat, lon };
      });
      
      // Get road-following path from OSRM
      const routePath = await getOSRMRoute(waypoints);
      
      // Create Via
      try {
        const via = await retryOperation(async () => {
          return await prisma.via.create({
            data: {
              nome: viaName,
              codigo: viaCode,
              cor: `#${Math.floor(Math.random()*16777215).toString(16)}`, // Random color
              terminalPartida: routeDef.start.name,
              terminalChegada: routeDef.end.name,
              geoLocationPath: routePath,
              codigoMunicipio: municipality.codigo,
              municipioId: municipality.id
            }
          });
        });
        
        // Create ViaParagem relations
        for (let j = 0; j < stopSubset.length; j++) {
          const stop = stopSubset[j];
          const isTerminal = j === 0 || j === stopSubset.length - 1;
          
          try {
            await retryOperation(async () => {
              await prisma.viaParagem.create({
                data: {
                  codigoParagem: stop.codigo,
                  codigoVia: via.codigo,
                  terminalBoolean: isTerminal,
                  viaId: via.id,
                  paragemId: stop.id
                }
              });
            });
          } catch (error) {
            // Ignore duplicate errors
          }
        }
        
        createdVias.push(via);
        viaCounter++;
        
        if (viaCounter % 5 === 0) {
          console.log(`   ✅ Created ${viaCounter - 1} vias so far...`);
        }
        
        // Small delay to avoid overwhelming OSRM
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`   ❌ Error creating ${viaCode}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n✅ Created ${createdVias.length} vias total`);
  
  // Step 4: Assign Transportes to Vias
  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Assigning Transportes to Vias');
  console.log('='.repeat(70));
  
  const transportes = await retryOperation(async () => {
    return await prisma.transporte.findMany({
      select: {
        id: true,
        codigo: true,
        matricula: true
      }
    });
  });
  
  console.log(`Found ${transportes.length} transportes`);
  console.log(`Assigning to ${createdVias.length} vias...\n`);
  
  let assignedCount = 0;
  
  for (let i = 0; i < transportes.length; i++) {
    const transporte = transportes[i];
    const via = createdVias[i % createdVias.length]; // Round-robin assignment
    
    try {
      // Get first stop of the via for initial location
      const firstStop = await retryOperation(async () => {
        return await prisma.viaParagem.findFirst({
          where: { viaId: via.id },
          include: { paragem: true },
          orderBy: { id: 'asc' }
        });
      });
      
      const initialLocation = firstStop ? firstStop.paragem.geoLocation : "-25.9655,32.5892";
      
      await retryOperation(async () => {
        await prisma.transporte.update({
          where: { id: transporte.id },
          data: {
            viaId: via.id,
            codigoVia: via.codigo,
            currGeoLocation: initialLocation,
            routePath: via.geoLocationPath
          }
        });
      });
      
      assignedCount++;
      
      if (assignedCount % 10 === 0) {
        console.log(`  ✅ Assigned ${assignedCount}/${transportes.length} transportes...`);
      }
    } catch (error) {
      console.log(`  ❌ Error assigning transporte ${transporte.codigo}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Assigned ${assignedCount} transportes to vias`);
  
  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SETUP SUMMARY');
  console.log('='.repeat(70));
  
  const allTransportes = await retryOperation(async () => {
    return await prisma.transporte.findMany({ select: { viaId: true } });
  });
  const transportesAssigned = allTransportes.filter(t => t.viaId !== null).length;
  
  const stats = {
    municipios: await prisma.municipio.count(),
    vias: await prisma.via.count(),
    paragens: await prisma.paragem.count(),
    viaParagens: await prisma.viaParagem.count(),
    transportes: allTransportes.length,
    transportesAssigned
  };
  
  console.log(`✅ Municipalities: ${stats.municipios}`);
  console.log(`✅ Vias (Routes): ${stats.vias}`);
  console.log(`✅ Paragens (Stops): ${stats.paragens}`);
  console.log(`✅ ViaParagem Relations: ${stats.viaParagens}`);
  console.log(`✅ Transportes: ${stats.transportes}`);
  console.log(`✅ Transportes Assigned: ${stats.transportesAssigned}`);
  console.log('='.repeat(70));
  
  console.log('\n🎉 Complete System Setup Finished!');
  console.log('\n💡 Next steps:');
  console.log('   1. Restart your Next.js server: npm run dev');
  console.log('   2. Visit http://localhost:3000 to see buses on the map');
  console.log('   3. Check /admin to manage routes and buses');
  console.log('   4. Test USSD functionality');
}

// Run the script
setupCompleteSystem()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
