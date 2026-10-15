import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Count transportes with vias
    const transportesWithVia = await prisma.transporte.count({
      where: { viaId: { not: null } }
    });
    
    const totalTransportes = await prisma.transporte.count();
    
    console.log(`Total transportes in DB: ${totalTransportes}`);
    console.log(`Transportes with via: ${transportesWithVia}`);
    
    // Count transportes with locations
    const transportesWithLocation = await prisma.transporte.count({
      where: { currGeoLocation: { not: null } }
    });
    
    // Get sample transportes
    const sampleTransportes = await prisma.transporte.findMany({
      take: 10,
      orderBy: { codigo: 'asc' },
      include: {
        via: {
          select: {
            id: true,
            nome: true,
            codigo: true
          }
        }
      }
    });
    
    console.log(`Sample transportes fetched: ${sampleTransportes.length}`);
    
    // Count vias with transportes
    const viasWithTransportes = await prisma.via.count({
      where: {
        transportes: {
          some: {}
        }
      }
    });
    
    const totalVias = await prisma.via.count();
    
    return NextResponse.json({
      transportes: {
        total: totalTransportes,
        withVia: transportesWithVia,
        withLocation: transportesWithLocation,
        percentage: totalTransportes > 0 ? Math.round((transportesWithVia / totalTransportes) * 100) : 0
      },
      vias: {
        total: totalVias,
        withTransportes: viasWithTransportes,
        percentage: totalVias > 0 ? Math.round((viasWithTransportes / totalVias) * 100) : 0
      },
      samples: sampleTransportes.map(t => ({
        codigo: t.codigo,
        matricula: t.matricula,
        viaId: t.viaId,
        viaName: t.via?.nome || 'Not assigned',
        location: t.currGeoLocation
      })),
      needsAssignment: transportesWithVia === 0,
      debug: {
        totalInDb: totalTransportes,
        samplesFetched: sampleTransportes.length
      }
    });
    
  } catch (error) {
    console.error('Error checking assignments:', error);
    return NextResponse.json(
      { error: 'Failed to check assignments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
