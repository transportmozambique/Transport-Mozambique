import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const proprietario = await prisma.proprietario.findUnique({
      where: {
        id: params.id,
      },
      include: {
        transportes: {
          include: {
            transporte: {
              select: {
                id: true,
                matricula: true,
                modelo: true,
                marca: true,
                via: {
                  select: {
                    nome: true,
                    codigo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proprietario) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(proprietario);
  } catch (error) {
    console.error('Erro ao buscar proprietário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar proprietário' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();

    const { nome, bi, nacionalidade, birthDate, endereco, contacto1, contacto2, tipoProprietario } = body;

    // Validate required fields
    if (!nome || !bi || !nacionalidade || !birthDate || !endereco || !contacto1) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    // Check if proprietario exists
    const existingProprietario = await prisma.proprietario.findUnique({
      where: { id: params.id },
    });

    if (!existingProprietario) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 404 }
      );
    }

    // Check if BI is already used by another proprietario
    if (bi !== existingProprietario.bi) {
      const biExists = await prisma.proprietario.findUnique({
        where: { bi },
      });

      if (biExists) {
        return NextResponse.json(
          { error: 'BI/NUIT já está em uso por outro proprietário' },
          { status: 400 }
        );
      }
    }

    // Update proprietario
    const updatedProprietario = await prisma.proprietario.update({
      where: { id: params.id },
      data: {
        nome,
        bi,
        nacionalidade,
        birthDate: new Date(birthDate),
        endereco,
        contacto1: parseInt(contacto1),
        contacto2: contacto2 ? parseInt(contacto2) : null,
        tipoProprietario: tipoProprietario || 'Indivíduo',
      },
    });

    return NextResponse.json(updatedProprietario);
  } catch (error) {
    console.error('Erro ao atualizar proprietário:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar proprietário' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    // Check if proprietario has transportes
    const proprietario = await prisma.proprietario.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            transportes: true,
          },
        },
      },
    });

    if (!proprietario) {
      return NextResponse.json(
        { error: 'Proprietário não encontrado' },
        { status: 404 }
      );
    }

    if (proprietario._count.transportes > 0 && !force) {
      const transporteText = proprietario._count.transportes === 1 ? 'transporte' : 'transportes';
      return NextResponse.json(
        { 
          error: `Este proprietário tem ${proprietario._count.transportes} ${transporteText} associados.`,
          details: `Este proprietário tem ${proprietario._count.transportes} ${transporteText} associados.`
        },
        { status: 400 }
      );
    }

    // If force=true, remove associations first
    if (force && proprietario._count.transportes > 0) {
      // Remove all transporte associations
      await prisma.transporteProprietario.deleteMany({
        where: { proprietarioId: params.id },
      });
    }

    await prisma.proprietario.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao eliminar proprietário:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar proprietário',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
