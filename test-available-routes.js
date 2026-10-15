require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAvailableRoutes() {
  console.log('🔍 Testing available routes API logic...\n');

  try {
    // Test 1: Get all municipios with buses
    console.log('📍 Test 1: Municipios with buses');
    const municipiosWithBuses = await prisma.municipio.findMany({
      where: {
        vias: {
          some: {
            transportes: {
              some: {}
            }
          }
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        _count: {
          select: {
            vias: true
          }
        }
      }
    });

    console.log(`✅ Found ${municipiosWithBuses.length} municipios with buses:`);
    municipiosWithBuses.forEach(m => {
      console.log(`   - ${m.nome} (${m.codigo}): ${m._count.vias} vias`);
    });

    if (municipiosWithBuses.length === 0) {
      console.log('\n❌ NO MUNICIPIOS FOUND! This is the problem.');
      console.log('   Checking if transportes exist...\n');
      
      const totalTransportes = await prisma.transporte.count();
      console.log(`   Total transportes in DB: ${totalTransportes}`);
      
      const totalVias = await prisma.via.count();
      console.log(`   Total vias in DB: ${totalVias}`);
      
      // Check if transportes have viaId
      const transportesWithVia = await prisma.transporte.findMany({
        take: 5,
        select: {
          id: true,
          matricula: true,
          viaId: true,
          codigoVia: true
        }
      });
      
      console.log('\n   Sample transportes:');
      transportesWithVia.forEach(t => {
        console.log(`   - ${t.matricula}: viaId=${t.viaId}, codigoVia=${t.codigoVia}`);
      });
      
      return;
    }

    // Test 2: Get vias for first municipio
    const firstMunicipio = municipiosWithBuses[0];
    console.log(`\n📍 Test 2: Vias for ${firstMunicipio.nome}`);
    
    const viasWithBuses = await prisma.via.findMany({
      where: {
        municipioId: firstMunicipio.id,
        transportes: {
          some: {}
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        terminalPartida: true,
        terminalChegada: true,
        _count: {
          select: {
            transportes: true
          }
        }
      }
    });

    console.log(`✅ Found ${viasWithBuses.length} vias with buses:`);
    viasWithBuses.slice(0, 5).forEach(v => {
      console.log(`   - ${v.nome}: ${v._count.transportes} buses`);
      console.log(`     ${v.terminalPartida} → ${v.terminalChegada}`);
    });

    // Test 3: Group by unique routes
    console.log(`\n📍 Test 3: Unique routes`);
    const uniqueRoutes = viasWithBuses.reduce((acc, via) => {
      const routeKey = `${via.terminalPartida} → ${via.terminalChegada}`;
      if (!acc[routeKey]) {
        acc[routeKey] = [];
      }
      acc[routeKey].push(via.codigo);
      return acc;
    }, {});

    console.log(`✅ Found ${Object.keys(uniqueRoutes).length} unique routes:`);
    Object.entries(uniqueRoutes).slice(0, 5).forEach(([route, vias]) => {
      console.log(`   - ${route}: ${vias.length} via(s)`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAvailableRoutes();
