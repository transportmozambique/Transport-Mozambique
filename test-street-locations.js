// Test script to verify street-based locations in USSD responses
const fetch = require('node-fetch');

const USSD_URL = 'http://localhost:3000/api/ussd';

async function testUSSD(text, description) {
  const formData = new URLSearchParams();
  formData.append('sessionId', 'test-session-' + Date.now());
  formData.append('serviceCode', '*384*123#');
  formData.append('phoneNumber', '+258840000000');
  formData.append('text', text);

  try {
    const response = await fetch(USSD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    const result = await response.text();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST: ${description}`);
    console.log(`INPUT: ${text || '(empty)'}`);
    console.log(`${'='.repeat(80)}`);
    console.log(result);
    
    // Check for street names
    const streetPatterns = [
      /Em Av\./,
      /Em Estrada/,
      /próximo de/,
      /Entre .* e .*/
    ];
    
    const hasStreetName = streetPatterns.some(pattern => pattern.test(result));
    
    if (hasStreetName) {
      console.log('\n✅ STREET-BASED LOCATION FOUND!');
    } else if (result.includes('LOCALIZACAO ATUAL')) {
      console.log('\n⚠️  Location found but not street-based');
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error in test "${description}":`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('\n🧪 Testing Street-Based Locations in USSD System\n');
  
  // Test 1: Find transport from Baixa to Museu
  await testUSSD('1*1*1*1*1', 'Find Transport: Baixa → Museu (should show street name)');
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Find transport from Matola to Baixa
  await testUSSD('1*2*1*1*1', 'Find Transport: Matola Sede → Baixa (should show street name)');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Find transport from T3 to Baixa
  await testUSSD('1*2*5*1*1', 'Find Transport: T3 → Baixa (should show street name)');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 4: Find transport from Polana to Baixa
  await testUSSD('1*1*2*1*1', 'Find Transport: Polana → Baixa (should show street name)');
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ All tests completed!');
  console.log('\nExpected street names:');
  console.log('  - Em Av. Samora Machel');
  console.log('  - Em Av. 24 de Julho');
  console.log('  - Em Estrada da Matola');
  console.log('  - Em Av. União Africana');
  console.log('  - Em Estrada Circular');
  console.log('  - Em Av. de Moçambique');
  console.log('  - Em Av. Julius Nyerere');
  console.log('  - Em Av. Eduardo Mondlane');
  console.log('\n');
}

runTests();
