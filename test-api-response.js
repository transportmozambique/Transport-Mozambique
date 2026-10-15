const http = require('http');

const proprietarioId = 'cmotb44qm0003kh6tw6vtkdfa'; // Transportes Maputo Lda

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/proprietarios/${proprietarioId}`,
  method: 'GET'
};

console.log(`Testing: http://localhost:3000/api/proprietarios/${proprietarioId}\n`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('\nResponse:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      console.log('\n=== VERIFICAÇÃO ===');
      console.log('Nome:', json.nome || 'MISSING');
      console.log('BI:', json.bi || 'MISSING');
      console.log('Tipo:', json.tipoProprietario || 'MISSING');
      console.log('Nacionalidade:', json.nacionalidade || 'MISSING');
      console.log('Endereço:', json.endereco || 'MISSING');
      console.log('Contacto1:', json.contacto1 || 'MISSING');
      console.log('Transportes:', json.transportes?.length || 0);
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
