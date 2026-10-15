const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTransportes() {
  try {
    console.log('Checking transportes in database...\n');

    const total = await prisma.transporte.count();
    console.log(`Total transportes: ${total}`);

    if (total === 0) {
      console.log('\n⚠️  No transportes found in database!');
    } else {
      console.log('\n✅ Transportes found! Listing first 10:\n');
      
      const transportes = await prisma.transporte.findMany({
        take: 10,
        include: {
          via: {
            select: {
              nome: true,
            },
          },
          motorista: {
            select: {
              nome: true,
            },
          },
        },
        orderBy: {
          matricula: 'asc',
        },
      });

      transportes.forEach((t, index) => {
        console.log(`${index + 1}. ${t.matricula} - ${t.modelo} ${t.marca}`);
        console.log(`   Via: ${t.via ? t.via.nome : 'Nenhuma'}`);
        console.log(`   Motorista: ${t.motorista ? t.motorista.nome : 'Nenhum'}`);
        console.log('');
      });

      // Count by status
      const comVia = await prisma.transporte.count({ where: { viaId: { not: null } } });
      const comMotorista = await prisma.transporte.count({ where: { motoristaId: { not: null } } });

      console.log('\n📊 Statistics:');
      console.log(`   Total: ${total}`);
      console.log(`   Com Via: ${comVia}`);
      console.log(`   Sem Via: ${total - comVia}`);
      console.log(`   Com Motorista: ${comMotorista}`);
      console.log(`   Sem Motorista: ${total - comMotorista}`);
    }

  } catch (error) {
    console.error('Error checking transportes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransportes();
