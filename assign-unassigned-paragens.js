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

async function assignUnassignedParagens() {
  try {
    console.log('🔍 Finding unassigned paragens...\n');

    // Get all unassigned paragens
    const unassignedParagens = await prisma.paragem.findMany({
      where: {
        vias: {
          none: {}
        }
      }
    });

    console.log(`Found ${unassignedParagens.length} unassigned paragens\n`);

    if (unassignedParagens.length === 0) {
      console.log('✅ All paragens are already assigned!');
      return;
    }

    // Get all vias with their paths
    const vias = await prisma.via.findMany();

    console.log(`Found ${vias.length} vias with paths\n`);

    const MAX_DISTANCE = 150; // Maximum 150 meters from route
    let assignedCount = 0;
    let skippedCount = 0;

    for (const paragem of unassignedParagens) {
      const [lat, lon] = paragem.geoLocation.split(',').map(Number);

      if (isNaN(lat) || isNaN(lon)) {
        console.log(`⚠️  Invalid coordinates for ${paragem.codigo}`);
        skippedCount++;
        continue;
      }

      let closestVia = null;
      let closestDistance = Infinity;

      // Find the closest via to this paragem
      for (const via of vias) {
        if (!via.geoLocationPath) continue;

        // Parse route coordinates
        const routeCoordinates = via.geoLocationPath
          .split(';')
          .map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          })
          .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

        if (routeCoordinates.length < 2) continue;

        // Calculate minimum distance to this route
        const distance = minDistanceToPath({ lat, lon }, routeCoordinates);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestVia = via;
        }
      }

      // If we found a via within the maximum distance, assign the paragem
      if (closestVia && closestDistance <= MAX_DISTANCE) {
        try {
          // Check if this relationship already exists
          const existing = await prisma.viaParagem.findFirst({
            where: {
              viaId: closestVia.id,
              paragemId: paragem.id
            }
          });

          if (!existing) {
            await prisma.viaParagem.create({
              data: {
                viaId: closestVia.id,
                paragemId: paragem.id,
                codigoVia: closestVia.codigo,
                codigoParagem: paragem.codigo,
                terminalBoolean: false
              }
            });

            console.log(`✅ Assigned ${paragem.nome} (${paragem.codigo}) to ${closestVia.nome} (${Math.round(closestDistance)}m)`);
            assignedCount++;
          } else {
            console.log(`⏭️  ${paragem.codigo} already linked to ${closestVia.codigo}`);
            assignedCount++;
          }
        } catch (error) {
          console.error(`❌ Error assigning ${paragem.codigo}:`, error.message);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  No via within ${MAX_DISTANCE}m for ${paragem.nome} (closest: ${Math.round(closestDistance)}m)`);
        skippedCount++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total unassigned paragens: ${unassignedParagens.length}`);
    console.log(`   Successfully assigned: ${assignedCount}`);
    console.log(`   Skipped (too far): ${skippedCount}`);

    // Verify final counts
    const totalViaParagens = await prisma.viaParagem.count();
    const totalParagens = await prisma.paragem.count();
    const stillUnassigned = await prisma.paragem.count({
      where: {
        vias: {
          none: {}
        }
      }
    });

    console.log(`\n   📊 Final statistics:`);
    console.log(`   Total paragens: ${totalParagens}`);
    console.log(`   Total ViaParagem relationships: ${totalViaParagens}`);
    console.log(`   Still unassigned: ${stillUnassigned}`);
    console.log(`   Assigned: ${totalParagens - stillUnassigned}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignUnassignedParagens();
