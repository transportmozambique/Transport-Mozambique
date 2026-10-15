import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { proprietarioId } = await request.json();

    if (!proprietarioId) {
      return NextResponse.json(
        { error: 'proprietarioId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o proprietário existe
    const proprietario = await prisma.proprietario.findUnique({
      where: { id: proprietarioId }
    });

    if (!proprietario) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o transporte existe
    const transporte = await prisma.transporte.findUnique({
      where: { id: id }
    });

    if (!transporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe a atribuição
    const existingAssignment = await prisma.transporteProprietario.findFirst({
      where: {
        transporteId: id,
        proprietarioId: proprietarioId
      }
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Proprietário já está atribuído a este transporte' },
        { status: 400 }
      );
    }

    // Criar atribuição
    await prisma.transporteProprietario.create({
      data: {
        transporteId: id,
        proprietarioId: proprietarioId,
        codigoTransporte: transporte.codigo,
        idProprietario: proprietarioId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Proprietário atribuído com sucesso'
    });
  } catch (error) {
    console.error('Error assigning proprietario:', error);
    return NextResponse.json(
      { error: 'Erro ao atribuir proprietário' },
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
    const { proprietarioId } = await request.json();

    if (!proprietarioId) {
      return NextResponse.json(
        { error: 'proprietarioId é obrigatório' },
        { status: 400 }
      );
    }

    // Find and delete the assignment
    const assignment = await prisma.transporteProprietario.findFirst({
      where: {
        transporteId: id,
        proprietarioId: proprietarioId
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Atribuição não encontrada' },
        { status: 404 }
      );
    }

    await prisma.transporteProprietario.delete({
      where: { id: assignment.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Proprietário removido com sucesso'
    });
  } catch (error) {
    console.error('Error removing proprietario:', error);
    return NextResponse.json(
      { error: 'Erro ao remover proprietário' },
      { status: 500 }
    );
  }
}
