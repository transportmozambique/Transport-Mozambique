import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const municipioId = searchParams.get('municipioId');
    
    // If municipioId is provided, filter by it
    const whereClause = municipioId ? { municipioId: municipioId } : {};
    
    console.log('Fetching vias', municipioId ? `for municipio: ${municipioId}` : '(all)');
    
    const vias = await prisma.via.findMany({
      where: whereClause,
      select: {
        id: true,
        nome: true,
        codigo: true,
        cor: true,
        municipioId: true,
        terminalPartida: true,
        terminalChegada: true,
        geoLocationPath: true,
        municipio: {
          select: {
            nome: true,
          },
        },
        _count: {
          select: {
            paragens: true,
            transportes: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
    });
    
    // Transform the data to flatten municipio name
    const transformedVias = vias.map(via => ({
      ...via,
      municipio: via.municipio.nome,
    }));
    
    console.log('Vias found:', transformedVias.length);
    if (transformedVias.length > 0) {
      console.log('Sample via with counts:', JSON.stringify(transformedVias[0], null, 2));
    }

    const response = NextResponse.json(
      { vias: transformedVias },
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
    console.error('Error fetching vias:', error);
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
