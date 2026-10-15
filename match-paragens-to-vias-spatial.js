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

// Find the closest point on a line segment to a given point
function closestPointOnSegment(pointLat, pointLon, line1Lat, line1Lon, line2Lat, line2Lon) {
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

  let closestLat, closestLon;

  if (param < 0) {
    closestLat = line1Lat;
    closestLon = line1Lon;
  } else if (param > 1) {
    closestLat = line2Lat;
    closestLon = line2Lon;
  } else {
    closestLat = line1Lat + param * C;
    closestLon = line1Lon + param * D;
  }

  const distance = calculateDistance(pointLat, pointLon, closestLat, closestLon);
  
  return {
    distance,
    closestLat,
    closestLon,
    segmentIndex: -1 // Will be set by caller
  };
}

// Find all route segments that pass near a paragem
function findMatchingSegments(paragem, routeCoordinates, thresholdMeters = 150) {
  const [paragemLat, paragemLon] = paragem.geoLocation.split(',').map(Number);
  
  if (isNaN(paragemLat) || isNaN(paragemLon)) {
    return [];
  }

  const matches = [];

  // Check each segment of the route
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const result = closestPointOnSegment(
      paragemLat,
      paragemLon,
      routeCoordinates[i].lat,
      routeCoordinates[i].lng,
      routeCoordinates[i + 1].lat,
      routeCoordinates[i + 1].lng
    );

    if (result.distance <= thresholdMeters) {
      matches.push({
        segmentIndex: i,
        distance: Math.round(result.distance),
        closestPoint: {
          lat: result.closestLat,
          lon: result.closestLon
        }
      });
    }
  }

  return matches;
}

async function matchParagensToViasSpatial() {
  try {
    console.log('🗺️  Starting spatial matching of paragens to vias...\n');

    // Configuration
    const DISTANCE_THRESHOLD = 150; // meters - stops within 150m of route will be considered
    const MIN_MATCHES = 1; // Minimum number of matching segments required
    const DRY_RUN = false; // Set to true to preview without making changes
    const SHOW_DETAILS = true; // Show detailed matching information

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    console.log(`⚙️  Configuration:`);
    console.log(`   Distance threshold: ${DISTANCE_THRESHOLD}m`);
    console.log(`   Minimum matches: ${MIN_MATCHES}`);
    console.log(`   Show details: ${SHOW_DETAILS}\n`);

    // Get all vias with their routes
    console.log('📍 Loading vias...');
    const vias = await prisma.via.findMany({
      include: {
        paragens: {
          include: {
            paragem: true
          }
        },
        municipio: true
      }
    });
    console.log(`   Found ${vias.length} vias\n`);

    // Get all paragens
    console.log('🚏 Loading paragens...');
    const allParagens = await prisma.paragem.findMany();
    console.log(`   Found ${allParagens.length} paragens\n`);

    // Parse all via routes once
    const viasWithRoutes = vias
      .map(via => {
        if (!via.geoLocationPath || via.geoLocationPath.length === 0) {
          return null;
        }

        const routeCoordinates = via.geoLocationPath
          .split(';')
          .map(coord => {
            const [lng, lat] = coord.split(',').map(Number);
            return { lng, lat };
          })
          .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

        if (routeCoordinates.length < 2) {
          return null;
        }

        return {
          ...via,
          routeCoordinates,
          existingParagemIds: new Set(via.paragens.map(vp => vp.paragem.id))
        };
      })
      .filter(v => v !== null);

    console.log(`   ${viasWithRoutes.length} vias have valid routes\n`);

    let totalAssignments = 0;
    let paragensProcessed = 0;
    let paragensWithMatches = 0;

    // Process each paragem
    for (const paragem of allParagens) {
      const matchingVias = [];

      // Check against all vias
      for (const via of viasWithRoutes) {
        // Skip if already assigned
        if (via.existingParagemIds.has(paragem.id)) {
          continue;
        }

        // Find matching segments
        const matches = findMatchingSegments(
          paragem,
          via.routeCoordinates,
          DISTANCE_THRESHOLD
        );

        if (matches.length >= MIN_MATCHES) {
          const avgDistance = Math.round(
            matches.reduce((sum, m) => sum + m.distance, 0) / matches.length
          );

          matchingVias.push({
            via,
            matches,
            avgDistance,
            minDistance: Math.min(...matches.map(m => m.distance))
          });
        }
      }

      if (matchingVias.length > 0) {
        paragensWithMatches++;
        
        // Sort by minimum distance (closest via first)
        matchingVias.sort((a, b) => a.minDistance - b.minDistance);

        if (SHOW_DETAILS) {
          console.log(`\n🚏 ${paragem.codigo} - ${paragem.nome}`);
          console.log(`   Matches ${matchingVias.length} via(s):`);
        }

        // Assign to all matching vias
        for (const { via, matches, avgDistance, minDistance } of matchingVias) {
          try {
            if (!DRY_RUN) {
              // Determine if this is a terminal stop
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

            if (SHOW_DETAILS) {
              console.log(`   ✅ ${via.codigo} - ${via.nome} (${minDistance}m, ${matches.length} segments)`);
            }
            
            totalAssignments++;
          } catch (error) {
            if (error.code === 'P2002') {
              if (SHOW_DETAILS) {
                console.log(`   ⚠️  ${via.codigo} - Already linked`);
              }
            } else {
              console.error(`   ❌ Error linking to ${via.codigo}:`, error.message);
            }
          }
        }

        paragensProcessed++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Paragens processed: ${paragensProcessed}`);
    console.log(`   Paragens with matches: ${paragensWithMatches}`);
    console.log(`   Total assignments ${DRY_RUN ? 'that would be made' : 'made'}: ${totalAssignments}`);
    console.log(`   Average assignments per matched paragem: ${paragensWithMatches > 0 ? (totalAssignments / paragensWithMatches).toFixed(1) : 0}`);

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
      });

      const viasWithParagens = updatedVias.filter(v => v._count.paragens > 0).length;
      const totalParagens = updatedVias.reduce((sum, v) => sum + v._count.paragens, 0);
      const avgParagens = totalParagens / updatedVias.length;

      console.log(`   Vias with paragens: ${viasWithParagens}/${updatedVias.length}`);
      console.log(`   Total paragem assignments: ${totalParagens}`);
      console.log(`   Average paragens per via: ${avgParagens.toFixed(1)}`);

      // Show top 5 vias with most paragens
      const topVias = updatedVias
        .sort((a, b) => b._count.paragens - a._count.paragens)
        .slice(0, 5);

      console.log(`\n   Top 5 vias by paragem count:`);
      topVias.forEach((via, i) => {
        console.log(`   ${i + 1}. ${via.codigo}: ${via._count.paragens} paragens`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

matchParagensToViasSpatial();
