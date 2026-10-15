/**
 * Check System Status
 * Verifies the current state of the database
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkStatus() {
  try {
    console.log('🔍 Checking System Status...\n');
    console.log('='.repeat(70));
    
    // Count all entities
    const municipios = await prisma.municipio.count();
    const vias = await prisma.via.count();
    const paragens = await prisma.paragem.count();
    const viaParagens = await prisma.viaParagem.count();
    const transportes = await prisma.transporte.count();
    
    const allTransportes = await prisma.transporte.findMany({ select: { viaId: true } });
    const transportesWithVia = allTransportes.filter(t => t.viaId !== null).length;
    
    console.log('📊 DATABASE COUNTS:');
    console.log(`   Municipalities: ${municipios}`);
    console.log(`   Vias (Routes): ${vias}`);
    console.log(`   Paragens (Stops): ${paragens}`);
    console.log(`   ViaParagem Relations: ${viaParagens}`);
    console.log(`   Transportes: ${transportes}`);
    console.log(`   Transportes with Via: ${transportesWithVia}`);
    
    // Check for duplicate stop names
    console.log('\n🔍 CHECKING FOR DUPLICATES:');
    const allStops = await prisma.paragem.findMany({ 
      select: { nome: true, codigo: true } 
    });
    
    const stopNames = {};
    allStops.forEach(s => {
      if (!stopNames[s.nome]) {
        stopNames[s.nome] = [];
      }
      stopNames[s.nome].push(s.codigo);
    });
    
    const duplicates = Object.entries(stopNames).filter(([_, codes]) => codes.length > 1);
    
    console.log(`   Duplicate stop names: ${duplicates.length}`);
    if (duplicates.length > 0) {
      console.log('   ⚠️  Examples:');
      duplicates.slice(0, 5).forEach(([name, codes]) => {
        console.log(`      - "${name}": ${codes.length} stops (${codes.join(', ')})`);
      });
    } else {
      console.log('   ✅ No duplicates found!');
    }
    
    // Sample stops
    console.log('\n📍 SAMPLE STOPS:');
    const sampleStops = await prisma.paragem.findMany({
      take: 10,
      select: { 
        nome: true, 
        codigo: true, 
        geoLocation: true,
        vias: {
          select: {
            via: {
              select: { nome: true }
            }
          }
        }
      }
    });
    
    sampleStops.forEach(s => {
      console.log(`   ${s.nome}`);
      console.log(`      Code: ${s.codigo}`);
      console.log(`      Location: ${s.geoLocation}`);
      console.log(`      Routes: ${s.vias.length}`);
    });
    
    // Check municipalities
    console.log('\n🏙️  MUNICIPALITIES:');
    const munis = await prisma.municipio.findMany({
      select: {
        nome: true,
        codigo: true,
        _count: {
          select: {
            vias: true
          }
        }
      }
    });
    
    munis.forEach(m => {
      console.log(`   ${m.nome} (${m.codigo}): ${m._count.vias} vias`);
    });
    
    // Check transportes with locations
    console.log('\n🚌 TRANSPORTES STATUS:');
    const transportesWithLocation = await prisma.transporte.count({
      where: { currGeoLocation: { not: null } }
    });
    const transportesWithPath = await prisma.transporte.count({
      where: { routePath: { not: null } }
    });
    
    console.log(`   With current location: ${transportesWithLocation}/${transportes}`);
    console.log(`   With route path: ${transportesWithPath}/${transportes}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Status check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
