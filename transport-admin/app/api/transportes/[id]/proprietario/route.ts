import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Associar proprietário a um transporte
export async function POST(
  request: Request,
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

    // Verificar se o transporte existe
    const transporte = await prisma.transporte.findUnique({
      where: { id },
      select: { id: true, codigo: true },
    });

    if (!transporte) {
      return NextResponse.json(
        { error: 'Transporte não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o proprietário existe
    const proprietario = await prisma.proprietario.findUnique({
      where: { id: proprietarioId },
      select: { id: true },
    });

    if (!proprietario) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe associação
    const existingAssociation = await prisma.transporteProprietario.findFirst({
      where: {
        transporteId: id,
        proprietarioId: proprietarioId,
      },
    });

    if (existingAssociation) {
      return NextResponse.json(
        { error: 'Este transporte já está associado a este proprietário' },
        { status: 400 }
      );
    }

    // Criar associação
    const association = await prisma.transporteProprietario.create({
      data: {
        transporteId: id,
        proprietarioId: proprietarioId,
        codigoTransporte: transporte.codigo,
        idProprietario: proprietario.id,
      },
    });

    return NextResponse.json(association, { status: 201 });
  } catch (error) {
    console.error('Erro ao associar proprietário:', error);
    return NextResponse.json(
      { error: 'Erro ao associar proprietário' },
      { status: 500 }
    );
  }
}

// DELETE - Desassociar proprietário de um transporte
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Buscar todas as associações deste transporte
    const associations = await prisma.transporteProprietario.findMany({
      where: { transporteId: id },
    });

    if (associations.length === 0) {
      return NextResponse.json(
        { error: 'Este transporte não tem proprietário associado' },
        { status: 404 }
      );
    }

    // Deletar todas as associações
    await prisma.transporteProprietario.deleteMany({
      where: { transporteId: id },
    });

    return NextResponse.json({ message: 'Proprietário desassociado com sucesso' });
  } catch (error) {
    console.error('Erro ao desassociar proprietário:', error);
    return NextResponse.json(
      { error: 'Erro ao desassociar proprietário' },
      { status: 500 }
    );
  }
}
