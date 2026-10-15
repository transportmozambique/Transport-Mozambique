/**
 * Local USSD Testing Script
 * 
 * Run this to test your USSD endpoint before using your phone
 * 
 * Usage: node test-ussd-local.js
 */

const sessionId = 'test-session-' + Date.now();
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

async function testFlow() {
  console.log('🧪 Testing USSD Flow\n');
  console.log('Session ID:', sessionId);
  console.log('Phone:', phoneNumber);
  console.log('═'.repeat(40));

  // Test 1: Initial menu
  console.log('\n1️⃣  TEST: Initial Menu');
  await sendUSSD('');

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Select option 1 (Find Routes)
  console.log('\n2️⃣  TEST: Select Option 1 (Find Routes)');
  await sendUSSD('1');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Enter origin "Matola"
  console.log('\n3️⃣  TEST: Enter Origin "Matola"');
  await sendUSSD('1*Matola');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Select first route
  console.log('\n4️⃣  TEST: Select First Route');
  await sendUSSD('1*Matola*1');

  console.log('\n✅ Test complete!\n');
  console.log('If all tests passed, you can now test with your phone! 📱');
}

// Run tests
testFlow();
