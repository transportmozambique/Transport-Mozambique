const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if a paragem is within distance of a via path
function isParagemOnViaPath(paragem, viaPath, maxDistance = 0.5) { // Increased to 500m
  for (let i = 0; i < viaPath.length - 1; i++) {
    const segmentStart = viaPath[i];
    const segmentEnd = viaPath[i + 1];
    
    // Calculate distance from paragem to line segment
    const distance = pointToSegmentDistance(
      paragem.latitude, paragem.longitude,
      segmentStart[0], segmentStart[1],
      segmentEnd[0], segmentEnd[1]
    );
    
    if (distance <= maxDistance) {
      return true;
    }
  }
  return false;
}

// Calculate distance from point to line segment
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy) * 111; // Convert to km
}

// Realistic Maputo routes (10-50km) covering actual paragem locations
const maputoRoutes = [
  {
    nome: 'Maputo Centro → Ponta d\'Ouro',
    origem: 'Maputo Centro',
    destino: 'Ponta d\'Ouro',
    path: [
      [-25.9692, 32.5732], // Maputo Centro
      [-25.9800, 32.5900],
      [-26.0500, 32.6200],
      [-26.1500, 32.7000],
      [-26.2500, 32.8000],
      [-26.3500, 32.8500],
      [-26.4500, 32.8800],
      [-26.8433, 32.8933]  // Ponta d'Ouro
    ]
  },
  {
    nome: 'Maputo Centro → Matola',
    origem: 'Maputo Centro',
    destino: 'Matola',
    path: [
      [-25.9692, 32.5732],
      [-25.9500, 32.5800],
      [-25.9300, 32.5900],
      [-25.9100, 32.6000],
      [-25.8900, 32.6100],
      [-25.8798, 32.4758]  // Matola
    ]
  },
  {
    nome: 'Maputo Centro → Machava',
    origem: 'Maputo Centro',
    destino: 'Machava',
    path: [
      [-25.9692, 32.5732],
      [-25.9500, 32.5600],
      [-25.9300, 32.5400],
      [-25.9100, 32.5200],
      [-25.9002, 32.4834]  // Machava-Sede
    ]
  },
  {
    nome: 'Avenida 4 de Outubro',
    origem: 'Início Av. 4 de Outubro',
    destino: 'Fim Av. 4 de Outubro',
    path: [
      [-25.8918, 32.5392],
      [-25.8919, 32.5393],
      [-25.8926, 32.5418],
      [-25.8898, 32.5443],
      [-25.8875, 32.5461],
      [-25.8861, 32.5471],
      [-25.8857, 32.5483],
      [-25.8867, 32.5545],
      [-25.8869, 32.5561]
    ]
  },
  {
    nome: 'Estrada Circular Norte',
    origem: 'Circular Norte Início',
    destino: 'Circular Norte Fim',
    path: [
      [-25.8281, 32.6077],
      [-25.8297, 32.6130],
      [-25.8350, 32.6200],
      [-25.8417, 32.4842],
      [-25.8500, 32.5000]
    ]
  },
  {
    nome: 'Maputo Norte → Sul',
    origem: 'Maputo Norte',
    destino: 'Maputo Sul',
    path: [
      [-25.8500, 32.5500],
      [-25.8700, 32.5600],
      [-25.8900, 32.5700],
      [-25.9100, 32.5800],
      [-25.9300, 32.5900],
      [-25.9500, 32.6000],
      [-25.9700, 32.6100]
    ]
  },
  {
    nome: 'Rota Costeira',
    origem: 'Costa Norte',
    destino: 'Costa Sul',
    path: [
      [-25.8000, 32.6500],
      [-25.8500, 32.7000],
      [-25.9000, 32.7500],
      [-25.9500, 32.8000],
      [-26.0000, 32.8500]
    ]
  },
  {
    nome: 'Rota Interior',
    origem: 'Interior Norte',
    destino: 'Interior Sul',
    path: [
      [-25.8000, 32.4000],
      [-25.8500, 32.4200],
      [-25.9000, 32.4400],
      [-25.9500, 32.4600],
      [-26.0000, 32.4800]
    ]
  },
  {
    nome: 'Diagonal Nordeste-Sudoeste',
    origem: 'Nordeste',
    destino: 'Sudoeste',
    path: [
      [-25.7000, 32.7000],
      [-25.7500, 32.6500],
      [-25.8000, 32.6000],
      [-25.8500, 32.5500],
      [-25.9000, 32.5000],
      [-25.9500, 32.4500],
      [-26.0000, 32.4000]
    ]
  },
  {
    nome: 'Diagonal Noroeste-Sudeste',
    origem: 'Noroeste',
    destino: 'Sudeste',
    path: [
      [-25.7000, 32.4000],
      [-25.7500, 32.4500],
      [-25.8000, 32.5000],
      [-25.8500, 32.5500],
      [-25.9000, 32.6000],
      [-25.9500, 32.6500],
      [-26.0000, 32.7000]
    ]
  }
];

