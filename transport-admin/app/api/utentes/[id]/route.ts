import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const utente = await prisma.utente.findUnique({
      where: {
        id: params.id,
      },
      include: {
        missoes: {
          include: {
            paragem: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                geoLocation: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            missoes: true,
          },
        },
      },
    });

    if (!utente) {
      return NextResponse.json(
        { error: 'Utente não encontrado' },
        { status: 404 }
      );
    }

    // Tirar a palavra-passe da resposta
    const { senha, ...sanitizedUtente } = utente;

    return NextResponse.json(sanitizedUtente);
  } catch (error) {
    console.error('Erro ao buscar utente:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar utente' },
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
    const { nome, email, telefone, mISSION, subscrito, dataSubscricao, geoLocation, senha } = body;

    // Confirmar os campos obrigatórios
    if (!nome || !email || !telefone || !mISSION) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    // O utente existe?
    const existingUtente = await prisma.utente.findUnique({
      where: { id: params.id },
    });

    if (!existingUtente) {
      return NextResponse.json(
        { error: 'Utente não encontrado' },
        { status: 404 }
      );
    }

    // O email já é usado por outro utente?
    if (email !== existingUtente.email) {
      const emailExists = await prisma.utente.findUnique({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email já está em uso por outro utente' },
          { status: 400 }
        );
      }
    }

    // O telefone já é usado por outro utente?
    if (telefone !== existingUtente.telefone) {
      const telefoneExists = await prisma.utente.findUnique({
        where: { telefone },
      });

      if (telefoneExists) {
        return NextResponse.json(
          { error: 'Telefone já está em uso por outro utente' },
          { status: 400 }
        );
      }
    }

    // O MISSION já é usado por outro utente?
    if (mISSION !== existingUtente.mISSION) {
      const missionExists = await prisma.utente.findUnique({
        where: { mISSION },
      });

      if (missionExists) {
        return NextResponse.json(
          { error: 'MISSION já está em uso por outro utente' },
          { status: 400 }
        );
      }
    }

    // Preparar os dados a actualizar
    const updateData: any = {
      nome,
      email,
      telefone,
      mISSION,
      subscrito: subscrito || false,
      dataSubscricao: subscrito && dataSubscricao ? new Date(dataSubscricao) : null,
      geoLocation: geoLocation || null,
    };

    // A palavra-passe só muda quando foi dada (guardada como hash)
    if (senha) {
      updateData.senha = await bcrypt.hash(senha, 10);
    }

    // Guardar o utente
    const updatedUtente = await prisma.utente.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: {
          select: {
            missoes: true,
          },
        },
      },
    });

    // Tirar a palavra-passe da resposta
    const { senha: _, ...sanitizedUtente } = updatedUtente;

    return NextResponse.json(sanitizedUtente);
  } catch (error: any) {
    console.error('Erro ao atualizar utente:', error);
    
    // Erros de valor único do Prisma
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um utente com este ${field}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao atualizar utente' },
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
    
    // O utente tem alertas?
    const utente = await prisma.utente.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            missoes: true,
          },
        },
      },
    });

    if (!utente) {
      return NextResponse.json(
        { error: 'Utente não encontrado' },
        { status: 404 }
      );
    }

    if (utente._count.missoes > 0 && !force) {
      const missaoText = utente._count.missoes === 1 ? 'missão' : 'missões';
      return NextResponse.json(
        { 
          error: `Este utente tem ${utente._count.missoes} ${missaoText} associadas.`,
          details: `Este utente tem ${utente._count.missoes} ${missaoText} associadas.`
        },
        { status: 400 }
      );
    }

    // Com force=true, apagar primeiro todos os alertas
    if (force && utente._count.missoes > 0) {
      await prisma.mISSION.deleteMany({
        where: { utenteId: params.id },
      });
    }

    await prisma.utente.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao eliminar utente:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar utente',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
