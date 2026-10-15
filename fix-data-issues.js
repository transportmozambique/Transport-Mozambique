const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDataIssues() {
  console.log('🔧 Fixing Data Issues\n');
  console.log('=' .repeat(80));
  
  try {
    // 1. Add buses to routes without buses
    console.log('\n🚌 Adding buses to routes without buses...');
    
    const routesWithoutBuses = await prisma.via.findMany({
      where: {
        transportes: {
          none: {}
        }
      }
    });
    
    console.log(`   Found ${routesWithoutBuses.length} routes without buses`);
    
    // Find the highest existing bus code
    const highestBus = await prisma.transporte.findFirst({
      orderBy: { codigo: 'desc' },
      select: { codigo: true }
    });
    
    let busCodeCounter = highestBus ? highestBus.codigo + 1 : 9000;
    console.log(`   Starting bus codes from: ${busCodeCounter}`);
    
    let busesCreated = 0;
    
    for (const route of routesWithoutBuses) {
      // Create 2 buses for each route
      for (let i = 1; i <= 2; i++) {
        const matricula = `${route.codigo}-${i}${String.fromCharCode(64 + i)}`;
        busCodeCounter++;
        
        // Get first stop coordinates for initial location
        const firstStop = await prisma.viaParagem.findFirst({
          where: { viaId: route.id },
          include: { paragem: true },
          orderBy: { id: 'asc' }
        });
        
        const initialLocation = firstStop?.paragem.geoLocation || '-25.9692,32.5732';
        
        const bus = await prisma.transporte.create({
          data: {
            matricula: matricula,
            codigo: busCodeCounter,
            marca: 'Toyota',
            modelo: 'Hiace',
            lotacao: 15,
            cor: '#3B82F6', // Blue color
            codigoVia: route.codigo,
            currGeoLocation: initialLocation,
            viaId: route.id
          }
        });
        
        // Create GeoLocation record
        await prisma.geoLocation.create({
          data: {
            geoLocationTransporte: initialLocation,
            geoDirection: 'forward',
            codigoTransporte: busCodeCounter,
            transporteId: bus.id
          }
        });
        
        busesCreated++;
        console.log(`   ✅ Created bus ${matricula} for ${route.nome}`);
      }
    }
    
    console.log(`   ✓ Created ${busesCreated} buses`);
    
    // 2. Fix neighborhood name mismatches
    console.log('\n📍 Fixing neighborhood name mismatches...');
    
    // "Albazine" should be "Albasine" (already exists)
    const albasineStop = await prisma.paragem.findFirst({
      where: { nome: { contains: 'Albasine', mode: 'insensitive' } }
    });
    
    if (albasineStop) {
      console.log(`   ✓ "Albasine" stop exists: ${albasineStop.nome}`);
    }
    
    // "Alto Maé" - create a stop for it
    const altoMaeStop = await prisma.paragem.findFirst({
      where: { nome: { contains: 'Alto Maé', mode: 'insensitive' } }
    });
    
    if (!altoMaeStop) {
      const newStop = await prisma.paragem.create({
        data: {
          nome: 'Alto Maé',
          codigo: 'PAR-ALTOMAE-1',
          geoLocation: '-25.9550,32.5800' // Approximate coordinates
        }
      });
      console.log(`   ✅ Created stop: ${newStop.nome}`);
      
      // Link to a nearby route (VIA-POL-BAI or similar)
      const nearbyRoute = await prisma.via.findFirst({
        where: { codigo: 'VIA-POL-BAI' }
      });
      
      if (nearbyRoute) {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: newStop.codigo,
            codigoVia: nearbyRoute.codigo,
            terminalBoolean: false,
            viaId: nearbyRoute.id,
            paragemId: newStop.id
          }
        });
        console.log(`   ✓ Linked Alto Maé to ${nearbyRoute.nome}`);
      }
    } else {
      console.log(`   ✓ "Alto Maé" stop already exists: ${altoMaeStop.nome}`);
    }
    
    // 3. Verify fixes
    console.log('\n✅ Verifying fixes...');
    
    const routesWithBuses = await prisma.via.findMany({
      include: {
        transportes: true
      }
    });
    
    const routesStillWithoutBuses = routesWithBuses.filter(r => r.transportes.length === 0);
    console.log(`   ✓ Routes without buses: ${routesStillWithoutBuses.length}/28`);
    
    const totalBuses = await prisma.transporte.count();
    console.log(`   ✓ Total buses: ${totalBuses}`);
    
    const totalStops = await prisma.paragem.count();
    console.log(`   ✓ Total stops: ${totalStops}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Data issues fixed!\n');
    
  } catch (error) {
    console.error('\n❌ Error fixing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixDataIssues();
}

module.exports = { fixDataIssues };