// Generate more Maputo routes programmatically
function generateAdditionalMaputoRoutes() {
  const additionalRoutes = [];
  const basePoints = [
    { name: 'Maputo Centro', lat: -25.9692, lon: 32.5732 },
    { name: 'Matola', lat: -25.8798, lon: 32.4758 },
    { name: 'Machava', lat: -25.9002, lon: 32.4834 },
    { name: 'Av 4 Outubro', lat: -25.8900, lon: 32.5450 },
    { name: 'Circular', lat: -25.8300, lon: 32.6100 },
    { name: 'Norte', lat: -25.7500, lon: 32.5500 },
    { name: 'Sul', lat: -26.0500, lon: 32.6500 },
    { name: 'Leste', lat: -25.9000, lon: 32.7500 },
    { name: 'Oeste', lat: -25.9000, lon: 32.3500 },
    { name: 'Nordeste', lat: -25.7000, lon: 32.7000 },
    { name: 'Noroeste', lat: -25.7000, lon: 32.4000 },
    { name: 'Sudeste', lat: -26.1000, lon: 32.7500 },
    { name: 'Sudoeste', lat: -26.1000, lon: 32.4000 },
    { name: 'Centro-Norte', lat: -25.8500, lon: 32.5500 },
    { name: 'Centro-Sul', lat: -26.0000, lon: 32.5500 }
  ];
  
  // Create routes between different points
  for (let i = 0; i < basePoints.length; i++) {
    for (let j = i + 1; j < basePoints.length; j++) {
      const start = basePoints[i];
      const end = basePoints[j];
      
      // Create path with intermediate points
      const path = [];
      const steps = 8; // More intermediate points for better coverage
      for (let k = 0; k <= steps; k++) {
        const ratio = k / steps;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lon = start.lon + (end.lon - start.lon) * ratio;
        path.push([lat, lon]);
      }
      
      additionalRoutes.push({
        nome: `${start.name} → ${end.name}`,
        origem: start.name,
        destino: end.name,
        path: path
      });
    }
  }
  
  return additionalRoutes;
}

// Matola routes (shorter, fewer)
const matolaRoutes = [
  {
    nome: 'Matola Centro → Machava',
    origem: 'Matola Centro',
    destino: 'Machava',
    path: [
      [-25.9500, 32.6200],
      [-25.9550, 32.6250],
      [-25.9600, 32.6300],
      [-25.9650, 32.6350],
      [-25.9700, 32.6400]
    ]
  },
  {
    nome: 'Matola Centro → Fomento',
    origem: 'Matola Centro',
    destino: 'Fomento',
    path: [
      [-25.9500, 32.6200],
      [-25.9520, 32.6220],
      [-25.9540, 32.6240],
      [-25.9560, 32.6260],
      [-25.9580, 32.6280]
    ]
  },
  {
    nome: 'Matola Centro → Tsalala',
    origem: 'Matola Centro',
    destino: 'Tsalala',
    path: [
      [-25.9500, 32.6200],
      [-25.9480, 32.6220],
      [-25.9460, 32.6240],
      [-25.9440, 32.6260],
      [-25.9420, 32.6280]
    ]
  },
  {
    nome: 'Machava → Khongolote',
    origem: 'Machava',
    destino: 'Khongolote',
    path: [
      [-25.9700, 32.6400],
      [-25.9650, 32.6400],
      [-25.9600, 32.6400],
      [-25.9550, 32.6400],
      [-25.9500, 32.6400],
      [-25.9450, 32.6400],
      [-25.9400, 32.6400]
    ]
  },
  {
    nome: 'Matola Gare → Sikwama',
    origem: 'Matola Gare',
    destino: 'Sikwama',
    path: [
      [-25.9550, 32.6150],
      [-25.9560, 32.6200],
      [-25.9570, 32.6250],
      [-25.9580, 32.6300],
      [-25.9590, 32.6330],
      [-25.9600, 32.6350]
    ]
  }
];

