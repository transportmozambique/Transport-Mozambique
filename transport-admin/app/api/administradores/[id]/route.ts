import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    console.log(`[API] A carregar o administrador com o id ${params.id}`);
    
    const administrador = await prisma.administrador.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        nome: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            provincias: true,
            municipios: true,
            vias: true,
            paragens: true,
          },
        },
      },
    });

    if (!administrador) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(administrador, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Erro ao carregar administrador:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar administrador', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const body = await request.json();
    const { nome, email, senha } = body;

    // Montar os dados a actualizar
    const updateData: any = {};
    if (nome) updateData.nome = nome;
    if (email) updateData.email = email;
    
    // Hash da palavra-passe, quando foi dada
    if (senha) {
      const bcrypt = require('bcryptjs');
      updateData.senha = await bcrypt.hash(senha, 10);
    }

    const administrador = await prisma.administrador.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(administrador);
  } catch (error: any) {
    console.error('Erro ao actualizar administrador:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar administrador', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);

    // O administrador existe?
    const administrador = await prisma.administrador.findUnique({
      where: { id: params.id },
    });

    if (!administrador) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
        { status: 404 }
      );
    }

    // Apagar o administrador
    await prisma.administrador.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao apagar administrador:', error);
    return NextResponse.json(
      { error: 'Erro ao eliminar administrador', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
