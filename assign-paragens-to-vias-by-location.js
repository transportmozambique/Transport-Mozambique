const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// Check if a point is near a line segment
function distanceToLineSegment(pointLat, pointLon, line1Lat, line1Lon, line2Lat, line2Lon) {
  // Calculate distance from point to line segment
  const A = pointLat - line1Lat;
  const B = pointLon - line1Lon;
  const C = line2Lat - line1Lat;
  const D = line2Lon - line1Lon;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = line1Lat;
    yy = line1Lon;
  } else if (param > 1) {
    xx = line2Lat;
    yy = line2Lon;
  } else {
    xx = line1Lat + param * C;
    yy = line1Lon + param * D;
  }

  return calculateDistance(pointLat, pointLon, xx, yy);
}

// Check if a paragem is along a via's route
function isParagemAlongRoute(paragem, routeCoordinates, thresholdMeters = 100) {
  const [paragemLat, paragemLon] = paragem.geoLocation.split(',').map(Number);
  
  if (isNaN(paragemLat) || isNaN(paragemLon)) {
    return { isAlong: false, minDistance: Infinity };
  }

  let minDistance = Infinity;

  // Check distance to each segment of the route
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const distance = distanceToLineSegment(
      paragemLat,
      paragemLon,
      routeCoordinates[i].lat,
      routeCoordinates[i].lng,
      routeCoordinates[i + 1].lat,
      routeCoordinates[i + 1].lng
    );

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return {
    isAlong: minDistance <= thresholdMeters,
    minDistance: Math.round(minDistance)
  };
}

async function assignParagensToViasByLocation() {
  try {
    console.log('🔍 Starting automatic paragem assignment based on location...\n');

    // Configuration
    const DISTANCE_THRESHOLD = 100; // meters - stops within 100m of route will be assigned
    const DRY_RUN = false; // Set to true to see what would be assigned without making changes

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Get all vias with their routes
    console.log('📍 Loading vias...');
    const vias = await prisma.via.findMany({
      include: {
        paragens: {
          include: {
            paragem: true
          }
        }
      }
    });
    console.log(`   Found ${vias.length} vias\n`);

    // Get all paragens
    console.log('🚏 Loading paragens...');
    const allParagens = await prisma.paragem.findMany();
    console.log(`   Found ${allParagens.length} paragens\n`);

    let totalAssignments = 0;
    let viasProcessed = 0;
    let viasSkipped = 0;

    for (const via of vias) {
      console.log(`\n📍 Processing: ${via.codigo} - ${via.nome}`);

      if (!via.geoLocationPath || via.geoLocationPath.length === 0) {
        console.log('   ⚠️  No geographic path - skipping');
        viasSkipped++;
        continue;
      }

      // Parse route coordinates
      const routeCoordinates = via.geoLocationPath
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return { lng, lat };
        })
        .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

      if (routeCoordinates.length < 2) {
        console.log(`   ⚠️  Insufficient coordinates (${routeCoordinates.length}) - skipping`);
        viasSkipped++;
        continue;
      }

      console.log(`   📊 Route has ${routeCoordinates.length} coordinates`);

      // Get existing paragens for this via
      const existingParagemIds = new Set(
        via.paragens.map(vp => vp.paragem.id)
      );

      let assignmentsForThisVia = 0;
      const matchedParagens = [];

      // Check each paragem
      for (const paragem of allParagens) {
        // Skip if already assigned
        if (existingParagemIds.has(paragem.id)) {
          continue;
        }

        // Check if paragem is along the route
        const { isAlong, minDistance } = isParagemAlongRoute(
          paragem,
          routeCoordinates,
          DISTANCE_THRESHOLD
        );

        if (isAlong) {
          matchedParagens.push({
            paragem,
            distance: minDistance
          });
        }
      }

      // Sort by distance (closest first)
      matchedParagens.sort((a, b) => a.distance - b.distance);

      console.log(`   🎯 Found ${matchedParagens.length} matching paragens`);

      // Assign the matched paragens
      for (const { paragem, distance } of matchedParagens) {
        try {
          if (!DRY_RUN) {
            // Check if this paragem name suggests it's a terminal
            const isTerminal = 
              paragem.nome.toLowerCase().includes('terminal') ||
              paragem.nome.toLowerCase().includes('partida') ||
              paragem.nome.toLowerCase().includes('chegada') ||
              paragem.nome === via.terminalPartida ||
              paragem.nome === via.terminalChegada;

            await prisma.viaParagem.create({
              data: {
                viaId: via.id,
                paragemId: paragem.id,
                codigoVia: via.codigo,
                codigoParagem: paragem.codigo,
                terminalBoolean: isTerminal,
              },
            });
          }

          console.log(`   ✅ ${DRY_RUN ? '[DRY RUN] Would assign' : 'Assigned'}: ${paragem.codigo} - ${paragem.nome} (${distance}m away)`);
          assignmentsForThisVia++;
          totalAssignments++;
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`   ⚠️  Already linked: ${paragem.codigo}`);
          } else {
            console.error(`   ❌ Error assigning ${paragem.codigo}:`, error.message);
          }
        }
      }

      if (assignmentsForThisVia > 0) {
        viasProcessed++;
        console.log(`   ✅ ${DRY_RUN ? 'Would assign' : 'Assigned'} ${assignmentsForThisVia} paragens to ${via.codigo}`);
      } else {
        console.log(`   ℹ️  No new paragens to assign`);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Vias processed: ${viasProcessed}`);
    console.log(`   Vias skipped: ${viasSkipped}`);
    console.log(`   Total paragens ${DRY_RUN ? 'that would be assigned' : 'assigned'}: ${totalAssignments}`);
    console.log(`   Distance threshold: ${DISTANCE_THRESHOLD}m`);

    if (DRY_RUN) {
      console.log(`\n⚠️  This was a DRY RUN - no changes were made`);
      console.log(`   Set DRY_RUN = false in the script to apply changes`);
    }

    // Show updated counts
    if (!DRY_RUN && totalAssignments > 0) {
      console.log(`\n📈 Verifying updated counts...`);
      const updatedVias = await prisma.via.findMany({
        include: {
          _count: {
            select: {
              paragens: true,
            },
          },
        },
        orderBy: {
          codigo: 'asc',
        },
      });

      const viasWithParagens = updatedVias.filter(v => v._count.paragens > 0).length;
      const totalParagens = updatedVias.reduce((sum, v) => sum + v._count.paragens, 0);

      console.log(`   Vias with paragens: ${viasWithParagens}/${updatedVias.length}`);
      console.log(`   Total paragens across all vias: ${totalParagens}`);
      console.log(`   Average paragens per via: ${(totalParagens / updatedVias.length).toFixed(1)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignParagensToViasByLocation();
