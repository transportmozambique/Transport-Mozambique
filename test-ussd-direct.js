/**
 * Direct USSD Test - Check server logs
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

  console.log(`\nSending: "${text}"`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('http://localhost:3000/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const result = await response.text();
    console.log('Response:', result.substring(0, 200));
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Request timed out after 15 seconds');
      console.log('\n💡 Check server logs for errors');
      console.log('💡 The findTransportInfo function may be taking too long');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

async function test() {
  console.log('Testing USSD with timeout...\n');
  
  // Final step that's timing out
  await sendUSSD('1*1*1');
  
  console.log('\n✅ Test complete!');
}

test();
