const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🌐 Testing /api/locations endpoint...\n');
    
    const response = await fetch('http://localhost:3000/api/locations');
    
    console.log('📊 Response status:', response.status);
    
    if (!response.ok) {
      console.log('❌ Response not OK');
      const text = await response.text();
      console.log('Response body:', text);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📦 Data received:');
    console.log('  - Municipios:', data.municipios?.length || 0);
    console.log('  - Vias:', data.vias?.length || 0);
    console.log('  - Paragens:', data.paragens?.length || 0);
    
    if (data.municipios && data.municipios.length > 0) {
      console.log('\n📋 First municipio:', data.municipios[0]);
    }
    
    if (data.vias && data.vias.length > 0) {
      console.log('\n📋 First 3 vias:');
      data.vias.slice(0, 3).forEach(via => {
        console.log(`  - ${via.nome} (municipioId: ${via.municipioId})`);
      });
    }
    
    // Check if vias have the correct municipioId
    const targetMunicipioId = 'cmorbs0bm000a124pum8v3z8a';
    const viasForMunicipio = data.vias?.filter(v => v.municipioId === targetMunicipioId) || [];
    console.log(`\n🔎 Vias for municipio ${targetMunicipioId}: ${viasForMunicipio.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
