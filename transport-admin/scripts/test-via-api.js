const fetch = require('node-fetch');

async function testViaAPI() {
  const viaId = 'cmovet5r700v314lnx42bx339';
  const url = `http://localhost:3000/api/vias/${viaId}`;
  
  console.log(`Testing API: ${url}\n`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('API Response:');
    console.log('='.repeat(60));
    console.log(`Via ID: ${data.id}`);
    console.log(`Nome: ${data.nome}`);
    console.log(`Código: ${data.codigo}`);
    console.log(`\n_count object:`);
    console.log(`  paragens: ${data._count?.paragens}`);
    console.log(`  transportes: ${data._count?.transportes}`);
    console.log(`\nActual paragens array length: ${data.paragens?.length || 0}`);
    
    if (data.paragens && data.paragens.length > 0) {
      console.log(`\nFirst 3 paragens:`);
      data.paragens.slice(0, 3).forEach((vp, idx) => {
        console.log(`  ${idx + 1}. ${vp.paragem.nome} (${vp.paragem.codigo})`);
      });
    }
    
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testViaAPI();
