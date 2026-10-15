/**
 * Quick USSD Test - Origin to Destination
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
    console.log('─'.repeat(50));
    
    return result;
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function test() {
  console.log('Testing USSD Origin → Destination\n');
  console.log('═'.repeat(50));

  // Menu
  await sendUSSD('', '1. Main Menu');
  
  // Find transport
  await sendUSSD('1', '2. Find Transport');
  
  // Select Aeroporto as origin
  await sendUSSD('1*1', '3. Select Aeroporto (origin)');
  
  // Select destination (Praça dos Trabalhadores)
  await sendUSSD('1*1*1', '4. Select Praça dos Trabalhadores (destination)');
  
  console.log('\n✅ Test complete!');
  console.log('\nCheck if final response shows:');
  console.log('  - TEMPO ATE CHEGAR A SI (time to origin)');
  console.log('  - TEMPO DE VIAGEM (journey time)');
  console.log('  - DISTANCIA (journey distance)');
  console.log('  - TARIFA (fare based on journey)');
}

test();
