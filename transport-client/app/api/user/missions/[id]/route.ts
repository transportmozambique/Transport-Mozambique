import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { utenteIdFromRequest, unauthorized } from '@/lib/userSession';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const utenteId = utenteIdFromRequest(request);
    if (!utenteId) return unauthorized();

    if (!id) {
      return NextResponse.json(
        { error: "Mission ID é obrigatório" },
        { status: 400 }
      );
    }

    // O alerta existe?
    const mission = await prisma.mISSION.findUnique({
      where: { id },
    });

    // Só os alertas do próprio passageiro podem ser apagados
    if (!mission || mission.utenteId !== utenteId) {
      return NextResponse.json(
        { error: "Missão não encontrada" },
        { status: 404 }
      );
    }

    // Apagar o alerta
    await prisma.mISSION.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Missão removida com sucesso",
    });
  } catch (error) {
    console.error("Erro ao remover missão:", error);
    return NextResponse.json(
      { error: "Erro ao remover missão" },
      { status: 500 }
    );
  }
}
