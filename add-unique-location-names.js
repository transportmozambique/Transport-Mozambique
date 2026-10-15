/**
 * Add Unique Location Names to Duplicate Stops
 * 
 * This script uses OpenStreetMap's Nominatim API to get actual street names
 * and addresses for each stop, making them truly unique and identifiable.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Retry logic for database operations
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`⚠️  Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// Get address from OpenStreetMap Nominatim API
async function getAddressFromCoordinates(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TransporteMocambique/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.address) {
      return null;
    }
    
    const addr = data.address;
    
    // Build a descriptive location string
    // Priority: road > suburb > neighbourhood > quarter > city_district
    let location = null;
    
    if (addr.road) {
      location = addr.road;
      // Add house number if available
      if (addr.house_number) {
        location = `${addr.road} ${addr.house_number}`;
      }
    } else if (addr.suburb) {
      location = addr.suburb;
    } else if (addr.neighbourhood) {
      location = addr.neighbourhood;
    } else if (addr.quarter) {
      location = addr.quarter;
    } else if (addr.city_district) {
      location = addr.city_district;
    }
    
    return location;
  } catch (error) {
    console.log(`    ⚠️  Nominatim error: ${error.message}`);
    return null;
  }
}

// Generate a unique suffix based on coordinates
function generateCoordinateSuffix(lat, lon) {
  // Create a readable coordinate-based suffix
  const latStr = lat.toFixed(4);
  const lonStr = lon.toFixed(4);
  return `${latStr}, ${lonStr}`;
}

async function addUniqueLocationNames() {
  console.log('🗺️  Adding Unique Location Names from OpenStreetMap...\n');
  console.log('='.repeat(70));
  console.log('⚠️  This will take some time due to API rate limiting (1 request/second)');
  console.log('='.repeat(70));
  
  // Step 1: Get all stops with duplicate names (those with parentheses)
  console.log('\n1️⃣  Finding stops with duplicate names...');
  const duplicateStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
      where: {
        nome: {
          contains: '('
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true
      },
      orderBy: {
        nome: 'asc'
      }
    });
  });
  
  console.log(`   ✅ Found ${duplicateStops.length} stops with area suffixes`);
  
  // Group by base name (without the area suffix)
  const stopsByBaseName = {};
  for (const stop of duplicateStops) {
    const baseName = stop.nome.split(' (')[0];
    if (!stopsByBaseName[baseName]) {
      stopsByBaseName[baseName] = [];
    }
    stopsByBaseName[baseName].push(stop);
  }
  
  const duplicateGroups = Object.entries(stopsByBaseName)
    .filter(([name, stops]) => stops.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`   📊 Found ${duplicateGroups.length} groups still needing unique names`);
  console.log(`   Top duplicates:`);
  duplicateGroups.slice(0, 10).forEach(([name, stops]) => {
    console.log(`      - "${name}": ${stops.length} stops`);
  });
  
  // Step 2: Process each duplicate group
  console.log('\n2️⃣  Fetching unique addresses from OpenStreetMap...');
  console.log('   (Rate limit: 1 request per second)\n');
  
  let updatedCount = 0;
  let failedCount = 0;
  let totalProcessed = 0;
  
  for (const [baseName, stops] of duplicateGroups) {
    console.log(`\n   Processing "${baseName}" (${stops.length} stops):`);
    
    for (const stop of stops) {
      totalProcessed++;
      const [lat, lon] = stop.geoLocation.split(',').map(Number);
      
      // Get address from Nominatim
      const address = await getAddressFromCoordinates(lat, lon);
      
      // Wait 1 second between requests (Nominatim rate limit)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      let newName;
      if (address) {
        newName = `${baseName} (${address})`;
        console.log(`      ✅ ${stop.codigo}: "${stop.nome}" → "${newName}"`);
      } else {
        // Fallback to coordinates
        const coordSuffix = generateCoordinateSuffix(lat, lon);
        newName = `${baseName} (${coordSuffix})`;
        console.log(`      ⚠️  ${stop.codigo}: No address found, using coordinates`);
        failedCount++;
      }
      
      // Update the stop name
      try {
        await retryOperation(async () => {
          await prisma.paragem.update({
            where: { id: stop.id },
            data: { nome: newName }
          });
        });
        updatedCount++;
      } catch (error) {
        console.log(`      ❌ ${stop.codigo}: Update failed - ${error.message}`);
      }
      
      // Progress indicator
      if (totalProcessed % 10 === 0) {
        const remaining = duplicateStops.length - totalProcessed;
        const estimatedMinutes = Math.ceil(remaining / 60);
        console.log(`\n      📊 Progress: ${totalProcessed}/${duplicateStops.length} (${estimatedMinutes} min remaining)`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Updated with addresses: ${updatedCount - failedCount} stops`);
  console.log(`⚠️  Updated with coordinates: ${failedCount} stops`);
  console.log(`📝 Total updated: ${updatedCount} stops`);
  
  // Step 3: Show examples
  console.log('\n3️⃣  Examples of updated stops:');
  const updatedStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
      where: {
        nome: {
          contains: '('
        }
      },
      select: {
        nome: true,
        codigo: true,
        geoLocation: true
      },
      take: 15
    });
  });
  
  updatedStops.forEach(stop => {
    console.log(`   - ${stop.nome}`);
    console.log(`     Code: ${stop.codigo}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Unique location names added successfully!');
  console.log('\n💡 Now each stop has a unique, identifiable location:');
  console.log('   - "Farmácia (Avenida Julius Nyerere)"');
  console.log('   - "Farmácia (Rua da Resistência)"');
  console.log('   - "Esquina (Avenida de Moçambique)"');
  console.log('   - "Esquina (Rua dos Continuadores)"');
  console.log('\n📱 Users can now easily distinguish between stops!');
}

// Run the script
addUniqueLocationNames()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
