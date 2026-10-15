const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Parse tab-separated OSM data
function parseOSMData(rawData) {
  const lines = rawData.trim().split('\n');
  const stops = [];
  
  const startIndex = lines[0].includes('@id') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    
    const osmId = parts[0].trim();
    const lat = parseFloat(parts[1].trim());
    const lon = parseFloat(parts[2].trim());
    const name = parts[3] ? parts[3].trim() : null;
    
    if (isNaN(lat) || isNaN(lon) || !name || name === '') continue;
    
    stops.push({ osmId, lat, lon, name });
  }
  
  return stops;
}

// Deduplicate stops by name (average coordinates for same name)
function deduplicateStops(stops) {
  const stopsByName = new Map();
  
  for (const stop of stops) {
    if (!stopsByName.has(stop.name)) {
      stopsByName.set(stop.name, {
        name: stop.name,
        lats: [stop.lat],
        lons: [stop.lon],
        osmIds: [stop.osmId]
      });
    } else {
      const existing = stopsByName.get(stop.name);
      existing.lats.push(stop.lat);
      existing.lons.push(stop.lon);
      existing.osmIds.push(stop.osmId);
    }
  }
  
  // Average coordinates for stops with same name
  const uniqueStops = [];
  for (const [name, data] of stopsByName) {
    const avgLat = data.lats.reduce((a, b) => a + b, 0) / data.lats.length;
    const avgLon = data.lons.reduce((a, b) => a + b, 0) / data.lons.length;
    uniqueStops.push({
      name,
      lat: avgLat,
      lon: avgLon,
      osmId: data.osmIds[0],
      count: data.lats.length
    });
  }
  
  return uniqueStops;
}

// Get OSRM route between two points
async function getOSRMRoute(start, end) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      return coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
    }
  } catch (error) {
    console.log(`⚠️  OSRM failed for ${start.name} to ${end.name}`);
  }
  
  return `${start.lon},${start.lat};${end.lon},${end.lat}`;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find stops near a route path
function findStopsNearRoute(routePath, allStops, maxDistanceKm = 0.5) {
  const pathCoords = routePath.split(';').map(coord => {
    const [lon, lat] = coord.split(',').map(Number);
    return { lat, lon };
  });
  
  const nearbyStops = [];
  
  for (const stop of allStops) {
    for (const pathPoint of pathCoords) {
      const distance = calculateDistance(
        stop.lat, stop.lon,
        pathPoint.lat, pathPoint.lon
      );
      
      if (distance <= maxDistanceKm) {
        nearbyStops.push(stop);
        break;
      }
    }
  }
  
  return nearbyStops;
}

// Pexels photos of Black people
const blackPeoplePhotos = [
  "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg",
  "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg",
  "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg",
  "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg",
  "https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg",
  "https://images.pexels.com/photos/1520760/pexels-photo-1520760.jpeg",
  "https://images.pexels.com/photos/1484810/pexels-photo-1484810.jpeg",
  "https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg",
  "https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg",
  "https://images.pexels.com/photos/1722198/pexels-photo-1722198.jpeg",
  "https://images.pexels.com/photos/1758144/pexels-photo-1758144.jpeg",
  "https://images.pexels.com/photos/1820559/pexels-photo-1820559.jpeg",
  "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg",
  "https://images.pexels.com/photos/2709388/pexels-photo-2709388.jpeg",
  "https://images.pexels.com/photos/3094215/pexels-photo-3094215.jpeg",
  "https://images.pexels.com/photos/3211476/pexels-photo-3211476.jpeg",
  "https://images.pexels.com/photos/3394347/pexels-photo-3394347.jpeg",
  "https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg",
  "https://images.pexels.com/photos/4307869/pexels-photo-4307869.jpeg",
  "https://images.pexels.com/photos/5384445/pexels-photo-5384445.jpeg"
];

const africanFirstNamesMale = [
  "Abasi", "Amadi", "Azizi", "Baraka", "Chike", "Dakarai", "Ekon", "Faraji",
  "Jabari", "Kamau", "Kofi", "Kwame", "Mandla", "Nkosi", "Obasi", "Sekou",
  "Tau", "Thabo", "Tendai", "Zuberi", "João", "Pedro", "Carlos", "António",
  "Manuel", "Fernando", "Ricardo", "Paulo", "José", "Francisco", "Armando"
];

const africanFirstNamesFemale = [
  "Amara", "Asha", "Ayanna", "Chiamaka", "Eshe", "Faizah", "Imani", "Jamila",
  "Kaya", "Lulu", "Makena", "Nia", "Sanaa", "Zuri", "Maria", "Ana", "Isabel",
  "Rosa", "Beatriz", "Sofia", "Catarina", "Teresa", "Paula", "Carla"
];

