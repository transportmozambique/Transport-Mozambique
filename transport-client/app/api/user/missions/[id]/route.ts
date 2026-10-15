import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Mission ID é obrigatório" },
        { status: 400 }
      );
    }

    // Check if mission exists
    const mission = await prisma.mISSION.findUnique({
      where: { id },
    });

    if (!mission) {
      return NextResponse.json(
        { error: "Missão não encontrada" },
        { status: 404 }
      );
    }

    // Delete the mission
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
