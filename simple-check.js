require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n🔍 Simple Database Check\n');
  console.log('='.repeat(70));
  
  // 1. Check municipalities
  const municipios = await prisma.municipio.findMany();
  console.log(`\n✅ Municipalities: ${municipios.length}`);
  municipios.forEach(m => console.log(`   - ${m.nome} (${m.codigo})`));
  
  // 2. Check transportes with locations
  const transportes = await prisma.transporte.findMany({
    take: 3,
    include: {
      via: {
        select: {
          nome: true,
          municipio: {
            select: { nome: true }
          }
        }
      }
    }
  });
  
  console.log(`\n✅ Sample Transportes (first 3):`);
  transportes.forEach(t => {
    console.log(`\n   ${t.matricula}:`);
    console.log(`     Location: ${t.currGeoLocation || 'NULL'}`);
    console.log(`     Via: ${t.via?.nome || 'NULL'}`);
    console.log(`     Municipality: ${t.via?.municipio?.nome || 'NULL'}`);
    console.log(`     Route Path: ${t.routePath ? 'YES (' + t.routePath.split(';').length + ' points)' : 'NO'}`);
  });
  
  console.log('\n' + '='.repeat(70));
  
  await prisma.$disconnect();
})();
