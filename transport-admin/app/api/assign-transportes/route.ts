import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🚀 Assigning transportes to vias...');
    
    // Get all vias with their paths
    const vias = await prisma.via.findMany({
      orderBy: { codigo: 'asc' }
    });
    
    // Get all transportes
    const transportes = await prisma.transporte.findMany({
      orderBy: { codigo: 'asc' }
    });
    
    console.log(`📊 Found ${vias.length} vias and ${transportes.length} transportes`);
    
    if (vias.length === 0) {
      return NextResponse.json({ error: 'No vias found' }, { status: 400 });
    }
    
    if (transportes.length === 0) {
      return NextResponse.json({ error: 'No transportes found' }, { status: 400 });
    }
    
    // Distribute transportes evenly across vias
    let assignedCount = 0;
    const updates = [];
    
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
      updates.push({
        transporte: transporte.codigo,
        via: via.nome,
        location: currGeoLocation
      });
    }
    
    // Get distribution stats
    const viasWithCounts = await prisma.via.findMany({
      include: {
        _count: {
          select: { transportes: true }
        }
      },
      orderBy: { codigo: 'asc' }
    });
    
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
    
    // Get top 5 vias
    const topVias = viasWithCounts
      .sort((a, b) => b._count.transportes - a._count.transportes)
      .slice(0, 5)
      .map(v => ({
        name: v.nome,
        count: v._count.transportes
      }));
    
    // Verify
    const transportesWithVia = await prisma.transporte.count({
      where: { viaId: { not: null } }
    });
    
    const transportesWithLocation = await prisma.transporte.count({
      where: { currGeoLocation: { not: null } }
    });
    
    return NextResponse.json({
      success: true,
      message: 'All transportes assigned to vias successfully!',
      stats: {
        totalVias: vias.length,
        totalTransportes: transportes.length,
        assigned: assignedCount,
        avgPerVia: (assignedCount / vias.length).toFixed(1),
        maputo: {
          vias: maputoVias.length,
          transportes: maputoTransportes,
          avgPerVia: (maputoTransportes / maputoVias.length).toFixed(1)
        },
        matola: {
          vias: matolaVias.length,
          transportes: matolaTransportes,
          avgPerVia: (matolaTransportes / matolaVias.length).toFixed(1)
        },
        topVias,
        verification: {
          transportesWithVia,
          transportesWithLocation,
          allAssigned: transportesWithVia === transportes.length,
          allHaveLocation: transportesWithLocation === transportes.length
        }
      }
    });
    
  } catch (error) {
    console.error('Error assigning transportes:', error);
    return NextResponse.json(
      { error: 'Failed to assign transportes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
