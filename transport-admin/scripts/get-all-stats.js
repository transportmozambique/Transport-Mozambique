const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Getting All Statistics\n');
  console.log('='.repeat(80) + '\n');

  // Get counts
  const transportesCount = await prisma.transporte.count();
  const viasCount = await prisma.via.count();
  const paragensCount = await prisma.paragem.count();
  const associationsCount = await prisma.paragemVia.count();

  // Get municipalities
  const municipios = await prisma.municipio.findMany();
  const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
  const municipioMatola = municipios.find(m => m.nome === 'Matola');

  // Count by municipality
  const transportesMaputo = await prisma.transporte.count({
    where: { via: { municipioId: municipioMaputo.id } }
  });

  const transportesMatola = await prisma.transporte.count({
    where: { via: { municipioId: municipioMatola.id } }
  });

  const viasMaputo = await prisma.via.count({
    where: { municipioId: municipioMaputo.id }
  });

  const viasMatola = await prisma.via.count({
    where: { municipioId: municipioMatola.id }
  });

  console.log('📊 OVERALL STATISTICS:');
  console.log(`   Total Transportes: ${transportesCount}`);
  console.log(`   Total Vias: ${viasCount}`);
  console.log(`   Total Paragens: ${paragensCount}`);
  console.log(`   Total Associations: ${associationsCount}\n`);

  console.log('📊 BY MUNICIPALITY:');
  console.log(`   Maputo:`);
  console.log(`     - Transportes: ${transportesMaputo} (${Math.round(transportesMaputo / transportesCount * 100)}%)`);
  console.log(`     - Vias: ${viasMaputo} (${Math.round(viasMaputo / viasCount * 100)}%)`);
  console.log(`   Matola:`);
  console.log(`     - Transportes: ${transportesMatola} (${Math.round(transportesMatola / transportesCount * 100)}%)`);
  console.log(`     - Vias: ${viasMatola} (${Math.round(viasMatola / viasCount * 100)}%)\n`);

  console.log('='.repeat(80));
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
