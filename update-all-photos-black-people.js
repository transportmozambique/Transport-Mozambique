const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Fotos de pessoas negras africanas (Unsplash - alta qualidade)
const fotosHomensNegros = [
  'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1619194617062-5a83b8580c10?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1603415526960-f7e0328c63b1?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1590086782792-42dd2350140d?w=400&h=400&fit=crop&crop=faces',
];

const fotosMulheresNegras = [
  'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1595956825652-c8d0b3a3e1d7?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400&h=400&fit=crop&crop=faces',
];

async function updateAllPhotos() {
  try {
    console.log('=== ATUALIZANDO FOTOS DOS MOTORISTAS ===\n');

    // Get all motoristas
    const motoristas = await prisma.motorista.findMany({
      orderBy: { nome: 'asc' }
    });

    let homemIndex = 0;
    let mulherIndex = 0;

    for (const motorista of motoristas) {
      let foto;
      if (motorista.genero === 'Feminino') {
        foto = fotosMulheresNegras[mulherIndex % fotosMulheresNegras.length];
        mulherIndex++;
      } else {
        foto = fotosHomensNegros[homemIndex % fotosHomensNegros.length];
        homemIndex++;
      }

      await prisma.$executeRaw`
        UPDATE "Motorista"
        SET foto = ${foto}
        WHERE id = ${motorista.id}
      `;

      console.log(`✓ ${motorista.nome} (${motorista.genero})`);
    }

    console.log(`\n✅ ${motoristas.length} motoristas atualizados\n`);

    console.log('=== ATUALIZANDO FOTOS DOS PROPRIETÁRIOS INDIVIDUAIS ===\n');

    // Update proprietarios individuais
    const proprietarios = await prisma.$queryRaw`
      SELECT id, nome
      FROM "Proprietario"
      WHERE "tipoProprietario" = 'Indivíduo'
      ORDER BY nome
    `;

    const fotosProprietarios = [
      'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=400&h=400&fit=crop&crop=faces',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
    ];

    for (let i = 0; i < proprietarios.length; i++) {
      const prop = proprietarios[i];
      const foto = fotosProprietarios[i % fotosProprietarios.length];

      await prisma.$executeRaw`
        UPDATE "Proprietario"
        SET foto = ${foto}
        WHERE id = ${prop.id}
      `;

      console.log(`✓ ${prop.nome}`);
    }

    console.log(`\n✅ ${proprietarios.length} proprietários individuais atualizados\n`);

    console.log('=== TOTAIS FINAIS ===');
    console.log(`Motoristas: ${motoristas.length}`);
    console.log(`Proprietários Individuais: ${proprietarios.length}`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllPhotos();
