const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function checkAllMunicipios() {
  try {
    console.log('🔍 Checking all municipios...\n');
    
    const municipios = await prisma.municipio.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });
    
    console.log(`📊 Total Municipios: ${municipios.length}\n`);
    
    for (const municipio of municipios) {
      console.log(`\n📍 ${municipio.nome} (${municipio.codigo})`);
      console.log(`   ID: ${municipio.id}`);
      
      // Count vias for this municipio
      const viasCount = await prisma.via.count({
        where: { municipioId: municipio.id },
      });
      
      console.log(`   Vias: ${viasCount}`);
      
      // Show sample vias
      if (viasCount > 0) {
        const sampleVias = await prisma.via.findMany({
          where: { municipioId: municipio.id },
          select: {
            nome: true,
          },
          take: 3,
        });
        
        console.log('   Sample vias:');
        sampleVias.forEach(v => {
          console.log(`     - ${v.nome}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllMunicipios();
