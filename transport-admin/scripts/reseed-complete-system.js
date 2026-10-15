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
    const name = parts[3] ? parts[3].trim() : `Stop ${osmId}`;
    
    if (isNaN(lat) || isNaN(lon) || !name || name === '') continue;
    
    stops.push({ osmId, lat, lon, name });
  }
  
  return stops;
}

async function main() {
  console.log('🔄 RESEEDING COMPLETE SYSTEM\n');
  console.log('='.repeat(80));

  // 1. Clear existing data (keep proprietarios)
  console.log('\n🗑️  Clearing existing data (keeping proprietarios)...\n');
  
  await prisma.motorista.deleteMany({});
  console.log('✅ Motoristas cleared');
  
  await prisma.viaParagem.deleteMany({});
  console.log('✅ Via-Paragem relations cleared');
  
  await prisma.transporteProprietario.deleteMany({});
  console.log('✅ Transporte-Proprietario relations cleared');
  
  await prisma.transporte.deleteMany({});
  console.log('✅ Transportes cleared');
  
  await prisma.paragem.deleteMany({});
  console.log('✅ Paragens cleared');
  
  await prisma.via.deleteMany({});
  console.log('✅ Vias cleared');

  // 2. Create/Get Municipalities
  console.log('\n🏛️  Creating municipalities...\n');
  
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
  console.log('✅ Maputo municipality');

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
  console.log('✅ Matola municipality');

  // 3. Import Paragens (1348 stops)
  console.log('\n🚏 Importing paragens from data files...\n');
  
  let maputoData = '';
  let matolaData = '';
  
  try {
    maputoData = fs.readFileSync(path.join(process.cwd(), '..', 'maputo-stops-data.json'), 'utf-8');
    console.log('✅ Loaded Maputo stops data');
  } catch (error) {
    console.log('⚠️  Could not load maputo-stops-data.json');
  }
  
  try {
    matolaData = fs.readFileSync(path.join(process.cwd(), '..', 'matola-stops-data.json'), 'utf-8');
    console.log('✅ Loaded Matola stops data');
  } catch (error) {
    console.log('⚠️  Could not load matola-stops-data.json');
  }

  const maputoStops = parseOSMData(maputoData);
  const matolaStops = parseOSMData(matolaData);
  
  console.log(`\n📊 Parsed ${maputoStops.length} Maputo stops`);
  console.log(`📊 Parsed ${matolaStops.length} Matola stops`);
  
  const allStops = [...maputoStops, ...matolaStops];
  console.log(`📊 Total stops to import: ${allStops.length}\n`);

  let paragensCreated = 0;
  for (const stop of allStops) {
    try {
      await prisma.paragem.create({
        data: {
          nome: stop.name,
          codigo: `PAR-${stop.osmId}`,
          geoLocation: `${stop.lat},${stop.lon}`,
        }
      });
      paragensCreated++;
      if (paragensCreated % 100 === 0) {
        console.log(`✅ ${paragensCreated}/${allStops.length} paragens imported...`);
      }
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log(`✅ ${paragensCreated} paragens imported!`);

  // 4. Create 221 Vias
  console.log('\n🛣️  Creating 221 vias...\n');
  
  const cores = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557',
    '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#264653'
  ];

  const vias = [];
  for (let i = 1; i <= 221; i++) {
    const municipio = i % 2 === 0 ? municipioMaputo : municipioMatola;
    const via = await prisma.via.create({
      data: {
        nome: `Via ${i}`,
        codigo: `V${String(i).padStart(3, '0')}`,
        cor: cores[i % cores.length],
        terminalPartida: `Terminal ${i}A`,
        terminalChegada: `Terminal ${i}B`,
        geoLocationPath: `32.${5800 + (i * 10)},-25.${9600 + (i * 5)};32.${5900 + (i * 10)},-25.${9700 + (i * 5)}`,
        codigoMunicipio: municipio.codigo,
        municipioId: municipio.id,
      }
    });
    vias.push(via);
    
    if (i % 20 === 0) {
      console.log(`✅ ${i}/221 vias created...`);
    }
  }
  console.log(`✅ 221/221 vias created!`);

  // 5. Get Proprietarios (should already exist - 11 empresas)
  const proprietarios = await prisma.proprietario.findMany();
  console.log(`\n✅ Found ${proprietarios.length} proprietarios (empresas)`);

  if (proprietarios.length === 0) {
    console.error('❌ No proprietarios found! Please run the empresas creation script first.');
    process.exit(1);
  }

  // 6. Create 111 Transportes
  console.log('\n🚌 Creating 111 transportes...\n');
  
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
      
      // Assign to one of the first 111 vias
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
          currGeoLocation: '32.5892,-25.9655',
        }
      });

      // Link to proprietario
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
  console.log(`✅ 111/111 transportes created!`);

  // 7. Create 111 Motoristas
  console.log('\n👨‍✈️ Creating 111 motoristas...\n');
  
  const nomesMasculinos = [
    "João", "Pedro", "Carlos", "António", "Manuel", "Fernando", "Ricardo", "Paulo",
    "José", "Francisco", "Armando", "Alberto", "Domingos", "Joaquim", "Sebastião",
    "Tomás", "Miguel", "Rafael", "Daniel", "Gabriel", "Lucas", "Mateus", "André",
    "Bruno", "David", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "Jorge",
    "Leonardo", "Marcos", "Nelson", "Oscar", "Rui", "Samuel", "Tiago", "Vicente"
  ];

  const nomesFemininos = [
    "Maria", "Ana", "Isabel", "Rosa", "Beatriz", "Sofia", "Catarina", "Teresa",
    "Paula", "Carla", "Sandra", "Cristina", "Fernanda", "Helena", "Inês",
    "Joana", "Laura", "Mariana", "Patrícia", "Rita", "Sara", "Vera", "Alice",
    "Bárbara", "Diana", "Eduarda", "Fátima", "Graça", "Júlia", "Lúcia", "Marta",
    "Natália", "Olga", "Raquel", "Sílvia", "Tatiana", "Vitória", "Zélia"
  ];

  const apelidos = [
    "Silva", "Santos", "Costa", "Macamo", "Nhaca", "Sitoe", "Cossa", "Mondlane",
    "Chissano", "Guebuzza", "Machel", "Tembe", "Mabunda", "Chapo", "Nhamitambo",
    "Mahumane", "Bila", "Matlombe", "Massinga", "Nkomo", "Zandamela", "Maluleque",
    "Chicuamba", "Maposse", "Nhabinde", "Cumbe", "Muthisse", "Zavale", "Matusse",
    "Chongo", "Mabote", "Ngovene", "Macie", "Langa", "Mussagy", "Nkavele"
  ];

  function gerarNomeCompleto(genero, index) {
    const primeiroNome = genero === "Masculino" 
      ? nomesMasculinos[index % nomesMasculinos.length]
      : nomesFemininos[index % nomesFemininos.length];
    
    const segundoNome = genero === "Masculino"
      ? nomesMasculinos[(index + 7) % nomesMasculinos.length]
      : nomesFemininos[(index + 7) % nomesFemininos.length];
    
    const apelido = apelidos[index % apelidos.length];
    
    return `${primeiroNome} ${segundoNome} ${apelido}`;
  }

  function gerarData(anosAtras, variacao = 0) {
    const hoje = new Date();
    const ano = hoje.getFullYear() - anosAtras + (variacao % 3);
    const mes = Math.floor(Math.random() * 12);
    const dia = Math.floor(Math.random() * 28) + 1;
    return new Date(ano, mes, dia);
  }

  for (let i = 0; i < 111; i++) {
    const genero = i % 3 === 0 ? "Feminino" : "Masculino";
    const nome = gerarNomeCompleto(genero, i);
    const estadosCivis = ["Solteiro", "Casado", "Divorciado", "Viúvo"];
    const categorias = ["B", "C", "D"];
    
    const dataEmissaoBI = gerarData(4, i);
    const dataEmissaoCarta = gerarData(5, i);
    
    await prisma.motorista.create({
      data: {
        nome,
        bi: String(110200000000 + i).padStart(12, '0') + String.fromCharCode(65 + (i % 26)),
        cartaConducao: `CC-${2016 + (i % 8)}-${String(i + 1).padStart(6, '0')}`,
        telefone: `+258 ${["84", "85", "86", "87"][i % 4]} ${String(100 + (i % 900)).padStart(3, '0')} ${String(1000 + (i * 7 % 9000)).padStart(4, '0')}`,
        email: `${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ')[0]}.motorista${i + 1}@transport.co.mz`,
        dataNascimento: gerarData(35, i),
        endereco: `Av. ${apelidos[i % apelidos.length]}, ${100 + i}, Maputo`,
        foto: `https://images.pexels.com/photos/${3000000 + (i * 1000)}/pexels-photo-${3000000 + (i * 1000)}.jpeg`,
        nacionalidade: "Moçambicana",
        genero,
        estadoCivil: estadosCivis[i % estadosCivis.length],
        numeroEmergencia: `+258 84 ${String(500 + i).padStart(3, '0')} ${String(2000 + i).padStart(4, '0')}`,
        contatoEmergencia: `${gerarNomeCompleto(genero === "Masculino" ? "Feminino" : "Masculino", i + 50)} (${genero === "Masculino" ? "Esposa" : "Marido"})`,
        deficiencia: null,
        dataEmissaoBI,
        dataValidadeBI: new Date(dataEmissaoBI.getFullYear() + 10, dataEmissaoBI.getMonth(), dataEmissaoBI.getDate()),
        dataEmissaoCarta,
        dataValidadeCarta: new Date(dataEmissaoCarta.getFullYear() + 10, dataEmissaoCarta.getMonth(), dataEmissaoCarta.getDate()),
        categoriaCarta: categorias[i % categorias.length],
        experienciaAnos: 3 + (i % 15),
        observacoes: i % 5 === 0 ? "Motorista experiente e pontual." : null,
        status: "ativo",
        transporteId: transportes[i].id,
      }
    });

    if ((i + 1) % 10 === 0) {
      console.log(`✅ ${i + 1}/111 motoristas created...`);
    }
  }
  console.log(`✅ 111/111 motoristas created!`);

  // Final Statistics
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SYSTEM RESEEDED SUCCESSFULLY!\n');
  console.log(`✅ 2 municipalities (Maputo & Matola)`);
  console.log(`✅ ${paragensCreated} paragens (bus stops)`);
  console.log(`✅ 221 vias (routes)`);
  console.log(`✅ 111 transportes (buses with matriculas ACA-001M to ACK-011M)`);
  console.log(`✅ 111 motoristas (drivers with complete data)`);
  console.log(`✅ ${proprietarios.length} proprietarios (empresas)`);
  console.log(`✅ Each empresa has ~10 transportes`);
  console.log(`✅ Each transporte has 1 motorista`);
  console.log(`✅ Each motorista has a photo\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
