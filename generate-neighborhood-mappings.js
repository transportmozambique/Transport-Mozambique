require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

// Parse geolocation string
function parseGeoLocation(geoStr) {
  if (!geoStr) return null;
  const parts = geoStr.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  
  // Maputo coordinates: lat around -25 to -26, lng around 32
  if (parts[0] < 0 && parts[0] > -30) {
    return { lat: parts[0], lng: parts[1] };
  } else {
    return { lat: parts[1], lng: parts[0] };
  }
}

// Determine region based on coordinates
function determineRegion(lat, lng) {
  // Matola is generally west of Maputo (lower longitude)
  // Rough boundary: lng < 32.48 is Matola, >= 32.48 is Maputo
  if (lng < 32.48) {
    return 'Matola';
  } else {
    return 'Maputo';
  }
}

// Determine neighborhood based on coordinates and stop name
function determineNeighborhood(stopName, lat, lng, region) {
  const name = stopName.toLowerCase();
  
  if (region === 'Maputo') {
    // Maputo neighborhoods based on coordinates and keywords
    if (name.includes('baixa') || name.includes('praça') || name.includes('trabalhadores') || 
        name.includes('albert') || name.includes('laurentina') || (lat > -25.98 && lng > 32.56)) {
      return 'Baixa / Central';
    }
    if (name.includes('polana') || name.includes('sommerschield') || (lat > -25.97 && lat < -25.96 && lng > 32.58)) {
      return 'Polana / Museu';
    }
    if (name.includes('alto maé') || name.includes('alto mae')) {
      return 'Alto Maé';
    }
    if (name.includes('xipamanine') || (lat > -25.95 && lat < -25.94 && lng > 32.56)) {
      return 'Xipamanine';
    }
    if (name.includes('hulene') || (lat > -25.92 && lat < -25.90 && lng > 32.59)) {
      return 'Hulene';
    }
    if (name.includes('magoanine') || (lat > -25.88 && lat < -25.87 && lng > 32.60)) {
      return 'Magoanine';
    }
    if (name.includes('zimpeto') || (lat > -25.87 && lat < -25.86 && lng > 32.61)) {
      return 'Zimpeto';
    }
    if (name.includes('albasine') || name.includes('albazine') || (lat > -25.85 && lat < -25.83 && lng > 32.63)) {
      return 'Albazine';
    }
    if (name.includes('jardim') || (lat > -25.97 && lat < -25.96 && lng > 32.57)) {
      return 'Jardim';
    }
    if (name.includes('maxaquene') || (lat > -25.96 && lat < -25.94 && lng > 32.56 && lng < 32.58)) {
      return 'Xipamanine'; // Maxaquene is close to Xipamanine
    }
    if (name.includes('aeroporto') || name.includes('airport') || (lat > -25.93 && lat < -25.91 && lng > 32.57)) {
      return 'Alto Maé';
    }
    
    // Default for Maputo
    return 'Baixa / Central';
  } else {
    // Matola neighborhoods based on coordinates and keywords
    if (name.includes('matola sede') || name.includes('sede') || (lat > -25.98 && lng < 32.46)) {
      return 'Matola Sede';
    }
    if (name.includes('machava') || (lat > -25.92 && lat < -25.90 && lng < 32.50)) {
      return 'Machava';
    }
    if (name.includes('matola gare') || name.includes('gare') || (lat > -25.83 && lat < -25.82 && lng < 32.46)) {
      return 'Matola Gare';
    }
    if (name.includes('tchumene') || (lat > -25.89 && lat < -25.88 && lng < 32.41)) {
      return 'Tchumene';
    }
    if (name.includes('t3') || name.includes('t-3') || (lat > -25.91 && lat < -25.90 && lng > 32.51 && lng < 32.53)) {
      return 'T3';
    }
    if (name.includes('fomento') || (lat > -25.93 && lat < -25.91 && lng < 32.49)) {
      return 'Fomento';
    }
    if (name.includes('liberdade') || (lat > -25.95 && lat < -25.93 && lng < 32.47)) {
      return 'Liberdade';
    }
    if (name.includes('malhampsene') || (lat > -25.90 && lat < -25.88 && lng < 32.44)) {
      return 'Malhampsene';
    }
    if (name.includes('godinho') || name.includes('shoprite') || (lat > -25.96 && lat < -25.94 && lng < 32.47)) {
      return 'Matola Sede';
    }
    if (name.includes('portagem') || (lat > -25.95 && lat < -25.93 && lng > 32.50 && lng < 32.52)) {
      return 'Fomento'; // Portagem is between Matola and Maputo
    }
    
    // Default for Matola
    return 'Matola Sede';
  }
}