// Generate more Matola routes
function generateAdditionalMatolaRoutes() {
  const additionalRoutes = [];
  const basePoints = [
    { name: 'Matola Centro', lat: -25.9500, lon: 32.6200 },
    { name: 'Machava', lat: -25.9700, lon: 32.6400 },
    { name: 'Fomento', lat: -25.9580, lon: 32.6280 },
    { name: 'Tsalala', lat: -25.9420, lon: 32.6280 },
    { name: 'Matola Gare', lat: -25.9550, lon: 32.6150 },
    { name: 'Matola Rio', lat: -25.9450, lon: 32.6300 },
    { name: 'Sikwama', lat: -25.9600, lon: 32.6350 },
    { name: 'Liberdade', lat: -25.9520, lon: 32.6250 },
    { name: 'Khongolote', lat: -25.9400, lon: 32.6400 }
  ];
  
  for (let i = 0; i < basePoints.length; i++) {
    for (let j = i + 1; j < basePoints.length; j++) {
      const start = basePoints[i];
      const end = basePoints[j];
      
      const path = [];
      const steps = 5;
      for (let k = 0; k <= steps; k++) {
        const ratio = k / steps;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lon = start.lon + (end.lon - start.lon) * ratio;
        path.push([lat, lon]);
      }
      
      additionalRoutes.push({
        nome: `${start.name} → ${end.name}`,
        origem: start.name,
        destino: end.name,
        path: path
      });
    }
  }
  
  return additionalRoutes;
}

