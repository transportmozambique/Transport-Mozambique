const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🏢 Atribuindo proprietários aos transportes...\n');

  // Step 1: Get all proprietarios
  const proprietarios = await prisma.proprietario.findMany({
    orderBy: { nome: 'asc' }
  });

  if (proprietarios.length === 0) {
    console.log('❌ Nenhum proprietário encontrado! Crie proprietários primeiro.');
    return;
  }

  console.log(`📊 Proprietários disponíveis: ${proprietarios.length}\n`);
  proprietarios.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.nome} (${p.tipoProprietario || 'N/A'})`);
  });

  // Step 2: Get all transportes without proprietarios
  const transportes = await prisma.transporte.findMany({
    include: {
      proprietarios: true
    },
    orderBy: {
      codigo: 'asc'
    }
  });

  const transportesSemProprietario = transportes.filter(t => t.proprietarios.length === 0);

  console.log(`\n📊 Transportes:`);
  console.log(`   Total: ${transportes.length}`);
  console.log(`   Sem proprietário: ${transportesSemProprietario.length}\n`);

  if (transportesSemProprietario.length === 0) {
    console.log('✅ Todos os transportes já têm proprietário!');
    return;
  }

  // Step 3: Assign proprietarios to transportes (distribute evenly)
  console.log(`🔗 Atribuindo proprietários...\n`);

  let atribuidos = 0;
  for (let i = 0; i < transportesSemProprietario.length; i++) {
    const transporte = transportesSemProprietario[i];
    const proprietario = proprietarios[i % proprietarios.length];

    // Create TransporteProprietario association
    await prisma.transporteProprietario.create({
      data: {
        codigoTransporte: transporte.codigo,
        idProprietario: proprietario.id,
        transporteId: transporte.id,
        proprietarioId: proprietario.id,
      }
    });

    atribuidos++;

    if ((i + 1) % 10 === 0) {
      console.log(`   Atribuídos ${i + 1}/${transportesSemProprietario.length} proprietários...`);
    }
  }

  console.log(`✅ ${atribuidos} proprietários atribuídos\n`);

  // Step 4: Final verification
  const transportesComProprietario = await prisma.transporte.findMany({
    where: {
      proprietarios: {
        some: {}
      }
    }
  });

  const transportesSemProprietarioFinal = await prisma.transporte.findMany({
    where: {
      proprietarios: {
        none: {}
      }
    }
  });

  console.log(`📊 Estado final:`);
  console.log(`   Total transportes: ${transportes.length}`);
  console.log(`   - Com proprietário: ${transportesComProprietario.length}`);
  console.log(`   - Sem proprietário: ${transportesSemProprietarioFinal.length}`);

  // Show distribution
  console.log(`\n📊 Distribuição por proprietário:`);
  for (const proprietario of proprietarios) {
    const count = await prisma.transporteProprietario.count({
      where: { proprietarioId: proprietario.id }
    });
    console.log(`   ${proprietario.nome}: ${count} transportes`);
  }

  if (transportesSemProprietarioFinal.length === 0) {
    console.log(`\n✅ Todos os transportes têm proprietário atribuído!`);
  } else {
    console.log(`\n⚠️  Ainda há ${transportesSemProprietarioFinal.length} transportes sem proprietário`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
