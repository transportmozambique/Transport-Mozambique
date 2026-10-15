/**
 * Test script for hierarchical USSD navigation
 * Tests: Region → Bairro → Paragem flow
 */

const testCases = [
  // Test 1: Find Transport - Maputo → Baixa → Praça dos Trabalhadores → Museu
  {
    name: 'Find Transport: Maputo → Baixa → Praça → Museu',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '1', expected: /Em que região você está/ },
      { text: '1*1', expected: /Maputo - Escolha o bairro/ },
      { text: '1*1*1', expected: /Baixa.*Escolha a paragem/ },
      { text: '1*1*1*1', expected: /Para onde vai/ },
      { text: '1*1*1*1*1', expected: /INFORMACAO DE TRANSPORTE/ }
    ]
  },

  // Test 2: Find Transport - Matola → Machava → Terminal
  {
    name: 'Find Transport: Matola → Machava',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '1', expected: /Em que região você está/ },
      { text: '1*2', expected: /Matola - Escolha o bairro/ },
      { text: '1*2*2', expected: /Machava.*Escolha a paragem/ }
    ]
  },

  // Test 3: Search Routes - Maputo → Polana
  {
    name: 'Search Routes: Maputo → Polana',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '2', expected: /Em que região você está/ },
      { text: '2*1', expected: /Maputo - Escolha o bairro/ },
      { text: '2*1*2', expected: /Polana.*Escolha a paragem/ },
      { text: '2*1*2*1', expected: /Rotas de/ }
    ]
  },

  // Test 4: Nearest Stops - Matola → T3
  {
    name: 'Nearest Stops: Matola → T3',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '3', expected: /Em que região você está/ },
      { text: '3*2', expected: /Matola - Escolha o bairro/ },
      { text: '3*2*5', expected: /T3.*Paragens em/ }
    ]
  },

  // Test 5: Calculate Fare - Maputo Baixa → Matola Machava
  {
    name: 'Calculate Fare: Maputo Baixa → Matola Machava',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '4', expected: /Região de origem/ },
      { text: '4*1', expected: /Maputo - Origem \(bairro\)/ },
      { text: '4*1*1', expected: /Baixa.*Paragem de origem/ },
      { text: '4*1*1*1', expected: /Região de destino/ },
      { text: '4*1*1*1*2', expected: /Matola - Bairro de destino/ },
      { text: '4*1*1*1*2*2', expected: /Machava.*Paragem de destino/ },
      { text: '4*1*1*1*2*2*1', expected: /CALCULO DE TARIFA/ }
    ]
  },

  // Test 6: Back navigation
  {
    name: 'Back Navigation Test',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '1', expected: /Em que região você está/ },
      { text: '1*1', expected: /Maputo - Escolha o bairro/ },
      { text: '1*1*0', expected: /Em que região você está/ }
    ]
  },

  // Test 7: No manual input allowed
  {
    name: 'No Manual Input Test',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '1', expected: /Em que região você está/ },
      { text: '1*1', expected: /Maputo - Escolha o bairro/ }
    ]
  },

  // Test 8: All neighborhoods accessible
  {
    name: 'All Maputo Neighborhoods',
    inputs: [
      { text: '1*1', expected: /Baixa.*Polana.*Alto Maé.*Xipamanine.*Hulene.*Magoanine.*Zimpeto.*Albazine.*Jardim/ }
    ]
  },

  // Test 9: All Matola neighborhoods accessible
  {
    name: 'All Matola Neighborhoods',
    inputs: [
      { text: '1*2', expected: /Matola Sede.*Machava.*Matola Gare.*Tchumene.*T3.*Fomento.*Liberdade.*Malhampsene/ }
    ]
  },

  // Test 10: Albasine search (previously broken)
  {
    name: 'Albasine Search Test',
    inputs: [
      { text: '', expected: /Bem-vindo ao Sistema de Transportes/ },
      { text: '1', expected: /Em que região você está/ },
      { text: '1*1', expected: /Maputo - Escolha o bairro/ },
      { text: '1*1*8', expected: /Albazine.*Escolha a paragem/ }
    ]
  }
];

async function testUSSD(text) {
  const response = await fetch('http://localhost:3000/api/ussd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      sessionId: 'test-session-' + Date.now(),
      serviceCode: '*384*123#',
      phoneNumber: '+258840000000',
      text: text
    })
  });

  return await response.text();
}

async function runTests() {
  console.log('🧪 Starting Hierarchical USSD Navigation Tests\n');
  console.log('=' .repeat(80));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('-'.repeat(80));

    let testPassed = true;

    for (const input of testCase.inputs) {
      try {
        const response = await testUSSD(input.text);
        
        console.log(`\n  Input: "${input.text}"`);
        console.log(`  Response: ${response.substring(0, 100)}...`);

        if (!input.expected.test(response)) {
          console.log(`  ❌ FAILED: Expected pattern not found`);
          console.log(`  Expected: ${input.expected}`);
          console.log(`  Got: ${response}`);
          testPassed = false;
          break;
        } else {
          console.log(`  ✅ PASSED`);
        }
      } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        testPassed = false;
        break;
      }
    }

    if (testPassed) {
      console.log(`\n✅ ${testCase.name} - PASSED`);
      passed++;
    } else {
      console.log(`\n❌ ${testCase.name} - FAILED`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
  console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Hierarchical navigation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
  }
}

// Check for manual input prompts
async function checkForManualInput() {
  console.log('\n\n🔍 Checking for manual input prompts...\n');
  console.log('=' .repeat(80));

  const manualInputPatterns = [
    /Digite/i,
    /Escreva/i,
    /Introduza/i,
    /Insira/i,
    /CON Digite/i,
    /Outro local/i,
    /digitar nome/i
  ];

  const testInputs = [
    '',
    '1',
    '1*1',
    '1*1*1',
    '1*1*1*1',
    '2',
    '2*1',
    '2*1*1',
    '3',
    '3*2',
    '4',
    '4*1',
    '4*1*1'
  ];

  let manualInputFound = false;

  for (const input of testInputs) {
    const response = await testUSSD(input);
    
    for (const pattern of manualInputPatterns) {
      if (pattern.test(response)) {
        console.log(`❌ Manual input prompt found!`);
        console.log(`   Input: "${input}"`);
        console.log(`   Pattern: ${pattern}`);
        console.log(`   Response: ${response.substring(0, 200)}`);
        manualInputFound = true;
      }
    }
  }

  if (!manualInputFound) {
    console.log('✅ No manual input prompts found - System is 100% number-based!');
  }

  console.log('=' .repeat(80));
}

// Run all tests
runTests()
  .then(() => checkForManualInput())
  .then(() => {
    console.log('\n✨ Testing complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });
