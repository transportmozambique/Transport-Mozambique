import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { utenteId, transporteId, paragemId } = body;

    if (!utenteId || !transporteId || !paragemId) {
      return NextResponse.json(
        { error: 'utenteId, transporteId e paragemId são obrigatórios' },
        { status: 400 }
      );
    }

    // Get utente data to get mISSION code
    const utente = await prisma.utente.findUnique({
      where: { id: utenteId },
    });

    if (!utente) {
      return NextResponse.json(
        { error: 'Utente não encontrado' },
        { status: 404 }
      );
    }

    // Get paragem data
    const paragem = await prisma.paragem.findUnique({
      where: { id: paragemId },
    });

    if (!paragem) {
      return NextResponse.json(
        { error: 'Paragem não encontrada' },
        { status: 404 }
      );
    }

    // Check if mission already exists for this user and stop
    const existingMission = await prisma.mISSION.findFirst({
      where: {
        utenteId: utenteId,
        paragemId: paragemId,
      },
    });

    if (existingMission) {
      return NextResponse.json({
        message: 'Transporte já está nos seus favoritos',
        missao: existingMission,
      });
    }

    // Create new mission
    const missao = await prisma.mISSION.create({
      data: {
        mISSIONUtente: utente.mISSION,
        codigoParagem: paragem.codigo,
        geoLocationUtente: utente.geoLocation || '',
        geoLocationParagem: paragem.geoLocation,
        utenteId: utenteId,
        paragemId: paragemId,
      },
      include: {
        paragem: true,
        utente: true,
      },
    });

    return NextResponse.json({
      message: 'Transporte adicionado aos seus favoritos',
      missao: missao,
    });
  } catch (error: any) {
    console.error('Error saving mission:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao salvar transporte',
        message: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
