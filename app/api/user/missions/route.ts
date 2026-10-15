import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const utenteId = searchParams.get('utenteId');

    if (!utenteId) {
      return NextResponse.json(
        { error: 'ID do utente é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar missões do utente
    const missoes = await prisma.mISSION.findMany({
      where: { utenteId },
      include: {
        paragem: {
          include: {
            vias: {
              include: {
                via: {
                  include: {
                    transportes: {
                      take: 1, // Get first transport on this via
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format missions with transport info
    const missoesFormatted = missoes.map((missao) => {
      // Get first transport from first via that has transports
      let transporteId = null;
      for (const viaParagem of missao.paragem.vias) {
        if (viaParagem.via.transportes.length > 0) {
          transporteId = viaParagem.via.transportes[0].id;
          break;
        }
      }

      return {
        id: missao.id,
        mISSIONUtente: missao.mISSIONUtente,
        geoLocationUtente: missao.geoLocationUtente,
        geoLocationParagem: missao.geoLocationParagem,
        createdAt: missao.createdAt,
        paragem: {
          nome: missao.paragem.nome,
          codigo: missao.paragem.codigo,
          geoLocation: missao.paragem.geoLocation,
        },
        transporteId: transporteId, // Add transport ID
      };
    });

    return NextResponse.json({ missoes: missoesFormatted });
  } catch (error) {
    console.error('Erro ao buscar missões:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar missões' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
