const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGeoAndPrices() {
  console.log('🔍 Checking Geolocations and Prices\n');
  console.log('=' .repeat(80));
  
  // Check buses with geolocations
  const buses = await prisma.transporte.findMany({
    select: {
      id: true,
      matricula: true,
      currGeoLocation: true,
      via: {
        select: {
          nome: true,
          terminalPartida: true,
          terminalChegada: true
        }
      }
    }
  });
  
  console.log(`\n🚌 BUSES: ${buses.length} total`);
  const busesWithGeo = buses.filter(b => b.currGeoLocation);
  const busesWithoutGeo = buses.filter(b => !b.currGeoLocation);
  
  console.log(`  ✅ With geolocation: ${busesWithGeo.length}`);
  console.log(`  ❌ Without geolocation: ${busesWithoutGeo.length}`);
  
  if (busesWithoutGeo.length > 0) {
    console.log('\n  Buses without geolocation:');
    busesWithoutGeo.slice(0, 10).forEach(b => {
      console.log(`    - ${b.matricula} (Route: ${b.via?.nome || 'N/A'})`);
    });
  }
  
  // Check GeoLocation table
  const geoLocations = await prisma.geoLocation.findMany({
    select: {
      id: true,
      geoLocation: true,
      transporteId: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log(`\n\n📍 GEO LOCATION RECORDS: ${geoLocations.length} recent`);
  geoLocations.forEach(g => {
    console.log(`  ${g.geoLocation} - Bus ${g.transporteId} (${g.createdAt.toISOString()})`);
  });
  
  // Check if we need a price table
  console.log('\n\n💰 CHECKING PRICE STRUCTURE...');
  
  // Check if there's a Tarifa/Price table
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log('\n  Available tables:');
    tables.forEach(t => console.log(`    - ${t.table_name}`));
    
    const hasTarifaTable = tables.some(t => 
      t.table_name.toLowerCase().includes('tarifa') || 
      t.table_name.toLowerCase().includes('price') ||
      t.table_name.toLowerCase().includes('preco')
    );
    
    if (hasTarifaTable) {
      console.log('\n  ✅ Price table exists');
    } else {
      console.log('\n  ❌ No price table found');
      console.log('  💡 Prices should be calculated based on distance');
    }
  } catch (error) {
    console.log('  ⚠️  Could not check tables:', error.message);
  }
  
  // Check routes for any price-related fields
  const routes = await prisma.via.findMany({
    select: {
      nome: true,
      terminalPartida: true,
      terminalChegada: true
    },
    take: 5
  });
  
  console.log('\n\n🛣️  ROUTE STRUCTURE (sample):');
  console.log('  Routes do NOT have a price field');
  console.log('  Prices are calculated dynamically based on distance');
  
  // Show current fare calculation logic
  console.log('\n\n💵 CURRENT FARE CALCULATION:');
  console.log('  0-5km:   15 MT');
  console.log('  5-10km:  20 MT');
  console.log('  10-15km: 25 MT');
  console.log('  15-20km: 30 MT');
  console.log('  20+km:   35 MT');
  
  await prisma.$disconnect();
}

checkGeoAndPrices().catch(console.error);
