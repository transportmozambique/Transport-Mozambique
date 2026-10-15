/**
 * Add Location Suffixes to Duplicate Stop Names
 * 
 * This script finds stops with duplicate names and adds location-based
 * suffixes to distinguish them (e.g., "Esquina (Zimpeto)", "Esquina (Matola Gare)")
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

// Known locations/neighborhoods in Maputo and Matola
const KNOWN_AREAS = [
  // Maputo areas
  { name: 'Maputo Centro', lat: -25.9655, lon: 32.5892, radius: 0.02 },
  { name: 'Polana', lat: -25.9580, lon: 32.5890, radius: 0.015 },
  { name: 'Sommerschield', lat: -25.9520, lon: 32.5950, radius: 0.015 },
  { name: 'Malhangalene', lat: -25.9450, lon: 32.5750, radius: 0.015 },
  { name: 'Maxaquene', lat: -25.9350, lon: 32.5650, radius: 0.015 },
  { name: 'Zimpeto', lat: -25.8353, lon: 32.5491, radius: 0.02 },
  { name: 'Albazine', lat: -25.9100, lon: 32.5500, radius: 0.015 },
  
  // Matola areas
  { name: 'Matola Gare', lat: -25.8270, lon: 32.4512, radius: 0.02 },
  { name: 'Tchumene', lat: -25.8495, lon: 32.4219, radius: 0.02 },
  { name: 'Machava', lat: -25.9087, lon: 32.4342, radius: 0.025 },
  { name: 'Machava Sede', lat: -25.9134, lon: 32.4993, radius: 0.02 },
  { name: 'Patrice Lumumba', lat: -25.8988, lon: 32.5114, radius: 0.015 },
  { name: 'Intaka', lat: -25.7817, lon: 32.5527, radius: 0.02 },
  { name: 'Cidade da Matola', lat: -25.9793, lon: 32.4648, radius: 0.015 },
  { name: 'Nkobe', lat: -25.8335, lon: 32.5043, radius: 0.015 },
  { name: 'Boquisso', lat: -25.7445, lon: 32.5433, radius: 0.03 },
  { name: 'Mucatine', lat: -25.7183, lon: 32.5287, radius: 0.02 },
];

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find the nearest known area for a stop
function findNearestArea(lat, lon) {
  let nearestArea = null;
  let minDistance = Infinity;
  
  for (const area of KNOWN_AREAS) {
    const distance = calculateDistance(lat, lon, area.lat, area.lon);
    
    // Check if within radius
    if (distance <= area.radius && distance < minDistance) {
      minDistance = distance;
      nearestArea = area.name;
    }
  }
  
  // If no area found within radius, find the closest one
  if (!nearestArea) {
    for (const area of KNOWN_AREAS) {
      const distance = calculateDistance(lat, lon, area.lat, area.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestArea = area.name;
      }
    }
  }
  
  return nearestArea;
}

// Generate a short location suffix based on coordinates
function generateLocationSuffix(lat, lon) {
  // Use a simple grid system for unique identification
  const latStr = Math.abs(lat).toFixed(3).replace('.', '');
  const lonStr = Math.abs(lon).toFixed(3).replace('.', '');
  return `${latStr.slice(-2)}${lonStr.slice(-2)}`;
}

async function addLocationSuffixes() {
  console.log('🏷️  Adding Location Suffixes to Duplicate Stop Names...\n');
  console.log('='.repeat(70));
  
  // Step 1: Get all stops
  console.log('\n1️⃣  Loading all stops...');
  const allStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
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
  
  console.log(`   ✅ Loaded ${allStops.length} stops`);
  
  // Step 2: Group stops by name to find duplicates
  console.log('\n2️⃣  Finding duplicate stop names...');
  const stopsByName = {};
  
  for (const stop of allStops) {
    if (!stopsByName[stop.nome]) {
      stopsByName[stop.nome] = [];
    }
    stopsByName[stop.nome].push(stop);
  }
  
  const duplicateNames = Object.entries(stopsByName)
    .filter(([name, stops]) => stops.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`   ✅ Found ${duplicateNames.length} duplicate stop names`);
  console.log(`   📊 Top duplicates:`);
  duplicateNames.slice(0, 10).forEach(([name, stops]) => {
    console.log(`      - "${name}": ${stops.length} stops`);
  });
  
  // Step 3: Add location suffixes to duplicates
  console.log('\n3️⃣  Adding location suffixes...');
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const [originalName, stops] of duplicateNames) {
    console.log(`\n   Processing "${originalName}" (${stops.length} stops):`);
    
    for (const stop of stops) {
      const [lat, lon] = stop.geoLocation.split(',').map(Number);
      
      // Find nearest area
      const nearestArea = findNearestArea(lat, lon);
      
      // Create new name with area suffix
      const newName = `${originalName} (${nearestArea})`;
      
      // Check if this name already exists for this stop
      if (stop.nome === newName) {
        console.log(`      ⏭️  ${stop.codigo}: Already has suffix`);
        skippedCount++;
        continue;
      }
      
      try {
        await retryOperation(async () => {
          await prisma.paragem.update({
            where: { id: stop.id },
            data: { nome: newName }
          });
        });
        
        console.log(`      ✅ ${stop.codigo}: "${originalName}" → "${newName}"`);
        updatedCount++;
        
        // Small delay to avoid overwhelming database
        if (updatedCount % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.log(`      ❌ ${stop.codigo}: Error - ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Updated: ${updatedCount} stops`);
  console.log(`⏭️  Skipped: ${skippedCount} stops`);
  console.log(`📝 Total duplicates processed: ${duplicateNames.length} names`);
  
  // Step 4: Show examples of updated stops
  console.log('\n4️⃣  Examples of updated stops:');
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
      take: 10
    });
  });
  
  updatedStops.forEach(stop => {
    const [lat, lon] = stop.geoLocation.split(',').map(Number);
    console.log(`   - ${stop.nome}`);
    console.log(`     Code: ${stop.codigo}, Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Location suffixes added successfully!');
  console.log('\n💡 Now stops with the same name are distinguished by their area:');
  console.log('   - "Esquina (Zimpeto)"');
  console.log('   - "Esquina (Matola Gare)"');
  console.log('   - "Esquina (Machava)"');
  console.log('\n📱 Users will now see clear location information for each stop!');
}

// Run the script
addLocationSuffixes()
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
