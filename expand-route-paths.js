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

// Interpolate points between two coordinates
function interpolatePoints(lat1, lon1, lat2, lon2, numPoints) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const lat = lat1 + (lat2 - lat1) * fraction;
    const lon = lon1 + (lon2 - lon1) * fraction;
    points.push({ lat, lon });
  }
  return points;
}

// Expand a route path by adding intermediate waypoints
function expandRoutePath(pathStr, targetSpacing = 0.3) {
  // targetSpacing in km (300 meters default)
  
  if (!pathStr) return null;
  
  // Parse existing path
  const existingPoints = pathStr.split(';').map(coord => {
    const [lng, lat] = coord.split(',').map(Number);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

  if (existingPoints.length < 2) return pathStr;

  const expandedPoints = [];
  
  // For each segment between consecutive points
  for (let i = 0; i < existingPoints.length - 1; i++) {
    const p1 = existingPoints[i];
    const p2 = existingPoints[i + 1];
    
    // Calculate distance between points
    const distance = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    
    // Calculate how many intermediate points we need
    const numIntermediatePoints = Math.floor(distance / targetSpacing);
    
    // Add first point
    expandedPoints.push(p1);
    
    // Add intermediate points if distance is large enough
    if (numIntermediatePoints > 0) {
      const intermediates = interpolatePoints(
        p1.lat, p1.lng, 
        p2.lat, p2.lng, 
        numIntermediatePoints + 1
      );
      
      // Skip first (already added) and last (will be added in next iteration or at end)
      for (let j = 1; j < intermediates.length - 1; j++) {
        expandedPoints.push({ lat: intermediates[j].lat, lng: intermediates[j].lon });
      }
    }
  }
  
  // Add final point
  expandedPoints.push(existingPoints[existingPoints.length - 1]);
  
  // Convert back to string format (lng,lat;lng,lat;...)
  return expandedPoints.map(p => `${p.lng},${p.lat}`).join(';');
}

async function expandAllRoutePaths() {
  try {
    console.log('🛣️  Expanding route paths with intermediate waypoints...\n');
    console.log('Target spacing: 300 meters between waypoints\n');
    console.log('='.repeat(80));

    // Get all routes
    const routes = await prisma.via.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        geoLocationPath: true,
        terminalPartida: true,
        terminalChegada: true
      },
      orderBy: {
        codigo: 'asc'
      }
    });

    console.log(`\nFound ${routes.length} routes to process\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const stats = [];

    for (const route of routes) {
      console.log(`\n📍 ${route.codigo} - ${route.nome}`);
      console.log(`   ${route.terminalPartida} → ${route.terminalChegada}`);

      if (!route.geoLocationPath) {
        console.log(`   ⚠️  No path defined, skipping`);
        skippedCount++;
        continue;
      }

      // Count existing waypoints
      const existingWaypoints = route.geoLocationPath.split(';').length;
      
      // Expand the path
      const expandedPath = expandRoutePath(route.geoLocationPath, 0.3);
      
      if (!expandedPath) {
        console.log(`   ⚠️  Could not expand path, skipping`);
        skippedCount++;
        continue;
      }

      // Count new waypoints
      const newWaypoints = expandedPath.split(';').length;
      
      // Update route in database
      await prisma.via.update({
        where: { id: route.id },
        data: {
          geoLocationPath: expandedPath
        }
      });

      console.log(`   ✅ Expanded: ${existingWaypoints} → ${newWaypoints} waypoints (+${newWaypoints - existingWaypoints})`);
      
      stats.push({
        codigo: route.codigo,
        nome: route.nome,
        before: existingWaypoints,
        after: newWaypoints,
        added: newWaypoints - existingWaypoints
      });

      updatedCount++;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Routes expanded: ${updatedCount}`);
    console.log(`⚠️  Routes skipped: ${skippedCount}`);
    
    // Calculate totals
    const totalBefore = stats.reduce((sum, s) => sum + s.before, 0);
    const totalAfter = stats.reduce((sum, s) => sum + s.after, 0);
    const totalAdded = totalAfter - totalBefore;
    
    console.log(`\n📈 Waypoint Statistics:`);
    console.log(`   Before: ${totalBefore} total waypoints`);
    console.log(`   After: ${totalAfter} total waypoints`);
    console.log(`   Added: ${totalAdded} new waypoints (+${((totalAdded/totalBefore)*100).toFixed(1)}%)`);
    console.log(`   Average per route: ${(totalAfter/updatedCount).toFixed(1)} waypoints`);

    // Show top 10 routes by waypoint count
    console.log(`\n🏆 Top 10 routes by waypoint count:`);
    stats.sort((a, b) => b.after - a.after);
    stats.slice(0, 10).forEach((s, i) => {
      console.log(`   ${(i+1).toString().padStart(2)}. ${s.codigo.padEnd(15)} | ${s.after.toString().padStart(3)} waypoints (was ${s.before})`);
    });

    // Show routes with most waypoints added
    console.log(`\n➕ Routes with most waypoints added:`);
    stats.sort((a, b) => b.added - a.added);
    stats.slice(0, 10).forEach((s, i) => {
      console.log(`   ${(i+1).toString().padStart(2)}. ${s.codigo.padEnd(15)} | +${s.added.toString().padStart(3)} waypoints`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Route path expansion complete!');
    console.log('💡 Next step: Run "node connect-stops-to-routes.js" to connect more stops');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

expandAllRoutePaths();
