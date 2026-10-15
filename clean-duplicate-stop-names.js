require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse geolocation to get approximate street/area
function parseGeoLocation(geoStr) {
  if (!geoStr) return null;
  const parts = geoStr.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  
  if (parts[0] < 0 && parts[0] > -30) {
    return { lat: parts[0], lng: parts[1] };
  } else {
    return { lat: parts[1], lng: parts[0] };
  }
}

// Determine street/avenue based on coordinates
function determineStreetArea(lat, lng) {
  // Major avenues in Maputo/Matola based on coordinates
  
  // Maputo streets
  if (lng >= 32.48) {
    if (lat > -25.97 && lat < -25.96 && lng > 32.56 && lng < 32.58) {
      return 'Av. Julius Nyerere';
    }
    if (lat > -25.97 && lat < -25.96 && lng > 32.57 && lng < 32.59) {
      return 'Av. 24 de Julho';
    }
    if (lat > -25.98 && lat < -25.97 && lng > 32.56 && lng < 32.58) {
      return 'Av. Samora Machel';
    }
    if (lat > -25.97 && lat < -25.96 && lng > 32.56 && lng < 32.57) {
      return 'Av. 25 de Setembro';
    }
    if (lat > -25.96 && lat < -25.94 && lng > 32.56 && lng < 32.58) {
      return 'Av. Eduardo Mondlane';
    }
    if (lat > -25.95 && lat < -25.93 && lng > 32.56 && lng < 32.59) {
      return 'Av. de Moçambique';
    }
    if (lat > -25.92 && lat < -25.90 && lng > 32.57 && lng < 32.58) {
      return 'Av. Acordos de Lusaka';
    }
    if (lat > -25.88 && lat < -25.86 && lng > 32.60 && lng < 32.62) {
      return 'Estrada Circular';
    }
    if (lat > -25.87 && lat < -25.85 && lng > 32.61 && lng < 32.64) {
      return 'Estrada de Albasine';
    }
  }
  
  // Matola streets
  if (lng < 32.48) {
    if (lat > -25.98 && lat < -25.95 && lng > 32.45 && lng < 32.47) {
      return 'Av. União Africana';
    }
    if (lat > -25.95 && lat < -25.93 && lng > 32.48 && lng < 32.52) {
      return 'Estrada da Matola';
    }
    if (lat > -25.92 && lat < -25.90 && lng > 32.48 && lng < 32.50) {
      return 'Av. das Indústrias';
    }
    if (lat > -25.90 && lat < -25.88 && lng > 32.40 && lng < 32.44) {
      return 'Estrada Nacional N4';
    }
    if (lat > -25.83 && lat < -25.82 && lng > 32.44 && lng < 32.46) {
      return 'Estrada da Matola Gare';
    }
  }
  
  return null;
}

// Extract base name (remove parentheses and extra info)
function extractBaseName(name) {
  // Remove content in parentheses
  let baseName = name.replace(/\([^)]*\)/g, '').trim();
  // Remove extra spaces
  baseName = baseName.replace(/\s+/g, ' ').trim();
  return baseName;
}

async function cleanDuplicateStopNames() {
  try {
    console.log('🧹 Cleaning duplicate stop names...\n');
    console.log('='.repeat(80));

    // Get all stops
    const stops = await prisma.paragem.findMany({
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

    console.log(`\n📍 Found ${stops.length} stops to analyze\n`);

    // Group stops by base name
    const stopsByBaseName = new Map();
    
    for (const stop of stops) {
      const baseName = extractBaseName(stop.nome);
      if (!stopsByBaseName.has(baseName)) {
        stopsByBaseName.set(baseName, []);
      }
      stopsByBaseName.get(baseName).push(stop);
    }

    // Find duplicates
    const duplicates = Array.from(stopsByBaseName.entries())
      .filter(([name, stops]) => stops.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`🔍 Found ${duplicates.length} stop names with duplicates:\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const [baseName, duplicateStops] of duplicates) {
      console.log(`\n📌 "${baseName}" - ${duplicateStops.length} duplicates`);
      console.log('─'.repeat(80));

      // Try to distinguish by street/avenue
      const updates = [];
      
      for (const stop of duplicateStops) {
        const coords = parseGeoLocation(stop.geoLocation);
        if (!coords) {
          console.log(`  ⚠️  ${stop.nome} - No valid coordinates, skipping`);
          totalSkipped++;
          continue;
        }

        const street = determineStreetArea(coords.lat, coords.lng);
        
        if (street) {
          // Check if name already includes street info
          if (stop.nome.includes(street) || stop.nome.includes('Av.') || stop.nome.includes('Estrada')) {
            console.log(`  ✓  ${stop.nome} - Already has street info`);
            totalSkipped++;
            continue;
          }

          const newName = `${baseName} (${street})`;
          updates.push({
            id: stop.id,
            oldName: stop.nome,
            newName: newName,
            street: street
          });
        } else {
          // Use coordinates as fallback
          const coordStr = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
          const newName = `${baseName} (${coordStr})`;
          updates.push({
            id: stop.id,
            oldName: stop.nome,
            newName: newName,
            street: 'Coordinates'
          });
        }
      }

      // Apply updates
      for (const update of updates) {
        try {
          await prisma.paragem.update({
            where: { id: update.id },
            data: { nome: update.newName }
          });
          console.log(`  ✅ Updated: "${update.oldName}" → "${update.newName}"`);
          totalUpdated++;
        } catch (error) {
          console.log(`  ❌ Error updating ${update.oldName}: ${error.message}`);
          totalSkipped++;
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Stops updated: ${totalUpdated}`);
    console.log(`⚠️  Stops skipped: ${totalSkipped}`);
    console.log(`🔍 Duplicate groups found: ${duplicates.length}`);

    // Show top duplicates that were cleaned
    console.log('\n🏆 Top 10 cleaned duplicates:');
    duplicates.slice(0, 10).forEach((dup, i) => {
      console.log(`   ${i + 1}. "${dup[0]}" - ${dup[1].length} instances`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Duplicate stop names cleaned!');
    console.log('💡 Tip: Run "node test-dynamic-neighborhoods.js" to verify');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicateStopNames();
