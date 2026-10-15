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
  console.log('🔍 Checking All Vias for Missing Stops\n');
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
      paragens: true
    },
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total vias: ${allVias.length}\n`);

  let totalMissing = 0;
  let viasWithMissing = [];

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

    // Find missing stops
    const associatedStopIds = new Set(via.paragens.map(vp => vp.paragemId));
    let missingCount = 0;

    for (const stop of stopsWithCoords) {
      const isNear = isPointNearPath(stop, pathCoords, 1.0);
      
      if (isNear && !associatedStopIds.has(stop.id)) {
        missingCount++;
      }
    }

    if (missingCount > 0) {
      totalMissing += missingCount;
      viasWithMissing.push({
        codigo: via.codigo,
        nome: via.nome,
        currentStops: via.paragens.length,
        missingStops: missingCount,
        totalShouldHave: via.paragens.length + missingCount
      });
    }
  }

  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`⚠️  Vias with missing stops: ${viasWithMissing.length}/${allVias.length}`);
  console.log(`⚠️  Total missing stop associations: ${totalMissing}\n`);

  if (viasWithMissing.length > 0) {
    console.log('⚠️  VIAS WITH MISSING STOPS:\n');
    
    // Sort by most missing
    viasWithMissing.sort((a, b) => b.missingStops - a.missingStops);
    
    viasWithMissing.forEach((via, idx) => {
      console.log(`${(idx + 1).toString().padStart(3)}. ${via.codigo.padEnd(6)} Missing: ${via.missingStops.toString().padStart(3)} | Current: ${via.currentStops.toString().padStart(3)} | Should have: ${via.totalShouldHave.toString().padStart(3)}`);
      if (idx < 20) {
        console.log(`     ${via.nome}`);
      }
    });
    
    if (viasWithMissing.length > 20) {
      console.log(`\n     ... and ${viasWithMissing.length - 20} more vias`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
