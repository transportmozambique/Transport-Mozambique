const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssociations() {
  try {
    const testParagens = await prisma.paragem.findMany({
      where: {
        OR: [
          { nome: { contains: 'test', mode: 'insensitive' } }
        ]
      },
      include: {
        vias: {
          include: {
            via: {
              select: {
                nome: true,
                codigo: true
              }
            }
          }
        },
        missoes: true,
        _count: {
          select: {
            vias: true,
            missoes: true
          }
        }
      }
    });

    console.log('\n=== Verificando Associações das Paragens Test ===\n');
    
    for (const paragem of testParagens) {
      console.log(`Paragem: ${paragem.nome} (${paragem.codigo})`);
      console.log(`ID: ${paragem.id}`);
      console.log(`Vias associadas: ${paragem._count.vias}`);
      console.log(`Missões associadas: ${paragem._count.missoes}`);
      
      if (paragem.vias.length > 0) {
        console.log('Vias:');
        paragem.vias.forEach(v => {
          console.log(`  - ${v.via.nome} (${v.via.codigo})`);
        });
      }
      
      console.log('---\n');
    }

    // Try to delete one manually
    console.log('Tentando deletar manualmente...');
    const firstTest = testParagens[0];
    if (firstTest) {
      try {
        await prisma.paragem.delete({
          where: { id: firstTest.id }
        });
        console.log(`✓ Paragem "${firstTest.nome}" deletada com sucesso!`);
      } catch (error) {
        console.log(`✗ Erro ao deletar "${firstTest.nome}":`);
        console.log(`  Código: ${error.code}`);
        console.log(`  Mensagem: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssociations();
