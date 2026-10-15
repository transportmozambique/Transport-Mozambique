const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando proprietários...\n');

  // Check existing proprietários
  const proprietarios = await prisma.proprietario.findMany();
  console.log(`✓ Encontrados ${proprietarios.length} proprietários na base de dados`);

  if (proprietarios.length === 0) {
    console.log('\n📝 Criando proprietários predefinidos...\n');

    const defaultProprietarios = [
      {
        nome: 'Transportes Maputo Lda',
        telefone: '+258 84 123 4567',
        email: 'geral@transportesmaputo.co.mz',
      },
      {
        nome: 'Rodoviária da Matola',
        telefone: '+258 84 234 5678',
        email: 'info@rodoviaria-matola.co.mz',
      },
      {
        nome: 'Expresso Costa do Sol',
        telefone: '+258 84 345 6789',
        email: 'contacto@expressocostadosol.co.mz',
      },
      {
        nome: 'Transportes Machava',
        telefone: '+258 84 456 7890',
        email: 'admin@transportesmachava.co.mz',
      },
      {
        nome: 'Autocarro Sommerschield',
        telefone: '+258 84 567 8901',
        email: 'info@autocarrosommerschield.co.mz',
      },
    ];

    for (const prop of defaultProprietarios) {
      const created = await prisma.proprietario.create({
        data: prop,
      });
      console.log(`  ✓ Criado: ${created.nome}`);
    }

    console.log('\n✅ Proprietários criados com sucesso!');
  } else {
    console.log('\nProprietários existentes:');
    proprietarios.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.nome} - ${p.telefone}`);
    });
  }

  // Check how many buses have proprietários
  const transportes = await prisma.transporte.findMany({
    include: {
      proprietarios: {
        include: {
          proprietario: true,
        },
      },
    },
  });

  const transportesComProprietario = transportes.filter(
    (t) => t.proprietarios && t.proprietarios.length > 0
  );

  console.log(`\n📊 Estatísticas:`);
  console.log(`   Total de autocarros: ${transportes.length}`);
  console.log(`   Com proprietário: ${transportesComProprietario.length}`);
  console.log(`   Sem proprietário: ${transportes.length - transportesComProprietario.length}`);

  if (transportes.length - transportesComProprietario.length > 0) {
    console.log('\n⚠️  Alguns autocarros não têm proprietário atribuído!');
    console.log('   Execute: node assign-proprietarios.js');
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
