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
  console.log('🔍 Checking All Vias for Incorrect Associations\n');
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
      paragens: {
        include: {
          paragem: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  let totalIncorrect = 0;
  let viasWithIncorrect = [];

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
    let incorrectCount = 0;

    for (const vp of via.paragens) {
      const stop = stopsWithCoords.find(s => s.id === vp.paragemId);
      if (!stop) continue;

      const isNear = isPointNearPath(stop, pathCoords, 1.0);
      
      if (!isNear) {
        incorrectCount++;
      }
    }

    if (incorrectCount > 0) {
      totalIncorrect += incorrectCount;
      viasWithIncorrect.push({
        codigo: via.codigo,
        nome: via.nome,
        totalStops: via.paragens.length,
        incorrectCount: incorrectCount,
        correctCount: via.paragens.length - incorrectCount
      });
    }
  }

  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`⚠️  Vias with incorrect associations: ${viasWithIncorrect.length}/${allVias.length}`);
  console.log(`⚠️  Total incorrect stop associations: ${totalIncorrect}\n`);

  if (viasWithIncorrect.length > 0) {
    console.log('⚠️  VIAS WITH INCORRECT ASSOCIATIONS:\n');
    
    // Sort by most incorrect
    viasWithIncorrect.sort((a, b) => b.incorrectCount - a.incorrectCount);
    
    viasWithIncorrect.forEach((via, idx) => {
      console.log(`${(idx + 1).toString().padStart(3)}. ${via.codigo.padEnd(6)} Incorrect: ${via.incorrectCount.toString().padStart(3)} | Correct: ${via.correctCount.toString().padStart(3)} | Total: ${via.totalStops.toString().padStart(3)}`);
      if (idx < 20) {
        console.log(`     ${via.nome}`);
      }
    });
    
    if (viasWithIncorrect.length > 20) {
      console.log(`\n     ... and ${viasWithIncorrect.length - 20} more vias`);
    }
  } else {
    console.log('✅ All associations are correct!\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
