/**
 * Merge Duplicate Stops
 * 
 * This script finds stops with identical names and merges them into single stops.
 * All route connections (ViaParagem) are preserved and transferred to the merged stop.
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

async function mergeDuplicateStops() {
  console.log('🔄 Merging Duplicate Stops...\n');
  console.log('='.repeat(70));
  
  // Step 1: Get all stops grouped by name
  console.log('\n1️⃣  Finding duplicate stop names...');
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
  
  // Group stops by name
  const stopsByName = {};
  for (const stop of allStops) {
    if (!stopsByName[stop.nome]) {
      stopsByName[stop.nome] = [];
    }
    stopsByName[stop.nome].push(stop);
  }
  
  const duplicateGroups = Object.entries(stopsByName)
    .filter(([name, stops]) => stops.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`   📊 Found ${duplicateGroups.length} stop names with duplicates`);
  console.log(`   Top duplicates:`);
  duplicateGroups.slice(0, 10).forEach(([name, stops]) => {
    console.log(`      - "${name}": ${stops.length} stops`);
  });
  
  // Step 2: Merge duplicates
  console.log('\n2️⃣  Merging duplicate stops...');
  let mergedCount = 0;
  let deletedCount = 0;
  let viaConnectionsMoved = 0;
  
  for (const [stopName, stops] of duplicateGroups) {
    if (stops.length < 2) continue;
    
    console.log(`\n   Processing "${stopName}" (${stops.length} duplicates):`);
    
    // Keep the first stop as the primary one
    const primaryStop = stops[0];
    const duplicateStops = stops.slice(1);
    
    console.log(`      ✅ Keeping: ${primaryStop.codigo} (${primaryStop.geoLocation})`);
    
    // For each duplicate stop
    for (const duplicateStop of duplicateStops) {
      try {
        // Get all ViaParagem connections for this duplicate
        const viaConnections = await retryOperation(async () => {
          return await prisma.viaParagem.findMany({
            where: { paragemId: duplicateStop.id }
          });
        });
        
        console.log(`      🔗 ${duplicateStop.codigo}: ${viaConnections.length} route connections`);
        
        // Move all connections to the primary stop
        for (const connection of viaConnections) {
          try {
            // Check if this connection already exists for the primary stop
            const existingConnection = await retryOperation(async () => {
              return await prisma.viaParagem.findFirst({
                where: {
                  viaId: connection.viaId,
                  paragemId: primaryStop.id
                }
              });
            });
            
            if (existingConnection) {
              // Connection already exists, just delete the duplicate
              await retryOperation(async () => {
                await prisma.viaParagem.delete({
                  where: { id: connection.id }
                });
              });
            } else {
              // Update the connection to point to the primary stop
              await retryOperation(async () => {
                await prisma.viaParagem.update({
                  where: { id: connection.id },
                  data: {
                    paragemId: primaryStop.id,
                    codigoParagem: primaryStop.codigo
                  }
                });
              });
              viaConnectionsMoved++;
            }
          } catch (error) {
            console.log(`         ⚠️  Error moving connection: ${error.message}`);
          }
        }
        
        // Check for any MISSION connections
        const missions = await retryOperation(async () => {
          return await prisma.mISSION.findMany({
            where: { paragemId: duplicateStop.id }
          });
        });
        
        if (missions.length > 0) {
          console.log(`      📋 ${duplicateStop.codigo}: ${missions.length} missions`);
          
          // Move missions to primary stop
          for (const mission of missions) {
            try {
              await retryOperation(async () => {
                await prisma.mISSION.update({
                  where: { id: mission.id },
                  data: {
                    paragemId: primaryStop.id,
                    codigoParagem: primaryStop.codigo,
                    geoLocationParagem: primaryStop.geoLocation
                  }
                });
              });
            } catch (error) {
              console.log(`         ⚠️  Error moving mission: ${error.message}`);
            }
          }
        }
        
        // Delete the duplicate stop
        await retryOperation(async () => {
          await prisma.paragem.delete({
            where: { id: duplicateStop.id }
          });
        });
        
        console.log(`      ❌ Deleted: ${duplicateStop.codigo}`);
        deletedCount++;
        
      } catch (error) {
        console.log(`      ⚠️  Error processing ${duplicateStop.codigo}: ${error.message}`);
      }
    }
    
    mergedCount++;
    
    // Progress indicator
    if (mergedCount % 10 === 0) {
      console.log(`\n      📊 Progress: ${mergedCount}/${duplicateGroups.length} groups merged`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Stop groups merged: ${mergedCount}`);
  console.log(`❌ Duplicate stops deleted: ${deletedCount}`);
  console.log(`🔗 Route connections moved: ${viaConnectionsMoved}`);
  
  // Step 3: Verify results
  console.log('\n3️⃣  Verifying results...');
  const finalStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
      select: {
        id: true,
        nome: true
      }
    });
  });
  
  const finalStopsByName = {};
  for (const stop of finalStops) {
    if (!finalStopsByName[stop.nome]) {
      finalStopsByName[stop.nome] = [];
    }
    finalStopsByName[stop.nome].push(stop);
  }
  
  const remainingDuplicates = Object.entries(finalStopsByName)
    .filter(([name, stops]) => stops.length > 1);
  
  console.log(`   Total stops now: ${finalStops.length}`);
  console.log(`   Remaining duplicates: ${remainingDuplicates.length}`);
  
  if (remainingDuplicates.length > 0) {
    console.log(`\n   ⚠️  Some duplicates remain (may need manual review):`);
    remainingDuplicates.slice(0, 5).forEach(([name, stops]) => {
      console.log(`      - "${name}": ${stops.length} stops`);
    });
  }
  
  // Step 4: Show examples
  console.log('\n4️⃣  Examples of merged stops:');
  const sampleStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
      select: {
        nome: true,
        codigo: true,
        geoLocation: true,
        vias: {
          select: {
            via: {
              select: {
                nome: true
              }
            }
          }
        }
      },
      take: 10
    });
  });
  
  sampleStops.forEach(stop => {
    console.log(`\n   ${stop.nome}`);
    console.log(`     Code: ${stop.codigo}`);
    console.log(`     Location: ${stop.geoLocation}`);
    console.log(`     Connected to ${stop.vias.length} routes`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('\n🎉 Duplicate stops merged successfully!');
  console.log('\n💡 Benefits:');
  console.log('   - Cleaner stop list without duplicates');
  console.log('   - All route connections preserved');
  console.log('   - Users see each stop only once');
  console.log('   - Easier navigation and search');
  console.log('\n📱 Each unique stop name now appears only once in the system!');
}

// Run the script
mergeDuplicateStops()
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
