const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMotoristas() {
  try {
    console.log('Checking motoristas in database...\n');

    const total = await prisma.motorista.count();
    console.log(`Total motoristas: ${total}`);

    if (total === 0) {
      console.log('\n⚠️  No motoristas found in database!');
      console.log('\nTo create motoristas, you can:');
      console.log('1. Use the admin panel: /motoristas/novo');
      console.log('2. Run a seed script to create sample motoristas');
      console.log('3. Import motoristas from a CSV file');
    } else {
      console.log('\n✅ Motoristas found! Listing first 10:\n');
      
      const motoristas = await prisma.motorista.findMany({
        take: 10,
        include: {
          transporte: {
            select: {
              matricula: true,
            },
          },
        },
        orderBy: {
          nome: 'asc',
        },
      });

      motoristas.forEach((m, index) => {
        console.log(`${index + 1}. ${m.nome} (BI: ${m.bi})`);
        console.log(`   Status: ${m.status}`);
        console.log(`   Transporte: ${m.transporte ? m.transporte.matricula : 'Nenhum'}`);
        console.log(`   Telefone: ${m.telefone || 'N/A'}`);
        console.log('');
      });

      // Count by status
      const ativos = await prisma.motorista.count({ where: { status: 'ativo' } });
      const inativos = await prisma.motorista.count({ where: { status: 'inativo' } });
      const comTransporte = await prisma.motorista.count({ where: { transporteId: { not: null } } });

      console.log('\n📊 Statistics:');
      console.log(`   Ativos: ${ativos}`);
      console.log(`   Inativos: ${inativos}`);
      console.log(`   Com Transporte: ${comTransporte}`);
      console.log(`   Sem Transporte: ${total - comTransporte}`);
    }

  } catch (error) {
    console.error('Error checking motoristas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMotoristas();
