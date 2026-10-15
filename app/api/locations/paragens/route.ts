import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viaId = searchParams.get('viaId');

    console.log('Fetching paragens for via:', viaId || 'all');

    // Build where clause based on whether viaId is provided
    const whereClause = viaId ? {
      vias: {
        some: {
          viaId: viaId,
        },
      },
    } : {};

    const paragens = await prisma.paragem.findMany({
      where: whereClause,
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true,
        vias: {
          select: {
            viaId: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
    });
    
    console.log('Paragens found:', paragens.length);

    const paragensFormatted = paragens.map((p) => ({
      id: p.id,
      nome: p.nome,
      codigo: p.codigo,
      geoLocation: p.geoLocation,
      viaIds: p.vias.map((v) => v.viaId),
    }));

    const response = NextResponse.json(
      { paragens: paragensFormatted },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('Error fetching paragens:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
