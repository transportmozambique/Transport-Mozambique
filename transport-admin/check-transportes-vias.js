const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransportesVias() {
  try {
    const transportesWithVia = await prisma.transporte.count({ 
      where: { viaId: { not: null } } 
    });
    
    const totalTransportes = await prisma.transporte.count();
    
    const viasWithTransportes = await prisma.via.count({
      where: {
        transportes: {
          some: {}
        }
      }
    });
    
    const totalVias = await prisma.via.count();
    
    console.log('📊 Transportes and Vias Status:');
    console.log(`  Transportes with via: ${transportesWithVia}/${totalTransportes}`);
    console.log(`  Vias with transportes: ${viasWithTransportes}/${totalVias}`);
    console.log('');
    
    if (viasWithTransportes === 0) {
      console.log('⚠️  NO VIAS HAVE TRANSPORTES ASSIGNED!');
      console.log('   This is why vias are not showing on the dashboard map.');
      console.log('   The dashboard only shows vias that have at least one transporte.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransportesVias();
