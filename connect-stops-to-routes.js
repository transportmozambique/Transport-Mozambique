require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Parse geolocation string (handles both "lat,lng" and "lng,lat" formats)
function parseGeoLocation(geoStr) {
  if (!geoStr) return null;
  const parts = geoStr.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  
  // Maputo coordinates: lat around -25 to -26, lng around 32
  // If first number is negative and in range -30 to -20, it's latitude
  if (parts[0] < 0 && parts[0] > -30) {
    return { lat: parts[0], lng: parts[1] };
  } else {
    return { lat: parts[1], lng: parts[0] };
  }
}

// Parse route path (format: "lng,lat;lng,lat;...")
function parseRoutePath(pathStr) {
  if (!pathStr) return [];
  return pathStr.split(';').map(coord => {
    const [lng, lat] = coord.split(',').map(Number);
    return { lat, lng };
  }).filter(c => !isNaN(c.lat) && !isNaN(c.lng));
}

// Check if a stop is near a route path
function isStopNearRoute(stopCoords, routePath, maxDistance = 0.5) {
  // maxDistance in km (500 meters default)
  for (const pathPoint of routePath) {
    const distance = calculateDistance(
      stopCoords.lat, stopCoords.lng,
      pathPoint.lat, pathPoint.lng
    );
    if (distance <= maxDistance) {
      return true;
    }
  }
  return false;
}

// Find position of stop along route (0 = start, 1 = end)
function findStopPositionOnRoute(stopCoords, routePath) {
  let minDistance = Infinity;
  let closestIndex = 0;
  
  routePath.forEach((pathPoint, index) => {
    const distance = calculateDistance(
      stopCoords.lat, stopCoords.lng,
      pathPoint.lat, pathPoint.lng
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });
  
  return closestIndex / Math.max(1, routePath.length - 1);
}

async function connectStopsToRoutes() {
  try {
    console.log('🔗 Connecting stops to routes based on proximity...\n');

    // Get all routes with their paths
    const routes = await prisma.via.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        terminalPartida: true,
        terminalChegada: true,
        geoLocationPath: true,
        paragens: {
          select: {
            paragemId: true
          }
        }
      }
    });

    console.log(`📍 Found ${routes.length} routes to process\n`);

    // Get all stops
    const stops = await prisma.paragem.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        geoLocation: true
      }
    });

    console.log(`🚏 Found ${stops.length} stops to check\n`);

    let totalConnections = 0;
    let skippedNoPath = 0;
    let skippedAlreadyConnected = 0;

    for (const route of routes) {
      console.log(`\n🛣️  Processing: ${route.codigo} - ${route.nome}`);
      console.log(`   ${route.terminalPartida} → ${route.terminalChegada}`);

      // Parse route path
      const routePath = parseRoutePath(route.geoLocationPath);
      
      if (routePath.length === 0) {
        console.log(`   ⚠️  No valid path coordinates, skipping`);
        skippedNoPath++;
        continue;
      }

      console.log(`   📏 Route has ${routePath.length} path points`);

      // Get existing connections for this route
      const existingStopIds = new Set(route.paragens.map(p => p.paragemId));

      // Find stops near this route
      const nearbyStops = [];
      
      for (const stop of stops) {
        // Skip if already connected
        if (existingStopIds.has(stop.id)) {
          continue;
        }

        const stopCoords = parseGeoLocation(stop.geoLocation);
        if (!stopCoords) continue;

        // Check if stop is near route (within 500m)
        if (isStopNearRoute(stopCoords, routePath, 0.5)) {
          const position = findStopPositionOnRoute(stopCoords, routePath);
          nearbyStops.push({
            stop,
            position
          });
        }
      }

      // Sort stops by position along route
      nearbyStops.sort((a, b) => a.position - b.position);

      console.log(`   ✅ Found ${nearbyStops.length} nearby stops to connect`);

      // Create ViaParagem relations
      let connected = 0;
      for (const { stop, position } of nearbyStops) {
        try {
          // Check if terminal (first or last 10% of route)
          const isTerminal = position < 0.1 || position > 0.9;

          await prisma.viaParagem.create({
            data: {
              codigoParagem: stop.codigo,
              codigoVia: route.codigo,
              terminalBoolean: isTerminal,
              viaId: route.id,
              paragemId: stop.id
            }
          });

          connected++;
          totalConnections++;
        } catch (error) {
          // Skip if duplicate (unique constraint violation)
          if (error.code === 'P2002') {
            skippedAlreadyConnected++;
          } else {
            console.error(`   ❌ Error connecting ${stop.nome}:`, error.message);
          }
        }
      }

      console.log(`   🔗 Connected ${connected} new stops to this route`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Total new connections created: ${totalConnections}`);
    console.log(`⚠️  Routes skipped (no path): ${skippedNoPath}`);
    console.log(`ℹ️  Stops skipped (already connected): ${skippedAlreadyConnected}`);
    console.log('='.repeat(80));

    // Show updated stats
    const finalRelations = await prisma.viaParagem.count();
    console.log(`\n🔗 Total ViaParagem relations now: ${finalRelations}`);

    // Show routes with most stops
    const routesWithStops = await prisma.via.findMany({
      select: {
        codigo: true,
        nome: true,
        _count: {
          select: {
            paragens: true
          }
        }
      },
      orderBy: {
        paragens: {
          _count: 'desc'
        }
      },
      take: 10
    });

    console.log('\n📊 Top 10 routes by stop count:');
    routesWithStops.forEach(route => {
      console.log(`   ${route.codigo.padEnd(15)} | ${route._count.paragens} stops`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

connectStopsToRoutes();
