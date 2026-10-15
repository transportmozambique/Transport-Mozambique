const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function isPointNearPath(point, pathCoords, maxDistance = 0.01) {
  for (let i = 0; i < pathCoords.length - 1; i++) {
    const segStart = pathCoords[i];
    const segEnd = pathCoords[i + 1];
    
    const dist = pointToSegmentDistance(
      point.lat, point.lon,
      segStart.lat, segStart.lon,
      segEnd.lat, segEnd.lon
    );
    
    if (dist <= maxDistance) {
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

  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy) * 111;
}

async function main() {
  console.log('🔧 Reassigning Uncovered Stops\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allStops = await prisma.paragem.findMany();
  const stopsWithCoords = allStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  // Get all vias
  const allVias = await prisma.via.findMany({
    include: {
      paragens: true
    }
  });

  // Find uncovered stops
  const coveredStops = new Set();
  allVias.forEach(via => {
    via.paragens.forEach(vp => {
      coveredStops.add(vp.paragemId);
    });
  });

  const uncoveredStops = stopsWithCoords.filter(s => !coveredStops.has(s.id));

  console.log(`📊 Uncovered stops: ${uncoveredStops.length}\n`);

  if (uncoveredStops.length === 0) {
    console.log('✅ All stops are already covered!\n');
    return;
  }

  let reassignedCount = 0;
  let stillUncovered = 0;

  for (const stop of uncoveredStops) {
    // Find vias that pass through this stop (within 10m)
    const viasPassingThrough = [];

    for (const via of allVias) {
      if (!via.geoLocationPath) continue;

      const pathCoords = via.geoLocationPath
        .split(';')
        .map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return { lng, lat, lon: lng };
        })
        .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

      const isNear = isPointNearPath(stop, pathCoords, 0.01); // 10m
      
      if (isNear) {
        viasPassingThrough.push(via);
      }
    }

    if (viasPassingThrough.length > 0) {
      console.log(`${stop.codigo}: ${stop.nome}`);
      console.log(`   Adding to ${viasPassingThrough.length} vias`);

      // Add to all vias that pass through
      for (const via of viasPassingThrough) {
        try {
          await prisma.viaParagem.create({
            data: {
              codigoParagem: stop.codigo,
              codigoVia: via.codigo,
              viaId: via.id,
              paragemId: stop.id,
              terminalBoolean: false
            }
          });
          reassignedCount++;
        } catch (error) {
          // Ignore duplicates
        }
      }
    } else {
      console.log(`⚠️  ${stop.codigo}: ${stop.nome} - No via passes through (within 10m)`);
      stillUncovered++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS');
  console.log(`✅ Stops reassigned: ${uncoveredStops.length - stillUncovered}`);
  console.log(`✅ New associations created: ${reassignedCount}`);
  console.log(`⚠️  Still uncovered: ${stillUncovered}\n`);

  // Final coverage check
  const viasAfterReassign = await prisma.via.findMany({
    include: {
      paragens: true
    }
  });

  const finalCoveredStops = new Set();
  viasAfterReassign.forEach(via => {
    via.paragens.forEach(vp => {
      finalCoveredStops.add(vp.paragemId);
    });
  });

  console.log('📊 FINAL COVERAGE');
  console.log(`✅ Covered stops: ${finalCoveredStops.size}/${allStops.length}\n`);

  console.log('='.repeat(80));
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
