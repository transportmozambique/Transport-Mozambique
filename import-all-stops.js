/**
 * Import ALL Maputo and Matola Bus Stops to Database
 * 
 * This script imports 2000+ bus stops from OpenStreetMap data
 * Format: @id  @lat  @lon  name (tab-separated)
 * 
 * Run: node import-all-stops.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

// Parse tab-separated OSM data
function parseOSMData(rawData) {
  const lines = rawData.trim().split('\n');
  const stops = [];
  
  // Skip header line if it exists
  const startIndex = lines[0].includes('@id') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by tab character
    const parts = line.split('\t');
    
    // Need at least 3 parts (id, lat, lon) - name is optional
    if (parts.length < 3) continue;
    
    const osmId = parts[0].trim();
    const lat = parseFloat(parts[1].trim());
    const lon = parseFloat(parts[2].trim());
    const name = parts[3] ? parts[3].trim() : `Stop ${osmId}`;
    
    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon)) continue;
    
    // Skip stops without names (empty string)
    if (!name || name === '') continue;
    
    stops.push({
      osmId,
      lat,
      lon,
      name
    });
  }
  
  return stops;
}

async function importAllStops() {
  console.log('🚏 Starting import of ALL Maputo & Matola bus stops...\n');

  // Read both data files
  let maputoData = '';
  let matolaData = '';
  
  try {
    maputoData = fs.readFileSync('maputo-stops-data.json', 'utf-8');
    console.log('✅ Loaded Maputo stops data');
  } catch (error) {
    console.log('⚠️  Could not load maputo-stops-data.json');
  }
  
  try {
    matolaData = fs.readFileSync('matola-stops-data.json', 'utf-8');
    console.log('✅ Loaded Matola stops data');
  } catch (error) {
    console.log('⚠️  Could not load matola-stops-data.json');
  }

  // Parse both datasets
  const maputoStops = parseOSMData(maputoData);
  const matolaStops = parseOSMData(matolaData);
  
  console.log(`\n📊 Parsed ${maputoStops.length} Maputo stops`);
  console.log(`📊 Parsed ${matolaStops.length} Matola stops`);
  
  // Combine all stops
  const allStops = [...maputoStops, ...matolaStops];
  console.log(`📊 Total stops to import: ${allStops.length}\n`);

  if (allStops.length === 0) {
    console.error('❌ No stops found in data files. Please check the format.');
    process.exit(1);
  }

  let addedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Get all existing stops to avoid duplicates
  console.log('🔍 Checking existing stops in database...');
  const existingStops = await prisma.paragem.findMany({
    select: {
      nome: true,
      geoLocation: true,
      codigo: true
    }
  });

  const existingSet = new Set(
    existingStops.map(s => `${s.nome}|${s.geoLocation}`)
  );
  
  const existingCodigos = new Set(
    existingStops.map(s => s.codigo)
  );

  console.log(`📍 Found ${existingStops.length} existing stops in database\n`);

  // Process stops in batches for better performance
  const BATCH_SIZE = 100;
  for (let i = 0; i < allStops.length; i += BATCH_SIZE) {
    const batch = allStops.slice(i, i + BATCH_SIZE);
    
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allStops.length / BATCH_SIZE);
    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, allStops.length)} of ${allStops.length})...`);

    for (const stop of batch) {
      try {
        const geoLocation = `${stop.lat},${stop.lon}`;
        const key = `${stop.name}|${geoLocation}`;

        // Check if already exists by name+location
        if (existingSet.has(key)) {
          skippedCount++;
          continue;
        }

        // Generate unique codigo from OSM ID
        let codigo = `OSM-${stop.osmId}`;
        
        // If codigo already exists, add a suffix
        let suffix = 1;
        while (existingCodigos.has(codigo)) {
          codigo = `OSM-${stop.osmId}-${suffix}`;
          suffix++;
        }

        // Create new stop
        await prisma.paragem.create({
          data: {
            nome: stop.name,
            codigo: codigo,
            geoLocation: geoLocation
          }
        });

        console.log(`✅ Added: ${stop.name} (${codigo})`);
        addedCount++;
        existingSet.add(key);
        existingCodigos.add(codigo);

      } catch (error) {
        console.error(`❌ Error adding ${stop.name}:`, error.message);
        errorCount++;
      }
    }

    // Small delay between batches to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully added: ${addedCount} stops`);
  console.log(`⏭️  Skipped (already exist): ${skippedCount} stops`);
  console.log(`❌ Errors: ${errorCount} stops`);
  console.log(`📍 Total processed: ${allStops.length} stops`);
  console.log('='.repeat(70));

  // Verify total stops in database
  const totalStops = await prisma.paragem.count();
  console.log(`\n📊 Total stops now in database: ${totalStops}`);
  
  console.log('\n🎉 Import completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Connect these stops to routes using ViaParagem relations');
  console.log('   2. Update route paths to include these stops');
  console.log('   3. Update USSD neighborhood mappings');
  console.log('   4. Test the webapp and USSD to verify stops appear correctly');
  console.log('\n📝 Note: For transports to show up, their routes must pass through');
  console.log('   the stop you are searching from (via ViaParagem relations).');
}

// Run the script
importAllStops()
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
