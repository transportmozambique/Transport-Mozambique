import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { utenteIdFromRequest, unauthorized } from '@/lib/userSession';

export async function POST(request: NextRequest) {
  try {
    // O alerta fica guardado para o passageiro do token de sessão
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

    // Ler o passageiro, para o código mISSION
    const utente = await prisma.utente.findUnique({
      where: { id: utenteId },
    });

    if (!utente) {
      return NextResponse.json(
        { error: 'Utente não encontrado' },
        { status: 404 }
      );
    }

    // Ler a paragem
    const paragem = await prisma.paragem.findUnique({
      where: { id: paragemId },
    });

    if (!paragem) {
      return NextResponse.json(
        { error: 'Paragem não encontrada' },
        { status: 404 }
      );
    }

    // Já existe um alerta deste passageiro para esta paragem?
    const existingMission = await prisma.mISSION.findFirst({
      where: {
        utenteId: utenteId,
        paragemId: paragemId,
      },
    });

    if (existingMission) {
      // Pedir outra vez recomeça o alerta: os alertas com mais de 24 h ou já respondidos por um SMS
      // de chegada deixam de ser verificados
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

    // Criar o alerta
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
    console.error('Erro ao guardar alerta:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao salvar transporte',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
