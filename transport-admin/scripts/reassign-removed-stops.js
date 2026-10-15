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
  console.log('🔍 Checking if removed stops are covered by other vias\n');
  console.log('='.repeat(80) + '\n');

  // The 4 stops that were removed
  const removedStopCodes = ['PAR-0497', 'PAR-0498', 'PAR-0499', 'PAR-0522'];

  const removedStops = await prisma.paragem.findMany({
    where: {
      codigo: { in: removedStopCodes }
    }
  });

  const stopsWithCoords = removedStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  console.log('📍 Removed stops:');
  stopsWithCoords.forEach(s => {
    console.log(`   ${s.codigo}: ${s.nome} (${s.geoLocation})`);
  });
  console.log('');

  // Get all vias
  const allVias = await prisma.via.findMany({
    include: {
      paragens: true
    }
  });

  // Check which vias these stops are currently associated with
  for (const stop of stopsWithCoords) {
    const associatedVias = allVias.filter(via => 
      via.paragens.some(vp => vp.paragemId === stop.id)
    );

    console.log(`\n${stop.codigo}: ${stop.nome}`);
    console.log(`   Currently associated with ${associatedVias.length} vias:`);
    associatedVias.forEach(via => {
      console.log(`      - ${via.codigo}: ${via.nome}`);
    });

    // Find vias that actually pass through this stop
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

      const isNear = isPointNearPath(stop, pathCoords, 1.0);
      
      if (isNear) {
        viasPassingThrough.push(via);
      }
    }

    console.log(`   Vias that actually pass through (within 1km): ${viasPassingThrough.length}`);
    
    if (viasPassingThrough.length > 0) {
      viasPassingThrough.slice(0, 5).forEach(via => {
        const alreadyAssociated = via.paragens.some(vp => vp.paragemId === stop.id);
        const status = alreadyAssociated ? '✅ Already associated' : '⚠️  Not associated';
        console.log(`      - ${via.codigo}: ${via.nome} ${status}`);
      });
      
      if (viasPassingThrough.length > 5) {
        console.log(`      ... and ${viasPassingThrough.length - 5} more`);
      }
    } else {
      console.log(`      ⚠️  No vias pass through this stop!`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