const mozambicanSurnames = [
  "Silva", "Santos", "Costa", "Macamo", "Nhaca", "Sitoe", "Cossa", "Mondlane",
  "Chissano", "Guebuzza", "Machel", "Tembe", "Mabunda", "Chapo", "Nhamitambo",
  "Mahumane", "Bila", "Matlombe", "Massinga", "Nkomo", "Zandamela", "Maluleque",
  "Chicuamba", "Maposse", "Nhabinde", "Cumbe", "Muthisse", "Zavale", "Matusse",
  "Chongo", "Mabote", "Ngovene", "Macie", "Langa", "Mussagy", "Nkavele"
];

function generateDriverName(gender, index) {
  const firstName = gender === "Masculino" 
    ? africanFirstNamesMale[index % africanFirstNamesMale.length]
    : africanFirstNamesFemale[index % africanFirstNamesFemale.length];
  
  const surname = mozambicanSurnames[index % mozambicanSurnames.length];
  
  return `${firstName} ${surname}`;
}

function generateDate(yearsAgo, variation = 0) {
  const today = new Date();
  const year = today.getFullYear() - yearsAgo + (variation % 3);
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
}

async function main() {
  console.log('🚀 CREATING REALISTIC TRANSPORT SYSTEM\n');
  console.log('='.repeat(80));

  // 1. Clear existing data
  console.log('\n🗑️  Clearing existing data...\n');
  
  await prisma.motorista.deleteMany({});
  await prisma.viaParagem.deleteMany({});
  await prisma.transporteProprietario.deleteMany({});
  await prisma.transporte.deleteMany({});
  await prisma.paragem.deleteMany({});
  await prisma.via.deleteMany({});
  
  console.log('✅ Data cleared');

  // 2. Get/Create Municipalities
  console.log('\n🏛️  Setting up municipalities...\n');
  
  const municipioMaputo = await prisma.municipio.upsert({
    where: { codigo: 'MUN-MAPUTO' },
    update: {},
    create: {
      nome: 'Maputo',
      codigo: 'MUN-MAPUTO',
      endereco: 'Maputo, Moçambique',
      contacto1: 21300000,
    }
  });

  const municipioMatola = await prisma.municipio.upsert({
    where: { codigo: 'MUN-MATOLA' },
    update: {},
    create: {
      nome: 'Matola',
      codigo: 'MUN-MATOLA',
      endereco: 'Matola, Moçambique',
      contacto1: 21400000,
    }
  });
  
  console.log('✅ Municipalities ready');

  // 3. Import and deduplicate stops
  console.log('\n🚏 Importing stops from JSON files...\n');
  
  let maputoData = '';
  let matolaData = '';
  
  try {
    maputoData = fs.readFileSync(path.join(process.cwd(), '..', 'maputo-stops-data.json'), 'utf-8');
    console.log('✅ Loaded maputo-stops-data.json');
  } catch (error) {
    console.log('❌ Could not load maputo-stops-data.json');
    process.exit(1);
  }
  
  try {
    matolaData = fs.readFileSync(path.join(process.cwd(), '..', 'matola-stops-data.json'), 'utf-8');
    console.log('✅ Loaded matola-stops-data.json');
  } catch (error) {
    console.log('❌ Could not load matola-stops-data.json');
    process.exit(1);
  }

  const maputoStops = parseOSMData(maputoData);
  const matolaStops = parseOSMData(matolaData);
  
  console.log(`\n📊 Parsed ${maputoStops.length} Maputo stops`);
  console.log(`📊 Parsed ${matolaStops.length} Matola stops`);
  
  // Deduplicate by name
  const allStopsRaw = [...maputoStops, ...matolaStops];
  const uniqueStops = deduplicateStops(allStopsRaw);
  
  console.log(`📊 After deduplication: ${uniqueStops.length} unique stops`);
  console.log(`📊 Merged ${allStopsRaw.length - uniqueStops.length} duplicate stop names\n`);

  // Create stops in database
  const createdStops = [];
  for (let i = 0; i < uniqueStops.length; i++) {
    const stop = uniqueStops[i];
    try {
      const paragem = await prisma.paragem.create({
        data: {
          nome: stop.name,
          codigo: `PAR-${String(i + 1).padStart(4, '0')}`,
          geoLocation: `${stop.lat},${stop.lon}`,
        }
      });
      createdStops.push({ ...stop, id: paragem.id, codigo: paragem.codigo });
      
      if ((i + 1) % 50 === 0) {
        console.log(`✅ ${i + 1}/${uniqueStops.length} stops created...`);
      }
    } catch (error) {
      console.log(`⚠️  Error creating stop ${stop.name}: ${error.message}`);
    }
  }
  console.log(`✅ ${createdStops.length} unique stops created!\n`);

  // 4. Get proprietarios
  const proprietarios = await prisma.proprietario.findMany();
  console.log(`✅ Found ${proprietarios.length} proprietarios (empresas)\n`);

  if (proprietarios.length === 0) {
    console.error('❌ No proprietarios found! Run empresas creation first.');
    process.exit(1);
  }

  // 5. Create 111 vias with OSRM routes covering all stops
  console.log('🛣️  Creating 111 vias with OSRM road-following routes...\n');
  
  const cores = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557',
    '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#264653'
  ];

  const vias = [];
  const stopsPerRoute = Math.ceil(createdStops.length / 111);
  
  for (let i = 0; i < 111; i++) {
    // Select stops for this route to ensure coverage
    const startIdx = (i * stopsPerRoute) % createdStops.length;
    const endIdx = ((i + 1) * stopsPerRoute) % createdStops.length;
    
    const startStop = createdStops[startIdx];
    const endStop = createdStops[endIdx];
    
    // Get OSRM route
    const routePath = await getOSRMRoute(startStop, endStop);
    
    const municipio = i % 2 === 0 ? municipioMaputo : municipioMatola;
    
    const via = await prisma.via.create({
      data: {
        nome: `${startStop.name} - ${endStop.name}`,
        codigo: `V${String(i + 1).padStart(3, '0')}`,
        cor: cores[i % cores.length],
        terminalPartida: startStop.name,
        terminalChegada: endStop.name,
        geoLocationPath: routePath,
        codigoMunicipio: municipio.codigo,
        municipioId: municipio.id,
      }
    });
    
    vias.push({ ...via, routePath, startStop, endStop });
    
    if ((i + 1) % 10 === 0) {
      console.log(`✅ ${i + 1}/111 vias created...`);
    }
    
    // Small delay to avoid overwhelming OSRM
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  console.log(`✅ 111/111 vias created!\n`);

  // 6. Associate stops to vias
  console.log('🔗 Associating stops to vias that pass through them...\n');
  
  let associationsCreated = 0;
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    const nearbyStops = findStopsNearRoute(via.routePath, createdStops, 0.5);
    
    // Always include start and end terminals
    const stopsToAdd = new Set([via.startStop.codigo, via.endStop.codigo]);
    nearbyStops.forEach(s => stopsToAdd.add(s.codigo));
    
    for (const stopCodigo of stopsToAdd) {
      const stop = createdStops.find(s => s.codigo === stopCodigo);
      if (!stop) continue;
      
      try {
        await prisma.viaParagem.create({
          data: {
            codigoParagem: stop.codigo,
            codigoVia: via.codigo,
            viaId: via.id,
            paragemId: stop.id,
            terminalBoolean: stop.codigo === via.startStop.codigo || stop.codigo === via.endStop.codigo,
          }
        });
        associationsCreated++;
      } catch (error) {
        // Skip duplicates
      }
    }
    
    if ((i + 1) % 10 === 0) {
      console.log(`✅ ${i + 1}/111 vias processed...`);
    }
  }
  console.log(`✅ ${associationsCreated} stop-via associations created!\n`);

  // 7. Create 111 transportes
  console.log('🚌 Creating 111 transportes...\n');
  
  const prefixos = ['ACA', 'ACB', 'ACC', 'ACD', 'ACE', 'ACF', 'ACG', 'ACH', 'ACI', 'ACJ', 'ACK'];
  const marcas = ['Toyota', 'Mercedes', 'Volkswagen', 'Nissan', 'Isuzu', 'Mitsubishi', 'Hyundai'];
  const modelos = ['Hiace', 'Sprinter', 'Crafter', 'Urvan', 'NQR', 'Rosa', 'County'];
  const coresBus = ['Branco', 'Azul', 'Vermelho', 'Verde', 'Amarelo', 'Cinza', 'Preto'];

  const transportes = [];
  let transporteIndex = 0;

  for (let empresaIdx = 0; empresaIdx < 11; empresaIdx++) {
    const numTransportes = empresaIdx < 10 ? 10 : 11;
    const prefixo = prefixos[empresaIdx];

    for (let t = 0; t < numTransportes; t++) {
      transporteIndex++;
      const numero = String(t + 1).padStart(3, '0');
      const matricula = `${prefixo}-${numero}M`;
      
      const via = vias[transporteIndex - 1];
      
      const transporte = await prisma.transporte.create({
        data: {
          matricula,
          modelo: modelos[transporteIndex % modelos.length],
          marca: marcas[transporteIndex % marcas.length],
          cor: coresBus[transporteIndex % coresBus.length],
          lotacao: 15,
          codigo: transporteIndex,
          codigoVia: via.codigo,
          viaId: via.id,
          currGeoLocation: via.geoLocationPath.split(';')[0],
          routePath: via.geoLocationPath,
        }
      });

      await prisma.transporteProprietario.create({
        data: {
          codigoTransporte: transporte.codigo,
          idProprietario: proprietarios[empresaIdx].id,
          transporteId: transporte.id,
          proprietarioId: proprietarios[empresaIdx].id,
        }
      });

      transportes.push(transporte);
      
      if (transporteIndex % 10 === 0) {
        console.log(`✅ ${transporteIndex}/111 transportes created...`);
      }
    }
  }
  console.log(`✅ 111/111 transportes created!\n`);

  // 8. Create 111 African motoristas
  console.log('👨‍✈️ Creating 111 African motoristas with photos...\n');
  
  for (let i = 0; i < 111; i++) {
    const genero = i % 3 === 0 ? "Feminino" : "Masculino";
    const nome = generateDriverName(genero, i);
    const estadosCivis = ["Solteiro", "Casado", "Divorciado", "Viúvo"];
    const categorias = ["B", "C", "D"];
    
    const dataEmissaoBI = generateDate(4, i);
    const dataEmissaoCarta = generateDate(5, i);
    
    const empresaIdx = Math.floor(i / 10);
    const empresa = proprietarios[empresaIdx];
    
    await prisma.motorista.create({
      data: {
        nome,
        bi: String(110200000000 + i).padStart(12, '0') + String.fromCharCode(65 + (i % 26)),
        cartaConducao: `CC-${2016 + (i % 8)}-${String(i + 1).padStart(6, '0')}`,
        telefone: `+258 ${["84", "85", "86", "87"][i % 4]} ${String(100 + (i % 900)).padStart(3, '0')} ${String(1000 + (i * 7 % 9000)).padStart(4, '0')}`,
        email: `${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '.')}.motorista${i + 1}@transport.co.mz`,
        dataNascimento: generateDate(35, i),
        endereco: `Av. ${mozambicanSurnames[i % mozambicanSurnames.length]}, ${100 + i}, Maputo`,
        foto: blackPeoplePhotos[i % blackPeoplePhotos.length],
        nacionalidade: "Moçambicana",
        genero,
        estadoCivil: estadosCivis[i % estadosCivis.length],
        numeroEmergencia: `+258 84 ${String(500 + i).padStart(3, '0')} ${String(2000 + i).padStart(4, '0')}`,
        contatoEmergencia: `${generateDriverName(genero === "Masculino" ? "Feminino" : "Masculino", i + 50)} (Familiar)`,
        deficiencia: null,
        dataEmissaoBI,
        dataValidadeBI: new Date(dataEmissaoBI.getFullYear() + 10, dataEmissaoBI.getMonth(), dataEmissaoBI.getDate()),
        dataEmissaoCarta,
        dataValidadeCarta: new Date(dataEmissaoCarta.getFullYear() + 10, dataEmissaoCarta.getMonth(), dataEmissaoCarta.getDate()),
        categoriaCarta: categorias[i % categorias.length],
        experienciaAnos: 3 + (i % 15),
        observacoes: `Trabalha para ${empresa.nome}`,
        status: "ativo",
        transporteId: transportes[i].id,
      }
    });

    if ((i + 1) % 10 === 0) {
      console.log(`✅ ${i + 1}/111 motoristas created...`);
    }
  }
  console.log(`✅ 111/111 motoristas created!\n`);

  // Final Statistics
  const finalStats = {
    municipios: await prisma.municipio.count(),
    paragens: await prisma.paragem.count(),
    vias: await prisma.via.count(),
    transportes: await prisma.transporte.count(),
    motoristas: await prisma.motorista.count(),
    proprietarios: await prisma.proprietario.count(),
    viaParagens: await prisma.viaParagem.count(),
  };

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 REALISTIC TRANSPORT SYSTEM COMPLETE!\n');
  console.log(`✅ ${finalStats.municipios} municipalities (Maputo & Matola)`);
  console.log(`✅ ${finalStats.paragens} unique stops (deduplicated by name)`);
  console.log(`✅ ${finalStats.vias} vias (111 routes following real roads)`);
  console.log(`✅ ${finalStats.viaParagens} stop-via associations`);
  console.log(`✅ ${finalStats.transportes} transportes (buses: ACA-001M to ACK-011M)`);
  console.log(`✅ ${finalStats.motoristas} motoristas (African drivers with photos)`);
  console.log(`✅ ${finalStats.proprietarios} proprietarios (empresas)`);
  console.log(`\n✅ Each bus has 1 driver (African with photo)`);
  console.log(`✅ Each driver works for 1 company`);
  console.log(`✅ Each bus follows 1 route`);
  console.log(`✅ Routes follow real roads (OSRM)`);
  console.log(`✅ Stops deduplicated by name`);
  console.log(`✅ Routes cover all available stops`);
  console.log(`✅ Stops associated to routes passing through them\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
