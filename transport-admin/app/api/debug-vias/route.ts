import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get first 3 vias with their geoLocationPath
    const vias = await prisma.via.findMany({
      take: 3,
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocationPath: true,
        cor: true,
      },
    });

    // Parse and analyze the data
    const analysis = vias.map(via => {
      let coordinates: Array<{ lng: number; lat: number }> = [];
      let error = null;
      
      try {
        if (via.geoLocationPath) {
          coordinates = via.geoLocationPath.split(';').map(point => {
            const [lng, lat] = point.trim().split(',').map(Number);
            return { lng, lat };
          });
        }
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error';
      }

      return {
        id: via.id,
        nome: via.nome,
        codigo: via.codigo,
        cor: via.cor,
        hasGeoPath: !!via.geoLocationPath,
        geoPathLength: via.geoLocationPath?.length || 0,
        geoPathSample: via.geoLocationPath?.substring(0, 200) || null,
        coordinatesCount: coordinates.length,
        firstCoordinate: coordinates[0] || null,
        lastCoordinate: coordinates[coordinates.length - 1] || null,
        error,
      };
    });

    return NextResponse.json({
      totalVias: await prisma.via.count(),
      viasWithGeoPath: await prisma.via.count({
        where: {
          geoLocationPath: {
            not: null as any,
          },
        },
      }),
      samples: analysis,
    });
  } catch (error) {
    console.error('Error in debug-vias:', error);
    return NextResponse.json(
      { error: 'Failed to debug vias', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
