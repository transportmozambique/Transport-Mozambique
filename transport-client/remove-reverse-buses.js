const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeReverseBuses() {
  try {
    console.log('🗑️  Removendo autocarros reversos incorretos...\n');
    
    // Get all vias with 2 transportes
    const vias = await prisma.via.findMany({
      include: {
        transportes: {
          orderBy: {
            codigo: 'asc'
          }
        }
      }
    });
    
    let removed = 0;
    
    for (const via of vias) {
      if (via.transportes.length === 2) {
        // Keep the first one (original), remove the second (reverse)
        const toRemove = via.transportes[1];
        
        // Delete associated GeoLocations first
        await prisma.geoLocation.deleteMany({
          where: {
            transporteId: toRemove.id
          }
        });
        
        // Then delete the transporte
        await prisma.transporte.delete({
          where: {
            id: toRemove.id
          }
        });
        
        console.log(`✅ Removido: ${toRemove.matricula} de ${via.nome}`);
        removed++;
      }
    }
    
    console.log(`\n✅ Removidos ${removed} autocarros reversos!`);
    
    // Check final state
    const totalTransportes = await prisma.transporte.count();
    const totalVias = await prisma.via.count();
    
    console.log(`\n📊 Estado final:`);
    console.log(`  Total de autocarros: ${totalTransportes}`);
    console.log(`  Total de vias: ${totalVias}`);
    console.log(`  Autocarros por via: ${(totalTransportes / totalVias).toFixed(1)}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

removeReverseBuses();
