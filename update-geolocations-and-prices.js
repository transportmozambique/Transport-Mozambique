const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Calculate fare based on distance (in km)
function calculateFare(distanceKm) {
  // Mozambique transport pricing structure
  if (distanceKm <= 2) return 10;   // Very short: 10 MT
  if (distanceKm <= 5) return 15;   // Short: 15 MT
  if (distanceKm <= 10) return 20;  // Medium: 20 MT
  if (distanceKm <= 15) return 25;  // Long: 25 MT
  if (distanceKm <= 20) return 30;  // Very long: 30 MT
  if (distanceKm <= 30) return 35;  // Extra long: 35 MT
  return 40;                         // Maximum: 40 MT
}

// Parse geolocation string "lat,lng" or "lng,lat"
function parseGeoLocation(geoStr) {
  if (!geoStr) return null;
  const parts = geoStr.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  
  // Maputo coordinates are around -25 lat, 32 lng
  // If first number is negative and around -25, it's latitude
  if (parts[0] < 0 && parts[0] > -30) {
    return { lat: parts[0], lng: parts[1] };
  } else {
    return { lat: parts[1], lng: parts[0] };
  }
}

// Simulate bus movement along route
function simulateBusPosition(routePath, progress = 0.5) {
  if (!routePath) return null;
  
  const points = routePath.split(';').map(p => {
    const coords = parseGeoLocation(p);
    return coords;
  }).filter(c => c !== null);
  
  if (points.length < 2) return null;
  
  // Get position based on progress (0 = start, 1 = end)
  const index = Math.floor(progress * (points.length - 1));
  const nextIndex = Math.min(index + 1, points.length - 1);
  
  const point1 = points[index];
  const point2 = points[nextIndex];
  
  // Interpolate between points
  const localProgress = (progress * (points.length - 1)) - index;
  const lat = point1.lat + (point2.lat - point1.lat) * localProgress;
  const lng = point1.lng + (point2.lng - point1.lng) * localProgress;
  
  return `${lat},${lng}`;
}

