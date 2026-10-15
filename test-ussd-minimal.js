/**
 * Minimal test - just send the request and see server logs
 */

async function test() {
  const formData = new URLSearchParams();
  formData.append('sessionId', 'test-123');
  formData.append('serviceCode', '*384#');
  formData.append('phoneNumber', '+258841234567');
  formData.append('text', '1*1*1');

  console.log('Sending USSD request...');
  console.log('Check the server terminal for logs\n');

  try {
    const response = await fetch('http://localhost:3000/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.text();
    console.log('✅ Response received:');
    console.log(result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
