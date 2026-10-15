const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Test script to check if all vias have valid transport routes
 * This simulates what happens when users search for transports
 */

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

async function testAllVias() {
  console.log('\n🔍 TESTING ALL VIAS FOR TRANSPORT AVAILABILITY\n');
  console.log('='.repeat(80));

  try {
    // Get all vias with their transportes and paragens
    const allVias = await prisma.via.findMany({
      include: {
        municipio: {
          select: {
            nome: true
          }
        },
        transportes: {
          select: {
            id: true,
            matricula: true,
            currGeoLocation: true
          }
        },
        paragens: {
          include: {
            paragem: true
          },
          orderBy: {
            id: 'asc'
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    console.log(`\n📊 Total vias to test: ${allVias.length}\n`);

    let viasWithIssues = [];
    let viasWithoutTransportes = [];
    let viasWithWrongDirection = [];
    let viasOK = [];

    for (const via of allVias) {
      const viaName = `${via.terminalPartida} → ${via.terminalChegada}`;
      const municipioName = via.municipio.nome;
      
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📍 Via: ${viaName}`);
      console.log(`   Município: ${municipioName}`);
      console.log(`   Código: ${via.codigo}`);
      console.log(`   Paragens: ${via.paragens.length}`);
      console.log(`   Transportes: ${via.transportes.length}`);

      // Check 1: Does via have transportes?
      if (via.transportes.length === 0) {
        console.log(`   ❌ NO TRANSPORTES - Will show "Nenhum transporte disponível"`);
        viasWithoutTransportes.push({
          via: viaName,
          municipio: municipioName,
          codigo: via.codigo,
          issue: 'No transportes assigned'
        });
        continue;
      }

      // Check 2: Does via have at least 2 paragens (origem + destino)?
      if (via.paragens.length < 2) {
        console.log(`   ⚠️  WARNING: Only ${via.paragens.length} paragem(s) - Cannot create valid routes`);
        viasWithIssues.push({
          via: viaName,
          municipio: municipioName,
          codigo: via.codigo,
          issue: `Only ${via.paragens.length} paragem(s)`
        });
        continue;
      }

      // Check 3: Test all possible origem-destino combinations
      let validCombinations = 0;
      let invalidCombinations = 0;
      const testResults = [];

      for (let i = 0; i < via.paragens.length - 1; i++) {
        for (let j = i + 1; j < via.paragens.length; j++) {
          const origem = via.paragens[i].paragem;
          const destino = via.paragens[j].paragem;

          // Simulate the bus search logic
          const transporte = via.transportes[0]; // Test with first transporte
          
          // Find origem and destino indices
          const origemIndex = via.paragens.findIndex(vp => vp.paragem.id === origem.id);
          const destinoIndex = via.paragens.findIndex(vp => vp.paragem.id === destino.id);

          // Check if origem comes before destino (correct direction)
          if (origemIndex < destinoIndex) {
            validCombinations++;
          } else {
            invalidCombinations++;
            testResults.push({
              origem: origem.nome,
              destino: destino.nome,
              issue: 'Wrong direction (destino before origem)'
            });
          }
        }
      }

      const totalCombinations = validCombinations + invalidCombinations;
      console.log(`   ✅ Valid combinations: ${validCombinations}/${totalCombinations}`);

      if (validCombinations === 0) {
        console.log(`   ❌ NO VALID ROUTES - All combinations are wrong direction!`);
        viasWithWrongDirection.push({
          via: viaName,
          municipio: municipioName,
          codigo: via.codigo,
          issue: 'All origem-destino combinations are wrong direction',
          details: testResults
        });
      } else if (invalidCombinations > 0) {
        console.log(`   ⚠️  Some combinations won't work (${invalidCombinations} invalid)`);
      } else {
        console.log(`   ✅ ALL COMBINATIONS VALID`);
        viasOK.push({
          via: viaName,
          municipio: municipioName,
          codigo: via.codigo,
          paragens: via.paragens.length,
          transportes: via.transportes.length,
          validCombinations: validCombinations
        });
      }
    }

    // Print summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY REPORT');
    console.log('='.repeat(80));

    console.log(`\n✅ Vias OK: ${viasOK.length}`);
    console.log(`❌ Vias without transportes: ${viasWithoutTransportes.length}`);
    console.log(`❌ Vias with wrong direction: ${viasWithWrongDirection.length}`);
    console.log(`⚠️  Vias with other issues: ${viasWithIssues.length}`);
    console.log(`📊 Total vias: ${allVias.length}`);

    // Detailed issues
    if (viasWithoutTransportes.length > 0) {
      console.log('\n\n❌ VIAS WITHOUT TRANSPORTES (Will show "Nenhum transporte disponível"):');
      console.log('─'.repeat(80));
      viasWithoutTransportes.forEach((item, index) => {
        console.log(`${index + 1}. ${item.via} (${item.municipio})`);
        console.log(`   Código: ${item.codigo}`);
        console.log(`   Issue: ${item.issue}\n`);
      });
    }

    if (viasWithWrongDirection.length > 0) {
      console.log('\n\n❌ VIAS WITH WRONG DIRECTION (Will show "Nenhum transporte disponível"):');
      console.log('─'.repeat(80));
      viasWithWrongDirection.forEach((item, index) => {
        console.log(`${index + 1}. ${item.via} (${item.municipio})`);
        console.log(`   Código: ${item.codigo}`);
        console.log(`   Issue: ${item.issue}\n`);
      });
    }

    if (viasWithIssues.length > 0) {
      console.log('\n\n⚠️  VIAS WITH OTHER ISSUES:');
      console.log('─'.repeat(80));
      viasWithIssues.forEach((item, index) => {
        console.log(`${index + 1}. ${item.via} (${item.municipio})`);
        console.log(`   Código: ${item.codigo}`);
        console.log(`   Issue: ${item.issue}\n`);
      });
    }

    // Calculate percentage
    const problemVias = viasWithoutTransportes.length + viasWithWrongDirection.length + viasWithIssues.length;
    const successRate = ((viasOK.length / allVias.length) * 100).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('📈 SUCCESS RATE');
    console.log('='.repeat(80));
    console.log(`✅ Working vias: ${viasOK.length}/${allVias.length} (${successRate}%)`);
    console.log(`❌ Problem vias: ${problemVias}/${allVias.length} (${(100 - parseFloat(successRate)).toFixed(1)}%)`);

    if (problemVias > 0) {
      console.log('\n⚠️  RECOMMENDATION: Fix the vias listed above to prevent "Nenhum transporte disponível" errors');
    } else {
      console.log('\n✅ ALL VIAS ARE WORKING CORRECTLY!');
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAllVias()
  .then(() => {
    console.log('✅ Test completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
