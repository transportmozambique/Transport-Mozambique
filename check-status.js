require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const allTransportes = await prisma.transporte.findMany({ select: { viaId: true } });
  const transportesAssigned = allTransportes.filter(t => t.viaId !== null).length;
  
  const stats = {
    municipios: await prisma.municipio.count(),
    vias: await prisma.via.count(),
    paragens: await prisma.paragem.count(),
    viaParagens: await prisma.viaParagem.count(),
    transportes: allTransportes.length,
    transportesAssigned
  };
  
  console.log('\n📊 Current Database Status:');
  console.log('='.repeat(50));
  console.log(`Municipalities: ${stats.municipios}`);
  console.log(`Vias (Routes): ${stats.vias}`);
  console.log(`Paragens (Stops): ${stats.paragens}`);
  console.log(`ViaParagem Relations: ${stats.viaParagens}`);
  console.log(`Transportes Total: ${stats.transportes}`);
  console.log(`Transportes Assigned: ${stats.transportesAssigned}`);
  console.log('='.repeat(50));
  
  await prisma.$disconnect();
})();
