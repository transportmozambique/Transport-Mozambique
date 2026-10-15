// Test USSD Number-Only System
// Run with: node test-ussd-number-only.js

const http = require('http');

async function testUSSD(text, description) {
  const formData = new URLSearchParams();
  formData.append('sessionId', `test${Date.now()}`);
  formData.append('serviceCode', '*384*123#');
  formData.append('phoneNumber', '+258123456789');
  formData.append('text', text);

  try {
    const response = await fetch('http://localhost:3001/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const data = await response.text();
    return { text, description, response: data };
  } catch (error) {
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Testing USSD Number-Only System\n');
  console.log('=' .repeat(80));
  
  const tests = [
    // Main menu
    { text: '', description: 'Main Menu' },
    
    // Option 1: Find Transport
    { text: '1', description: 'Option 1: Location List' },
    { text: '1*1', description: 'Option 1: Select Albasine' },
    { text: '1*1*1', description: 'Option 1: Select Destination (Laurentina)' },
    { text: '1*2', description: 'Option 1: Select Albert Lithule' },
    { text: '1*9', description: 'Option 1: Select Matendene (9th location)' },
    
    // Option 2: Search Routes
    { text: '2', description: 'Option 2: Origin List' },
    { text: '2*1', description: 'Option 2: Routes from Albasine' },
    { text: '2*1*1', description: 'Option 2: Route Details' },
    
    // Option 3: Nearest Stops
    { text: '3', description: 'Option 3: Area List' },
    { text: '3*1', description: 'Option 3: Stops in Area' },
    { text: '3*1*1', description: 'Option 3: Stop Details' },
    
    // Option 4: Calculate Fare
    { text: '4', description: 'Option 4: Origin List' },
    { text: '4*1', description: 'Option 4: Destination List from Albasine' },
    { text: '4*1*1', description: 'Option 4: Fare Calculation' },
    
    // Option 5: Help
    { text: '5', description: 'Option 5: Help' },
  ];

  const results = {
    passed: [],
    failed: [],
    errors: []
  };

  for (const test of tests) {
    try {
      console.log(`\n📝 Testing: ${test.description}`);
      console.log(`   Input: text="${test.text}"`);
      
      const result = await testUSSD(test.text, test.description);
      
      // Check for errors
      if (result.response.includes('Nenhum transporte disponível') ||
          result.response.includes('Nenhuma localização disponível') ||
          result.response.includes('Nenhuma rota encontrada') ||
          result.response.includes('Nenhuma paragem encontrada') ||
          result.response.includes('Nenhum destino disponível') ||
          result.response.includes('Digite')) {
        results.failed.push(result);
        console.log(`   ❌ FAILED`);
        console.log(`   Response: ${result.response.substring(0, 100)}...`);
      } else {
        results.passed.push(result);
        console.log(`   ✅ PASSED`);
        
        // Show first line of response
        const firstLine = result.response.split('\n')[0];
        console.log(`   Response: ${firstLine}`);
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      results.errors.push({ test, error: error.error || error });
      console.log(`   💥 ERROR: ${(error.error && error.error.message) || error.message || error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 TEST SUMMARY:\n');
  console.log(`✅ Passed: ${results.passed.length}/${tests.length}`);
  console.log(`❌ Failed: ${results.failed.length}/${tests.length}`);
  console.log(`💥 Errors: ${results.errors.length}/${tests.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(r => {
      console.log(`\n   Test: ${r.description}`);
      console.log(`   Input: ${r.text}`);
      console.log(`   Response: ${r.response.substring(0, 200)}...`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n💥 ERROR TESTS:');
    results.errors.forEach(r => {
      console.log(`\n   Test: ${r.test.description}`);
      console.log(`   Error: ${r.error.message || r.error}`);
    });
  }
  
  // Check for manual input prompts
  console.log('\n🔍 CHECKING FOR MANUAL INPUT PROMPTS:');
  const manualInputTests = results.passed.concat(results.failed);
  const hasManualInput = manualInputTests.some(r => 
    r.response.includes('Digite') || 
    r.response.includes('digitar') ||
    r.response.includes('Outro local') ||
    r.response.includes('Outro (digitar')
  );
  
  if (hasManualInput) {
    console.log('   ❌ FOUND manual input prompts - System is NOT number-only!');
  } else {
    console.log('   ✅ NO manual input prompts found - System is number-only!');
  }
  
  console.log('\n✅ Test complete!');
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 || results.errors.length > 0 ? 1 : 0);
}

runTests().catch(console.error);
