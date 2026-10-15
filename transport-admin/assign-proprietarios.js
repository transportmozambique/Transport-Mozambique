const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Atribuindo proprietários a todos os autocarros...\n');

  // Get all proprietários
  const proprietarios = await prisma.proprietario.findMany();
  
  if (proprietarios.length === 0) {
    console.log('❌ Nenhum proprietário encontrado!');
    console.log('   Execute primeiro: node check-and-seed-proprietarios.js');
    return;
  }

  console.log(`✓ Encontrados ${proprietarios.length} proprietários\n`);

  // Get all transportes without proprietários
  const transportes = await prisma.transporte.findMany({
    include: {
      proprietarios: true,
    },
  });

  const transportesSemProprietario = transportes.filter(
    (t) => !t.proprietarios || t.proprietarios.length === 0
  );

  console.log(`📊 Total de autocarros: ${transportes.length}`);
  console.log(`   Sem proprietário: ${transportesSemProprietario.length}\n`);

  if (transportesSemProprietario.length === 0) {
    console.log('✅ Todos os autocarros já têm proprietário!');
    return;
  }

  console.log('📝 Atribuindo proprietários...\n');

  let count = 0;
  for (const transporte of transportesSemProprietario) {
    // Distribute proprietários evenly
    const proprietario = proprietarios[count % proprietarios.length];

    await prisma.transporteProprietario.create({
      data: {
        transporteId: transporte.id,
        proprietarioId: proprietario.id,
      },
    });

    console.log(`  ✓ ${transporte.matricula} → ${proprietario.nome}`);
    count++;
  }

  console.log(`\n✅ ${count} autocarros atribuídos com sucesso!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
