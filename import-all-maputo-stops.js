/**
 * Import ALL Maputo Bus Stops to Neon Database
 * 
 * This script imports 2000+ bus stops from OpenStreetMap data
 * provided by the user in tab-separated format.
 * 
 * Run: node import-all-maputo-stops.js
 */

// Load environment variables
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Complete OSM data from user (tab-separated: @id, @lat, @lon, name)
// This data will be read from a separate file to keep this script clean
const fs = require('fs');

// Parse tab-separated OSM data
function parseOSMData(rawData) {
  const lines = rawData.trim().split('\n');
  const stops = [];
  
  for (const line of lines) {
    // Split by tab character
    const parts = line.split('\t');
    
    // Skip lines that don't have all required fields
    if (parts.length < 3) continue;
    
    const osmId = parts[0].trim();
    const lat = parseFloat(parts[1].trim());
    const lon = parseFloat(parts[2].trim());
    const name = parts[3] ? parts[3].trim() : `Stop ${osmId}`;
    
    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon)) continue;
    
    stops.push({
      osmId,
      lat,
      lon,
      name
    });
  }
  
  return stops;
}

async function importAllMaputoStops() {
  console.log('🚏 Starting import of ALL Maputo bus stops from OSM data...\n');

  // Read the OSM data from user input (you'll paste it here or read from file)
  const rawData = process.argv[2] || fs.readFileSync('maputo-stops-osm-data.txt', 'utf-8');
  
  const stops = parseOSMData(rawData);
  console.log(`📊 Parsed ${stops.length} stops from OSM data\n`);

  if (stops.length === 0) {
    console.error('❌ No stops found in data. Please check the input format.');
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

  console.log(`📍 Found ${existingStops.length} existing stops\n`);

  // Process stops in batches for better performance
  const BATCH_SIZE = 100;
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = stops.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stops.length / BATCH_SIZE)}...`);

    for (const stop of batch) {
      try {
        const geoLocation = `${stop.lat},${stop.lon}`;
        const key = `${stop.name}|${geoLocation}`;

        // Check if already exists by name+location
        if (existingSet.has(key)) {
          console.log(`⏭️  Skipped (exists): ${stop.name}`);
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
  console.log(`📍 Total processed: ${stops.length} stops`);
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
}

// Run the script
importAllMaputoStops()
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
