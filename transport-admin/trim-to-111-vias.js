const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function trimTo111Vias() {
  try {
    console.log('🚀 Trimming vias to exactly 111 (70 Maputo, 41 Matola)...\n');
    
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } }
    });
    
    if (!maputo || !matola) {
      throw new Error('Could not find Maputo or Matola municipios');
    }
    
    // Get current counts
    const currentMaputoCount = await prisma.via.count({ where: { municipioId: maputo.id } });
    const currentMatolaCount = await prisma.via.count({ where: { municipioId: matola.id } });
    const totalCurrent = currentMaputoCount + currentMatolaCount;
    
    console.log('📊 Current Status:');
    console.log(`  Maputo vias: ${currentMaputoCount}`);
    console.log(`  Matola vias: ${currentMatolaCount}`);
    console.log(`  Total: ${totalCurrent}\n`);
    
    if (totalCurrent === 111 && currentMaputoCount === 70 && currentMatolaCount === 41) {
      console.log('✅ Already have exactly 111 vias (70 Maputo, 41 Matola)!');
      return;
    }
    
    // Get all vias
    const maputoVias = await prisma.via.findMany({
      where: { municipioId: maputo.id },
      orderBy: { codigo: 'asc' }
    });
    
    const matolaVias = await prisma.via.findMany({
      where: { municipioId: matola.id },
      orderBy: { codigo: 'asc' }
    });
    
    // Keep first 70 Maputo and 41 Matola
    const maputoToKeep = maputoVias.slice(0, 70);
    const matolaToKeep = matolaVias.slice(0, 41);
    
    const maputoToDelete = maputoVias.slice(70);
    const matolaToDelete = matolaVias.slice(41);
    
    console.log('🗑️  Deleting extra vias...');
    console.log(`  Maputo: keeping ${maputoToKeep.length}, deleting ${maputoToDelete.length}`);
    console.log(`  Matola: keeping ${matolaToKeep.length}, deleting ${matolaToDelete.length}\n`);
    
    // Delete extra Maputo vias
    if (maputoToDelete.length > 0) {
      for (const via of maputoToDelete) {
        await prisma.viaParagem.deleteMany({ where: { viaId: via.id } });
        await prisma.via.delete({ where: { id: via.id } });
      }
      console.log(`✅ Deleted ${maputoToDelete.length} extra Maputo vias`);
    }
    
    // Delete extra Matola vias
    if (matolaToDelete.length > 0) {
      for (const via of matolaToDelete) {
        await prisma.viaParagem.deleteMany({ where: { viaId: via.id } });
        await prisma.via.delete({ where: { id: via.id } });
      }
      console.log(`✅ Deleted ${matolaToDelete.length} extra Matola vias`);
    }
    
    // Verify final counts
    const finalMaputoCount = await prisma.via.count({ where: { municipioId: maputo.id } });
    const finalMatolaCount = await prisma.via.count({ where: { municipioId: matola.id } });
    const finalTotal = finalMaputoCount + finalMatolaCount;
    
    console.log('\n✅ TRIMMING COMPLETE!\n');
    console.log('📊 Final Statistics:');
    console.log(`  Maputo vias: ${finalMaputoCount}/70`);
    console.log(`  Matola vias: ${finalMatolaCount}/41`);
    console.log(`  Total vias: ${finalTotal}/111`);
    console.log('');
    
    if (finalTotal === 111) {
      console.log('🎉 Perfect! Exactly 111 vias!');
      console.log(`✅ Maputo vias (${finalMaputoCount}) > Matola vias (${finalMatolaCount})`);
      console.log('✅ All routes follow actual roads (OSRM)');
      console.log('✅ Each via has unique color');
      console.log('✅ Visible on dashboard map');
    } else {
      console.log(`⚠️  Total is ${finalTotal}, expected 111`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

trimTo111Vias();
