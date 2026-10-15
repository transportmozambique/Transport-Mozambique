const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando seed de proprietários...\n');

  // Criar proprietários com dados que correspondem ao schema
  const proprietarios = [
    {
      nome: 'Transportes Maputo Lda',
      bi: '110000000001A',
      nacionalidade: 'Moçambicana',
      birthDate: new Date('1990-01-01'),
      endereco: 'Av. Julius Nyerere, Maputo',
      contacto1: 842345678,
      contacto2: 843456789,
    },
    {
      nome: 'Rodoviária da Matola',
      bi: '110000000002B',
      nacionalidade: 'Moçambicana',
      birthDate: new Date('1985-05-15'),
      endereco: 'Av. da Independência, Matola',
      contacto1: 845678901,
      contacto2: 846789012,
    },
    {
      nome: 'Expresso Costa do Sol',
      bi: '110000000003C',
      nacionalidade: 'Moçambicana',
      birthDate: new Date('1988-08-20'),
      endereco: 'Av. Marginal, Maputo',
      contacto1: 847890123,
      contacto2: 848901234,
    },
    {
      nome: 'Transportes Machava',
      bi: '110000000004D',
      nacionalidade: 'Moçambicana',
      birthDate: new Date('1992-03-10'),
      endereco: 'Estrada Nacional N4, Machava',
      contacto1: 849012345,
      contacto2: 840123456,
    },
    {
      nome: 'Autocarro Sommerschield',
      bi: '110000000005E',
      nacionalidade: 'Moçambicana',
      birthDate: new Date('1987-11-25'),
      endereco: 'Av. Mao Tse Tung, Maputo',
      contacto1: 841234567,
      contacto2: 842345678,
    },
  ];

  console.log('📝 Criando proprietários...\n');
  
  const createdProprietarios = [];
  for (const prop of proprietarios) {
    try {
      // Verificar se já existe
      const existing = await prisma.proprietario.findUnique({
        where: { bi: prop.bi }
      });

      if (existing) {
        console.log(`  ⚠️  Já existe: ${prop.nome}`);
        createdProprietarios.push(existing);
      } else {
        const created = await prisma.proprietario.create({
          data: prop,
        });
        console.log(`  ✓ Criado: ${created.nome}`);
        createdProprietarios.push(created);
      }
    } catch (error) {
      console.error(`  ❌ Erro ao criar ${prop.nome}:`, error.message);
    }
  }

  console.log(`\n✅ ${createdProprietarios.length} proprietários disponíveis\n`);

  // Atribuir proprietários aos transportes
  console.log('🚌 Atribuindo proprietários aos transportes...\n');

  const transportes = await prisma.transporte.findMany({
    include: {
      proprietarios: true,
    },
  });

  console.log(`📊 Total de transportes: ${transportes.length}\n`);

  let assigned = 0;
  let alreadyAssigned = 0;

  for (let i = 0; i < transportes.length; i++) {
    const transporte = transportes[i];
    
    // Verificar se já tem proprietário
    if (transporte.proprietarios && transporte.proprietarios.length > 0) {
      alreadyAssigned++;
      continue;
    }

    // Distribuir proprietários de forma circular
    const proprietario = createdProprietarios[i % createdProprietarios.length];

    try {
      await prisma.transporteProprietario.create({
        data: {
          codigoTransporte: transporte.codigo,
          idProprietario: proprietario.id,
          transporteId: transporte.id,
          proprietarioId: proprietario.id,
        },
      });

      console.log(`  ✓ ${transporte.matricula} → ${proprietario.nome}`);
      assigned++;
    } catch (error) {
      console.error(`  ❌ Erro ao atribuir ${transporte.matricula}:`, error.message);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✓ Atribuídos agora: ${assigned}`);
  console.log(`   ⚠️  Já tinham proprietário: ${alreadyAssigned}`);
  console.log(`   📦 Total: ${transportes.length}`);
  console.log(`\n✅ Processo concluído!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
