/**
 * Comprehensive USSD Test - All Options
 */

const sessionId = 'test-' + Date.now();
const phoneNumber = '+258841234567';
const serviceCode = '*384*12345#';

async function sendUSSD(text, description) {
  const formData = new URLSearchParams();
  formData.append('sessionId', sessionId);
  formData.append('serviceCode', serviceCode);
  formData.append('phoneNumber', phoneNumber);
  formData.append('text', text);

  console.log(`\n${description}`);
  console.log(`Input: "${text}"`);

  try {
    const response = await fetch('http://localhost:3000/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.text();
    console.log('\nResponse:');
    console.log(result);
    console.log('─'.repeat(80));
    
    return result;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function testOption1() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING OPTION 1: Encontrar Transporte Agora');
  console.log('═'.repeat(80));

  await sendUSSD('', '1. Main Menu');
  await sendUSSD('1', '2. Select Option 1');
  await sendUSSD('1*1', '3. Select Aeroporto (location 1)');
  await sendUSSD('1*1*1', '4. Select destination 1');
  
  console.log('\n✅ Option 1 test complete');
}

async function testOption2() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING OPTION 2: Procurar Rotas');
  console.log('═'.repeat(80));

  await sendUSSD('', '1. Main Menu');
  await sendUSSD('2', '2. Select Option 2');
  await sendUSSD('2*1', '3. Select origin 1');
  await sendUSSD('2*1*1', '4. Select route 1');
  
  console.log('\n✅ Option 2 test complete');
}

async function testOption3() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING OPTION 3: Paragens Próximas');
  console.log('═'.repeat(80));

  await sendUSSD('', '1. Main Menu');
  await sendUSSD('3', '2. Select Option 3');
  await sendUSSD('3*1', '3. Select area 1');
  await sendUSSD('3*1*1', '4. Select stop 1');
  
  console.log('\n✅ Option 3 test complete');
}

async function testOption4() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING OPTION 4: Calcular Tarifa');
  console.log('═'.repeat(80));

  await sendUSSD('', '1. Main Menu');
  await sendUSSD('4', '2. Select Option 4');
  await sendUSSD('4*1', '3. Select origin 1');
  await sendUSSD('4*1*1', '4. Select destination 1');
  
  console.log('\n✅ Option 4 test complete');
}

async function testOption5() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING OPTION 5: Ajuda');
  console.log('═'.repeat(80));

  await sendUSSD('', '1. Main Menu');
  await sendUSSD('5', '2. Select Option 5 (Help)');
  
  console.log('\n✅ Option 5 test complete');
}

async function testInvalidInputs() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING INVALID INPUTS');
  console.log('═'.repeat(80));

  await sendUSSD('99', 'Invalid main menu option');
  await sendUSSD('1*abc', 'Non-numeric input');
  await sendUSSD('1*999', 'Out of bounds index');
  await sendUSSD('0', 'Zero input');
  
  console.log('\n✅ Invalid inputs test complete');
}

async function testBackNavigation() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING BACK NAVIGATION (0)');
  console.log('═'.repeat(80));

  await sendUSSD('1', 'Go to Option 1');
  await sendUSSD('1*0', 'Press 0 to go back');
  
  console.log('\n✅ Back navigation test complete');
}

async function runAllTests() {
  console.log('\n🚀 Starting Comprehensive USSD Tests\n');
  
  try {
    await testOption1();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests
    
    await testOption2();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testOption3();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testOption4();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testOption5();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testInvalidInputs();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testBackNavigation();
    
    console.log('\n\n' + '═'.repeat(80));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('═'.repeat(80));
    console.log('\nCheck the output above for any errors or unexpected responses.');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

runAllTests();
