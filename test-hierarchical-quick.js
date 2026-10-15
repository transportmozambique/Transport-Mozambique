/**
 * Quick test for hierarchical USSD navigation
 * Tests key flows without waiting for slow database queries
 */

const testCases = [
  // Test 1: Main menu
  {
    name: 'Main Menu',
    text: '',
    expected: /Bem-vindo ao Sistema de Transportes/
  },

  // Test 2: Region selection for Find Transport
  {
    name: 'Find Transport - Region Selection',
    text: '1',
    expected: /Em que região você está/
  },

  // Test 3: Maputo neighborhoods
  {
    name: 'Maputo Neighborhoods',
    text: '1*1',
    expected: /Baixa[\s\S]*Polana[\s\S]*Alto Maé[\s\S]*Xipamanine[\s\S]*Hulene[\s\S]*Magoanine[\s\S]*Zimpeto[\s\S]*Albazine[\s\S]*Jardim/
  },

  // Test 4: Matola neighborhoods
  {
    name: 'Matola Neighborhoods',
    text: '1*2',
    expected: /Matola Sede[\s\S]*Machava[\s\S]*Matola Gare[\s\S]*Tchumene[\s\S]*T3[\s\S]*Fomento[\s\S]*Liberdade[\s\S]*Malhampsene/
  },

  // Test 5: Baixa stops
  {
    name: 'Baixa Stops',
    text: '1*1*1',
    expected: /Baixa.*Escolha a paragem/
  },

  // Test 6: Polana stops
  {
    name: 'Polana Stops',
    text: '1*1*2',
    expected: /Polana.*Escolha a paragem/
  },

  // Test 7: Albazine stops (previously broken)
  {
    name: 'Albazine Stops',
    text: '1*1*8',
    expected: /Albazine.*Escolha a paragem/
  },

  // Test 8: Machava stops
  {
    name: 'Machava Stops',
    text: '1*2*2',
    expected: /Machava.*Escolha a paragem/
  },

  // Test 9: T3 stops
  {
    name: 'T3 Stops',
    text: '1*2*5',
    expected: /T3.*Escolha a paragem/
  },

  // Test 10: Search Routes - Region
  {
    name: 'Search Routes - Region',
    text: '2',
    expected: /Em que região você está/
  },

  // Test 11: Search Routes - Neighborhoods
  {
    name: 'Search Routes - Neighborhoods',
    text: '2*1',
    expected: /Maputo - Escolha o bairro/
  },

  // Test 12: Nearest Stops - Region
  {
    name: 'Nearest Stops - Region',
    text: '3',
    expected: /Em que região você está/
  },

  // Test 13: Calculate Fare - Origin Region
  {
    name: 'Calculate Fare - Origin Region',
    text: '4',
    expected: /Região de origem/
  },

  // Test 14: Calculate Fare - Origin Neighborhood
  {
    name: 'Calculate Fare - Origin Neighborhood',
    text: '4*1',
    expected: /Maputo - Origem \(bairro\)/
  },

  // Test 15: Back navigation
  {
    name: 'Back Navigation',
    text: '1*1*0',
    expected: /Em que região você está/
  },

  // Test 16: Help
  {
    name: 'Help',
    text: '5',
    expected: /Sistema de Transportes - Ajuda/
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
  console.log('🧪 Quick Hierarchical USSD Navigation Tests\n');
  console.log('=' .repeat(80));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const testCase of testCases) {
    try {
      const response = await testUSSD(testCase.text);
      
      if (testCase.expected.test(response)) {
        console.log(`✅ ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}`);
        console.log(`   Input: "${testCase.text}"`);
        console.log(`   Expected: ${testCase.expected}`);
        console.log(`   Got: ${response.substring(0, 150)}...`);
        failed++;
        failures.push(testCase.name);
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} - ERROR: ${error.message}`);
      failed++;
      failures.push(testCase.name);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
  console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log(`\n❌ Failed tests:`);
    failures.forEach(name => console.log(`   - ${name}`));
  }

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Hierarchical navigation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
  }

  return failed === 0;
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
  
  return !manualInputFound;
}

// Run all tests
runTests()
  .then(testsPass => checkForManualInput().then(noManualInput => testsPass && noManualInput))
  .then(success => {
    console.log('\n✨ Testing complete!\n');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });
