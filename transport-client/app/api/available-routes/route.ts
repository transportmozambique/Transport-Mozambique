import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API to get only routes and stops that have buses available
 * This ensures selectors only show options where buses actually exist
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const municipioId = searchParams.get('municipioId');
    const viaId = searchParams.get('viaId');

    // Get all municipios that have vias with buses
    const municipiosWithBuses = await prisma.municipio.findMany({
      where: {
        vias: {
          some: {
            transportes: {
              some: {}
            }
          }
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true
      }
    });

    // If no municipio selected, return just municipios
    if (!municipioId) {
      return NextResponse.json({
        municipios: municipiosWithBuses,
        vias: [],
        paragens: []
      });
    }

    // Get vias for selected municipio that have buses
    const viasWithBuses = await prisma.via.findMany({
      where: {
        municipioId: municipioId,
        transportes: {
          some: {}
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        municipioId: true,
        terminalPartida: true,
        terminalChegada: true
      }
    });

    // If no via selected, return municipios + vias
    if (!viaId) {
      return NextResponse.json({
        municipios: municipiosWithBuses,
        vias: viasWithBuses,
        paragens: []
      });
    }

    // Get all vias for the same route (same terminalPartida → terminalChegada)
    const selectedVia = viasWithBuses.find(v => v.id === viaId);
    if (!selectedVia) {
      return NextResponse.json({
        municipios: municipiosWithBuses,
        vias: viasWithBuses,
        paragens: []
      });
    }

    const viasForRoute = viasWithBuses.filter(
      v => v.terminalPartida === selectedVia.terminalPartida && 
           v.terminalChegada === selectedVia.terminalChegada
    );
    const viaIdsForRoute = viasForRoute.map(v => v.id);

    // Get paragens that belong to these vias AND have buses passing through
    const paragensWithBuses = await prisma.paragem.findMany({
      where: {
        vias: {
          some: {
            viaId: {
              in: viaIdsForRoute
            }
          }
        }
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true,
        vias: {
          where: {
            viaId: {
              in: viaIdsForRoute
            }
          },
          select: {
            viaId: true,
            id: true, // This gives us the order
            via: {
              select: {
                id: true,
                paragens: {
                  select: {
                    id: true,
                    paragemId: true
                  },
                  orderBy: {
                    id: 'asc'
                  }
                }
              }
            }
          }
        }
      }
    });

    // Format paragens with viaIds array and order information
    const formattedParagens = paragensWithBuses.map(p => {
      // Calculate the minimum order index across all vias
      const orderInfo = p.vias.map(vp => {
        const orderIndex = vp.via.paragens.findIndex(viaParagem => viaParagem.paragemId === p.id);
        return {
          viaId: vp.viaId,
          order: orderIndex
        };
      });

      return {
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        geoLocation: p.geoLocation,
        viaIds: p.vias.map(vp => vp.viaId),
        orderByVia: orderInfo.reduce((acc, info) => {
          acc[info.viaId] = info.order;
          return acc;
        }, {} as Record<string, number>)
      };
    });

    return NextResponse.json({
      municipios: municipiosWithBuses,
      vias: viasWithBuses,
      paragens: formattedParagens
    });

  } catch (error: any) {
    console.error('❌ Error fetching available routes:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
