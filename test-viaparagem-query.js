require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testViaParagem() {
  try {
    console.log('🧪 Testing ViaParagem queries...\n');

    // Test 1: Find routes passing through "Matola Sede"
    console.log('TEST 1: Find routes passing through "Matola Sede"');
    console.log('─'.repeat(80));
    
    const routesThroughMatolaSede = await prisma.via.findMany({
      where: {
        paragens: {
          some: {
            paragem: {
              nome: { contains: 'Matola Sede', mode: 'insensitive' }
            }
          }
        }
      },
      select: {
        codigo: true,
        nome: true,
        terminalPartida: true,
        terminalChegada: true,
        _count: {
          select: {
            paragens: true
          }
        }
      }
    });

    console.log(`Found ${routesThroughMatolaSede.length} routes:\n`);
    routesThroughMatolaSede.forEach(route => {
      console.log(`  ${route.codigo} - ${route.nome}`);
      console.log(`    ${route.terminalPartida} → ${route.terminalChegada}`);
      console.log(`    ${route._count.paragens} stops on this route\n`);
    });

    // Test 2: Find stops on route VIA-MAT-BAI
    console.log('\nTEST 2: Find stops on route VIA-MAT-BAI');
    console.log('─'.repeat(80));
    
    const stopsOnRoute = await prisma.viaParagem.findMany({
      where: {
        via: {
          codigo: 'VIA-MAT-BAI'
        }
      },
      include: {
        paragem: {
          select: {
            nome: true,
            geoLocation: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`Found ${stopsOnRoute.length} stops on VIA-MAT-BAI:\n`);
    stopsOnRoute.forEach((vp, index) => {
      console.log(`  ${index + 1}. ${vp.paragem.nome} ${vp.terminalBoolean ? '(Terminal)' : ''}`);
    });

    // Test 3: Check if specific stop is on specific route
    console.log('\n\nTEST 3: Check if "Godinho" is on route VIA-MAT-BAI');
    console.log('─'.repeat(80));
    
    const godinhoStop = await prisma.paragem.findFirst({
      where: {
        nome: { contains: 'Godinho', mode: 'insensitive' }
      }
    });

    const matolaBaixaRoute = await prisma.via.findFirst({
      where: {
        codigo: 'VIA-MAT-BAI'
      }
    });

    if (godinhoStop && matolaBaixaRoute) {
      const viaParagem = await prisma.viaParagem.findFirst({
        where: {
          viaId: matolaBaixaRoute.id,
          paragemId: godinhoStop.id
        }
      });

      if (viaParagem) {
        console.log(`✅ YES - "Godinho" IS on route VIA-MAT-BAI`);
        console.log(`   Terminal: ${viaParagem.terminalBoolean ? 'Yes' : 'No'}`);
      } else {
        console.log(`❌ NO - "Godinho" is NOT on route VIA-MAT-BAI`);
      }
    } else {
      console.log('⚠️  Could not find stop or route');
    }

    // Test 4: Find alternative routes for a stop
    console.log('\n\nTEST 4: Find all routes passing through "Portagem"');
    console.log('─'.repeat(80));
    
    const routesThroughPortagem = await prisma.via.findMany({
      where: {
        paragens: {
          some: {
            paragem: {
              nome: { contains: 'Portagem', mode: 'insensitive' }
            }
          }
        }
      },
      select: {
        codigo: true,
        nome: true
      }
    });

    console.log(`Found ${routesThroughPortagem.length} routes passing through "Portagem":\n`);
    routesThroughPortagem.forEach(route => {
      console.log(`  - ${route.codigo}: ${route.nome}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testViaParagem();
