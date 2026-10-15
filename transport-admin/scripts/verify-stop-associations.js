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
  console.log('🔍 Verifying Stop Associations\n');
  console.log('='.repeat(80) + '\n');

  // Get all stops
  const allStops = await prisma.paragem.findMany();
  const stopsWithCoords = allStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  console.log(`📊 Total stops: ${allStops.length}\n`);

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

  let totalIncorrect = 0;
  let totalCorrect = 0;
  let viasWithIssues = [];

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
    let incorrectStops = [];
    let correctStops = 0;

    for (const vp of via.paragens) {
      const stop = stopsWithCoords.find(s => s.id === vp.paragemId);
      if (!stop) continue;

      const isNearRoute = isPointNearPath(stop, pathCoords, 1.0);
      
      if (!isNearRoute) {
        incorrectStops.push({
          codigo: stop.codigo,
          nome: stop.nome,
          location: stop.geoLocation
        });
        totalIncorrect++;
      } else {
        correctStops++;
        totalCorrect++;
      }
    }

    if (incorrectStops.length > 0) {
      viasWithIssues.push({
        codigo: via.codigo,
        nome: via.nome,
        totalStops: via.paragens.length,
        incorrectCount: incorrectStops.length,
        correctCount: correctStops,
        incorrectStops: incorrectStops.slice(0, 5) // Show first 5
      });
    }
  }

  console.log('📊 ASSOCIATION VERIFICATION RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Correct associations: ${totalCorrect}`);
  console.log(`❌ Incorrect associations: ${totalIncorrect}`);
  console.log(`⚠️  Vias with issues: ${viasWithIssues.length}/${allVias.length}\n`);

  if (viasWithIssues.length > 0) {
    console.log('⚠️  VIAS WITH INCORRECT ASSOCIATIONS:\n');
    
    viasWithIssues.slice(0, 10).forEach(via => {
      console.log(`${via.codigo}: ${via.nome}`);
      console.log(`   Total stops: ${via.totalStops}`);
      console.log(`   Correct: ${via.correctCount} | Incorrect: ${via.incorrectCount}`);
      console.log(`   Sample incorrect stops:`);
      via.incorrectStops.forEach(stop => {
        console.log(`      - ${stop.codigo}: ${stop.nome}`);
      });
      console.log('');
    });

    if (viasWithIssues.length > 10) {
      console.log(`   ... and ${viasWithIssues.length - 10} more vias with issues\n`);
    }
  }

  // Check for stops not covered by any via
  const coveredStops = new Set();
  allVias.forEach(via => {
    via.paragens.forEach(vp => {
      coveredStops.add(vp.paragemId);
    });
  });

  const uncoveredStops = allStops.filter(s => !coveredStops.has(s.id));

  console.log('='.repeat(80));
  console.log(`📊 STOP COVERAGE`);
  console.log(`✅ Covered stops: ${coveredStops.size}/${allStops.length}`);
  console.log(`❌ Uncovered stops: ${uncoveredStops.length}\n`);

  if (uncoveredStops.length > 0 && uncoveredStops.length <= 20) {
    console.log('⚠️  Uncovered stops:');
    uncoveredStops.forEach(stop => {
      console.log(`   - ${stop.codigo}: ${stop.nome}`);
    });
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Verification complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
