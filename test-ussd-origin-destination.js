/**
 * USSD Origin-Destination Test
 * 
 * Tests the complete flow: Origin → Destination → Transport Info
 * 
 * Usage: node test-ussd-origin-destination.js
 */

const sessionId = 'test-session-' + Date.now();
const phoneNumber = '+258841234567';
const serviceCode = '*384*12345#';

async function sendUSSD(text, description) {
  const formData = new URLSearchParams();
  formData.append('sessionId', sessionId);
  formData.append('serviceCode', serviceCode);
  formData.append('phoneNumber', phoneNumber);
  formData.append('text', text);

  console.log(`\n📤 ${description}`);
  console.log(`   Input: "${text}"`);

  try {
    const response = await fetch('http://localhost:3000/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.text();
    console.log('\n📱 Response:');
    console.log('─'.repeat(50));
    console.log(result);
    console.log('─'.repeat(50));
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure your app is running:');
    console.log('   npm run dev');
    process.exit(1);
  }
}

async function wait(ms = 500) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function testCompleteFlow() {
  console.log('🧪 Testing USSD Origin-Destination Flow\n');
  console.log('Session ID:', sessionId);
  console.log('Phone:', phoneNumber);
  console.log('═'.repeat(50));

  // Step 1: Initial menu
  console.log('\n\n🔹 STEP 1: Initial Menu');
  await sendUSSD('', 'Opening USSD');
  await wait();

  // Step 2: Select "Find Transport Now" (option 1)
  console.log('\n\n🔹 STEP 2: Select "Find Transport Now"');
  await sendUSSD('1', 'Selecting option 1');
  await wait();

  // Step 3: Select region - Maputo (option 1)
  console.log('\n\n🔹 STEP 3: Select Region - Maputo');
  await sendUSSD('1*1', 'Selecting Maputo');
  await wait();

  // Step 4: Select neighborhood - First option
  console.log('\n\n🔹 STEP 4: Select Neighborhood');
  await sendUSSD('1*1*1', 'Selecting first neighborhood');
  await wait();

  // Step 5: Select origin stop - First option
  console.log('\n\n🔹 STEP 5: Select Origin Stop');
  await sendUSSD('1*1*1*1', 'Selecting first stop as origin');
  await wait();

  // Step 6: Select destination - Second option (different from origin)
  console.log('\n\n🔹 STEP 6: Select Destination');
  await sendUSSD('1*1*1*1*2', 'Selecting second destination');
  await wait();

  console.log('\n\n✅ Test Complete!\n');
  console.log('═'.repeat(50));
  console.log('\n📊 What to check:');
  console.log('   ✓ Final response should show transport info');
  console.log('   ✓ Should include: TEMPO ATE CHEGAR A SI');
  console.log('   ✓ Should include: TEMPO DE VIAGEM');
  console.log('   ✓ Should include: DISTANCIA');
  console.log('   ✓ Should include: TARIFA');
  console.log('   ✓ Calculations should be based on origin → destination');
  console.log('\n');
}

// Alternative test with Matola
async function testMatolaFlow() {
  console.log('\n\n🧪 Testing Matola Route\n');
  console.log('═'.repeat(50));

  // Step 1: Initial menu
  console.log('\n\n🔹 STEP 1: Initial Menu');
  await sendUSSD('', 'Opening USSD');
  await wait();

  // Step 2: Select "Find Transport Now"
  console.log('\n\n🔹 STEP 2: Select "Find Transport Now"');
  await sendUSSD('1', 'Selecting option 1');
  await wait();

  // Step 3: Select region - Matola (option 2)
  console.log('\n\n🔹 STEP 3: Select Region - Matola');
  await sendUSSD('1*2', 'Selecting Matola');
  await wait();

  // Step 4: Select neighborhood
  console.log('\n\n🔹 STEP 4: Select Neighborhood');
  await sendUSSD('1*2*1', 'Selecting first neighborhood in Matola');
  await wait();

  // Step 5: Select origin stop
  console.log('\n\n🔹 STEP 5: Select Origin Stop');
  await sendUSSD('1*2*1*1', 'Selecting first stop as origin');
  await wait();

  // Step 6: Select destination
  console.log('\n\n🔹 STEP 6: Select Destination');
  await sendUSSD('1*2*1*1*2', 'Selecting second destination');
  await wait();

  console.log('\n\n✅ Matola Test Complete!\n');
}

// Run tests
async function runAllTests() {
  try {
    console.log('🚀 Starting USSD Tests\n');
    
    // Test 1: Maputo flow
    await testCompleteFlow();
    
    // Wait between tests
    await wait(2000);
    
    // Test 2: Matola flow
    // await testMatolaFlow();
    
    console.log('\n🎉 All tests completed successfully!\n');
    console.log('You can now test with your phone! 📱');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runAllTests();
