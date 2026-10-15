const fetch = require('node-fetch');

async function testAPI() {
  try {
    const proprietarioId = 'cmotb44qm0003kh6tw6vtkdfa';
    const url = `http://localhost:3000/api/proprietarios/${proprietarioId}`;
    
    console.log('Testing URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\n=== API RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Erro ao testar API:', error.message);
  }
}

testAPI();
