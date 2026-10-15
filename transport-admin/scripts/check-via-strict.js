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
  const viaCodigo = process.argv[2] || 'V038';
  
  console.log(`🔍 Checking ${viaCodigo} with STRICT criteria (10m)\n`);
  console.log('='.repeat(80) + '\n');

  const via = await prisma.via.findUnique({
    where: { codigo: viaCodigo },
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  if (!via) {
    console.log(`❌ Via ${viaCodigo} not found!`);
    return;
  }

  console.log(`📍 ${via.codigo}: ${via.nome}`);
  console.log(`   Terminal Partida: ${via.terminalPartida}`);
  console.log(`   Terminal Chegada: ${via.terminalChegada}`);
  console.log(`   Currently associated stops: ${via.paragens.length}\n`);

  if (!via.geoLocationPath) {
    console.log('❌ No route path defined!');
    return;
  }

  // Parse route path
  const pathCoords = via.geoLocationPath
    .split(';')
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return { lng, lat, lon: lng };
    })
    .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

  // Get all stops
  const allStops = await prisma.paragem.findMany();
  const stopsWithCoords = allStops.map(s => {
    const [lat, lon] = s.geoLocation.split(',').map(Number);
    return { ...s, lat, lon };
  });

  // Check each associated stop with STRICT criteria (200m)
  const incorrectStops = [];
  const correctStops = [];

  for (const vp of via.paragens) {
    const stop = stopsWithCoords.find(s => s.id === vp.paragemId);
    if (!stop) continue;

    const isNear = isPointNearPath(stop, pathCoords, 0.01); // 10m
    
    if (!isNear) {
      incorrectStops.push(stop);
    } else {
      correctStops.push(stop);
    }
  }

  console.log('📊 RESULTS (STRICT: 10m)');
  console.log('='.repeat(80));
  console.log(`✅ Correct associations: ${correctStops.length}`);
  console.log(`❌ Incorrect associations: ${incorrectStops.length}\n`);

  if (incorrectStops.length > 0) {
    console.log('❌ STOPS NOT ON ROUTE (should be removed):\n');
    
    incorrectStops.forEach((stop, idx) => {
      console.log(`${(idx + 1).toString().padStart(3)}. ${stop.codigo}: ${stop.nome}`);
    });
  } else {
    console.log('✅ All stops are on the route!\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
