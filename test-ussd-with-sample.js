/**
 * Test USSD with sample route names from your database
 * 
 * Try these common Mozambique locations:
 * - Maputo
 * - Matola
 * - Baixa
 * - Costa do Sol
 * - Sommerschield
 * - Polana
 */

const sessionId = 'test-' + Date.now();
const phoneNumber = '+258841234567';
const serviceCode = '*384*12345#';

async function sendUSSD(text) {
  const formData = new URLSearchParams();
  formData.append('sessionId', sessionId);
  formData.append('serviceCode', serviceCode);
  formData.append('phoneNumber', phoneNumber);
  formData.append('text', text);

  console.log('\n📤 Sending:', { text });

  try {
    const response = await fetch('http://localhost:3000/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.text();
    console.log('📱 Response:\n');
    console.log('─'.repeat(40));
    console.log(result);
    console.log('─'.repeat(40));
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure your app is running:');
    console.log('   cd transport-client && npm run dev');
  }
}

async function testWithDifferentSearches() {
  console.log('🧪 Testing USSD with Different Searches\n');
  console.log('Session ID:', sessionId);
  console.log('Phone:', phoneNumber);
  console.log('═'.repeat(40));

  // Test 1: Initial menu
  console.log('\n1️⃣  TEST: Initial Menu');
  await sendUSSD('');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Try searching for "Maputo"
  console.log('\n2️⃣  TEST: Search for "Maputo"');
  await sendUSSD('1*Maputo');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Try searching for "Baixa"
  console.log('\n3️⃣  TEST: Search for "Baixa"');
  await sendUSSD('1*Baixa');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Try option 2 (Nearest Stops)
  console.log('\n4️⃣  TEST: Nearest Stops - Search "Centro"');
  await sendUSSD('2*Centro');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Help option
  console.log('\n5️⃣  TEST: Help Option');
  await sendUSSD('4');

  console.log('\n✅ Test complete!\n');
  console.log('💡 Tips:');
  console.log('- If "No routes found", your database might be empty');
  console.log('- Check transport-admin to add routes first');
  console.log('- Or test with exact names from your database');
}

// Run tests
testWithDifferentSearches();
