const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkParagens() {
  try {
    // Check for test and test1
    const testParagens = await prisma.paragem.findMany({
      where: {
        OR: [
          { nome: { contains: 'test', mode: 'insensitive' } },
          { nome: { contains: 'test1', mode: 'insensitive' } }
        ]
      }
    });

    console.log('\n=== Paragens com "test" no nome ===');
    if (testParagens.length === 0) {
      console.log('✓ Nenhuma paragem "test" ou "test1" encontrada - foram deletadas com sucesso!');
    } else {
      console.log(`✗ Encontradas ${testParagens.length} paragens:`);
      testParagens.forEach(p => {
        console.log(`  - ID: ${p.id}`);
        console.log(`    Nome: ${p.nome}`);
        console.log(`    Código: ${p.codigo}`);
        console.log('');
      });
    }

    // Total count
    const total = await prisma.paragem.count();
    console.log(`\nTotal de paragens no sistema: ${total}`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkParagens();
