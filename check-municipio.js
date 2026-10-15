const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function checkMunicipio() {
  try {
    const selectedId = 'cmorbs0bm000a124pum8v3z8a';
    
    console.log('🔍 Checking municipio:', selectedId);
    
    const municipio = await prisma.municipio.findUnique({
      where: { id: selectedId },
    });
    
    if (municipio) {
      console.log('✅ Municipio found:', municipio);
      
      // Check vias for this municipio
      const vias = await prisma.via.findMany({
        where: { municipioId: selectedId },
        select: {
          id: true,
          nome: true,
          municipioId: true,
        },
      });
      
      console.log(`\n📊 Vias for this municipio: ${vias.length}`);
      vias.slice(0, 5).forEach(v => {
        console.log(`  - ${v.nome} (MunicipioID: ${v.municipioId})`);
      });
    } else {
      console.log('❌ Municipio NOT found');
      
      // Show all municipios
      const allMunicipios = await prisma.municipio.findMany();
      console.log('\n📋 All municipios in database:');
      allMunicipios.forEach(m => {
        console.log(`  - ${m.nome} (ID: ${m.id})`);
      });
      
      // Check if any vias have this municipioId
      const viasWithThisId = await prisma.via.findMany({
        where: { municipioId: selectedId },
      });
      console.log(`\n🔎 Vias with municipioId ${selectedId}: ${viasWithThisId.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMunicipio();
