require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDataSync() {
  console.log('🔍 Verifying Data Sync Between Webapp and USSD\n');
  console.log('=' .repeat(80));
  
  const issues = [];
  const warnings = [];
  
  try {
    // 1. Check all routes have stops
    console.log('\n📍 Checking Routes and Stops...');
    const routes = await prisma.via.findMany({
      include: {
        paragens: {
          include: {
            paragem: true
          }
        },
        transportes: true
      }
    });
    
    console.log(`   ✓ Found ${routes.length} routes`);
    
    let routesWithoutStops = 0;
    let routesWithoutBuses = 0;
    let routesWithoutPath = 0;
    
    routes.forEach(route => {
      if (route.paragens.length === 0) {
        issues.push(`Route ${route.codigo} (${route.nome}) has NO STOPS`);
        routesWithoutStops++;
      } else if (route.paragens.length < 2) {
        warnings.push(`Route ${route.codigo} has only ${route.paragens.length} stop (needs at least 2)`);
      }
      
      if (route.transportes.length === 0) {
        warnings.push(`Route ${route.codigo} has NO BUSES`);
        routesWithoutBuses++;
      }
      
      if (!route.geoLocationPath || route.geoLocationPath.trim() === '') {
        issues.push(`Route ${route.codigo} has NO ROUTE PATH`);
        routesWithoutPath++;
      }
    });
    
    console.log(`   ✓ Routes with stops: ${routes.length - routesWithoutStops}/${routes.length}`);
    console.log(`   ✓ Routes with buses: ${routes.length - routesWithoutBuses}/${routes.length}`);
    console.log(`   ✓ Routes with path: ${routes.length - routesWithoutPath}/${routes.length}`);
    
    // 2. Check all stops have coordinates
    console.log('\n📌 Checking Stops...');
    const stops = await prisma.paragem.findMany();
    
    console.log(`   ✓ Found ${stops.length} stops`);
    
    let stopsWithoutCoords = 0;
    stops.forEach(stop => {
      if (!stop.geoLocation || stop.geoLocation.trim() === '') {
        issues.push(`Stop ${stop.nome} has NO COORDINATES`);
        stopsWithoutCoords++;
      } else {
        // Validate coordinate format
        const coords = stop.geoLocation.split(',');
        if (coords.length !== 2) {
          issues.push(`Stop ${stop.nome} has INVALID COORDINATES: ${stop.geoLocation}`);
        } else {
          const [lat, lng] = coords.map(c => parseFloat(c.trim()));
          if (isNaN(lat) || isNaN(lng)) {
            issues.push(`Stop ${stop.nome} has NON-NUMERIC COORDINATES: ${stop.geoLocation}`);
          } else if (lat > -25 || lat < -26.5 || lng < 32 || lng > 33) {
            warnings.push(`Stop ${stop.nome} coordinates seem outside Maputo/Matola area: ${stop.geoLocation}`);
          }
        }
      }
    });
    
    console.log(`   ✓ Stops with valid coordinates: ${stops.length - stopsWithoutCoords}/${stops.length}`);
    
    // 3. Check all buses have locations
    console.log('\n🚌 Checking Buses...');
    const buses = await prisma.transporte.findMany({
      include: {
        via: true,
        geoLocations: {
          take: 1,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    console.log(`   ✓ Found ${buses.length} buses`);
    
    let busesWithoutLocation = 0;
    let busesWithoutRoute = 0;
    
    buses.forEach(bus => {
      if (!bus.currGeoLocation && bus.geoLocations.length === 0) {
        warnings.push(`Bus ${bus.matricula} has NO LOCATION`);
        busesWithoutLocation++;
      }
      
      if (!bus.via) {
        issues.push(`Bus ${bus.matricula} has NO ROUTE ASSIGNED`);
        busesWithoutRoute++;
      }
    });
    
    console.log(`   ✓ Buses with location: ${buses.length - busesWithoutLocation}/${buses.length}`);
    console.log(`   ✓ Buses with route: ${buses.length - busesWithoutRoute}/${buses.length}`);
    
    // 4. Check ViaParagem relations
    console.log('\n🔗 Checking Route-Stop Relations...');
    const viaParagens = await prisma.viaParagem.findMany({
      include: {
        via: true,
        paragem: true
      }
    });
    
    console.log(`   ✓ Found ${viaParagens.length} route-stop relations`);
    
    let invalidRelations = 0;
    viaParagens.forEach(vp => {
      if (!vp.via) {
        issues.push(`ViaParagem ${vp.id} references non-existent route`);
        invalidRelations++;
      }
      if (!vp.paragem) {
        issues.push(`ViaParagem ${vp.id} references non-existent stop`);
        invalidRelations++;
      }
    });
    
    console.log(`   ✓ Valid relations: ${viaParagens.length - invalidRelations}/${viaParagens.length}`);
    
    // 5. Check for orphaned data
    console.log('\n🔍 Checking for Orphaned Data...');
    
    const stopsWithoutRoutes = await prisma.paragem.findMany({
      where: {
        vias: {
          none: {}
        }
      }
    });
    
    if (stopsWithoutRoutes.length > 0) {
      warnings.push(`${stopsWithoutRoutes.length} stops are not connected to any route`);
      console.log(`   ⚠️  ${stopsWithoutRoutes.length} orphaned stops found`);
    } else {
      console.log(`   ✓ No orphaned stops`);
    }
    
    // 6. Check USSD-specific data
    console.log('\n📱 Checking USSD Data Requirements...');
    
    // Check if all routes have terminalPartida and terminalChegada
    let routesWithoutTerminals = 0;
    routes.forEach(route => {
      if (!route.terminalPartida || !route.terminalChegada) {
        issues.push(`Route ${route.codigo} missing terminal information`);
        routesWithoutTerminals++;
      }
    });
    
    console.log(`   ✓ Routes with terminals: ${routes.length - routesWithoutTerminals}/${routes.length}`);
    
    // Check if stops match USSD neighborhood structure
    const neighborhoods = {
      'Maputo': ['Baixa', 'Polana', 'Alto Maé', 'Xipamanine', 'Hulene', 'Magoanine', 'Zimpeto', 'Albazine', 'Jardim'],
      'Matola': ['Matola Sede', 'Machava', 'Matola Gare', 'Tchumene', 'T3', 'Fomento', 'Liberdade', 'Malhampsene']
    };
    
    let neighborhoodsWithStops = 0;
    let neighborhoodsWithoutStops = 0;
    
    for (const [region, hoods] of Object.entries(neighborhoods)) {
      for (const hood of hoods) {
        const stopsInHood = stops.filter(s => 
          s.nome.toLowerCase().includes(hood.toLowerCase()) ||
          hood.toLowerCase().includes(s.nome.toLowerCase().split(' ')[0])
        );
        
        if (stopsInHood.length > 0) {
          neighborhoodsWithStops++;
        } else {
          warnings.push(`Neighborhood "${hood}" in ${region} has no matching stops`);
          neighborhoodsWithoutStops++;
        }
      }
    }
    
    const totalNeighborhoods = neighborhoods.Maputo.length + neighborhoods.Matola.length;
    console.log(`   ✓ Neighborhoods with stops: ${neighborhoodsWithStops}/${totalNeighborhoods}`);
    
    // 7. Test bidirectional route search
    console.log('\n🔄 Testing Bidirectional Route Search...');
    
    const testOrigins = ['Praça dos Trabalhadores', 'Terminal Museu', 'Albasine', 'Terminal Matola Sede'];
    let searchesWithResults = 0;
    let searchesWithoutResults = 0;
    
    for (const origin of testOrigins) {
      // Forward search
      const forwardRoutes = await prisma.via.findMany({
        where: {
          terminalPartida: { contains: origin, mode: 'insensitive' }
        }
      });
      
      // Reverse search
      const reverseRoutes = await prisma.via.findMany({
        where: {
          terminalChegada: { contains: origin, mode: 'insensitive' }
        }
      });
      
      const totalRoutes = forwardRoutes.length + reverseRoutes.length;
      
      if (totalRoutes > 0) {
        searchesWithResults++;
        console.log(`   ✓ "${origin}": ${forwardRoutes.length} forward + ${reverseRoutes.length} reverse = ${totalRoutes} routes`);
      } else {
        searchesWithoutResults++;
        warnings.push(`No routes found for origin "${origin}"`);
        console.log(`   ⚠️  "${origin}": NO ROUTES FOUND`);
      }
    }
    
    // 8. Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 VERIFICATION SUMMARY\n');
    
    console.log('Data Statistics:');
    console.log(`  • Routes: ${routes.length}`);
    console.log(`  • Stops: ${stops.length}`);
    console.log(`  • Buses: ${buses.length}`);
    console.log(`  • Route-Stop Relations: ${viaParagens.length}`);
    console.log(`  • Neighborhoods: ${totalNeighborhoods}`);
    
    console.log('\nData Quality:');
    console.log(`  • Routes with stops: ${routes.length - routesWithoutStops}/${routes.length} (${((routes.length - routesWithoutStops) / routes.length * 100).toFixed(1)}%)`);
    console.log(`  • Routes with buses: ${routes.length - routesWithoutBuses}/${routes.length} (${((routes.length - routesWithoutBuses) / routes.length * 100).toFixed(1)}%)`);
    console.log(`  • Stops with coordinates: ${stops.length - stopsWithoutCoords}/${stops.length} (${((stops.length - stopsWithoutCoords) / stops.length * 100).toFixed(1)}%)`);
    console.log(`  • Buses with location: ${buses.length - busesWithoutLocation}/${buses.length} (${((buses.length - busesWithoutLocation) / buses.length * 100).toFixed(1)}%)`);
    
    console.log('\n' + '='.repeat(80));
    
    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES FOUND:\n');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:\n');
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n✅ ALL CHECKS PASSED! Data is in sync and complete.\n');
    } else {
      console.log(`\n📋 Found ${issues.length} critical issues and ${warnings.length} warnings.\n`);
    }
    
    // Return summary
    return {
      success: issues.length === 0,
      issues,
      warnings,
      stats: {
        routes: routes.length,
        stops: stops.length,
        buses: buses.length,
        relations: viaParagens.length,
        routesWithStops: routes.length - routesWithoutStops,
        routesWithBuses: routes.length - routesWithoutBuses,
        stopsWithCoords: stops.length - stopsWithoutCoords,
        busesWithLocation: buses.length - busesWithoutLocation
      }
    };
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  verifyDataSync()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { verifyDataSync };
