const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function calculateRouteLength(geoLocationPath) {
  if (!geoLocationPath) return 0;
  
  const coordinates = geoLocationPath
    .split(';')
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return { lng, lat };
    })
    .filter(coord => !isNaN(coord.lng) && !isNaN(coord.lat));

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const from = coordinates[i];
    const to = coordinates[i + 1];
    
    const R = 6371;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance;
}

async function main() {
  console.log('🔍 Final System Verification\n');
  console.log('='.repeat(80) + '\n');

  // 1. Get all data
  const allParagens = await prisma.paragem.findMany();
  const allVias = await prisma.via.findMany({
    include: {
      paragens: {
        include: {
          paragem: true
        }
      }
    }
  });

  console.log(`📊 Total stops in database: ${allParagens.length}`);
  console.log(`📊 Total vias: ${allVias.length}\n`);

  // 2. Check unique stops covered
  const uniqueStopsCovered = new Set();
  allVias.forEach(via => {
    via.paragens.forEach(vp => {
      uniqueStopsCovered.add(vp.paragemId);
    });
  });

  const uncoveredStops = allParagens.filter(p => !uniqueStopsCovered.has(p.id));

  console.log('📊 STOP COVERAGE');
  console.log('='.repeat(80));
  console.log(`✅ Unique stops covered: ${uniqueStopsCovered.size}/${allParagens.length}`);
  console.log(`❌ Uncovered stops: ${uncoveredStops.length}`);
  
  if (uncoveredStops.length > 0 && uncoveredStops.length <= 20) {
    console.log('\n⚠️  Uncovered stops:');
    uncoveredStops.forEach(stop => {
      console.log(`   - ${stop.codigo}: ${stop.nome}`);
    });
  }
  console.log('='.repeat(80) + '\n');

  // 3. Route length distribution
  const lengthCategories = {
    '0-10km': 0,
    '10-20km': 0,
    '20-30km': 0,
    '30-50km': 0,
    '50-70km': 0,
    '70km+': 0
  };

  const routeLengths = [];

  allVias.forEach(via => {
    const length = calculateRouteLength(via.geoLocationPath);
    routeLengths.push({ codigo: via.codigo, length, stops: via.paragens.length });
    
    if (length < 10) lengthCategories['0-10km']++;
    else if (length < 20) lengthCategories['10-20km']++;
    else if (length < 30) lengthCategories['20-30km']++;
    else if (length < 50) lengthCategories['30-50km']++;
    else if (length < 70) lengthCategories['50-70km']++;
    else lengthCategories['70km+']++;
  });

  console.log('📊 ROUTE LENGTH DISTRIBUTION');
  console.log('='.repeat(80));
  Object.entries(lengthCategories).forEach(([range, count]) => {
    const bar = '█'.repeat(Math.floor(count / 2));
    const pct = ((count / allVias.length) * 100).toFixed(1);
    console.log(`${range.padEnd(12)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%) ${bar}`);
  });
  console.log('='.repeat(80) + '\n');

  // 4. Stops per via distribution
  const stopCategories = {
    '0-10': 0,
    '11-20': 0,
    '21-30': 0,
    '31-50': 0,
    '51-100': 0,
    '100+': 0
  };

  allVias.forEach(via => {
    const stops = via.paragens.length;
    
    if (stops <= 10) stopCategories['0-10']++;
    else if (stops <= 20) stopCategories['11-20']++;
    else if (stops <= 30) stopCategories['21-30']++;
    else if (stops <= 50) stopCategories['31-50']++;
    else if (stops <= 100) stopCategories['51-100']++;
    else stopCategories['100+']++;
  });

  console.log('📊 STOPS PER VIA DISTRIBUTION');
  console.log('='.repeat(80));
  Object.entries(stopCategories).forEach(([range, count]) => {
    const bar = '█'.repeat(Math.floor(count / 2));
    const pct = ((count / allVias.length) * 100).toFixed(1);
    console.log(`${range.padEnd(12)}: ${count.toString().padStart(3)} (${pct.padStart(5)}%) ${bar}`);
  });
  console.log('='.repeat(80) + '\n');

  // 5. Top 10 longest routes
  routeLengths.sort((a, b) => b.length - a.length);
  
  console.log('📊 TOP 10 LONGEST ROUTES');
  console.log('='.repeat(80));
  routeLengths.slice(0, 10).forEach((r, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${r.codigo.padEnd(6)} ${r.length.toFixed(1).padStart(6)} km  ${r.stops.toString().padStart(3)} stops`);
  });
  console.log('='.repeat(80) + '\n');

  // 6. Routes with most stops
  const byStops = [...routeLengths].sort((a, b) => b.stops - a.stops);
  
  console.log('📊 TOP 10 ROUTES BY STOP COUNT');
  console.log('='.repeat(80));
  byStops.slice(0, 10).forEach((r, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${r.codigo.padEnd(6)} ${r.stops.toString().padStart(3)} stops  ${r.length.toFixed(1).padStart(6)} km`);
  });
  console.log('='.repeat(80) + '\n');

  // 7. Final summary
  const totalAssociations = allVias.reduce((sum, v) => sum + v.paragens.length, 0);
  const avgStopsPerVia = totalAssociations / allVias.length;
  const avgRouteLength = routeLengths.reduce((sum, r) => sum + r.length, 0) / routeLengths.length;

  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Total vias: ${allVias.length}`);
  console.log(`✅ Total unique stops: ${allParagens.length}`);
  console.log(`✅ Unique stops covered: ${uniqueStopsCovered.size} (${((uniqueStopsCovered.size / allParagens.length) * 100).toFixed(1)}%)`);
  console.log(`✅ Total stop-via associations: ${totalAssociations}`);
  console.log(`📊 Average stops per via: ${avgStopsPerVia.toFixed(1)}`);
  console.log(`📊 Average route length: ${avgRouteLength.toFixed(1)} km`);
  console.log(`\n✅ Routes >= 10km: ${allVias.length - lengthCategories['0-10km']}`);
  console.log(`⚠️  Routes < 10km: ${lengthCategories['0-10km']}`);
  console.log(`📊 Routes > 70km: ${lengthCategories['70km+']}`);
  console.log('='.repeat(80) + '\n');

  if (uniqueStopsCovered.size === allParagens.length) {
    console.log('🎉 SUCCESS: All stops are covered!\n');
  } else {
    console.log(`⚠️  WARNING: ${allParagens.length - uniqueStopsCovered.size} stops are not covered!\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
