const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSystemState() {
  try {
    console.log('📊 Checking system state...\n');

    const transportes = await prisma.transporte.findMany({
      include: {
        via: true
      }
    });
    
    const vias = await prisma.via.findMany({
      include: {
        _count: {
          select: {
            transportes: true
          }
        }
      }
    });

    console.log('Transportes:', transportes.length);
    console.log('Vias:', vias.length);
    console.log('Transportes without via:', transportes.filter(t => !t.via).length);
    console.log('Vias without transportes:', vias.filter(v => v._count.transportes === 0).length);
    
    // Show transportes without vias
    const transportesWithoutVia = transportes.filter(t => !t.via);
    if (transportesWithoutVia.length > 0) {
      console.log('\n⚠️  Transportes without via:');
      transportesWithoutVia.slice(0, 10).forEach(t => {
        console.log(`   - ${t.matricula} (${t.codigo})`);
      });
      if (transportesWithoutVia.length > 10) {
        console.log(`   ... and ${transportesWithoutVia.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSystemState();
