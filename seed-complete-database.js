const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    // 1. Add missing stops for neighborhoods that don't have them
    console.log('📍 Adding missing stops...');
    
    const newStops = [
      // Polana area
      { nome: 'Polana Cimento', codigo: 'POL-001', geoLocation: '-25.9650,32.5850' },
      { nome: 'Polana Shopping', codigo: 'POL-002', geoLocation: '-25.9680,32.5880' },
      
      // T3 area
      { nome: 'T3 (Terminal)', codigo: 'T3-001', geoLocation: '-25.9083,32.5222' },
      { nome: 'T3 Mercado', codigo: 'T3-002', geoLocation: '-25.9090,32.5230' },
      
      // Magoanine
      { nome: 'Magoanine A', codigo: 'MAG-001', geoLocation: '-25.8752,32.6105' },
      { nome: 'Magoanine B', codigo: 'MAG-002', geoLocation: '-25.8780,32.6120' },
      
      // Fomento
      { nome: 'Fomento (Paragem)', codigo: 'FOM-001', geoLocation: '-25.9100,32.4700' },
      
      // More stops for better coverage
      { nome: 'Sommerschield', codigo: 'SOM-001', geoLocation: '-25.9600,32.5900' },
      { nome: 'Maxaquene', codigo: 'MAX-001', geoLocation: '-25.9400,32.5700' },
      { nome: 'Aeroporto', codigo: 'AER-001', geoLocation: '-25.9200,32.5700' },
    ];
    
    for (const stop of newStops) {
      try {
        await prisma.paragem.upsert({
          where: { codigo: stop.codigo },
          update: {},
          create: stop
        });
        console.log(`  ✅ Added: ${stop.nome}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped ${stop.nome}: ${error.message}`);
      }
    }
    
    // 2. Add more routes to connect all neighborhoods
    console.log('\n🛣️  Adding missing routes...');
    
    const newRoutes = [
      // Polana routes
      { nome: 'Rota Polana-Baixa', codigo: 'VIA-POL-BAI', terminalPartida: 'Polana Cimento', terminalChegada: 'Praça dos Trabalhadores', cor: '#FF6B6B', geoLocationPath: '32.5850,-25.9650;32.5694,-25.9734' },
      { nome: 'Rota Polana-Matola', codigo: 'VIA-POL-MAT', terminalPartida: 'Polana Shopping', terminalChegada: 'Terminal Matola Sede', cor: '#4ECDC4', geoLocationPath: '32.5880,-25.9680;32.4589,-25.9794' },
      
      // T3 routes
      { nome: 'Rota T3-Baixa', codigo: 'VIA-T3-BAI', terminalPartida: 'T3 (Terminal)', terminalChegada: 'Praça dos Trabalhadores', cor: '#95E1D3', geoLocationPath: '32.5222,-25.9083;32.5694,-25.9734' },
      { nome: 'Rota T3-Museu', codigo: 'VIA-T3-MUS', terminalPartida: 'T3 Mercado', terminalChegada: 'Terminal Museu', cor: '#F38181', geoLocationPath: '32.5230,-25.9090;32.5836,-25.9723' },
      
      // Magoanine routes
      { nome: 'Rota Magoanine-Baixa', codigo: 'VIA-MAG-BAI', terminalPartida: 'Magoanine A', terminalChegada: 'Praça dos Trabalhadores', cor: '#AA96DA', geoLocationPath: '32.6105,-25.8752;32.5694,-25.9734' },
      { nome: 'Rota Magoanine-Zimpeto', codigo: 'VIA-MAG-ZIM', terminalPartida: 'Magoanine B', terminalChegada: 'Terminal Zimpeto', cor: '#FCBAD3', geoLocationPath: '32.6120,-25.8780;32.6186,-25.8643' },
      
      // Fomento routes
      { nome: 'Rota Fomento-Baixa', codigo: 'VIA-FOM-BAI', terminalPartida: 'Fomento (Paragem)', terminalChegada: 'Praça dos Trabalhadores', cor: '#FFFFD2', geoLocationPath: '32.4700,-25.9100;32.5694,-25.9734' },
      
      // Additional coverage routes
      { nome: 'Rota Sommerschield-Baixa', codigo: 'VIA-SOM-BAI', terminalPartida: 'Sommerschield', terminalChegada: 'Praça dos Trabalhadores', cor: '#A8D8EA', geoLocationPath: '32.5900,-25.9600;32.5694,-25.9734' },
      { nome: 'Rota Maxaquene-Baixa', codigo: 'VIA-MAX-BAI', terminalPartida: 'Maxaquene', terminalChegada: 'Praça dos Trabalhadores', cor: '#FFAAA7', geoLocationPath: '32.5700,-25.9400;32.5694,-25.9734' },
      { nome: 'Rota Aeroporto-Baixa', codigo: 'VIA-AER-BAI', terminalPartida: 'Aeroporto', terminalChegada: 'Praça dos Trabalhadores', cor: '#FF8C94', geoLocationPath: '32.5700,-25.9200;32.5694,-25.9734' },
    ];
    
    // Get or create municipality
    let municipio = await prisma.municipio.findFirst();
    if (!municipio) {
      municipio = await prisma.municipio.create({
        data: {
          nome: 'Maputo',
          codigo: 'MUN-MPT',
          endereco: 'Maputo, Moçambique'
        }
      });
    }
    
    for (const route of newRoutes) {
      try {
        await prisma.via.upsert({
          where: { codigo: route.codigo },
          update: {},
          create: {
            ...route,
            codigoMunicipio: municipio.codigo,
            municipioId: municipio.id
          }
        });
        console.log(`  ✅ Added: ${route.nome}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped ${route.nome}: ${error.message}`);
      }
    }
    
    // 3. Add buses for each route
    console.log('\n🚌 Adding buses...');
    
    const routes = await prisma.via.findMany();
    let busCode = 1000;
    
    for (const route of routes) {
      // Add 2-3 buses per route
      const busCount = Math.floor(Math.random() * 2) + 2; // 2 or 3 buses
      
      for (let i = 0; i < busCount; i++) {
        busCode++;
        const brands = ['Toyota', 'Mercedes', 'Iveco', 'Yutong', 'Hino'];
        const models = ['Hiace', 'Sprinter', 'Daily', 'ZK6107', 'RK8'];
        const brand = brands[Math.floor(Math.random() * brands.length)];
        const model = models[Math.floor(Math.random() * models.length)];
        
        try {
          await prisma.transporte.create({
            data: {
              matricula: `AAA-${busCode}${String.fromCharCode(65 + i)}`,
              modelo: model,
              marca: brand,
              cor: route.cor,
              lotacao: Math.floor(Math.random() * 20) + 30, // 30-50 seats
              codigo: busCode,
              codigoVia: route.codigo,
              viaId: route.id,
              currGeoLocation: route.geoLocationPath.split(';')[0], // Start at first point
              routePath: route.geoLocationPath
            }
          });
          console.log(`  ✅ Added bus ${busCode} to ${route.nome}`);
        } catch (error) {
          console.log(`  ⚠️  Skipped bus ${busCode}: ${error.message}`);
        }
      }
    }
    
    // 4. Add drivers
    console.log('\n👨‍✈️ Adding drivers...');
    
    const driverNames = [
      'João Silva', 'Maria Santos', 'Pedro Machado', 'Ana Costa',
      'Carlos Fernandes', 'Isabel Rodrigues', 'Manuel Pereira', 'Teresa Alves',
      'António Sousa', 'Luísa Martins', 'José Carvalho', 'Beatriz Lopes',
      'Francisco Gomes', 'Catarina Ribeiro', 'Paulo Ferreira', 'Sofia Dias'
    ];
    
    for (let i = 0; i < driverNames.length; i++) {
      try {
        await prisma.condutor.create({
          data: {
            nome: driverNames[i],
            telefone: `+258 84 ${String(1000000 + i).padStart(7, '0')}`,
            bi: `${String(100000000 + i).padStart(9, '0')}`,
            nacionalidade: 'Moçambicana',
            birthDate: new Date(1970 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            endereco: 'Maputo, Moçambique'
          }
        });
        console.log(`  ✅ Added driver: ${driverNames[i]}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped ${driverNames[i]}: ${error.message}`);
      }
    }
    
    // 5. Assign drivers to buses (motorista relation)
    console.log('\n🔗 Assigning drivers to buses...');
    
    const buses = await prisma.transporte.findMany();
    const drivers = await prisma.condutor.findMany();
    
    for (let i = 0; i < buses.length && i < drivers.length; i++) {
      try {
        await prisma.transporte.update({
          where: { id: buses[i].id },
          data: {
            motorista: {
              connect: { id: drivers[i % drivers.length].id }
            }
          }
        });
        console.log(`  ✅ Assigned ${drivers[i % drivers.length].nome} to bus ${buses[i].matricula}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped assignment: ${error.message}`);
      }
    }
    
    // 6. Add initial geo locations for buses
    console.log('\n📍 Adding initial geo locations for buses...');
    
    for (const bus of buses) {
      if (bus.currGeoLocation) {
        try {
          await prisma.geoLocation.create({
            data: {
              geoLocation: bus.currGeoLocation,
              transporteId: bus.id
            }
          });
          console.log(`  ✅ Added geo location for bus ${bus.matricula}`);
        } catch (error) {
          console.log(`  ⚠️  Skipped geo location: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Database seeding completed!');
    
    // Print summary
    const stopCount = await prisma.paragem.count();
    const routeCount = await prisma.via.count();
    const busCount = await prisma.transporte.count();
    const driverCount = await prisma.condutor.count();
    const geoCount = await prisma.geoLocation.count();
    
    console.log('\n📊 FINAL DATABASE SUMMARY:');
    console.log(`  Stops: ${stopCount}`);
    console.log(`  Routes: ${routeCount}`);
    console.log(`  Buses: ${busCount}`);
    console.log(`  Drivers: ${driverCount}`);
    console.log(`  Geo Locations: ${geoCount}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase();
