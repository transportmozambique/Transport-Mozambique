import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('Fetching locations from database...');
    
    // Fetch all data needed for the selectors
    const municipios = await prisma.municipio.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });
    
    console.log('Municipios fetched:', municipios.length);

    const vias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        municipioId: true,
        terminalPartida: true,
        terminalChegada: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });
    
    console.log('Vias fetched:', vias.length);
    console.log('Sample vias:', JSON.stringify(vias.slice(0, 3), null, 2));
    
    // Group vias by municipioId for debugging
    const viasByMunicipio = vias.reduce((acc, via) => {
      if (!acc[via.municipioId]) {
        acc[via.municipioId] = [];
      }
      acc[via.municipioId].push(via.nome);
      return acc;
    }, {} as Record<string, string[]>);
    console.log('Vias grouped by municipio:', JSON.stringify(viasByMunicipio, null, 2));

    const paragens = await prisma.paragem.findMany({
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
    
    console.log('Paragens fetched:', paragens.length);
    console.log('Sample paragem:', JSON.stringify(paragens[0], null, 2));

    const response = {
      municipios,
      vias,
      paragens: paragens.map((p) => {
        const mapped = {
          id: p.id,
          nome: p.nome,
          codigo: p.codigo,
          geoLocation: p.geoLocation,
          viaIds: p.vias.map((v) => v.viaId),
        };
        console.log('Mapped paragem:', p.nome, '-> viaIds:', mapped.viaIds);
        return mapped;
      }),
    };
    
    console.log('Returning response with', response.municipios.length, 'municipios');

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
