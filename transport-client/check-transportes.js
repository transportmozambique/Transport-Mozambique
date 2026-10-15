const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransportes() {
  try {
    const transportes = await prisma.transporte.count();
    const vias = await prisma.via.count();
    const viasComTransportes = await prisma.via.count({
      where: {
        transportes: {
          some: {}
        }
      }
    });
    
    console.log('📊 Estatísticas:');
    console.log('  Total transportes:', transportes);
    console.log('  Total vias:', vias);
    console.log('  Vias com transportes:', viasComTransportes);
    console.log('  Vias SEM transportes:', vias - viasComTransportes);
    console.log('');
    
    // Get sample vias without transportes
    const viasSemTransportes = await prisma.via.findMany({
      where: {
        transportes: {
          none: {}
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
      take: 10,
    });
    
    console.log('📋 Vias SEM transportes (primeiras 10):');
    viasSemTransportes.forEach(via => {
      console.log(`  - ${via.nome} (${via.codigo})`);
    });
    console.log('');
    
    // Get sample vias with transportes
    const viasComTransportesData = await prisma.via.findMany({
      where: {
        transportes: {
          some: {}
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        _count: {
          select: {
            transportes: true
          }
        }
      },
      take: 10,
    });
    
    console.log('🚌 Vias COM transportes (primeiras 10):');
    viasComTransportesData.forEach(via => {
      console.log(`  - ${via.nome} (${via.codigo}) - ${via._count.transportes} transporte(s)`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransportes();