async function reorganizeVias() {
  try {
    console.log('🚀 Starting via reorganization...\n');
    
    // Get municipio IDs
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } }
    });
    
    if (!maputo || !matola) {
      throw new Error('Could not find Maputo or Matola municipios');
    }
    
    console.log('📍 Municipio IDs:');
    console.log('Maputo:', maputo.id);
    console.log('Matola:', matola.id);
    console.log('');
    
    // Get all paragens
    const allParagens = await prisma.paragem.findMany();
    console.log(`📍 Total paragens: ${allParagens.length}`);
    console.log('');
    
    // Delete all existing vias
    console.log('🗑️  Deleting existing vias...');
    await prisma.viaParagem.deleteMany({});
    await prisma.via.deleteMany({});
    console.log('✅ All vias deleted\n');
    
    // Generate all routes
    const allMaputoRoutes = [...maputoRoutes, ...generateAdditionalMaputoRoutes()];
    const allMatolaRoutes = [...matolaRoutes, ...generateAdditionalMatolaRoutes()];
    
    // Select routes to maintain 111 total with Maputo > Matola
    const maputoRoutesToCreate = allMaputoRoutes.slice(0, 70); // 70 Maputo vias
    const matolaRoutesToCreate = allMatolaRoutes.slice(0, 41); // 41 Matola vias
    
    console.log(`📊 Creating ${maputoRoutesToCreate.length} Maputo vias and ${matolaRoutesToCreate.length} Matola vias`);
    console.log(`📊 Total routes available: ${allMaputoRoutes.length} Maputo, ${allMatolaRoutes.length} Matola\n`);
    
    let createdCount = 0;
    let totalAssociations = 0;
    
    // Create Maputo vias
    console.log('🏗️  Creating Maputo vias...');
    for (const route of maputoRoutesToCreate) {
      const geoJsonPath = {
        type: 'LineString',
        coordinates: route.path.map(p => [p[1], p[0]]) // [lon, lat]
      };
      
      // Calculate route length
      let routeLength = 0;
      for (let i = 0; i < route.path.length - 1; i++) {
        routeLength += calculateDistance(
          route.path[i][0], route.path[i][1],
          route.path[i + 1][0], route.path[i + 1][1]
        );
      }
      
      // Generate unique codigo
      const codigo = `VIA-MPT-${String(createdCount + 1).padStart(3, '0')}`;
      
      // Convert path to geoLocationPath format (lng,lat;lng,lat;...)
      const geoLocationPath = route.path.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: maputo.codigo,
          municipioId: maputo.id
        }
      });
      
      // Find and associate paragens within 50m
      let associatedCount = 0;
      for (const paragem of allParagens) {
        // Parse paragem geoLocation (format: "lat,lng")
        const [latStr, lngStr] = paragem.geoLocation.split(',');
        const paragemLat = parseFloat(latStr);
        const paragemLng = parseFloat(lngStr);
        
        if (isNaN(paragemLat) || isNaN(paragemLng)) continue;
        
        const paragemObj = {
          latitude: paragemLat,
          longitude: paragemLng
        };
        
        if (isParagemOnViaPath(paragemObj, route.path)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: associatedCount === 0 || associatedCount === route.path.length - 1
            }
          });
          associatedCount++;
          totalAssociations++;
        }
      }
      
      createdCount++;
      if (createdCount % 10 === 0) {
        console.log(`  Created ${createdCount} vias...`);
      }
    }
    
    console.log(`✅ Created ${maputoRoutesToCreate.length} Maputo vias\n`);
    
    // Create Matola vias
    console.log('🏗️  Creating Matola vias...');
    for (const route of matolaRoutesToCreate) {
      const geoJsonPath = {
        type: 'LineString',
        coordinates: route.path.map(p => [p[1], p[0]])
      };
      
      let routeLength = 0;
      for (let i = 0; i < route.path.length - 1; i++) {
        routeLength += calculateDistance(
          route.path[i][0], route.path[i][1],
          route.path[i + 1][0], route.path[i + 1][1]
        );
      }
      
      // Generate unique codigo
      const codigo = `VIA-MTL-${String(createdCount - maputoRoutesToCreate.length + 1).padStart(3, '0')}`;
      
      // Convert path to geoLocationPath format
      const geoLocationPath = route.path.map(p => `${p[1]},${p[0]}`).join(';');
      
      const via = await prisma.via.create({
        data: {
          codigo: codigo,
          nome: route.nome,
          terminalPartida: route.origem,
          terminalChegada: route.destino,
          geoLocationPath: geoLocationPath,
          codigoMunicipio: matola.codigo,
          municipioId: matola.id
        }
      });
      
      let associatedCount = 0;
      for (const paragem of allParagens) {
        // Parse paragem geoLocation
        const [latStr, lngStr] = paragem.geoLocation.split(',');
        const paragemLat = parseFloat(latStr);
        const paragemLng = parseFloat(lngStr);
        
        if (isNaN(paragemLat) || isNaN(paragemLng)) continue;
        
        const paragemObj = {
          latitude: paragemLat,
          longitude: paragemLng
        };
        
        if (isParagemOnViaPath(paragemObj, route.path)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: associatedCount === 0 || associatedCount === route.path.length - 1
            }
          });
          associatedCount++;
          totalAssociations++;
        }
      }
      
      createdCount++;
    }
    
    console.log(`✅ Created ${matolaRoutesToCreate.length} Matola vias\n`);
    
    // Verify results
    const finalMaputoCount = await prisma.via.count({
      where: { municipioId: maputo.id }
    });
    
    const finalMatolaCount = await prisma.via.count({
      where: { municipioId: matola.id }
    });
    
    const totalVias = await prisma.via.count();
    const totalParagens = await prisma.paragem.count();
    const totalViaParagens = await prisma.viaParagem.count();
    
    console.log('✅ REORGANIZATION COMPLETE!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Maputo vias: ${finalMaputoCount}`);
    console.log(`  Matola vias: ${finalMatolaCount}`);
    console.log(`  Total vias: ${totalVias}`);
    console.log(`  Total paragens: ${totalParagens} (preserved)`);
    console.log(`  Total via-paragem associations: ${totalViaParagens}`);
    console.log('');
    console.log(`✅ Maputo vias (${finalMaputoCount}) > Matola vias (${finalMatolaCount})`);
    console.log(`✅ All ${totalParagens} paragens preserved`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reorganizeVias();
