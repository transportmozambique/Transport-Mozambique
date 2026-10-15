import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { motoristaId } = await request.json();

    if (!motoristaId) {
      return NextResponse.json(
        { error: 'motoristaId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o motorista está disponível
    const motorista = await prisma.motorista.findUnique({
      where: { id: motoristaId }
    });

    if (!motorista) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }

    if (motorista.transporteId) {
      return NextResponse.json(
        { error: 'Motorista já está atribuído a outro transporte' },
        { status: 400 }
      );
    }

    if (motorista.status !== 'ativo') {
      return NextResponse.json(
        { error: 'Motorista não está ativo' },
        { status: 400 }
      );
    }

    // Verificar se o transporte existe
    const transporte = await prisma.transporte.findUnique({
      where: { id: id },
      include: { motorista: true }
    });

    if (!transporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    if (transporte.motorista) {
      return NextResponse.json(
        { error: 'Transporte já tem um motorista atribuído' },
        { status: 400 }
      );
    }

    // Atribuir motorista ao transporte
    await prisma.motorista.update({
      where: { id: motoristaId },
      data: { transporteId: id }
    });

    return NextResponse.json({
      success: true,
      message: 'Motorista atribuído com sucesso'
    });
  } catch (error) {
    console.error('Error assigning motorista:', error);
    return NextResponse.json(
      { error: 'Erro ao atribuir motorista' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Find the motorista assigned to this transporte
    const motorista = await prisma.motorista.findFirst({
      where: { transporteId: id }
    });

    if (!motorista) {
      return NextResponse.json(
        { error: 'Nenhum motorista atribuído a este transporte' },
        { status: 404 }
      );
    }

    // Remove assignment
    await prisma.motorista.update({
      where: { id: motorista.id },
      data: { transporteId: null as any }
    });

    return NextResponse.json({
      success: true,
      message: 'Motorista removido com sucesso'
    });
  } catch (error) {
    console.error('Error removing motorista:', error);
    return NextResponse.json(
      { error: 'Erro ao remover motorista' },
      { status: 500 }
    );
  }
}
