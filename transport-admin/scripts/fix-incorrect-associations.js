const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function isPointNearPath(point, pathCoords, maxDistance = 1.0) {
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
  console.log('🔧 Fixing Incorrect Stop Associations\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allStops = await prisma.paragem.findMany();
  const stopsWithCoords = allStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  // Get all vias with their associations
  const allVias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  let totalRemoved = 0;
  let totalKept = 0;

  for (const via of allVias) {
    if (!via.geoLocationPath) continue;

    // Parse route path
    const pathCoords = via.geoLocationPath
      .split(';')
      .map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat, lon: lng };
      })
      .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

    // Check each associated stop
    let removedFromThisVia = 0;

    for (const vp of via.paragens) {
      const stop = stopsWithCoords.find(s => s.id === vp.paragemId);
      if (!stop) continue;

      const isNearRoute = isPointNearPath(stop, pathCoords, 1.0);
      
      if (!isNearRoute) {
        // Remove this incorrect association
        await prisma.viaParagem.delete({
          where: {
            id: vp.id
          }
        });
        
        console.log(`❌ Removed: ${via.codigo} - ${stop.codigo} (${stop.nome})`);
        totalRemoved++;
        removedFromThisVia++;
      } else {
        totalKept++;
      }
    }

    if (removedFromThisVia > 0) {
      console.log(`   ✅ ${via.codigo}: Removed ${removedFromThisVia} incorrect associations\n`);
    }
  }

  console.log('='.repeat(80));
  console.log('📊 RESULTS');
  console.log(`✅ Kept correct associations: ${totalKept}`);
  console.log(`❌ Removed incorrect associations: ${totalRemoved}\n`);

  // Now check if any stops became uncovered
  const viasAfterFix = await prisma.via.findMany({
    include: {
      paragens: true
    }
  });

  const coveredStops = new Set();
  viasAfterFix.forEach(via => {
    via.paragens.forEach(vp => {
      coveredStops.add(vp.paragemId);
    });
  });

  const uncoveredStops = allStops.filter(s => !coveredStops.has(s.id));

  console.log('📊 STOP COVERAGE AFTER FIX');
  console.log(`✅ Covered stops: ${coveredStops.size}/${allStops.length}`);
  console.log(`❌ Uncovered stops: ${uncoveredStops.length}\n`);

  if (uncoveredStops.length > 0) {
    console.log('⚠️  Stops that became uncovered:');
    uncoveredStops.forEach(stop => {
      console.log(`   - ${stop.codigo}: ${stop.nome} (${stop.geoLocation})`);
    });
    console.log('\n⚠️  These stops need to be assigned to vias that actually pass through them!\n');
  }

  console.log('='.repeat(80));
  console.log('✅ Fix complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
