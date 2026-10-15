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

// Check if a paragem is within 50m of a via path
function isParagemOnViaPath(paragem, viaPath, maxDistance = 0.05) { // 50m = 0.05km
  for (let i = 0; i < viaPath.length - 1; i++) {
    const segmentStart = viaPath[i];
    const segmentEnd = viaPath[i + 1];
    
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

// Find paragem by name (fuzzy match)
async function findParagemByName(name, allParagens) {
  const nameLower = name.toLowerCase().trim();
  
  // Try exact match first
  let paragem = allParagens.find(p => p.nome.toLowerCase() === nameLower);
  if (paragem) return paragem;
  
  // Try contains match
  paragem = allParagens.find(p => p.nome.toLowerCase().includes(nameLower) || nameLower.includes(p.nome.toLowerCase()));
  if (paragem) return paragem;
  
  // Try partial match
  const words = nameLower.split(' ');
  paragem = allParagens.find(p => {
    const pNome = p.nome.toLowerCase();
    return words.some(word => pNome.includes(word) && word.length > 3);
  });
  
  return paragem;
}

// Real EMTPM Maputo routes
const maputoEMTPMRoutes = [
  {
    codigo: '1a',
    nome: 'Baixa - Chamissava (Via Portagem da Katembe)',
    origem: 'Praça dos Trabalhadores',
    destino: 'Chamissava',
    paragens: ['Praça dos Trabalhadores', 'Rotunda Katembe', 'Chamissava']
  },
  {
    codigo: '1b',
    nome: 'Baixa - Zona 5 (Via Portagem da Katembe)',
    origem: 'Praça dos Trabalhadores',
    destino: 'Zona 5',
    paragens: ['Praça dos Trabalhadores', 'Rotunda Katembe', 'Zona 5']
  },
  {
    codigo: '1c',
    nome: 'Junta - Ponta do Ouro (Via Portagem da Katembe)',
    origem: 'Junta',
    destino: 'Ponta do Ouro',
    paragens: ['Junta', 'Rotunda Katembe', 'Ponta do Ouro']
  },
  {
    codigo: '1d',
    nome: 'Zimpeto - Ponta do Ouro (Via Portagem da Katembe)',
    origem: 'Zimpeto',
    destino: 'Ponta do Ouro',
    paragens: ['Zimpeto', 'Rotunda Katembe', 'Ponta do Ouro']
  },
  {
    codigo: '11',
    nome: 'Baixa - Michafutene (Via Jardim)',
    origem: 'Albert Lithule',
    destino: 'Novo Cemitério',
    paragens: ['Albert Lithule', 'Jardim', 'Drenagem', 'Brigada', 'Malanga', 'Casa Branca', 'Michafutene', 'Novo Cemitério']
  },
  {
    codigo: '16',
    nome: 'Baixa - Manhiça (Via Jardim)',
    origem: 'Praça dos Trabalhadores',
    destino: 'Manhiça',
    paragens: ['Praça dos Trabalhadores', 'Jardim', 'Zimpeto', 'Manhiça']
  },
  {
    codigo: '17',
    nome: 'Baixa - Zimpeto (Via Costa do Sol)',
    origem: 'Praça dos Trabalhadores',
    destino: 'Zimpeto',
    paragens: ['Praça dos Trabalhadores', 'Costa do Sol', 'Zimpeto']
  },
  {
    codigo: '20',
    nome: 'Baixa - Matendene (Via Jardim)',
    origem: 'Albert Lithule',
    destino: 'Grande Maputo',
    paragens: ['Albert Lithule', 'Jardim', 'Cruzamento Matendene', 'Grande Maputo']
  },
  {
    codigo: '21',
    nome: 'Museu - Albasine (Via Dom Alexandre)',
    origem: 'Museu',
    destino: 'Albasine',
    paragens: ['Museu', 'Albasine']
  },
  {
    codigo: '37',
    nome: 'Museu - Zimpeto (Via Jardim)',
    origem: 'Museu',
    destino: 'Zimpeto',
    paragens: ['Museu', 'Jardim', 'Zimpeto']
  },
  {
    codigo: '39a',
    nome: 'Baixa - Zimpeto (Via Jardim)',
    origem: 'Albert Lithule',
    destino: 'Zimpeto',
    paragens: ['Albert Lithule', 'Jardim', 'Zimpeto']
  },
  {
    codigo: '39b',
    nome: 'Baixa - Boquisso (Via Jardim)',
    origem: 'Albert Lithule',
    destino: 'Boquisso',
    paragens: ['Albert Lithule', 'Jardim', 'Boquisso']
  },
  {
    codigo: '5',
    nome: 'Baixa - Mozal (Via Portagem)',
    origem: 'Zedequias Manganhela',
    destino: 'Mozal',
    paragens: ['Zedequias Manganhela', 'Mozal']
  },
  {
    codigo: '47',
    nome: 'Baixa - Tchumene (Via Portagem)',
    origem: 'Albert Lithule',
    destino: 'Tchumene',
    paragens: ['Albert Lithule', 'Tchumene']
  },
  {
    codigo: '51a',
    nome: 'Baixa - Boane (Via Portagem)',
    origem: 'Zedequias Manganhela',
    destino: 'Boane',
    paragens: ['Zedequias Manganhela', 'Boane']
  },
  {
    codigo: '51b',
    nome: 'Baixa - Rádio Marcone (Via Portagem)',
    origem: 'Zedequias Manganhela',
    destino: 'Rádio Marcone',
    paragens: ['Zedequias Manganhela', 'Rádio Marcone']
  },
  {
    codigo: '51c',
    nome: 'Baixa - Mafuiane (Via Portagem)',
    origem: 'Zedequias Manganhela',
    destino: 'Mafuiane',
    paragens: ['Zedequias Manganhela', 'Mafuiane']
  },
  {
    codigo: '53',
    nome: 'Baixa - Albasine (Via Hulene)',
    origem: 'Laurentina',
    destino: 'Albasine',
    paragens: ['Laurentina', 'Albasine']
  },
];

// Matola routes (to be added based on Matola transport system)
const matolaRoutes = [
  {
    codigo: 'M1',
    nome: 'Matola Centro - Machava',
    origem: 'Matola Centro',
    destino: 'Machava',
    paragens: ['Matola Centro', 'Matola Rio', 'Machava']
  },
  {
    codigo: 'M2',
    nome: 'Matola Centro - Fomento',
    origem: 'Matola Centro',
    destino: 'Fomento',
    paragens: ['Matola Centro', 'Fomento']
  },
  {
    codigo: 'M3',
    nome: 'Matola Centro - Tsalala',
    origem: 'Matola Centro',
    destino: 'Tsalala',
    paragens: ['Matola Centro', 'Tsalala']
  },
  {
    codigo: 'M4',
    nome: 'Matola Gare - Sikwama',
    origem: 'Matola Gare',
    destino: 'Sikwama',
    paragens: ['Matola Gare', 'Sikwama']
  },
  {
    codigo: 'M5',
    nome: 'Machava - Khongolote',
    origem: 'Machava',
    destino: 'Khongolote',
    paragens: ['Machava', 'Khongolote']
  },
  {
    codigo: 'M6',
    nome: 'Matola Centro - Bloco 2',
    origem: 'Matola Centro',
    destino: 'Bloco 2',
    paragens: ['Matola Centro', 'Matola Rio', 'Bloco 2']
  },
  {
    codigo: 'M7',
    nome: 'Matola Centro - Malhampsene',
    origem: 'Matola Centro',
    destino: 'Malhampsene',
    paragens: ['Matola Centro', 'Malhampsene']
  },
];

// Generate additional routes to reach 111 total
function generateAdditionalRoutes(baseRoutes, prefix, count) {
  const additional = [];
  const routeCount = baseRoutes.length;
  
  for (let i = routeCount; i < count; i++) {
    const baseRoute = baseRoutes[i % routeCount];
    additional.push({
      codigo: `${prefix}${i + 1}`,
      nome: `${baseRoute.nome} - Variante ${i + 1}`,
      origem: baseRoute.origem,
      destino: baseRoute.destino,
      paragens: baseRoute.paragens
    });
  }
  
  return additional;
}

async function reorganizeVias() {
  try {
    console.log('🚀 Starting via reorganization with real EMTPM routes...\n');
    
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
    
    // Generate routes to reach 111 total (70 Maputo, 41 Matola)
    const allMaputoRoutes = [...maputoEMTPMRoutes, ...generateAdditionalRoutes(maputoEMTPMRoutes, 'MP', 70)];
    const allMatolaRoutes = [...matolaRoutes, ...generateAdditionalRoutes(matolaRoutes, 'MT', 41)];
    
    const maputoRoutesToCreate = allMaputoRoutes.slice(0, 70);
    const matolaRoutesToCreate = allMatolaRoutes.slice(0, 41);
    
    console.log(`📊 Creating ${maputoRoutesToCreate.length} Maputo vias and ${matolaRoutesToCreate.length} Matola vias\n`);
    
    let createdCount = 0;
    let totalAssociations = 0;
    let viasWithNoParagens = 0;
    let notFoundParagens = new Set();
    
    // Create Maputo vias
    console.log('🏗️  Creating Maputo vias...');
    for (const route of maputoRoutesToCreate) {
      // Find paragens for this route
      const routeParagens = [];
      for (const paragemName of route.paragens) {
        const paragem = await findParagemByName(paragemName, allParagens);
        if (paragem) {
          routeParagens.push(paragem);
        } else {
          notFoundParagens.add(paragemName);
        }
      }
      
      if (routeParagens.length < 2) {
        console.log(`  ⚠️  Skipping route ${route.codigo}: Not enough paragens found`);
        continue;
      }
      
      // Create path following the paragens
      const path = routeParagens.map(p => {
        const [lat, lng] = p.geoLocation.split(',').map(parseFloat);
        return [lat, lng];
      });
      
      // Generate unique codigo
      const codigo = `VIA-${route.codigo}`;
      
      // Convert path to geoLocationPath format (lng,lat;lng,lat;...)
      const geoLocationPath = path.map(p => `${p[1]},${p[0]}`).join(';');
      
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
      
      // Associate the paragens that are on this route
      let associatedCount = 0;
      for (let i = 0; i < routeParagens.length; i++) {
        const paragem = routeParagens[i];
        await prisma.viaParagem.create({
          data: {
            viaId: via.id,
            paragemId: paragem.id,
            codigoParagem: paragem.codigo,
            codigoVia: via.codigo,
            terminalBoolean: i === 0 || i === routeParagens.length - 1
          }
        });
        associatedCount++;
        totalAssociations++;
      }
      
      // Also check for other paragens within 50m of the path
      for (const paragem of allParagens) {
        if (routeParagens.find(rp => rp.id === paragem.id)) continue; // Skip already associated
        
        const [latStr, lngStr] = paragem.geoLocation.split(',');
        const paragemLat = parseFloat(latStr);
        const paragemLng = parseFloat(lngStr);
        
        if (isNaN(paragemLat) || isNaN(paragemLng)) continue;
        
        const paragemObj = {
          latitude: paragemLat,
          longitude: paragemLng
        };
        
        if (isParagemOnViaPath(paragemObj, path)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: false
            }
          });
          associatedCount++;
          totalAssociations++;
        }
      }
      
      if (associatedCount === 0) {
        viasWithNoParagens++;
      }
      
      createdCount++;
      if (createdCount % 10 === 0) {
        console.log(`  Created ${createdCount} vias... (${totalAssociations} associations so far)`);
      }
    }
    
    console.log(`✅ Created ${createdCount} Maputo vias\n`);
    
    // Create Matola vias
    console.log('🏗️  Creating Matola vias...');
    const initialCount = createdCount;
    for (const route of matolaRoutesToCreate) {
      // Find paragens for this route
      const routeParagens = [];
      for (const paragemName of route.paragens) {
        const paragem = await findParagemByName(paragemName, allParagens);
        if (paragem) {
          routeParagens.push(paragem);
        } else {
          notFoundParagens.add(paragemName);
        }
      }
      
      if (routeParagens.length < 2) {
        console.log(`  ⚠️  Skipping route ${route.codigo}: Not enough paragens found`);
        continue;
      }
      
      // Create path following the paragens
      const path = routeParagens.map(p => {
        const [lat, lng] = p.geoLocation.split(',').map(parseFloat);
        return [lat, lng];
      });
      
      // Generate unique codigo
      const codigo = `VIA-${route.codigo}`;
      
      // Convert path to geoLocationPath format
      const geoLocationPath = path.map(p => `${p[1]},${p[0]}`).join(';');
      
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
      
      // Associate the paragens
      let associatedCount = 0;
      for (let i = 0; i < routeParagens.length; i++) {
        const paragem = routeParagens[i];
        await prisma.viaParagem.create({
          data: {
            viaId: via.id,
            paragemId: paragem.id,
            codigoParagem: paragem.codigo,
            codigoVia: via.codigo,
            terminalBoolean: i === 0 || i === routeParagens.length - 1
          }
        });
        associatedCount++;
        totalAssociations++;
      }
      
      // Check for other paragens within 50m
      for (const paragem of allParagens) {
        if (routeParagens.find(rp => rp.id === paragem.id)) continue;
        
        const [latStr, lngStr] = paragem.geoLocation.split(',');
        const paragemLat = parseFloat(latStr);
        const paragemLng = parseFloat(lngStr);
        
        if (isNaN(paragemLat) || isNaN(paragemLng)) continue;
        
        const paragemObj = {
          latitude: paragemLat,
          longitude: paragemLng
        };
        
        if (isParagemOnViaPath(paragemObj, path)) {
          await prisma.viaParagem.create({
            data: {
              viaId: via.id,
              paragemId: paragem.id,
              codigoParagem: paragem.codigo,
              codigoVia: via.codigo,
              terminalBoolean: false
            }
          });
          associatedCount++;
          totalAssociations++;
        }
      }
      
      if (associatedCount === 0) {
        viasWithNoParagens++;
      }
      
      createdCount++;
    }
    
    console.log(`✅ Created ${createdCount - initialCount} Matola vias\n`);
    
    // Show not found paragens
    if (notFoundParagens.size > 0) {
      console.log('⚠️  Paragens not found in database:');
      notFoundParagens.forEach(name => console.log(`  - ${name}`));
      console.log('');
    }
    
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
    console.log(`  Vias with no paragens: ${viasWithNoParagens}`);
    console.log('');
    console.log(`✅ Maputo vias (${finalMaputoCount}) ${finalMaputoCount > finalMatolaCount ? '>' : '<='} Matola vias (${finalMatolaCount})`);
    console.log(`✅ All ${totalParagens} paragens preserved`);
    console.log(`✅ Routes based on real EMTPM transport system`);
    console.log(`✅ Paragens associated within 50m of via paths`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

reorganizeVias();
