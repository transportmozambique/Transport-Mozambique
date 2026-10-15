/**
 * Create Vias (Bus Routes) and Connect Stops
 * 
 * This script creates realistic bus routes for Maputo and Matola
 * and connects them to the imported stops via ViaParagem relations.
 * 
 * Run: node create-vias-with-stops.js
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

// Define major bus routes in Maputo and Matola
const ROUTES = [
  {
    nome: "Rota Maputo Centro - Matola",
    codigo: "R001",
    cor: "#FF6B6B",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Matola Gare",
    keywords: ["Centro", "Baixa", "Matola", "Gare", "Praça", "Avenida"]
  },
  {
    nome: "Rota Costa do Sol - Machava",
    codigo: "R002",
    cor: "#4ECDC4",
    terminalPartida: "Costa do Sol",
    terminalChegada: "Machava",
    keywords: ["Costa", "Machava", "Socimol", "Naz Naz", "Sede"]
  },
  {
    nome: "Rota Maputo - Marracuene",
    codigo: "R003",
    cor: "#95E1D3",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Marracuene",
    keywords: ["Marracuene", "Boquisso", "Ricatla", "Magawanine"]
  },
  {
    nome: "Rota Maputo - Boane",
    codigo: "R004",
    cor: "#F38181",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Boane",
    keywords: ["Boane", "Mafuiane", "Namaacha", "Padaria Boane"]
  },
  {
    nome: "Rota Tchumene - Matola Gare",
    codigo: "R005",
    cor: "#AA96DA",
    terminalPartida: "Tchumene",
    terminalChegada: "Matola Gare",
    keywords: ["Tchumene", "Matola", "Gare", "Nkobe"]
  },
  {
    nome: "Rota Zimpeto - Cidade da Matola",
    codigo: "R006",
    cor: "#FCBAD3",
    terminalPartida: "Zimpeto",
    terminalChegada: "Cidade da Matola",
    keywords: ["Zimpeto", "Cidade da Matola", "Patrice Lumumba", "T3"]
  },
  {
    nome: "Rota Maputo - Manhiça",
    codigo: "R007",
    cor: "#FFFFD2",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Manhiça",
    keywords: ["Manhiça", "Maragra", "Xinavane", "Balucuane"]
  },
  {
    nome: "Rota Intaka - Matola",
    codigo: "R008",
    cor: "#A8D8EA",
    terminalPartida: "Intaka",
    terminalChegada: "Matola Gare",
    keywords: ["Intaka", "Matibwana", "Beleza", "Mathlemele"]
  },
  {
    nome: "Rota Maputo - Mucatine",
    codigo: "R009",
    cor: "#FFAAA5",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Mucatine",
    keywords: ["Mucatine", "Boquisso", "Oliveira"]
  },
  {
    nome: "Rota Machava - Mozal",
    codigo: "R010",
    cor: "#FF8B94",
    terminalPartida: "Machava",
    terminalChegada: "Mozal",
    keywords: ["Machava", "Mozal", "Texlom", "Salesiano"]
  },
  {
    nome: "Rota Circular Matola",
    codigo: "R011",
    cor: "#C7CEEA",
    terminalPartida: "Matola Gare",
    terminalChegada: "Matola Gare",
    keywords: ["Matola", "Sikwama", "Bedene", "Kongolote", "Nkobe"]
  },
  {
    nome: "Rota Maputo - Ponta do Ouro",
    codigo: "R012",
    cor: "#B5EAD7",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Ponta do Ouro",
    keywords: ["Ponta", "Ouro", "Salamanga", "Bela Vista", "Fronteira"]
  },
  {
    nome: "Rota Circular Machava",
    codigo: "R013",
    cor: "#FFD93D",
    terminalPartida: "Machava Sede",
    terminalChegada: "Machava Sede",
    keywords: ["Machava", "Romos", "Pinheiros", "Mafurreira", "Baião"]
  },
  {
    nome: "Rota Maputo - Albazine",
    codigo: "R014",
    cor: "#6BCB77",
    terminalPartida: "Maputo Centro",
    terminalChegada: "Albazine",
    keywords: ["Albazine", "Maningue", "Grande Maputo"]
  },
  {
    nome: "Rota João Mateus - Cidade da Matola",
    codigo: "R015",
    cor: "#4D96FF",
    terminalPartida: "João Mateus",
    terminalChegada: "Cidade da Matola",
    keywords: ["João Mateus", "Shoprite", "Ceres", "Desportivo", "Bagamoio"]
  }
];

// Function to check if a stop matches route keywords
function stopMatchesRoute(stopName, keywords) {
  const normalizedStopName = stopName.toLowerCase();
  return keywords.some(keyword => 
    normalizedStopName.includes(keyword.toLowerCase())
  );
}

// Function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Function to generate route path from stops
function generateRoutePath(stops) {
  // Sort stops by latitude (north to south) for a logical route
  const sortedStops = [...stops].sort((a, b) => {
    const [latA] = a.geoLocation.split(',').map(Number);
    const [latB] = b.geoLocation.split(',').map(Number);
    return latA - latB;
  });

  // Create path string: lng,lat;lng,lat;...
  return sortedStops.map(stop => {
    const [lat, lng] = stop.geoLocation.split(',');
    return `${lng},${lat}`;
  }).join(';');
}

async function createViasWithStops() {
  console.log('🚌 Starting creation of Vias and ViaParagem relations...\n');

  // Get or create municipality
  console.log('🏛️  Setting up municipality...');
  let municipio = await retryOperation(async () => {
    return await prisma.municipio.findFirst({
      where: { nome: "Maputo" }
    });
  });

  if (!municipio) {
    console.log('Creating Maputo municipality...');
    municipio = await retryOperation(async () => {
      return await prisma.municipio.create({
        data: {
          nome: "Maputo",
          codigo: "MUN-MPT-001",
          endereco: "Cidade de Maputo, Moçambique"
        }
      });
    });
    console.log('✅ Created Maputo municipality');
  } else {
    console.log('✅ Found existing Maputo municipality');
  }

  // Get all stops from database
  console.log('\n📍 Loading all stops from database...');
  const allStops = await retryOperation(async () => {
    return await prisma.paragem.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true
      }
    });
  });
  console.log(`✅ Loaded ${allStops.length} stops\n`);

  let createdVias = 0;
  let createdRelations = 0;
  let skippedVias = 0;

  // Process each route
  for (const route of ROUTES) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚌 Processing: ${route.nome} (${route.codigo})`);
    console.log(`${'='.repeat(70)}`);

    // Check if via already exists
    const existingVia = await retryOperation(async () => {
      return await prisma.via.findUnique({
        where: { codigo: route.codigo }
      });
    });

    if (existingVia) {
      console.log(`⏭️  Via ${route.codigo} already exists, skipping...`);
      skippedVias++;
      continue;
    }

    // Find stops that match this route
    const matchingStops = allStops.filter(stop => 
      stopMatchesRoute(stop.nome, route.keywords)
    );

    console.log(`📍 Found ${matchingStops.length} matching stops`);

    if (matchingStops.length === 0) {
      console.log(`⚠️  No stops found for route ${route.codigo}, skipping...`);
      continue;
    }

    // Generate route path
    const routePath = generateRoutePath(matchingStops);

    // Create the Via
    console.log(`\n🔨 Creating Via: ${route.nome}...`);
    const via = await retryOperation(async () => {
      return await prisma.via.create({
        data: {
          nome: route.nome,
          codigo: route.codigo,
          cor: route.cor,
          terminalPartida: route.terminalPartida,
          terminalChegada: route.terminalChegada,
          geoLocationPath: routePath,
          codigoMunicipio: municipio.codigo,
          municipioId: municipio.id
        }
      });
    });

    console.log(`✅ Created Via: ${via.nome}`);
    createdVias++;

    // Create ViaParagem relations
    console.log(`\n🔗 Connecting ${matchingStops.length} stops to route...`);
    let relationsCreated = 0;

    for (let i = 0; i < matchingStops.length; i++) {
      const stop = matchingStops[i];
      const isTerminal = i === 0 || i === matchingStops.length - 1;

      try {
        await retryOperation(async () => {
          await prisma.viaParagem.create({
            data: {
              codigoParagem: stop.codigo,
              codigoVia: via.codigo,
              terminalBoolean: isTerminal,
              viaId: via.id,
              paragemId: stop.id
            }
          });
        });

        relationsCreated++;
        createdRelations++;

        if (relationsCreated % 10 === 0) {
          console.log(`  ✅ Connected ${relationsCreated}/${matchingStops.length} stops...`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not connect stop ${stop.nome}: ${error.message}`);
      }
    }

    console.log(`✅ Connected ${relationsCreated} stops to ${via.nome}`);

    // Small delay between routes
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 CREATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Vias created: ${createdVias}`);
  console.log(`⏭️  Vias skipped (already exist): ${skippedVias}`);
  console.log(`🔗 ViaParagem relations created: ${createdRelations}`);
  console.log('='.repeat(70));

  // Verify results
  console.log('\n🔍 Verifying results...');
  const totalVias = await retryOperation(async () => {
    return await prisma.via.count();
  });
  const totalRelations = await retryOperation(async () => {
    return await prisma.viaParagem.count();
  });

  console.log(`\n📊 Database Status:`);
  console.log(`   Total Vias: ${totalVias}`);
  console.log(`   Total ViaParagem relations: ${totalRelations}`);
  console.log(`   Total Paragens: ${allStops.length}`);

  console.log('\n🎉 Via creation completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Assign buses (Transportes) to these routes');
  console.log('   2. Test the webapp to see routes and stops');
  console.log('   3. Update USSD to use the new routes');
  console.log('   4. Add more specific routes if needed');
}

// Run the script
createViasWithStops()
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