async function updateGeolocationsAndPrices() {
  console.log('🚀 Updating Bus Geolocations and Calculating Prices\n');
  console.log('=' .repeat(80));
  
  try {
    // 1. Get all stops with coordinates
    console.log('\n📍 Step 1: Loading all stops with coordinates...');
    const stops = await prisma.paragem.findMany({
      select: {
        id: true,
        nome: true,
        geoLocation: true
      }
    });
    
    console.log(`  ✅ Loaded ${stops.length} stops`);
    
    // Create a map of stop coordinates
    const stopCoords = new Map();
    stops.forEach(stop => {
      const coords = parseGeoLocation(stop.geoLocation);
      if (coords) {
        stopCoords.set(stop.nome, coords);
      }
    });
    
    console.log(`  ✅ Parsed ${stopCoords.size} stop coordinates`);
    
    // 2. Calculate distances and prices for all routes
    console.log('\n💰 Step 2: Calculating distances and prices for routes...');
    const routes = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        terminalPartida: true,
        terminalChegada: true,
        geoLocationPath: true
      }
    });
    
    const routePrices = new Map();
    
    for (const route of routes) {
      // Find matching stops (fuzzy match)
      let startCoords = null;
      let endCoords = null;
      
      // Try to find start coordinates
      for (const [stopName, coords] of stopCoords.entries()) {
        if (stopName.toLowerCase().includes(route.terminalPartida.toLowerCase()) ||
            route.terminalPartida.toLowerCase().includes(stopName.toLowerCase())) {
          startCoords = coords;
          break;
        }
      }
      
      // Try to find end coordinates
      for (const [stopName, coords] of stopCoords.entries()) {
        if (stopName.toLowerCase().includes(route.terminalChegada.toLowerCase()) ||
            route.terminalChegada.toLowerCase().includes(stopName.toLowerCase())) {
          endCoords = coords;
          break;
        }
      }
      
      if (startCoords && endCoords) {
        const distance = calculateDistance(
          startCoords.lat, startCoords.lng,
          endCoords.lat, endCoords.lng
        );
        const fare = calculateFare(distance);
        
        routePrices.set(route.codigo, {
          distance: distance.toFixed(2),
          fare: fare
        });
        
        console.log(`  ${route.codigo}: ${route.terminalPartida} → ${route.terminalChegada}`);
        console.log(`    Distance: ${distance.toFixed(2)} km, Fare: ${fare} MT`);
      } else {
        console.log(`  ⚠️  ${route.codigo}: Missing coordinates for ${route.terminalPartida} or ${route.terminalChegada}`);
      }
    }
    
    // 3. Update bus geolocations with simulated positions
    console.log('\n🚌 Step 3: Updating bus geolocations...');
    const buses = await prisma.transporte.findMany({
      select: {
        id: true,
        matricula: true,
        codigo: true,
        routePath: true,
        currGeoLocation: true,
        via: {
          select: {
            nome: true,
            codigo: true
          }
        }
      }
    });
    
    let updatedCount = 0;
    let geoLocationCount = 0;
    
    for (const bus of buses) {
      // Simulate bus at random position along route (0-100%)
      const progress = Math.random();
      const newPosition = simulateBusPosition(bus.routePath, progress);
      
      if (newPosition) {
        // Update bus current location
        await prisma.transporte.update({
          where: { id: bus.id },
          data: { currGeoLocation: newPosition }
        });
        
        // Create GeoLocation record
        try {
          await prisma.geoLocation.create({
            data: {
              geoLocationTransporte: newPosition,
              geoDirection: progress > 0.5 ? 'forward' : 'backward',
              codigoTransporte: bus.codigo,
              transporteId: bus.id,
              geoLocationHist1: bus.currGeoLocation,
              geoDateTime1: new Date()
            }
          });
          geoLocationCount++;
        } catch (error) {
          // GeoLocation might already exist, skip
        }
        
        updatedCount++;
        console.log(`  ✅ ${bus.matricula}: ${newPosition} (${(progress * 100).toFixed(0)}% along route)`);
      }
    }
    
    console.log(`\n  ✅ Updated ${updatedCount} bus positions`);
    console.log(`  ✅ Created ${geoLocationCount} geolocation records`);
    
    // 4. Create a price reference document
    console.log('\n📄 Step 4: Creating price reference...');
    
    let priceDoc = '# Transport Prices by Route\n\n';
    priceDoc += 'Prices calculated based on actual distances between stops.\n\n';
    priceDoc += '## Price Structure\n\n';
    priceDoc += '- 0-2 km: 10 MT\n';
    priceDoc += '- 2-5 km: 15 MT\n';
    priceDoc += '- 5-10 km: 20 MT\n';
    priceDoc += '- 10-15 km: 25 MT\n';
    priceDoc += '- 15-20 km: 30 MT\n';
    priceDoc += '- 20-30 km: 35 MT\n';
    priceDoc += '- 30+ km: 40 MT\n\n';
    priceDoc += '## Routes and Prices\n\n';
    
    for (const route of routes) {
      const priceInfo = routePrices.get(route.codigo);
      if (priceInfo) {
        priceDoc += `### ${route.nome} (${route.codigo})\n`;
        priceDoc += `- **From**: ${route.terminalPartida}\n`;
        priceDoc += `- **To**: ${route.terminalChegada}\n`;
        priceDoc += `- **Distance**: ${priceInfo.distance} km\n`;
        priceDoc += `- **Fare**: ${priceInfo.fare} MT\n\n`;
      }
    }
    
    const fs = require('fs');
    fs.writeFileSync('TRANSPORT_PRICES.md', priceDoc);
    console.log('  ✅ Created TRANSPORT_PRICES.md');
    
    // 5. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log(`  Stops with coordinates: ${stopCoords.size}`);
    console.log(`  Routes with prices: ${routePrices.size}`);
    console.log(`  Buses updated: ${updatedCount}`);
    console.log(`  GeoLocation records: ${geoLocationCount}`);
    
    console.log('\n✅ Geolocations and prices updated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateGeolocationsAndPrices();
