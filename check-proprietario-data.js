const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProprietarioData() {
  try {
    // Get first proprietario with transportes
    const proprietario = await prisma.proprietario.findFirst({
      include: {
        transportes: {
          include: {
            transporte: {
              select: {
                id: true,
                matricula: true,
                modelo: true,
                marca: true,
                via: {
                  select: {
                    nome: true,
                    codigo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (proprietario) {
      console.log('\n=== PROPRIETÁRIO ENCONTRADO ===');
      console.log('ID:', proprietario.id);
      console.log('Nome:', proprietario.nome);
      console.log('BI:', proprietario.bi);
      console.log('Nacionalidade:', proprietario.nacionalidade);
      console.log('Data Nascimento:', proprietario.birthDate);
      console.log('Endereço:', proprietario.endereco);
      console.log('Contacto1:', proprietario.contacto1);
      console.log('Contacto2:', proprietario.contacto2);
      console.log('Transportes:', proprietario.transportes.length);
      console.log('Created At:', proprietario.createdAt);
      console.log('\nDados completos:', JSON.stringify(proprietario, null, 2));
    } else {
      console.log('Nenhum proprietário encontrado no banco de dados');
    }

    // Count total
    const total = await prisma.proprietario.count();
    console.log('\n=== TOTAL DE PROPRIETÁRIOS ===');
    console.log('Total:', total);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProprietarioData();
