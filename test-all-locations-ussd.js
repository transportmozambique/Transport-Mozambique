// Test all locations in USSD to find similar issues
// Run with: node test-all-locations-ussd.js

const http = require('http');

const locations = [
  'Albasine',
  'Albert Lithule',
  'Boane',
  'Boquisso',
  'Chamissava',
  'Laurentina',
  'Machava Sede',
  'Mafuiane',
  'Matendene',
  'Matola Gare',
  'Matola Sede',
  'Michafutene',
  'Terminal Museu',
  'Terminal Zimpeto',
  'Tchumene'
];

async function testLocation(location, index) {
  return new Promise((resolve, reject) => {
    const postData = `sessionId=test${index}&serviceCode=*384*123%23&phoneNumber=%2B258123456789&text=1*${index + 1}`;
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/ussd',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ location, response: data });
      });
    });

    req.on('error', (error) => {
      reject({ location, error });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing all locations in USSD...\n');
  console.log('=' .repeat(80));
  
  const results = {
    working: [],
    failing: [],
    errors: []
  };

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    
    try {
      const result = await testLocation(location, i);
      
      if (result.response.includes('Nenhum transporte disponível') || 
          result.response.includes('Nenhuma paragem encontrada') ||
          result.response.includes('Nenhum destino disponível')) {
        results.failing.push(result);
        console.log(`❌ ${location}: NO DESTINATIONS FOUND`);
        console.log(`   Response: ${result.response.substring(0, 100)}...`);
      } else if (result.response.includes('Para onde quer ir?') || 
                 result.response.includes('Rotas de') ||
                 result.response.includes('Paragens em')) {
        results.working.push(result);
        console.log(`✅ ${location}: WORKING`);
        
        // Extract destination count
        const matches = result.response.match(/\d+\./g);
        if (matches) {
          console.log(`   Found ${matches.length} destinations/options`);
        }
      } else {
        results.errors.push(result);
        console.log(`⚠️  ${location}: UNEXPECTED RESPONSE`);
        console.log(`   Response: ${result.response.substring(0, 100)}...`);
      }
      
      console.log('');
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.errors.push({ location, error });
      console.log(`💥 ${location}: ERROR`);
      console.log(`   ${error.message || error}`);
      console.log('');
    }
  }

  console.log('=' .repeat(80));
  console.log('\n📊 SUMMARY:\n');
  console.log(`✅ Working: ${results.working.length}/${locations.length}`);
  console.log(`❌ Failing: ${results.failing.length}/${locations.length}`);
  console.log(`⚠️  Errors: ${results.errors.length}/${locations.length}`);
  
  if (results.failing.length > 0) {
    console.log('\n❌ LOCATIONS WITH NO DESTINATIONS:');
    results.failing.forEach(r => {
      console.log(`   - ${r.location}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  LOCATIONS WITH ERRORS:');
    results.errors.forEach(r => {
      console.log(`   - ${r.location}`);
    });
  }
  
  console.log('\n✅ Test complete!');
}

runTests().catch(console.error);
