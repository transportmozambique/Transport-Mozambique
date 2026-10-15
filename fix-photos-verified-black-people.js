const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// URLs verificadas de fotos de pessoas negras africanas
const fotosHomensNegros = [
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1484794/pexels-photo-1484794.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1212984/pexels-photo-1212984.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1438081/pexels-photo-1438081.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
];

const fotosMulheresNegras = [
  'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
  'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
];

async function fixPhotos() {
  try {
    console.log('=== CORRIGINDO FOTOS DOS MOTORISTAS ===\n');

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

    console.log('=== CORRIGINDO FOTOS DOS PROPRIETÁRIOS INDIVIDUAIS ===\n');

    // Update proprietarios individuais
    const proprietarios = await prisma.$queryRaw`
      SELECT id, nome
      FROM "Proprietario"
      WHERE "tipoProprietario" = 'Indivíduo'
      ORDER BY nome
    `;

    const fotosProprietarios = [
      'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1484794/pexels-photo-1484794.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
      'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop',
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
    console.log('\n✅ Todas as fotos agora são de pessoas negras africanas (Pexels)');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPhotos();
