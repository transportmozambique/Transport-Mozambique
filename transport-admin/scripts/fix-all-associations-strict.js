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
  console.log('🔧 Fixing All Via Associations with STRICT criteria (10m)\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allStops = await prisma.paragem.findMany();
  const stopsWithCoords = allStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  console.log(`📊 Total stops: ${allStops.length}\n`);

  // Get all vias
  const allVias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total vias: ${allVias.length}\n`);

  let totalRemoved = 0;
  let totalKept = 0;
  let viasFixed = 0;

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

    // Check each associated stop with STRICT criteria (10m)
    let removedFromThisVia = 0;

    for (const vp of via.paragens) {
      const stop = stopsWithCoords.find(s => s.id === vp.paragemId);
      if (!stop) continue;

      const isNear = isPointNearPath(stop, pathCoords, 0.01); // 10m
      
      if (!isNear) {
        // Remove this incorrect association
        await prisma.viaParagem.delete({
          where: {
            id: vp.id
          }
        });
        
        totalRemoved++;
        removedFromThisVia++;
      } else {
        totalKept++;
      }
    }

    if (removedFromThisVia > 0) {
      viasFixed++;
      console.log(`${via.codigo}: Removed ${removedFromThisVia} stops (kept ${via.paragens.length - removedFromThisVia})`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS');
  console.log(`✅ Vias fixed: ${viasFixed}`);
  console.log(`✅ Kept correct associations: ${totalKept}`);
  console.log(`❌ Removed incorrect associations: ${totalRemoved}\n`);

  // Check coverage
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

  if (uncoveredStops.length > 0 && uncoveredStops.length <= 50) {
    console.log('⚠️  Stops that became uncovered:');
    uncoveredStops.forEach(stop => {
      console.log(`   - ${stop.codigo}: ${stop.nome}`);
    });
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Fix complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
