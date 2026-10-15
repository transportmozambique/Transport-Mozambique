const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignTransportesToVias() {
  try {
    console.log('🚀 Assigning transportes to vias...\n');
    
    // Get all vias with their paths
    const vias = await prisma.via.findMany({
      orderBy: { codigo: 'asc' }
    });
    
    // Get all transportes
    const transportes = await prisma.transporte.findMany({
      orderBy: { codigo: 'asc' }
    });
    
    console.log(`📊 Found ${vias.length} vias and ${transportes.length} transportes\n`);
    
    if (vias.length === 0) {
      console.log('❌ No vias found!');
      return;
    }
    
    if (transportes.length === 0) {
      console.log('❌ No transportes found!');
      return;
    }
    
    // Distribute transportes evenly across vias
    let assignedCount = 0;
    let updatedCount = 0;
    
    for (let i = 0; i < transportes.length; i++) {
      const transporte = transportes[i];
      const via = vias[i % vias.length]; // Cycle through vias
      
      // Get the start point of the via (first coordinate)
      const pathPoints = via.geoLocationPath.split(';');
      if (pathPoints.length === 0) {
        console.log(`⚠️  Via ${via.nome} has no path points, skipping...`);
        continue;
      }
      
      const startPoint = pathPoints[0]; // Format: "lng,lat"
      const [lng, lat] = startPoint.split(',').map(parseFloat);
      
      if (isNaN(lng) || isNaN(lat)) {
        console.log(`⚠️  Via ${via.nome} has invalid start coordinates, skipping...`);
        continue;
      }
      
      // Format: "lat,lng" for currGeoLocation (reversed from path format)
      const currGeoLocation = `${lat},${lng}`;
      
      // Update transporte with via and location
      await prisma.transporte.update({
        where: { id: transporte.id },
        data: {
          viaId: via.id,
          codigoVia: via.codigo,
          currGeoLocation: currGeoLocation
        }
      });
      
      assignedCount++;
      updatedCount++;
      
      if (assignedCount % 10 === 0) {
        console.log(`✅ Assigned ${assignedCount}/${transportes.length} transportes...`);
      }
    }
    
    console.log(`\n✅ Assignment complete!\n`);
    
    // Show distribution
    const viasWithCounts = await prisma.via.findMany({
      include: {
        _count: {
          select: { transportes: true }
        }
      },
      orderBy: { codigo: 'asc' }
    });
    
    console.log('📊 Distribution Summary:\n');
    
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } }
    });
    
    const maputoVias = viasWithCounts.filter(v => v.municipioId === maputo?.id);
    const matolaVias = viasWithCounts.filter(v => v.municipioId === matola?.id);
    
    const maputoTransportes = maputoVias.reduce((sum, v) => sum + v._count.transportes, 0);
    const matolaTransportes = matolaVias.reduce((sum, v) => sum + v._count.transportes, 0);
    
    console.log(`Maputo:`);
    console.log(`  Vias: ${maputoVias.length}`);
    console.log(`  Transportes: ${maputoTransportes}`);
    console.log(`  Avg per via: ${(maputoTransportes / maputoVias.length).toFixed(1)}`);
    console.log('');
    
    console.log(`Matola:`);
    console.log(`  Vias: ${matolaVias.length}`);
    console.log(`  Transportes: ${matolaTransportes}`);
    console.log(`  Avg per via: ${(matolaTransportes / matolaVias.length).toFixed(1)}`);
    console.log('');
    
    console.log(`Total:`);
    console.log(`  Vias: ${vias.length}`);
    console.log(`  Transportes assigned: ${assignedCount}`);
    console.log(`  Avg per via: ${(assignedCount / vias.length).toFixed(1)}`);
    console.log('');
    
    // Show top 5 vias with most transportes
    const topVias = viasWithCounts
      .sort((a, b) => b._count.transportes - a._count.transportes)
      .slice(0, 5);
    
    console.log('🏆 Top 5 Vias with Most Transportes:\n');
    topVias.forEach((via, index) => {
      console.log(`  ${index + 1}. ${via.nome}: ${via._count.transportes} transportes`);
    });
    console.log('');
    
    // Verify all transportes have locations
    const transportesWithoutLocation = await prisma.transporte.count({
      where: { currGeoLocation: null }
    });
    
    const transportesWithVia = await prisma.transporte.count({
      where: { viaId: { not: null } }
    });
    
    console.log('✅ Verification:\n');
    console.log(`  Transportes with via: ${transportesWithVia}/${transportes.length}`);
    console.log(`  Transportes with location: ${transportes.length - transportesWithoutLocation}/${transportes.length}`);
    console.log('');
    
    if (transportesWithVia === transportes.length && transportesWithoutLocation === 0) {
      console.log('🎉 SUCCESS! All transportes assigned to vias with start locations!');
    } else {
      console.log('⚠️  Some transportes may not have been assigned properly.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

assignTransportesToVias();
