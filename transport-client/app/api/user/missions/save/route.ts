import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { utenteIdFromRequest, unauthorized } from '@/lib/userSession';

export async function POST(request: NextRequest) {
  try {
    // The alert is saved for the passenger of the session token
    const utenteId = utenteIdFromRequest(request);
    if (!utenteId) return unauthorized();
    const body = await request.json();
    const { transporteId, paragemId } = body;

    if (!transporteId || !paragemId) {
      return NextResponse.json(
        { error: 'transporteId e paragemId são obrigatórios' },
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
      // Asking again starts the alert over: alerts older than 24 h or already answered by an
      // arrival SMS are not checked any more
      const missao = await prisma.mISSION.update({
        where: { id: existingMission.id },
        data: { createdAt: new Date(), notificadoEm: null },
        include: { paragem: true },
      });
      return NextResponse.json({
        message: 'Transporte já está nos seus favoritos',
        missao,
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
  }
}
