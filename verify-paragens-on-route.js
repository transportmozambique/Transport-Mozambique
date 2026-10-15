const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two points
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Find minimum distance from a point to a line segment
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

  return haversineDistance(py, px, yy, xx);
}

// Find minimum distance from a point to a path
function minDistanceToPath(point, pathCoordinates) {
  let minDistance = Infinity;

  for (let i = 0; i < pathCoordinates.length - 1; i++) {
    const [lon1, lat1] = pathCoordinates[i];
    const [lon2, lat2] = pathCoordinates[i + 1];
    
    const distance = pointToSegmentDistance(
      point.lon, point.lat,
      lon1, lat1,
      lon2, lat2
    );

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

async function verifyParagensOnRoute() {
  try {
    console.log('🔍 Verifying paragens are on their assigned routes...\n');

    const vias = await prisma.via.findMany({
      include: {
        paragens: {
          include: {
            paragem: true
          }
        }
      }
    });

    console.log(`Found ${vias.length} vias to check\n`);

    let totalChecked = 0;
    let totalRemoved = 0;
    const MAX_DISTANCE = 100; // Maximum 100 meters from route

    for (const via of vias) {
      if (!via.geoLocationPath || via.paragens.length === 0) {
        continue;
      }

      // Parse route coordinates
      const routeCoordinates = via.geoLocationPath
        .split(';')
        .map(coord => {
          const [lon, lat] = coord.split(',').map(Number);
          return [lon, lat];
        })
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

      if (routeCoordinates.length < 2) {
        continue;
      }

      console.log(`\n📍 Checking ${via.codigo} - ${via.nome}`);
      console.log(`   Route has ${routeCoordinates.length} coordinates`);
      console.log(`   Assigned paragens: ${via.paragens.length}`);

      let removedCount = 0;

      for (const viaParagem of via.paragens) {
        const paragem = viaParagem.paragem;
        const [lat, lon] = paragem.geoLocation.split(',').map(Number);

        if (isNaN(lat) || isNaN(lon)) {
          console.log(`   ⚠️  Invalid coordinates for ${paragem.codigo}`);
          continue;
        }

        // Calculate minimum distance to route
        const minDistance = minDistanceToPath({ lat, lon }, routeCoordinates);
        totalChecked++;

        if (minDistance > MAX_DISTANCE) {
          console.log(`   ❌ Removing ${paragem.nome} (${paragem.codigo}) - ${Math.round(minDistance)}m from route`);
          
          try {
            await prisma.viaParagem.delete({
              where: {
                id: viaParagem.id
              }
            });
            removedCount++;
            totalRemoved++;
          } catch (error) {
            console.error(`   Error removing: ${error.message}`);
          }
        } else {
          console.log(`   ✅ ${paragem.nome} - ${Math.round(minDistance)}m from route`);
        }
      }

      if (removedCount > 0) {
        console.log(`   🗑️  Removed ${removedCount} paragens from ${via.codigo}`);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total paragens checked: ${totalChecked}`);
    console.log(`   Paragens removed: ${totalRemoved}`);
    console.log(`   Paragens kept: ${totalChecked - totalRemoved}`);

    // Verify final counts
    const totalViaParagens = await prisma.viaParagem.count();
    console.log(`\n   🔗 Total ViaParagem relationships remaining: ${totalViaParagens}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyParagensOnRoute();