async function generateNeighborhoodMappings() {
  try {
    console.log('🗺️  Generating dynamic neighborhood mappings from ViaParagem data...\n');
    console.log('='.repeat(80));

    // Get all stops with their routes
    const stops = await prisma.paragem.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        geoLocation: true,
        vias: {
          select: {
            via: {
              select: {
                codigo: true,
                nome: true
              }
            }
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    console.log(`\nFound ${stops.length} stops to analyze\n`);

    // Build neighborhood mappings
    const neighborhoodMappings = {
      Maputo: {},
      Matola: {}
    };

    const stats = {
      Maputo: {},
      Matola: {},
      totalStops: 0,
      connectedStops: 0,
      unconnectedStops: 0
    };

    for (const stop of stops) {
      stats.totalStops++;

      // Skip stops without routes
      if (stop.vias.length === 0) {
        stats.unconnectedStops++;
        continue;
      }

      stats.connectedStops++;

      // Parse coordinates
      const coords = parseGeoLocation(stop.geoLocation);
      if (!coords) continue;

      // Determine region and neighborhood
      const region = determineRegion(coords.lat, coords.lng);
      const neighborhood = determineNeighborhood(stop.nome, coords.lat, coords.lng, region);

      // Initialize neighborhood array if needed
      if (!neighborhoodMappings[region][neighborhood]) {
        neighborhoodMappings[region][neighborhood] = [];
        stats[region][neighborhood] = 0;
      }

      // Add stop to neighborhood
      neighborhoodMappings[region][neighborhood].push({
        name: stop.nome,
        codigo: stop.codigo,
        coordinates: stop.geoLocation,
        routeCount: stop.vias.length,
        routes: stop.vias.map(v => v.via.codigo).slice(0, 5) // First 5 routes
      });

      stats[region][neighborhood]++;
    }

    // Sort stops within each neighborhood by name
    for (const region in neighborhoodMappings) {
      for (const neighborhood in neighborhoodMappings[region]) {
        neighborhoodMappings[region][neighborhood].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
      }
    }

    console.log('📊 STATISTICS:');
    console.log('='.repeat(80));
    console.log(`Total stops: ${stats.totalStops}`);
    console.log(`Connected to routes: ${stats.connectedStops} (${((stats.connectedStops/stats.totalStops)*100).toFixed(1)}%)`);
    console.log(`Not connected: ${stats.unconnectedStops} (${((stats.unconnectedStops/stats.totalStops)*100).toFixed(1)}%)`);

    console.log('\n📍 MAPUTO NEIGHBORHOODS:');
    console.log('─'.repeat(80));
    for (const neighborhood in stats.Maputo) {
      console.log(`  ${neighborhood.padEnd(25)} | ${stats.Maputo[neighborhood]} stops`);
    }

    console.log('\n📍 MATOLA NEIGHBORHOODS:');
    console.log('─'.repeat(80));
    for (const neighborhood in stats.Matola) {
      console.log(`  ${neighborhood.padEnd(25)} | ${stats.Matola[neighborhood]} stops`);
    }

    // Save to JSON file
    const jsonOutput = JSON.stringify(neighborhoodMappings, null, 2);
    fs.writeFileSync('neighborhood-mappings.json', jsonOutput);
    console.log('\n✅ Saved to: neighborhood-mappings.json');

    // Generate TypeScript/JavaScript code for USSD
    let tsCode = `// Auto-generated neighborhood mappings from ViaParagem data
// Generated: ${new Date().toISOString()}
// Total stops: ${stats.connectedStops} connected to routes

export const neighborhoodMappings = {
  Maputo: {
`;

    for (const neighborhood in neighborhoodMappings.Maputo) {
      const stops = neighborhoodMappings.Maputo[neighborhood];
      tsCode += `    '${neighborhood}': [\n`;
      stops.forEach(stop => {
        tsCode += `      '${stop.name}',\n`;
      });
      tsCode += `    ],\n`;
    }

    tsCode += `  },
  Matola: {
`;

    for (const neighborhood in neighborhoodMappings.Matola) {
      const stops = neighborhoodMappings.Matola[neighborhood];
      tsCode += `    '${neighborhood}': [\n`;
      stops.forEach(stop => {
        tsCode += `      '${stop.name}',\n`;
      });
      tsCode += `    ],\n`;
    }

    tsCode += `  }
};

// Helper function to get stops by neighborhood
export function getStopsByNeighborhood(neighborhood: string, region: string): string[] {
  const mappings = neighborhoodMappings[region as 'Maputo' | 'Matola'];
  return mappings?.[neighborhood] || [];
}

// Helper function to get all neighborhoods by region
export function getNeighborhoodsByRegion(region: string): string[] {
  const mappings = neighborhoodMappings[region as 'Maputo' | 'Matola'];
  return Object.keys(mappings || {});
}
`;

    fs.writeFileSync('neighborhood-mappings.ts', tsCode);
    console.log('✅ Saved to: neighborhood-mappings.ts');

    // Generate Markdown documentation
    let mdDoc = `# Neighborhood Mappings

Auto-generated from ViaParagem data on ${new Date().toISOString()}

## Statistics

- **Total Stops**: ${stats.totalStops}
- **Connected to Routes**: ${stats.connectedStops} (${((stats.connectedStops/stats.totalStops)*100).toFixed(1)}%)
- **Not Connected**: ${stats.unconnectedStops} (${((stats.unconnectedStops/stats.totalStops)*100).toFixed(1)}%)

---

## Maputo Neighborhoods

`;

    for (const neighborhood in neighborhoodMappings.Maputo) {
      const stops = neighborhoodMappings.Maputo[neighborhood];
      mdDoc += `### ${neighborhood} (${stops.length} stops)\n\n`;
      stops.forEach(stop => {
        mdDoc += `- **${stop.name}** - ${stop.routeCount} route(s): ${stop.routes.join(', ')}\n`;
      });
      mdDoc += '\n';
    }

    mdDoc += `---

## Matola Neighborhoods

`;

    for (const neighborhood in neighborhoodMappings.Matola) {
      const stops = neighborhoodMappings.Matola[neighborhood];
      mdDoc += `### ${neighborhood} (${stops.length} stops)\n\n`;
      stops.forEach(stop => {
        mdDoc += `- **${stop.name}** - ${stop.routeCount} route(s): ${stop.routes.join(', ')}\n`;
      });
      mdDoc += '\n';
    }

    fs.writeFileSync('NEIGHBORHOOD_MAPPINGS.md', mdDoc);
    console.log('✅ Saved to: NEIGHBORHOOD_MAPPINGS.md');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Neighborhood mappings generated successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review neighborhood-mappings.json for accuracy');
    console.log('   2. Import neighborhood-mappings.ts in your USSD code');
    console.log('   3. Replace hardcoded mappings with dynamic ones');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

generateNeighborhoodMappings();
